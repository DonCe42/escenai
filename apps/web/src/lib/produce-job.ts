import { producePlan } from '@escenai/core';
import type { ProduceStep } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';
import { updateJob } from '@/lib/jobs';
import { enqueueRender } from '@/lib/render-job';

/**
 * Runner del lote de assets («hacer video»).
 *
 * Corre dentro del proceso de Next, no en un hijo: necesita el composition root
 * (keys descifradas, storage, repositorio) y el trabajo es de minutos, no de una
 * hora como el render. El estado va a disco en cada paso, así que un F5 se
 * reengancha al sondeo y no pierde lo hecho.
 */

function stepLabel(step: ProduceStep): string {
  const what = step.kind === 'image' ? 'imagen' : 'voz';
  return `${what} ${step.index}/${step.total} · escena ${step.sceneId}`;
}

export async function runProduceJob(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly total: number;
}): Promise<void> {
  const container = createContainer();
  const workspace = await getWorkspace();

  try {
    const kind = await container.detectImageProvider(workspace.id);
    if (kind === null) {
      await updateJob(input.jobId, {
        status: 'error',
        message: 'Falta la API key de imagen. Se configura en Ajustes.',
      });
      return;
    }

    const result = await producePlan(
      {
        projects: container.projects,
        storage: container.storage,
        clock: container.clock,
        imageModel: container.imageModel(workspace.id, kind),
        speech: container.speechModel(workspace.id),
        workspaceId: workspace.id,
      },
      {
        projectId: input.projectId,
        onStep: async (step) => {
          const progress = input.total === 0 ? 0 : step.index / input.total;
          if (step.status === 'start') {
            await updateJob(input.jobId, {
              stage: `generando ${stepLabel(step)}`,
              progress: Math.max(0, (step.index - 1) / input.total),
            });
            return;
          }
          await updateJob(input.jobId, {
            stage: `${stepLabel(step)} ${step.status === 'ready' ? 'lista' : 'falló'}`,
            progress,
            done: step.index,
            total: input.total,
          });
        },
      },
    );

    if (!result.ok) {
      await updateJob(input.jobId, {
        status: 'error',
        message:
          result.error === 'nothing_to_do'
            ? 'No falta nada por generar.'
            : `No se pudo generar: ${result.error}.`,
      });
      return;
    }

    const { generated, failures } = result.value;
    if (generated === 0 && failures.length > 0) {
      await updateJob(input.jobId, {
        status: 'error',
        message: `Ninguna escena salió: ${failures[0]?.message ?? failures[0]?.code ?? 'error del proveedor'}`,
        done: input.total,
        total: input.total,
      });
      return;
    }

    // Parcial: lo generado se queda guardado y los errores se ven por escena en
    // el inspector, así que el trabajo terminó bien aunque falten piezas.
    //
    // Si no falló nada, el render se encadena aquí y no en el navegador: cerrar
    // la pestaña después de «hacer video» no debe dejar el video a medias.
    let followUp: string | null = null;
    if (failures.length === 0) {
      const render = await enqueueRender({ projectId: input.projectId });
      if (render.ok) followUp = render.jobId;
    }

    await updateJob(input.jobId, {
      status: 'done',
      progress: 1,
      done: input.total,
      total: input.total,
      stage: failures.length === 0 ? null : `${failures.length} sin generar`,
      followUpJobId: followUp,
      message:
        failures.length === 0
          ? null
          : `Faltan ${failures.length} pieza(s): ${failures
              .map((failure) => `${failure.sceneId}/${failure.kind}`)
              .join(', ')}`,
    });
  } catch (error) {
    await updateJob(input.jobId, {
      status: 'error',
      message: error instanceof Error ? error.message.slice(0, 300) : 'UNKNOWN',
    }).catch(() => undefined);
  }
}
