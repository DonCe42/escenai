import { NextResponse } from 'next/server';
import { MissingSecretError } from '@escenai/adapters';
import { ProviderNotConfiguredError, generateSceneImageAsset } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Genera (o regenera) la imagen de UNA escena.
 *
 * La lógica (ancla de estilo, tablero de referencias, prompt) vive en
 * `@escenai/core`: el lote de «hacer video» tiene que pedir exactamente lo mismo,
 * o el mismo proyecto daría dos videos distintos según el botón que se pulse.
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
  const kind = await container.detectImageProvider(workspace.id);
  if (kind === null) {
    return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
  }

  const result = await generateSceneImageAsset(
    {
      projects: container.projects,
      storage: container.storage,
      clock: container.clock,
      imageModel: container.imageModel(workspace.id, kind),
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
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
    }
    if (failure.kind === 'project_not_found') {
      return NextResponse.json({ code: 'PROJECT_NOT_FOUND' }, { status: 404 });
    }
    if (failure.kind === 'scene_not_found') {
      return NextResponse.json({ code: 'SCENE_NOT_FOUND' }, { status: 404 });
    }
    if (failure.kind === 'no_active_plan') {
      return NextResponse.json({ code: 'NO_ACTIVE_PLAN' }, { status: 409 });
    }
    if (failure.kind === 'asset_not_saved') {
      return NextResponse.json({ code: 'ASSET_NOT_SAVED' }, { status: 500 });
    }
    return NextResponse.json(
      { code: 'IMAGE_ERROR', message: failure.message ?? 'UNKNOWN' },
      { status: 502 },
    );
  }

  const asset = result.value.asset;
  return NextResponse.json({
    asset,
    url: await container.storage.signedUrl(
      { key: asset.ref ?? '', mimeType: asset.mimeType ?? 'image/png', bytes: 0 },
      3600,
    ),
    usedReferences: result.value.references,
  });
}
