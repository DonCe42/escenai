import { validateVideoPlan } from '../../domain/plan-validator';
import { err, ok } from '../../domain/result';
import type { Result } from '../../domain/result.js';
import type { VideoPlan } from '../../domain/video-plan';
import type { TextModelPort } from '../ports/text-model.port';
import { buildCompactPrompt } from '../prompts/compact-prompt';

export interface CompactScriptDeps {
  readonly text: TextModelPort;
}

export interface CompactScriptInput {
  readonly plan: VideoPlan;
  readonly duracionObjetivoS: number;
  /** Español hablado ronda 2,6 palabras por segundo; el TTS lo confirma después. */
  readonly palabrasPorSegundo?: number;
}

export type CompactFailure =
  | { readonly kind: 'invalid_plan'; readonly issues: readonly string[] }
  | { readonly kind: 'model_error'; readonly message: string };

function normalize(raw: unknown, plan: VideoPlan): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const value = raw as Record<string, unknown>;
  const scenes = Array.isArray(value.escenas) ? value.escenas : plan.escenas;

  return {
    ...value,
    version: 1,
    locale: plan.locale,
    duracionObjetivoS: plan.duracionObjetivoS,
    styleToken: plan.styleToken,
    titulo: typeof value.titulo === 'string' ? value.titulo : plan.titulo,
    escenas: (scenes as readonly Record<string, unknown>[]).map((scene, index) => {
      const original = plan.escenas[index];
      return {
        ...scene,
        // El render y los assets ya existen por id: el modelo no los puede renombrar.
        id: original?.id ?? scene.id,
        rol: original?.rol ?? scene.rol,
        movimiento: original?.movimiento ?? scene.movimiento,
        promptImagen: original?.promptImagen ?? scene.promptImagen,
      };
    }),
  };
}

/**
 * Reescribe el guion para que quepa en la duración objetivo.
 * No toca imágenes ni ids: solo texto y duraciones.
 */
export async function compactScript(
  deps: CompactScriptDeps,
  input: CompactScriptInput,
): Promise<Result<VideoPlan, CompactFailure>> {
  const { systemPrompt, userPrompt } = buildCompactPrompt({
    plan: input.plan,
    duracionObjetivoS: input.duracionObjetivoS,
    palabrasPorSegundo: input.palabrasPorSegundo ?? 2.6,
  });

  let raw: unknown;
  try {
    raw = await deps.text.generateJson({ systemPrompt, userPrompt, schemaName: 'videoplan' });
  } catch (error) {
    return err({
      kind: 'model_error',
      message: error instanceof Error ? error.message : 'error desconocido',
    });
  }

  const candidate = normalize(raw, input.plan);
  const validation = validateVideoPlan(candidate);
  if (!validation.ok) {
    return err({ kind: 'invalid_plan', issues: validation.issues.map((issue) => `${issue.code}: ${issue.message}`) });
  }

  return ok(candidate as VideoPlan);
}
