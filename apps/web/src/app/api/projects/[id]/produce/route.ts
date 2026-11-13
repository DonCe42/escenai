import { NextResponse } from 'next/server';
import { pendingAssets, validateVideoPlan } from '@escenai/core';
import type { VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';
import { listJobs, newJobId, writeJob } from '@/lib/jobs';
import type { JobRecord } from '@/lib/jobs';
import { runProduceJob } from '@/lib/produce-job';
import { PRICES } from '@/lib/prices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * «Hacer video»: encola la generación de todo lo que falta (imagen y voz por escena).
 *
 * Responde 202 y el trabajo corre detrás: siete imágenes y siete voces son varios
 * minutos, y una petición HTTP de ese largo muere con el primer proxy que corte.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  const project = await container.projects.find(id);
  if (project === null) return NextResponse.json({ code: 'PROJECT_NOT_FOUND' }, { status: 404 });

  const active = project.versions.find((version) => version.id === project.activeVersionId);
  const plan: VideoPlan | undefined = active?.plan;
  if (plan === undefined) return NextResponse.json({ code: 'NO_ACTIVE_PLAN' }, { status: 409 });

  const validation = validateVideoPlan(plan);
  if (!validation.ok) {
    return NextResponse.json({ code: 'INVALID_PLAN', issues: validation.issues }, { status: 422 });
  }

  const pending = pendingAssets(plan, project.assets);
  if (pending.total === 0) {
    return NextResponse.json({ code: 'NOTHING_TO_DO', pending }, { status: 409 });
  }

  // Un lote a la vez por proyecto: dos a la vez gastan el doble y se pisan los assets.
  const running = (await listJobs(id)).find(
    (job) => job.kind === 'produce' && job.status === 'running',
  );
  if (running !== undefined) {
    return NextResponse.json({ code: 'JOB_RUNNING', jobId: running.id }, { status: 409 });
  }

  const workspace = await getWorkspace();
  const imageProvider = await container.detectImageProvider(workspace.id);
  if (imageProvider === null) {
    return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
  }

  const images = pending.images.length * PRICES.imagePerUnit;
  const characters = plan.escenas
    .filter((scene) => pending.voices.includes(scene.id))
    .reduce((sum, scene) => sum + scene.narracion.length, 0);
  const speech = (characters / 1000) * PRICES.speechPer1kChars;

  const jobId = newJobId();
  const now = new Date().toISOString();
  const job: JobRecord = {
    id: jobId,
    kind: 'produce',
    projectId: id,
    status: 'running',
    progress: 0,
    message: null,
    url: null,
    stage: 'preparando',
    done: 0,
    total: pending.total,
    outputPath: '',
    logPath: '',
    createdAt: now,
    updatedAt: now,
  };
  await writeJob(job);

  // Sin await: la respuesta sale ya y el estado se sigue por GET /api/jobs/:id.
  void runProduceJob({ projectId: id, jobId, total: pending.total });

  return NextResponse.json(
    {
      jobId,
      status: 'running',
      pending: { images: pending.images.length, voices: pending.voices.length, total: pending.total },
      estimate: {
        images: Math.round(images * 10000) / 10000,
        speech: Math.round(speech * 10000) / 10000,
        total: Math.round((images + speech) * 10000) / 10000,
      },
    },
    { status: 202 },
  );
}
