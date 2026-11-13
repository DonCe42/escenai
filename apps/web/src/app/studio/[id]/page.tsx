import { notFound } from 'next/navigation';
import { groupWordChunks, styleReferencesOf } from '@escenai/core';
import type { WordTiming } from '@escenai/core';
import {
  StudioShell,
  type StudioAsset,
  type StudioStyleReference,
  type VoiceMeta,
} from '@/components/studio/StudioShell';
import { createContainer } from '@/lib/container';
import { listJobs } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

/**
 * Estudio: la pantalla donde se trabaja el proyecto. Reemplaza al formulario
 * de /new como destino principal. Lee el plan activo y los assets del
 * repositorio, y deja que el cliente edite escenas, genere por escena y guarde.
 */
export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const container = createContainer();
  const project = await container.projects.find(id);
  if (project === null) notFound();

  const active = project.versions.find((version) => version.id === project.activeVersionId);
  const current = active ?? project.versions[project.versions.length - 1];
  if (current === undefined) notFound();

  // Los assets se guardan como clave de almacenamiento; la URL se resuelve aquí
  // para que el cliente no tenga que conocer el adaptador.
  const assets: StudioAsset[] = await Promise.all(
    (project.assets ?? []).map(async (asset) => ({
      sceneId: asset.sceneId,
      kind: asset.kind,
      status: asset.status,
      errorCode: asset.errorCode,
      url:
        asset.status === 'ready' && asset.ref !== null
          ? await container.storage.signedUrl(
              { key: asset.ref, mimeType: asset.mimeType ?? 'application/octet-stream', bytes: 0 },
              3600,
            )
          : null,
    })),
  );

  // Duración y palabras de cada voz: el preview necesita el mismo timing que el
  // render final, y el karaoke necesita las palabras ya agrupadas.
  const voiceMeta: Record<string, VoiceMeta> = {};
  for (const asset of project.assets ?? []) {
    if (asset.kind !== 'voice' || asset.status !== 'ready' || asset.ref === null) continue;
    const meta = await container.storage
      .read(asset.ref.replace(/\.mp3$/i, '.json'))
      .then((bytes) => JSON.parse(new TextDecoder().decode(bytes)) as {
        durationMs: number;
        words: readonly WordTiming[];
      })
      .catch(() => null);
    if (meta !== null) {
      voiceMeta[asset.sceneId] = {
        durationMs: meta.durationMs,
        words: groupWordChunks(meta.words),
      };
    }
  }

  // Tablero de estilo: mismas URLs que usa la generación de imágenes.
  const styleReferences: StudioStyleReference[] = await Promise.all(
    styleReferencesOf(project.styleReferences).map(async (reference) => ({
      id: reference.id,
      kind: reference.kind,
      label: reference.label,
      url: await container.storage.signedUrl(
        { key: reference.ref, mimeType: reference.mimeType, bytes: 0 },
        3600,
      ),
    })),
  );

  // Si hay un render en curso (o se recargó a mitad), el estudio retoma el sondeo.
  const jobs = await listJobs(project.id);
  const running = jobs.find((job) => job.status === 'running');
  const activeJob = running === undefined ? null : { id: running.id, progress: running.progress };
  // El último render terminado se ofrece al abrir: el MP4 sigue en disco aunque
  // la pestaña se haya cerrado.
  const lastRender = jobs.find((job) => job.status === 'done' && job.url !== null);

  return (
    <StudioShell
      projectId={project.id}
      projectName={project.nombre}
      assets={assets}
      styleReferences={styleReferences}
      voiceMeta={voiceMeta}
      activeJob={activeJob}
      initialRenderUrl={lastRender?.url ?? null}
      plan={current.plan}
      version={current.version}
      versionCount={project.versions.length}
      updatedAt={project.updatedAt}
    />
  );
}
