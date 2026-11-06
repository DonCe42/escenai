import type { ScriptProject, VersionSource } from '../../domain/script-project';
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
  remove(id: string): Promise<boolean>;
}
