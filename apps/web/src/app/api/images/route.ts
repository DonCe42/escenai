import { NextResponse } from 'next/server';
import { MissingSecretError } from '@escenai/adapters';
import { ProviderNotConfiguredError, validateVideoPlan } from '@escenai/core';
import type { Aspect, VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Vertex limita imágenes por minuto. En paralelo se desborda la cuota; secuencial
// con una pausa corta es más lento pero termina siempre.
const CONCURRENCY = 1;

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}
const PAUSE_BETWEEN_MS = 15000;

async function inBatches<T, R>(
  items: readonly T[],
  size: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size);
    results.push(...(await Promise.all(batch.map(worker))));
    if (index + size < items.length) {
      await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_MS));
    }
  }
  return results;
}

export async function POST(request: Request): Promise<Response> {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  let body: { plan?: unknown; provider?: unknown };
  try {
    body = (await request.json()) as { plan?: unknown; provider?: unknown };
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const validation = validateVideoPlan(body.plan);
  if (!validation.ok) {
    return NextResponse.json({ code: 'INVALID_PLAN', issues: validation.issues }, { status: 422 });
  }
  const plan = body.plan as VideoPlan;

  const workspace = await getWorkspace();
  const detected = await container.detectImageProvider(workspace.id);
  if (detected === null) {
    return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
  }
  const kind =
    body.provider === 'vertex' || body.provider === 'minimax' ? body.provider : detected;

  const imageModel = container.imageModel(workspace.id, kind);
  const storage = container.storage;
  const batchId = Date.now().toString(36);

  try {
    const first = plan.escenas[0];
    if (first === undefined) {
      return NextResponse.json({ code: 'INVALID_PLAN' }, { status: 422 });
    }

    // La primera escena fija la paleta. Las demás la reciben como imagen de referencia:
    // sin este ancla, cada escena elige su propia paleta y el video parece un collage.
    const anchor = await imageModel.generate({
      prompt: `${first.promptImagen}. Estilo: ${plan.styleToken}`,
      aspect: '9:16' as Aspect,
    });
    const anchorRef = await storage.put(
      `images/${workspace.id}/${batchId}/${first.id}.png`,
      anchor.bytes,
      anchor.mimeType,
    );

    const assets: { sceneId: string; url: string }[] = [
      { sceneId: first.id, url: await storage.signedUrl(anchorRef, 3600) },
    ];

    const rest = plan.escenas.slice(1);
    const generated = await inBatches(rest, CONCURRENCY, async (scene) => {
      const image = await imageModel.generate({
        prompt: `Mantén exactamente la paleta, el trazo y el estilo de la imagen de referencia. Nueva escena: ${scene.promptImagen}`,
        aspect: '9:16' as Aspect,
        referenceImage: anchor.bytes,
      });
      const ref = await storage.put(
        `images/${workspace.id}/${batchId}/${scene.id}.${extensionFor(image.mimeType)}`,
        image.bytes,
        image.mimeType,
      );
      return { sceneId: scene.id, url: await storage.signedUrl(ref, 3600) };
    });

    return NextResponse.json({ batchId, assets: [...assets, ...generated] });
  } catch (error) {
    if (error instanceof MissingSecretError || error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
    }
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ code: 'IMAGE_ERROR', message }, { status: 502 });
  }
}
