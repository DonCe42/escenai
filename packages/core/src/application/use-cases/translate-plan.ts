import { validateVideoPlan } from '../../domain/plan-validator';
import { err, ok } from '../../domain/result';
import type { Result } from '../../domain/result';
import type { Locale, VideoPlan } from '../../domain/video-plan';
import type { TextModelPort } from '../ports/text-model.port';
import { buildTranslatePrompt } from '../prompts/translate-prompt';

export interface TranslatePlanDeps {
  readonly text: TextModelPort;
}

export interface TranslatePlanInput {
  readonly plan: VideoPlan;
  readonly locale: Locale;
}

export type TranslateFailure =
  | { readonly kind: 'invalid_plan'; readonly issues: readonly string[] }
  | { readonly kind: 'model_error'; readonly message: string };

function normalize(raw: unknown, plan: VideoPlan, locale: Locale): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const value = raw as Record<string, unknown>;
  const scenes = Array.isArray(value.escenas) ? value.escenas : plan.escenas;

  return {
    ...value,
    version: 1,
    locale,
    duracionObjetivoS: plan.duracionObjetivoS,
    styleToken: plan.styleToken,
    titulo: typeof value.titulo === 'string' ? value.titulo : plan.titulo,
    escenas: (scenes as readonly Record<string, unknown>[]).map((scene, index) => {
      const original = plan.escenas[index];
      return {
        ...scene,
        // Lo que ya está generado (imágenes, ids) no se toca al traducir.
        id: original?.id ?? scene.id,
        rol: original?.rol ?? scene.rol,
        movimiento: original?.movimiento ?? scene.movimiento,
        promptImagen: original?.promptImagen ?? scene.promptImagen,
        duracionEstimadaS: original?.duracionEstimadaS ?? scene.duracionEstimadaS,
      };
    }),
  };
}

export async function translatePlan(
  deps: TranslatePlanDeps,
  input: TranslatePlanInput,
): Promise<Result<VideoPlan, TranslateFailure>> {
  const { systemPrompt, userPrompt } = buildTranslatePrompt({ plan: input.plan, locale: input.locale });

  let raw: unknown;
  try {
    raw = await deps.text.generateJson({ systemPrompt, userPrompt, schemaName: 'videoplan' });
  } catch (error) {
    return err({ kind: 'model_error', message: error instanceof Error ? error.message : 'error' });
  }

  const candidate = normalize(raw, input.plan, input.locale);
  const validation = validateVideoPlan(candidate);
  if (!validation.ok) {
    return err({
      kind: 'invalid_plan',
      issues: validation.issues.map((issue) => `${issue.code}: ${issue.message}`),
    });
  }

  return ok(candidate as VideoPlan);
}
