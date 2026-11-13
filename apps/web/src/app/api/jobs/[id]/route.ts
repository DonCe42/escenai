import { readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { parseProgress, readJob, writeJob } from '@/lib/jobs';
import type { JobRecord } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Clave de almacenamiento a partir de la ruta del MP4 dentro de `.data/assets`. */
function assetUrl(outputPath: string): string | null {
  const marker = '/.data/assets/';
  const index = outputPath.indexOf(marker);
  if (index === -1) return null;
  const key = outputPath.slice(index + marker.length).split('\\').join('/');
  return `/api/assets/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Estado de un trabajo. Se calcula leyendo el log del render y el MP4, no de
 * memoria del proceso: sobrevive a recargas e incluso a reiniciar Next.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const job = await readJob(id);
  if (job === null) return NextResponse.json({ code: 'JOB_NOT_FOUND' }, { status: 404 });
  if (job.status !== 'running') return NextResponse.json(job);

  const log = await readFile(job.logPath, 'utf8').catch(() => '');
  const info = parseProgress(log);
  const size = await stat(job.outputPath).then((s) => s.size).catch(() => 0);
  const hasOutput = size > 1000;

  let next: JobRecord = { ...job, progress: info.progress ?? job.progress };

  if (info.error !== null) {
    next = { ...next, status: 'error', message: info.error };
  } else if (hasOutput && (info.finished || info.progress === 1)) {
    next = { ...next, status: 'done', progress: 1, url: assetUrl(job.outputPath) };
  } else if (info.finished && !hasOutput) {
    // El proceso terminó sin escribir el MP4: no se puede decir «listo».
    next = { ...next, status: 'error', message: 'El render terminó sin escribir el video.' };
  }

  if (next.status !== job.status || next.progress !== job.progress) {
    await writeJob(next);
  }

  // Los intermedios del render (imágenes y MP3 copiados a `public/renders`) solo
  // hacen falta mientras dura: el MP4 final vive en `.data/assets`. Se borran al
  // detectar el final, una sola vez, porque el estado ya no es 'running'.
  if (next.status !== 'running') {
    const scratch = join(process.cwd(), '..', '..', 'apps', 'worker', 'public', 'renders', id.replace(/[^a-zA-Z0-9-]/g, ''));
    await rm(scratch, { recursive: true, force: true }).catch(() => undefined);
  }
  return NextResponse.json(next);
}
