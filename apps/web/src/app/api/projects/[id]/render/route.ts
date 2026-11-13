import { copyFile, mkdir, open, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { NextResponse } from 'next/server';
import { findSceneAsset, groupWordChunks, validateVideoPlan } from '@escenai/core';
import type { Aspect, VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';
import { jobLogPath, newJobId, pruneJobs, writeJob } from '@/lib/jobs';
import { musicUrl } from '@/lib/music';
import type { JobRecord } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

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
  readonly words: readonly { word: string; startMs: number; endMs: number }[];
}

function extensionFor(mimeType: string | null): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

/**
 * Encola el render de un proyecto y responde 202 con el id del trabajo.
 *
 * El proceso de Remotion corre desacoplado (`detached`, log a archivo): ni un F5
 * ni un corte del navegador lo matan. `GET /api/jobs/:id` devuelve el estado
 * cuando se pregunte, incluso después de recargar la página.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  let body: { formato?: unknown } = {};
  try {
    body = (await request.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }

  const project = await container.projects.find(id);
  if (project === null) return NextResponse.json({ code: 'PROJECT_NOT_FOUND' }, { status: 404 });

  // Retención barata: cualquier intento de render barre los trabajos viejos, aunque
  // el render acabe rechazado por validación o por assets sin generar.
  await pruneJobs().catch(() => 0);

  const active = project.versions.find((version) => version.id === project.activeVersionId);
  const plan: VideoPlan | undefined = active?.plan;
  if (plan === undefined) return NextResponse.json({ code: 'NO_ACTIVE_PLAN' }, { status: 409 });

  const validation = validateVideoPlan(plan);
  if (!validation.ok) {
    return NextResponse.json({ code: 'INVALID_PLAN', issues: validation.issues }, { status: 422 });
  }

  // Sin imagen y voz en todas las escenas no hay video: se dice cuáles faltan en vez
  // de renderizar huecos y devolver un MP4 a medias.
  const faltantes = plan.escenas
    .filter((scene) => {
      const image = findSceneAsset(project.assets, scene.id, 'image');
      const voice = findSceneAsset(project.assets, scene.id, 'voice');
      return image?.status !== 'ready' || voice?.status !== 'ready';
    })
    .map((scene) => scene.id);

  if (faltantes.length > 0) {
    return NextResponse.json({ code: 'ASSETS_MISSING', scenes: faltantes }, { status: 409 });
  }

  const workspace = await getWorkspace();
  const storage = container.storage;
  const jobId = newJobId();
  const root = repoRoot();
  const workerDir = join(root, 'apps', 'worker');
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
        return NextResponse.json({ code: 'ASSETS_MISSING', scenes: [scene.id] }, { status: 409 });
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

    const formato =
      body.formato === '1:1' || body.formato === '16:9' || body.formato === '9:16'
        ? (body.formato as Aspect)
        : '9:16';

    // Remotion solo resuelve `staticFile` dentro de apps/worker/public: la pista se
    // copia al directorio del trabajo, no se enlaza por URL.
    let musicSrc: string | undefined;
    const trackUrl = musicUrl(plan.musicTrack);
    if (trackUrl !== null) {
      const trackPath = join(process.cwd(), 'public', trackUrl);
      await copyFile(trackPath, join(publicDir, 'music.mp3'));
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
      projectId: id,
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

    return NextResponse.json({ jobId, status: 'running', formato }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ code: 'RENDER_ERROR', message: message.slice(0, 400) }, { status: 502 });
  }
}
