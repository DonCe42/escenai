import { err, ok } from '../../domain/result';
import type { Result } from '../../domain/result';
import type { ScriptProject, VersionSource } from '../../domain/script-project';
import { validateVideoPlan } from '../../domain/plan-validator';
import type { VideoPlan } from '../../domain/video-plan';
import type { ProjectRepositoryPort } from '../ports/project-repository.port';

export interface SavePlanDeps {
  readonly projects: ProjectRepositoryPort;
  readonly clock: { nowIso(): string };
}

export interface SavePlanInput {
  readonly projectId?: string;
  readonly nombre: string;
  readonly plan: unknown;
  readonly source: VersionSource;
}

export type SavePlanFailure =
  | { readonly kind: 'invalid_plan'; readonly issues: readonly string[] }
  | { readonly kind: 'project_not_found' };

/**
 * Guarda el plan como versión nueva. Un plan inválido nunca se persiste: si entró
 * al repositorio, es porque pasó el mismo validador que usa el render.
 */
export async function savePlan(
  deps: SavePlanDeps,
  input: SavePlanInput,
): Promise<Result<ScriptProject, SavePlanFailure>> {
  const validation = validateVideoPlan(input.plan);
  if (!validation.ok) {
    return err({ kind: 'invalid_plan', issues: validation.issues.map((i) => `${i.code}: ${i.message}`) });
  }

  const plan = input.plan as VideoPlan;
  const now = deps.clock.nowIso();

  if (input.projectId === undefined) {
    const created = await deps.projects.create({ nombre: input.nombre, plan, now });
    return ok(created);
  }

  const updated = await deps.projects.addVersion(input.projectId, {
    plan,
    source: input.source,
    now,
  });
  return updated === null ? err({ kind: 'project_not_found' }) : ok(updated);
}
