import { ProviderNotConfiguredError } from '../../domain/errors';
import { validateVideoPlan } from '../../domain/plan-validator';
import type { PlanIssue } from '../../domain/plan-validator';
import type { Brief, Project } from '../../domain/project';
import { err, ok } from '../../domain/result';
import type { Result } from '../../domain/result';
import type { Locale, VideoPlan } from '../../domain/video-plan';
import type { TextModelPort } from '../ports/text-model.port';
import { buildScriptPrompt } from '../prompts/script-prompt';

export interface GenerateScriptDeps {
  readonly text: TextModelPort;
}

export interface GenerateScriptInput {
  readonly brand: Project;
  readonly brief: Brief;
  readonly locale: Locale;
}

export type ScriptFailure =
  | { readonly kind: 'invalid_plan'; readonly attempts: number; readonly issues: readonly PlanIssue[] }
  | { readonly kind: 'model_error'; readonly attempts: number; readonly message: string };

export interface GenerateScriptOptions {
  readonly maxAttempts?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido del proveedor de texto.';
}

/**
 * El modelo propone, el dominio decide.
 * Los campos que son política del producto (locale, duración, styleToken, version) se
 * sobreescriben antes de validar: el LLM no manda sobre ellos aunque los devuelva mal.
 */
function normalize(raw: unknown, input: GenerateScriptInput): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  return {
    ...(raw as Record<string, unknown>),
    version: 1,
    locale: input.locale,
    duracionObjetivoS: input.brief.duracionObjetivoS,
    styleToken: input.brand.styleToken,
  };
}

export async function generateScript(
  deps: GenerateScriptDeps,
  input: GenerateScriptInput,
  options: GenerateScriptOptions = {},
): Promise<Result<VideoPlan, ScriptFailure>> {
  const maxAttempts = options.maxAttempts ?? 3;
  let issues: readonly PlanIssue[] | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const prompt = buildScriptPrompt({
      brand: input.brand,
      brief: input.brief,
      locale: input.locale,
      ...(issues === undefined ? {} : { previousIssues: issues }),
    });

    let raw: unknown;
    try {
      raw = await deps.text.generateJson({
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        schemaName: prompt.schemaName,
      });
    } catch (error) {
      // Configuración ausente: no es un fallo del modelo ni se arregla reintentando.
      if (error instanceof ProviderNotConfiguredError) throw error;
      return err({ kind: 'model_error', attempts: attempt, message: errorMessage(error) });
    }

    const normalized = normalize(raw, input);
    const validation = validateVideoPlan(normalized);
    if (validation.ok) return ok(normalized as VideoPlan);
    issues = validation.issues;
  }

  return err({ kind: 'invalid_plan', attempts: maxAttempts, issues: issues ?? [] });
}
