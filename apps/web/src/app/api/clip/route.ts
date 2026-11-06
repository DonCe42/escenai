import { NextResponse } from 'next/server';
import { MissingSecretError } from '@escenai/adapters';
import { ProviderNotConfiguredError, estimateClipCost } from '@escenai/core';
import type { Aspect } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 240_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Un clip generativo de 5 s para una escena. Es la pieza más cara del producto:
 * se usa solo donde hace falta movimiento real, nunca para todo el video.
 */
export async function POST(request: Request): Promise<Response> {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  let body: { prompt?: unknown; aspect?: unknown; durationS?: unknown; firstFrameUrl?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  if (typeof body.prompt !== 'string' || body.prompt.trim().length < 10) {
    return NextResponse.json({ code: 'INVALID_PROMPT' }, { status: 400 });
  }

  const aspect: Aspect = body.aspect === '1:1' || body.aspect === '16:9' ? body.aspect : '9:16';
  const durationS = typeof body.durationS === 'number' ? body.durationS : 5;

  const workspace = await getWorkspace();
  const clip = container.videoClip(workspace.id);

  try {
    let firstFrame: Uint8Array | undefined;
    if (typeof body.firstFrameUrl === 'string' && body.firstFrameUrl.startsWith('/api/assets/')) {
      const response = await fetch(new URL(body.firstFrameUrl, request.url));
      if (response.ok) firstFrame = new Uint8Array(await response.arrayBuffer());
    }

    const { providerJobId } = await clip.submit({
      prompt: body.prompt.trim(),
      aspect,
      durationS,
      ...(firstFrame === undefined ? {} : { firstFrame }),
    });

    const startedAt = Date.now();
    while (Date.now() - startedAt < MAX_WAIT_MS) {
      await sleep(POLL_INTERVAL_MS);
      const job = await clip.poll(providerJobId);

      if (job.state === 'succeeded' && job.value !== undefined) {
        const ref = await container.storage.put(
          `clips/${workspace.id}/${providerJobId}.mp4`,
          job.value.bytes,
          job.value.mimeType,
        );
        return NextResponse.json({
          providerJobId,
          url: await container.storage.signedUrl(ref, 3600),
          estimatedCostUsd: estimateClipCost('MiniMax-H3-Lite', '768P', durationS),
        });
      }
      if (job.state === 'failed') {
        return NextResponse.json(
          { code: 'CLIP_FAILED', message: job.error ?? 'sin detalle' },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ code: 'CLIP_TIMEOUT', providerJobId }, { status: 504 });
  } catch (error) {
    if (error instanceof MissingSecretError || error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'minimax' }, { status: 412 });
    }
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ code: 'CLIP_ERROR', message }, { status: 502 });
  }
}
