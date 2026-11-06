import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { validateVideoPlan } from '@escenai/core';
import type { VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const run = promisify(execFile);

/** Sube desde apps/web hasta el directorio del monorepo. */
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

export async function POST(request: Request): Promise<Response> {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  let body: { plan?: unknown; imageBatch?: unknown; audioBatch?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const validation = validateVideoPlan(body.plan);
  if (!validation.ok) {
    return NextResponse.json({ code: 'INVALID_PLAN', issues: validation.issues }, { status: 422 });
  }
  if (typeof body.imageBatch !== 'string' || typeof body.audioBatch !== 'string') {
    return NextResponse.json({ code: 'MISSING_BATCHES' }, { status: 400 });
  }

  const plan = body.plan as VideoPlan;
  const workspace = await getWorkspace();
  const webData = join(process.cwd(), '.data', 'assets');
  const imageDir = join(webData, 'images', workspace.id, body.imageBatch);
  const audioDir = join(webData, 'audio', workspace.id, body.audioBatch);

  const renderId = Date.now().toString(36);
  const root = repoRoot();
  const workerDir = join(root, 'apps', 'worker');
  const publicDir = join(workerDir, 'public', 'renders', renderId);

  try {
    await mkdir(publicDir, { recursive: true });

    // Copiar assets al public del worker: Remotion los sirve desde ahí.
    for (const file of await readdir(imageDir)) {
      await cp(join(imageDir, file), join(publicDir, file));
    }
    for (const file of await readdir(audioDir)) {
      await cp(join(audioDir, file), join(publicDir, file));
    }

    const imageExtension = (await readdir(imageDir)).find((file) => file.endsWith('.png')) ? 'png' : 'jpg';

    const scenes = [];
    for (const scene of plan.escenas) {
      const meta = JSON.parse(await readFile(join(audioDir, `${scene.id}.json`), 'utf8')) as SceneMeta;
      scenes.push({
        id: scene.id,
        textoPantalla: scene.textoPantalla,
        imageSrc: `renders/${renderId}/${scene.id}.${imageExtension}`,
        audioSrc: `renders/${renderId}/${scene.id}.mp3`,
        durationMs: meta.durationMs + 400,
        words: meta.words,
        motion: scene.movimiento,
      });
    }

    const props = {
      titulo: plan.titulo,
      colorFondo: '#0b0d10',
      colorTexto: '#f5f7fa',
      colorAcento: '#6ee7a8',
      scenes,
    };

    const propsPath = join(publicDir, 'props.json');
    const outputPath = join(publicDir, 'video.mp4');
    await writeFile(propsPath, JSON.stringify(props), 'utf8');

    await run('node', ['scripts/render.mjs', propsPath, outputPath], {
      cwd: workerDir,
      timeout: 280_000,
      env: {
        ...process.env,
        ...(process.env.REMOTION_BROWSER ? { REMOTION_BROWSER: process.env.REMOTION_BROWSER } : {}),
      },
    });

    const bytes = await readFile(outputPath);
    const ref = await container.storage.put(
      `renders/${workspace.id}/${renderId}.mp4`,
      new Uint8Array(bytes),
      'video/mp4',
    );

    return NextResponse.json({ renderId, url: await container.storage.signedUrl(ref, 3600) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ code: 'RENDER_ERROR', message: message.slice(0, 400) }, { status: 502 });
  }
}
