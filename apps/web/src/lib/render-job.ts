import { copyFile, mkdir, open, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { findSceneAsset, groupWordChunks, validateVideoPlan } from '@escenai/core';
import type { Aspect, VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';
import { jobLogPath, newJobId, pruneJobs, writeJob } from '@/lib/jobs';
import type { JobRecord } from '@/lib/jobs';
import { musicUrl } from '@/lib/music';

/**
 * Encolado del render.
 *
 * Vive fuera de la ruta porque hay dos caminos que lo necesitan: el botón
 * «renderizar» y el final del lote de assets («hacer video»). Encadenar el render
 * en el servidor es lo que hace que cerrar la pestaña no deje el video a medias.
 */

export type EnqueueRenderResult =
  | { readonly ok: true; readonly jobId: string; readonly formato: Aspect }
  | {
      readonly ok: false;
      readonly code:
        | 'PROJECT_NOT_FOUND'
        | 'NO_ACTIVE_PLAN'
        | 'INVALID_PLAN'
        | 'ASSETS_MISSING'
        | 'RENDER_ERROR';
      readonly scenes?: readonly string[];
      readonly issues?: readonly unknown[];
      readonly message?: string;
    };

function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('No se encontró la raíz del monorepo.');
}

interface SceneMeta {
  readonly durationMs: number;
  readonly words: readonly { readonly word: string; readonly startMs: number; readonly endMs: number }[];
}

function extensionFor(mimeType: string | null): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

export async function enqueueRender(input: {
  readonly projectId: string;
  readonly formato?: unknown;
}): Promise<EnqueueRenderResult> {
  const container = createContainer();
  if (container.secrets === null) {
    return { ok: false, code: 'RENDER_ERROR', message: 'Falta MASTER_KEY.' };
  }

  const project = await container.projects.find(input.projectId);
  if (project === null) return { ok: false, code: 'PROJECT_NOT_FOUND' };

  // Retención barata: cualquier intento de render barre los trabajos viejos.
  await pruneJobs().catch(() => 0);

  const active = project.versions.find((version) => version.id === project.activeVersionId);
  const plan: VideoPlan | undefined = active?.plan;
  if (plan === undefined) return { ok: false, code: 'NO_ACTIVE_PLAN' };

  const validation = validateVideoPlan(plan);
  if (!validation.ok) {
    return { ok: false, code: 'INVALID_PLAN', issues: validation.issues };
  }

  const faltantes = plan.escenas
    .filter((scene) => {
      const image = findSceneAsset(project.assets, scene.id, 'image');
      const voice = findSceneAsset(project.assets, scene.id, 'voice');
      return image?.status !== 'ready' || voice?.status !== 'ready';
    })
    .map((scene) => scene.id);

  if (faltantes.length > 0) {
    return { ok: false, code: 'ASSETS_MISSING', scenes: faltantes };
  }

  const workspace = await getWorkspace();
  const storage = container.storage;
  const jobId = newJobId();
  const workerDir = join(repoRoot(), 'apps', 'worker');
  const publicDir = join(workerDir, 'public', 'renders', jobId);
  const outputDir = join(process.cwd(), '.data', 'assets', 'renders', workspace.id);
  // El MP4 se escribe directamente donde lo sirve `/api/assets`: sin copia extra.
  const outputPath = join(outputDir, `${jobId}.mp4`);
  const logPath = jobLogPath(jobId);

  try {
    await mkdir(publicDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await mkdir(join(process.cwd(), '.data', 'jobs'), { recursive: true });

    const scenes = [];
    for (const scene of plan.escenas) {
      const image = findSceneAsset(project.assets, scene.id, 'image');
      const voice = findSceneAsset(project.assets, scene.id, 'voice');
      if (image?.ref == null || voice?.ref == null) {
        return { ok: false, code: 'ASSETS_MISSING', scenes: [scene.id] };
      }

      const imageName = `${scene.id}.${extensionFor(image.mimeType)}`;
      await writeFile(join(publicDir, imageName), await storage.read(image.ref));

      const audioName = `${scene.id}.mp3`;
      await writeFile(join(publicDir, audioName), await storage.read(voice.ref));

      // Los timestamps viven junto al MP3; si no están, se compone sin karaoke.
      const metaKey = voice.ref.replace(/\.mp3$/i, '.json');
      const meta = await storage
        .read(metaKey)
        .then((bytes) => JSON.parse(new TextDecoder().decode(bytes)) as SceneMeta)
        .catch(() => null);

      scenes.push({
        id: scene.id,
        textoPantalla: scene.textoPantalla,
        imageSrc: `renders/${jobId}/${imageName}`,
        audioSrc: `renders/${jobId}/${audioName}`,
        durationMs: (meta?.durationMs ?? scene.duracionEstimadaS * 1000) + 400,
        // Los audios viejos traen trozos ("ca","f","é"): se agrupan o el karaoke
        // muestra letras sueltas en el video.
        words: meta?.words === undefined ? [] : groupWordChunks(meta.words),
        motion: scene.movimiento,
      });
    }

    const formato: Aspect =
      input.formato === '1:1' || input.formato === '16:9' || input.formato === '9:16'
        ? (input.formato as Aspect)
        : '9:16';

    // Remotion solo resuelve `staticFile` dentro de apps/worker/public: la pista se
    // copia al directorio del trabajo, no se enlaza por URL.
    let musicSrc: string | undefined;
    const trackUrl = musicUrl(plan.musicTrack);
    if (trackUrl !== null) {
      await copyFile(join(process.cwd(), 'public', trackUrl), join(publicDir, 'music.mp3'));
      musicSrc = `renders/${jobId}/music.mp3`;
    }

    const props = {
      titulo: plan.titulo,
      musicSrc,
      formato,
      colorFondo: '#0a0908',
      colorTexto: '#f4efe7',
      colorAcento: '#e2542a',
      captionStyle: plan.captionStyle ?? 'caja',
      scenes,
    };

    const propsPath = join(publicDir, 'props.json');
    await writeFile(propsPath, JSON.stringify(props), 'utf8');

    // Log a archivo, no a pipe: si el servidor se reinicia, el hijo sigue vivo y
    // el progreso se puede leer después.
    const logHandle = await open(logPath, 'a');
    const child = spawn('node', ['scripts/render.mjs', propsPath, outputPath], {
      cwd: workerDir,
      detached: true,
      stdio: ['ignore', logHandle.fd, logHandle.fd],
      env: {
        ...process.env,
        ...(process.env.REMOTION_BROWSER ? { REMOTION_BROWSER: process.env.REMOTION_BROWSER } : {}),
      },
    });
    child.unref();
    await logHandle.close();

    const now = new Date().toISOString();
    const job: JobRecord = {
      id: jobId,
      kind: 'render',
      projectId: input.projectId,
      status: 'running',
      progress: 0,
      message: null,
      url: null,
      outputPath,
      logPath,
      createdAt: now,
      updatedAt: now,
    };
    await writeJob(job);

    return { ok: true, jobId, formato };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return { ok: false, code: 'RENDER_ERROR', message: message.slice(0, 400) };
  }
}
