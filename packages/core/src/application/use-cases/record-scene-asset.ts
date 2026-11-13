import { err, ok } from '../../domain/result';
import type { Result } from '../../domain/result';
import { isAssetConsistent } from '../../domain/project-assets';
import type { SceneAsset } from '../../domain/project-assets';
import type { ScriptProject } from '../../domain/script-project';
import type { ProjectRepositoryPort } from '../ports/project-repository.port';

export interface RecordSceneAssetDeps {
  readonly projects: ProjectRepositoryPort;
}

export interface RecordSceneAssetInput {
  readonly projectId: string;
  readonly asset: SceneAsset;
}

export type RecordSceneAssetFailure =
  | { readonly kind: 'project_not_found' }
  | { readonly kind: 'invalid_asset'; readonly reason: string };

/**
 * Guarda el estado de un asset de escena. Un asset `ready` sin clave nunca se
 * persiste: quedaría como «listo» en la interfaz sin nada que renderizar.
 */
export async function recordSceneAsset(
  deps: RecordSceneAssetDeps,
  input: RecordSceneAssetInput,
): Promise<Result<ScriptProject, RecordSceneAssetFailure>> {
  if (!isAssetConsistent(input.asset)) {
    return err({ kind: 'invalid_asset', reason: 'Un asset listo necesita una clave de almacenamiento.' });
  }

  const updated = await deps.projects.saveAsset(input.projectId, input.asset);
  return updated === null ? err({ kind: 'project_not_found' }) : ok(updated);
}
