import type { SceneAsset } from './project-assets';
import type { StyleReference } from './style-reference';
import type { VideoPlan } from './video-plan';

export type VersionSource = 'generated' | 'compacted' | 'edited';

export interface PlanVersion {
  readonly id: string;
  readonly version: number;
  readonly plan: VideoPlan;
  readonly source: VersionSource;
  readonly createdAt: string;
  /** Palabras de narración: sirve para ver de un vistazo si el recorte funcionó. */
  readonly words: number;
}

export interface ScriptProject {
  readonly id: string;
  readonly nombre: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly versions: readonly PlanVersion[];
  readonly activeVersionId: string;
  /**
   * Assets por escena (imagen, voz, clip). Opcional para leer los proyectos
   * guardados antes de que existiera; el repositorio lo normaliza a [].
   */
  readonly assets?: readonly SceneAsset[];
  /**
   * Tablero de estilo: producto, personaje o logo que se pasa como referencia a
   * cada escena. Opcional por el mismo motivo que `assets`.
   */
  readonly styleReferences?: readonly StyleReference[];
}

export interface ScriptProjectSummary {
  readonly id: string;
  readonly nombre: string;
  readonly updatedAt: string;
  readonly versions: number;
  readonly titulo: string;
  readonly duracionObjetivoS: number;
}

export function countPlanWords(plan: VideoPlan): number {
  return plan.escenas.reduce(
    (sum, scene) => sum + scene.narracion.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
}

export function summarize(project: ScriptProject): ScriptProjectSummary {
  const active = project.versions.find((version) => version.id === project.activeVersionId);
  return {
    id: project.id,
    nombre: project.nombre,
    updatedAt: project.updatedAt,
    versions: project.versions.length,
    titulo: active?.plan.titulo ?? project.nombre,
    duracionObjetivoS: active?.plan.duracionObjetivoS ?? 0,
  };
}
