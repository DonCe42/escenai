import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Trabajos en disco.
 *
 * Un render tarda minutos: bloquear la petición HTTP hacía que un F5, un proxy
 * corto o el cierre del navegador dejaran el trabajo huérfano y sin URL. El
 * trabajo vive en un JSON y el proceso hijo escribe su propio log, así que la
 * interfaz puede preguntar por su estado cuando quiera (o después de recargar).
 */

export type JobStatus = 'running' | 'done' | 'error';

export interface JobRecord {
  readonly id: string;
  readonly kind: 'render';
  readonly projectId: string;
  readonly status: JobStatus;
  readonly progress: number;
  readonly message: string | null;
  readonly url: string | null;
  /** Ruta del MP4 que escribe el worker. */
  readonly outputPath: string;
  readonly logPath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProgressInfo {
  readonly progress: number | null;
  readonly error: string | null;
  readonly finished: boolean;
}

function jobsDir(): string {
  return join(process.cwd(), '.data', 'jobs');
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '');
}

export function jobLogPath(id: string): string {
  return join(jobsDir(), `${safeId(id)}.log`);
}

export function jobOutputPath(id: string, extension = 'mp4'): string {
  return join(jobsDir(), `${safeId(id)}.${extension}`);
}

export function newJobId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function writeJob(job: JobRecord): Promise<void> {
  await mkdir(jobsDir(), { recursive: true });
  await writeFile(
    join(jobsDir(), `${safeId(job.id)}.json`),
    JSON.stringify({ ...job, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

export async function readJob(id: string): Promise<JobRecord | null> {
  try {
    const raw = await readFile(join(jobsDir(), `${safeId(id)}.json`), 'utf8');
    return JSON.parse(raw) as JobRecord;
  } catch {
    return null;
  }
}

export async function listJobs(projectId?: string): Promise<readonly JobRecord[]> {
  const files = await readdir(jobsDir()).catch(() => [] as string[]);
  const jobs: JobRecord[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const job = await readJob(file.replace(/\.json$/, ''));
    if (job === null) continue;
    if (projectId !== undefined && job.projectId !== projectId) continue;
    jobs.push(job);
  }
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Lee el log del render y saca el último porcentaje.
 * `render.mjs` imprime `render 20%` en cada hito; el error, si lo hay, viene con
 * `Error:` o `Command failed`.
 */
export function parseProgress(log: string): ProgressInfo {
  const percents = [...log.matchAll(/render\s+(\d{1,3})%/g)].map((match) => Number(match[1]));
  const progress = percents.length === 0 ? null : Math.min(100, Math.max(...percents)) / 100;

  const errorLine = log
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('Error:') || line.includes('Command failed'));

  return {
    progress,
    error: errorLine ?? null,
    finished: log.includes('listo en ') || log.includes('exit=0'),
  };
}

/**
 * Retención: los trabajos terminados viejos no sirven para nada y crecen sin
 * límite (un JSON y un log por render). Los que están en curso nunca se tocan.
 */
export async function pruneJobs(maxAgeDays = 7): Promise<number> {
  const files = await readdir(jobsDir()).catch(() => [] as string[]);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace(/\.json$/, '');
    const job = await readJob(id);
    if (job === null || job.status === 'running') continue;
    if (Date.parse(job.updatedAt) > cutoff) continue;
    await rm(join(jobsDir(), file), { force: true });
    await rm(jobLogPath(id), { force: true });
    removed += 1;
  }
  return removed;
}
