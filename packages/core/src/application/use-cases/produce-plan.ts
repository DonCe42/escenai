import { err, ok } from '../../domain/result';
import type { Result } from '../../domain/result';
import { findSceneAsset } from '../../domain/project-assets';
import type { SceneAsset } from '../../domain/project-assets';
import { validateVideoPlan } from '../../domain/plan-validator';
import type { VideoPlan } from '../../domain/video-plan';
import type { ScriptProject } from '../../domain/script-project';
import { generateSceneImageAsset, generateSceneVoiceAsset } from './scene-assets';
import type { SceneAssetsDeps, SceneAssetsFailure } from './scene-assets';
import type { ImageModelPort } from '../ports/image-model.port';
import type { SpeechPort } from '../ports/speech.port';

/**
 * «Hacer video»: generar en serie todo lo que falta (imagen y voz de cada escena).
 *
 * Es el botón que convierte el estudio en usable: siete escenas a mano son catorce
 * clics. Corre en serie a propósito — Vertex limita las imágenes por minuto y en
 * paralelo devuelve 429 — y reporta cada paso para que la interfaz enseñe en qué
 * escena va en vez de una barra muda.
 */

export type ProduceStepKind = 'image' | 'voice';

export interface ProduceStep {
  readonly sceneId: string;
  readonly kind: ProduceStepKind;
  /** Posición dentro del total de pasos pendientes (1-based). */
  readonly index: number;
  readonly total: number;
  readonly status: 'start' | 'ready' | 'skipped' | 'error';
  readonly errorCode?: string;
}

export interface ProduceFailure {
  readonly sceneId: string;
  readonly kind: ProduceStepKind;
  readonly code: string;
  readonly message?: string;
}

export interface ProduceSummary {
  readonly generated: number;
  readonly skipped: number;
  readonly failures: readonly ProduceFailure[];
}

export type ProduceFailureKind =
  | 'project_not_found'
  | 'no_active_plan'
  | 'invalid_plan'
  | 'nothing_to_do';

export interface ProducePlanDeps extends SceneAssetsDeps {
  readonly imageModel: ImageModelPort;
  readonly speech: SpeechPort;
  /** Vertex agota la cuota por minuto: separación entre imágenes. */
  readonly imagePauseMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface PendingAssets {
  readonly images: readonly string[];
  readonly voices: readonly string[];
  readonly total: number;
}

/** Qué falta por generar, en el orden en que se va a hacer. */
export function pendingAssets(
  plan: VideoPlan,
  assets: readonly SceneAsset[] | undefined,
): PendingAssets {
  const images: string[] = [];
  const voices: string[] = [];
  for (const scene of plan.escenas) {
    if (findSceneAsset(assets, scene.id, 'image')?.status !== 'ready') images.push(scene.id);
    if (findSceneAsset(assets, scene.id, 'voice')?.status !== 'ready') voices.push(scene.id);
  }
  return { images, voices, total: images.length + voices.length };
}

function isRateLimit(failure: SceneAssetsFailure): boolean {
  const message = failure.message ?? '';
  return /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(message);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function emptyPlan(project: ScriptProject): VideoPlan | null {
  const active = project.versions.find((version) => version.id === project.activeVersionId);
  return active?.plan ?? null;
}

export async function producePlan(
  deps: ProducePlanDeps,
  input: {
    readonly projectId: string;
    readonly onStep?: (step: ProduceStep) => void | Promise<void>;
  },
): Promise<Result<ProduceSummary, ProduceFailureKind>> {
  const project = await deps.projects.find(input.projectId);
  if (project === null) return err('project_not_found');

  const plan = emptyPlan(project);
  if (plan === null) return err('no_active_plan');

  const validation = validateVideoPlan(plan);
  if (!validation.ok) return err('invalid_plan');

  const pending = pendingAssets(plan, project.assets);
  if (pending.total === 0) return err('nothing_to_do');

  const sleep = deps.sleep ?? defaultSleep;
  const pauseMs = deps.imagePauseMs ?? 15_000;
  const total = pending.total;

  const failures: ProduceFailure[] = [];
  let generated = 0;
  let skipped = 0;
  let step = 0;
  let imageIndex = 0;

  const report = async (next: Omit<ProduceStep, 'index' | 'total'>): Promise<void> => {
    if (input.onStep === undefined) return;
    await input.onStep({ ...next, index: step, total });
  };

  for (const scene of plan.escenas) {
    if (pending.images.includes(scene.id)) {
      imageIndex += 1;
      step += 1;
      await report({ sceneId: scene.id, kind: 'image', status: 'start' });

      let result = await generateSceneImageAsset(deps, {
        projectId: input.projectId,
        sceneId: scene.id,
      });
      // Un 429 no es un fallo de la escena: se reintenta respetando la ventana.
      for (let attempt = 1; !result.ok && isRateLimit(result.error) && attempt <= 2; attempt += 1) {
        await sleep(pauseMs * (attempt + 1));
        result = await generateSceneImageAsset(deps, {
          projectId: input.projectId,
          sceneId: scene.id,
        });
      }

      if (result.ok) {
        generated += 1;
        await report({ sceneId: scene.id, kind: 'image', status: 'ready' });
        // Solo se respira si quedan más imágenes: la valla es la cuota, no el reloj.
        if (imageIndex < pending.images.length) await sleep(pauseMs);
      } else {
        const entry: ProduceFailure = {
          sceneId: scene.id,
          kind: 'image',
          code: 'IMAGE_ERROR',
          ...(result.error.message === undefined ? {} : { message: result.error.message }),
        };
        failures.push(entry);
        await report({ sceneId: scene.id, kind: 'image', status: 'error', errorCode: entry.code });
      }
    } else {
      skipped += 1;
    }

    if (pending.voices.includes(scene.id)) {
      step += 1;
      await report({ sceneId: scene.id, kind: 'voice', status: 'start' });
      const result = await generateSceneVoiceAsset(deps, {
        projectId: input.projectId,
        sceneId: scene.id,
      });

      if (result.ok) {
        generated += 1;
        await report({ sceneId: scene.id, kind: 'voice', status: 'ready' });
      } else {
        const entry: ProduceFailure = {
          sceneId: scene.id,
          kind: 'voice',
          code: 'VOICE_ERROR',
          ...(result.error.message === undefined ? {} : { message: result.error.message }),
        };
        failures.push(entry);
        await report({ sceneId: scene.id, kind: 'voice', status: 'error', errorCode: entry.code });
      }
    } else {
      skipped += 1;
    }
  }

  return ok({ generated, skipped, failures });
}
