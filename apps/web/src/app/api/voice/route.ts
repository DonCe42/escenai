import { NextResponse } from 'next/server';
import { MissingSecretError } from '@escenai/adapters';
import {
  ProviderNotConfiguredError,
  buildTimeline,
  validateVideoPlan,
} from '@escenai/core';
import type { SceneAudio, VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  let body: { plan?: unknown; voiceId?: unknown };
  try {
    body = (await request.json()) as { plan?: unknown; voiceId?: unknown };
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const validation = validateVideoPlan(body.plan);
  if (!validation.ok) {
    return NextResponse.json({ code: 'INVALID_PLAN', issues: validation.issues }, { status: 422 });
  }
  const plan = body.plan as VideoPlan;

  const workspace = await getWorkspace();
  const speech = container.speechModel(workspace.id);
  const storage = container.storage;
  const batchId = Date.now().toString(36);

  try {
    const clips: { sceneId: string; url: string; durationMs: number; words: number }[] = [];
    const audios: SceneAudio[] = [];

    for (const scene of plan.escenas) {
      const result = await speech.synthesize({
        text: scene.narracion,
        locale: plan.locale,
        ...(typeof body.voiceId === 'string' ? { voiceId: body.voiceId } : {}),
      });

      const ref = await storage.put(
        `audio/${workspace.id}/${batchId}/${scene.id}.mp3`,
        result.audio,
        result.mimeType,
      );

      // Los timestamps alimentan el karaoke del render: se guardan junto al audio.
      await storage.put(
        `audio/${workspace.id}/${batchId}/${scene.id}.json`,
        new TextEncoder().encode(
          JSON.stringify({ durationMs: result.durationMs, words: result.words }),
        ),
        'application/json',
      );

      audios.push({ sceneId: scene.id, durationMs: result.durationMs, words: result.words });
      clips.push({
        sceneId: scene.id,
        url: await storage.signedUrl(ref, 3600),
        durationMs: result.durationMs,
        words: result.words.length,
      });
    }

    const timeline = buildTimeline(plan, audios);

    return NextResponse.json({
      batchId,
      clips,
      timeline: {
        totalMs: timeline.totalMs,
        objetivoMs: timeline.objetivoMs,
        overBudgetMs: timeline.overBudgetMs,
        exceedsBudget: timeline.exceedsBudget,
      },
    });
  } catch (error) {
    if (error instanceof MissingSecretError || error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'minimax' }, { status: 412 });
    }
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ code: 'VOICE_ERROR', message }, { status: 502 });
  }
}
