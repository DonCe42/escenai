import { NextResponse } from 'next/server';
import { MissingSecretError } from '@escenai/adapters';
import {
  MAX_REFERENCE_IMAGES,
  ProviderNotConfiguredError,
  findSceneAsset,
  recordSceneAsset,
  styleReferencesOf,
} from '@escenai/core';
import type { Aspect, Scene, SceneAsset, VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Genera (o regenera) la imagen de UNA escena.
 *
 * La primera escena fija la paleta con el `styleToken`. Las demás la reciben como
 * imagen de referencia: sin ese ancla cada escena elige su propia paleta y el video
 * parece un collage de siete ilustraciones distintas.
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

  const index = plan.escenas.findIndex((scene) => scene.id === sceneId);
  const scene: Scene | undefined = plan.escenas[index];
  if (scene === undefined) return NextResponse.json({ code: 'SCENE_NOT_FOUND' }, { status: 404 });

  const workspace = await getWorkspace();
  const kind = await container.detectImageProvider(workspace.id);
  if (kind === null) {
    return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
  }

  const imageModel = container.imageModel(workspace.id, kind);
  const storage = container.storage;
  const batchId = Date.now().toString(36);

  try {
    // Referencias en orden de importancia: primero el ancla de estilo (la paleta y
    // el trazo de la escena 1) y después el tablero, para que el producto, el
    // personaje o el logo aparezcan igual en todas las escenas.
    const references: Uint8Array[] = [];

    if (index > 0) {
      const anchorScene = plan.escenas[0];
      const anchorAsset = findSceneAsset(project.assets, anchorScene?.id ?? '', 'image');
      if (anchorAsset?.status === 'ready' && anchorAsset.ref !== null) {
        const bytes = await storage.read(anchorAsset.ref).catch(() => undefined);
        if (bytes !== undefined) references.push(bytes);
      }
    }

    const board = styleReferencesOf(project.styleReferences);
    for (const reference of board) {
      if (references.length >= MAX_REFERENCE_IMAGES) break;
      const bytes = await storage.read(reference.ref).catch(() => undefined);
      if (bytes !== undefined) references.push(bytes);
    }

    const boardNote =
      board.length === 0
        ? ''
        : ' Respeta el producto, el personaje y el logo de las imágenes de referencia tal como son: no los rediseñes.';

    const prompt =
      index === 0
        ? `${scene.promptImagen}. Estilo: ${plan.styleToken}.${boardNote}`
        : `Mantén exactamente la paleta, el trazo y el estilo de la imagen de referencia. Nueva escena: ${scene.promptImagen}${boardNote}`;

    const image = await imageModel.generate({
      prompt,
      aspect: '9:16' as Aspect,
      ...(references.length === 0 ? {} : { referenceImages: references }),
    });

    const ref = await storage.put(
      `images/${workspace.id}/${batchId}/${scene.id}.${extensionFor(image.mimeType)}`,
      image.bytes,
      image.mimeType,
    );

    const asset: SceneAsset = {
      sceneId: scene.id,
      kind: 'image',
      status: 'ready',
      ref: ref.key,
      mimeType: ref.mimeType,
      errorCode: null,
      updatedAt: nowIso(),
    };

    const saved = await recordSceneAsset({ projects: container.projects }, { projectId: id, asset });
    if (!saved.ok) {
      return NextResponse.json({ code: 'ASSET_NOT_SAVED', detail: saved.error }, { status: 500 });
    }

    return NextResponse.json({
      asset,
      url: await storage.signedUrl(ref, 3600),
      usedReferences: references.length,
    });
  } catch (error) {
    if (error instanceof MissingSecretError || error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
    }
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    // Se guarda el fallo para que la interfaz pueda mostrarlo después de recargar.
    await recordSceneAsset(
      { projects: container.projects },
      {
        projectId: id,
        asset: {
          sceneId: scene.id,
          kind: 'image',
          status: 'error',
          ref: null,
          mimeType: null,
          errorCode: 'IMAGE_ERROR',
          updatedAt: nowIso(),
        },
      },
    ).catch(() => undefined);

    return NextResponse.json({ code: 'IMAGE_ERROR', message }, { status: 502 });
  }
}
