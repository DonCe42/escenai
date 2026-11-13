import { err, ok } from '../../domain/result';
import type { Result } from '../../domain/result';
import { findSceneAsset } from '../../domain/project-assets';
import type { SceneAsset } from '../../domain/project-assets';
import { styleReferencesOf } from '../../domain/style-reference';
import { MAX_REFERENCE_IMAGES } from '../../domain/video-plan';
import type { Aspect, Scene, VideoPlan } from '../../domain/video-plan';
import type { ScriptProject } from '../../domain/script-project';
import { sceneImagePrompt } from '../prompts/image-prompt';
import type { ClockPort } from '../ports/clock.port';
import type { ImageModelPort } from '../ports/image-model.port';
import type { ProjectRepositoryPort } from '../ports/project-repository.port';
import type { SpeechPort } from '../ports/speech.port';
import type { StoragePort } from '../ports/storage.port';

/**
 * Generación de imagen y voz de UNA escena.
 *
 * Vive en el núcleo y no en la ruta porque hay dos caminos que tienen que pedir
 * exactamente lo mismo: el botón de la escena y el lote de «hacer video». Si el
 * ancla de estilo o el tablero se aplicaran solo en uno, el mismo proyecto daría
 * dos videos distintos según por dónde se generara.
 */

export interface SceneAssetsDeps {
  readonly projects: ProjectRepositoryPort;
  readonly storage: StoragePort;
  readonly clock: ClockPort;
  readonly workspaceId: string;
}

/** La imagen necesita el modelo de imagen; la voz, el de voz. No se piden de más. */
export type SceneImageDeps = SceneAssetsDeps & { readonly imageModel: ImageModelPort };
export type SceneVoiceDeps = SceneAssetsDeps & { readonly speech: SpeechPort };

export type SceneAssetsFailureKind =
  | 'project_not_found'
  | 'no_active_plan'
  | 'scene_not_found'
  | 'asset_not_saved'
  | 'provider_error';

export interface SceneAssetsFailure {
  readonly kind: SceneAssetsFailureKind;
  /**
   * Error original del proveedor. La ruta lo usa para responder 412 cuando falta
   * la key sin que el núcleo tenga que conocer las clases de los adaptadores.
   */
  readonly cause?: unknown;
  readonly message?: string;
}

export interface GeneratedSceneImage {
  readonly asset: SceneAsset;
  /** Cuántas referencias se mandaron de verdad (ancla + tablero). */
  readonly references: number;
}

export interface GeneratedSceneVoice {
  readonly asset: SceneAsset;
  readonly durationMs: number;
  readonly words: number;
}

function activePlanOf(project: ScriptProject): VideoPlan | null {
  const active = project.versions.find((version) => version.id === project.activeVersionId);
  return active?.plan ?? null;
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

/**
 * Referencias en orden de importancia: primero el ancla de estilo (la paleta y el
 * trazo de la escena 1) y después el tablero, recortado al tope del proveedor.
 */
export async function referenceImagesFor(
  deps: Pick<SceneAssetsDeps, 'storage'>,
  project: ScriptProject,
  plan: VideoPlan,
  index: number,
): Promise<readonly Uint8Array[]> {
  const references: Uint8Array[] = [];

  if (index > 0) {
    const anchorScene = plan.escenas[0];
    const anchor = findSceneAsset(project.assets, anchorScene?.id ?? '', 'image');
    if (anchor?.status === 'ready' && anchor.ref !== null) {
      const bytes = await deps.storage.read(anchor.ref).catch(() => undefined);
      if (bytes !== undefined) references.push(bytes);
    }
  }

  for (const reference of styleReferencesOf(project.styleReferences)) {
    if (references.length >= MAX_REFERENCE_IMAGES) break;
    const bytes = await deps.storage.read(reference.ref).catch(() => undefined);
    if (bytes !== undefined) references.push(bytes);
  }

  return references;
}

async function saveAsset(
  deps: Pick<SceneAssetsDeps, 'projects'>,
  projectId: string,
  asset: SceneAsset,
): Promise<boolean> {
  const saved = await deps.projects.saveAsset(projectId, asset);
  return saved !== null;
}

function nowIso(deps: Pick<SceneAssetsDeps, 'clock'>): string {
  return deps.clock.nowIso();
}

/**
 * Genera la imagen de una escena y la deja guardada.
 *
 * El fallo del proveedor se persiste como estado del asset: la interfaz tiene que
 * poder contarlo después de recargar, no solo mientras la pestaña está abierta.
 */
export async function generateSceneImageAsset(
  deps: SceneImageDeps,
  input: { readonly projectId: string; readonly sceneId: string },
): Promise<Result<GeneratedSceneImage, SceneAssetsFailure>> {
  const project = await deps.projects.find(input.projectId);
  if (project === null) return err({ kind: 'project_not_found' });

  const plan = activePlanOf(project);
  if (plan === null) return err({ kind: 'no_active_plan' });

  const index = plan.escenas.findIndex((scene) => scene.id === input.sceneId);
  const scene: Scene | undefined = plan.escenas[index];
  if (scene === undefined) return err({ kind: 'scene_not_found' });

  try {
    const references = await referenceImagesFor(deps, project, plan, index);
    const hasBoard = styleReferencesOf(project.styleReferences).length > 0;
    const hasAnchor = index > 0 && references.length > 0;

    const image = await deps.imageModel.generate({
      prompt: sceneImagePrompt({ plan, scene, index, hasBoard, hasAnchor }),
      aspect: '9:16' as Aspect,
      ...(references.length === 0 ? {} : { referenceImages: references }),
    });

    const batchId = Date.now().toString(36);
    const stored = await deps.storage.put(
      `images/${deps.workspaceId}/${batchId}/${scene.id}.${extensionFor(image.mimeType)}`,
      image.bytes,
      image.mimeType,
    );

    const asset: SceneAsset = {
      sceneId: scene.id,
      kind: 'image',
      status: 'ready',
      ref: stored.key,
      mimeType: stored.mimeType,
      errorCode: null,
      updatedAt: nowIso(deps),
    };

    if (!(await saveAsset(deps, input.projectId, asset))) {
      return err({ kind: 'asset_not_saved' });
    }

    return ok({ asset, references: references.length });
  } catch (error) {
    await saveAsset(deps, input.projectId, {
      sceneId: scene.id,
      kind: 'image',
      status: 'error',
      ref: null,
      mimeType: null,
      errorCode: 'IMAGE_ERROR',
      updatedAt: nowIso(deps),
    }).catch(() => false);

    return err({
      kind: 'provider_error',
      cause: error,
      message: error instanceof Error ? error.message : 'UNKNOWN',
    });
  }
}

/**
 * Genera la voz de una escena.
 *
 * Junto al MP3 se guardan los timestamps por palabra: sin ellos no hay karaoke ni
 * subtítulos sincronizados, y volver a pedirlos cuesta otra llamada al proveedor.
 */
export async function generateSceneVoiceAsset(
  deps: SceneVoiceDeps,
  input: { readonly projectId: string; readonly sceneId: string },
): Promise<Result<GeneratedSceneVoice, SceneAssetsFailure>> {
  const project = await deps.projects.find(input.projectId);
  if (project === null) return err({ kind: 'project_not_found' });

  const plan = activePlanOf(project);
  if (plan === null) return err({ kind: 'no_active_plan' });

  const scene: Scene | undefined = plan.escenas.find((item) => item.id === input.sceneId);
  if (scene === undefined) return err({ kind: 'scene_not_found' });

  try {
    const speech = await deps.speech.synthesize({ text: scene.narracion, locale: plan.locale });
    const batchId = Date.now().toString(36);

    const audioRef = await deps.storage.put(
      `audio/${deps.workspaceId}/${batchId}/${scene.id}.mp3`,
      speech.audio,
      speech.mimeType,
    );
    await deps.storage.put(
      `audio/${deps.workspaceId}/${batchId}/${scene.id}.json`,
      new TextEncoder().encode(
        JSON.stringify({ durationMs: speech.durationMs, words: speech.words }),
      ),
      'application/json',
    );

    const asset: SceneAsset = {
      sceneId: scene.id,
      kind: 'voice',
      status: 'ready',
      ref: audioRef.key,
      mimeType: audioRef.mimeType,
      errorCode: null,
      updatedAt: nowIso(deps),
    };

    if (!(await saveAsset(deps, input.projectId, asset))) {
      return err({ kind: 'asset_not_saved' });
    }

    return ok({ asset, durationMs: speech.durationMs, words: speech.words.length });
  } catch (error) {
    await saveAsset(deps, input.projectId, {
      sceneId: scene.id,
      kind: 'voice',
      status: 'error',
      ref: null,
      mimeType: null,
      errorCode: 'VOICE_ERROR',
      updatedAt: nowIso(deps),
    }).catch(() => false);

    return err({
      kind: 'provider_error',
      cause: error,
      message: error instanceof Error ? error.message : 'UNKNOWN',
    });
  }
}
