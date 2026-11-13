import type { SceneAsset } from '../../domain/project-assets';
import type { ScriptProject, VersionSource } from '../../domain/script-project';
import type { StyleReference } from '../../domain/style-reference';
import type { VideoPlan } from '../../domain/video-plan';

/**
 * Persistencia de proyectos y versiones del plan.
 * Hoy hay un adaptador de archivo; cuando llegue la auth, el mismo puerto se implementa
 * sobre Postgres/Supabase sin tocar casos de uso.
 */
export interface ProjectRepositoryPort {
  create(input: { readonly nombre: string; readonly plan: VideoPlan; readonly now: string }): Promise<ScriptProject>;
  list(): Promise<readonly ScriptProject[]>;
  find(id: string): Promise<ScriptProject | null>;
  addVersion(
    id: string,
    input: { readonly plan: VideoPlan; readonly source: VersionSource; readonly now: string },
  ): Promise<ScriptProject | null>;
  setActiveVersion(id: string, versionId: string, now: string): Promise<ScriptProject | null>;
  /** Inserta o reemplaza el asset de una escena. No toca versiones ni timestamps del plan. */
  saveAsset(id: string, asset: SceneAsset): Promise<ScriptProject | null>;
  /** Añade una pieza al tablero de estilo (producto, personaje, logo). */
  saveStyleReference(id: string, reference: StyleReference): Promise<ScriptProject | null>;
  /** Quita una pieza del tablero. El archivo lo borra quien llama, que tiene el storage. */
  removeStyleReference(id: string, referenceId: string, now: string): Promise<ScriptProject | null>;
  remove(id: string): Promise<boolean>;
}
