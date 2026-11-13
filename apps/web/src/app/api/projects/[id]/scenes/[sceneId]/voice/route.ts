import { NextResponse } from 'next/server';
import { MissingSecretError } from '@escenai/adapters';
import { ProviderNotConfiguredError, recordSceneAsset } from '@escenai/core';
import type { Scene, SceneAsset, VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Genera (o regenera) la voz de UNA escena.
 *
 * Se guardan junto al MP3 los timestamps por palabra: sin ellos no hay karaoke ni
 * subtítulos sincronizados, y volver a pedirlos cuesta otra llamada al proveedor.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; sceneId: string }> },
): Promise<Response> {
  const { id, sceneId } = await context.params;
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  const project = await container.projects.find(id);
  if (project === null) return NextResponse.json({ code: 'PROJECT_NOT_FOUND' }, { status: 404 });

  const active = project.versions.find((version) => version.id === project.activeVersionId);
  const plan: VideoPlan | undefined = active?.plan;
  if (plan === undefined) return NextResponse.json({ code: 'NO_ACTIVE_PLAN' }, { status: 409 });

  const scene: Scene | undefined = plan.escenas.find((item) => item.id === sceneId);
  if (scene === undefined) return NextResponse.json({ code: 'SCENE_NOT_FOUND' }, { status: 404 });

  const workspace = await getWorkspace();
  const speech = container.speechModel(workspace.id);
  const storage = container.storage;
  const batchId = Date.now().toString(36);

  try {
    const result = await speech.synthesize({ text: scene.narracion, locale: plan.locale });

    const audioRef = await storage.put(
      `audio/${workspace.id}/${batchId}/${scene.id}.mp3`,
      result.audio,
      result.mimeType,
    );
    await storage.put(
      `audio/${workspace.id}/${batchId}/${scene.id}.json`,
      new TextEncoder().encode(JSON.stringify({ durationMs: result.durationMs, words: result.words })),
      'application/json',
    );

    const asset: SceneAsset = {
      sceneId: scene.id,
      kind: 'voice',
      status: 'ready',
      ref: audioRef.key,
      mimeType: audioRef.mimeType,
      errorCode: null,
      updatedAt: nowIso(),
    };

    const saved = await recordSceneAsset({ projects: container.projects }, { projectId: id, asset });
    if (!saved.ok) {
      return NextResponse.json({ code: 'ASSET_NOT_SAVED', detail: saved.error }, { status: 500 });
    }

    return NextResponse.json({
      asset,
      url: await storage.signedUrl(audioRef, 3600),
      durationMs: result.durationMs,
      words: result.words.length,
    });
  } catch (error) {
    if (error instanceof MissingSecretError || error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'minimax' }, { status: 412 });
    }
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    await recordSceneAsset(
      { projects: container.projects },
      {
        projectId: id,
        asset: {
          sceneId: scene.id,
          kind: 'voice',
          status: 'error',
          ref: null,
          mimeType: null,
          errorCode: 'VOICE_ERROR',
          updatedAt: nowIso(),
        },
      },
    ).catch(() => undefined);

    return NextResponse.json({ code: 'VOICE_ERROR', message }, { status: 502 });
  }
}
