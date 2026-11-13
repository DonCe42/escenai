import { NextResponse } from 'next/server';
import { MissingSecretError } from '@escenai/adapters';
import { ProviderNotConfiguredError, generateSceneVoiceAsset } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Genera (o regenera) la voz de UNA escena, con sus timestamps por palabra.
 *
 * Mismo camino que el lote: el caso de uso guarda el MP3 y el JSON con `words`,
 * sin el cual no hay karaoke ni subtítulos sincronizados.
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

  const workspace = await getWorkspace();
  const result = await generateSceneVoiceAsset(
    {
      projects: container.projects,
      storage: container.storage,
      clock: container.clock,
      speech: container.speechModel(workspace.id),
      workspaceId: workspace.id,
    },
    { projectId: id, sceneId },
  );

  if (!result.ok) {
    const failure = result.error;
    if (
      failure.kind === 'provider_error' &&
      (failure.cause instanceof MissingSecretError ||
        failure.cause instanceof ProviderNotConfiguredError)
    ) {
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'minimax' }, { status: 412 });
    }
    if (failure.kind === 'project_not_found' || failure.kind === 'scene_not_found') {
      return NextResponse.json({ code: failure.kind.toUpperCase() }, { status: 404 });
    }
    if (failure.kind === 'no_active_plan') {
      return NextResponse.json({ code: 'NO_ACTIVE_PLAN' }, { status: 409 });
    }
    if (failure.kind === 'asset_not_saved') {
      return NextResponse.json({ code: 'ASSET_NOT_SAVED' }, { status: 500 });
    }
    return NextResponse.json(
      { code: 'VOICE_ERROR', message: failure.message ?? 'UNKNOWN' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    asset: result.value.asset,
    url: await container.storage.signedUrl(
      {
        key: result.value.asset.ref ?? '',
        mimeType: result.value.asset.mimeType ?? 'audio/mpeg',
        bytes: 0,
      },
      3600,
    ),
    durationMs: result.value.durationMs,
    words: result.value.words,
  });
}
