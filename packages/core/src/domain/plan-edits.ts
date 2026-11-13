/**
 * Ediciones estructurales del plan.
 *
 * Mover una escena cambia quién abre y quién cierra el video, y el contrato exige
 * que la primera sea `hook` y la última `cta`. En vez de dejar el plan inválido y
 * pedirle al usuario que arregle roles a mano, se reasignan por posición: es la
 * regla que usan los shorts y la que el validador ya exige.
 */

import { LIMITS } from './video-plan';
import type { Scene, SceneRole, VideoPlan } from './video-plan';

export function totalDuration(plan: VideoPlan): number {
  return plan.escenas.reduce((sum, scene) => sum + scene.duracionEstimadaS, 0);
}

/** Primer id libre con el patrón `sN`; no reutiliza ids existentes. */
export function nextSceneId(escenas: readonly Scene[]): string {
  const used = new Set(escenas.map((scene) => scene.id));
  let n = escenas.length + 1;
  while (used.has(`s${n}`)) n += 1;
  return `s${n}`;
}

export function normalizeRoles(escenas: readonly Scene[]): readonly Scene[] {
  if (escenas.length === 0) return escenas;
  return escenas.map((scene, index) => {
    if (index === 0) return scene.rol === 'hook' ? scene : { ...scene, rol: 'hook' };
    if (index === escenas.length - 1) return scene.rol === 'cta' ? scene : { ...scene, rol: 'cta' };
    const medio: SceneRole = scene.rol === 'hook' || scene.rol === 'cta' ? 'desarrollo' : scene.rol;
    return medio === scene.rol ? scene : { ...scene, rol: medio };
  });
}

export function moveScene(plan: VideoPlan, from: number, to: number): VideoPlan {
  const last = plan.escenas.length - 1;
  const origin = Math.min(Math.max(from, 0), last);
  const target = Math.min(Math.max(to, 0), last);
  if (origin === target || plan.escenas.length === 0) return plan;

  const escenas = [...plan.escenas];
  const [moved] = escenas.splice(origin, 1);
  if (moved === undefined) return plan;
  escenas.splice(target, 0, moved);
  return { ...plan, escenas: normalizeRoles(escenas) };
}

/** `null` si borrar dejaría el plan por debajo del mínimo de escenas. */
export function removeScene(plan: VideoPlan, sceneId: string): VideoPlan | null {
  if (plan.escenas.length <= LIMITS.minEscenas) return null;
  const escenas = plan.escenas.filter((scene) => scene.id !== sceneId);
  if (escenas.length === plan.escenas.length) return null;
  return { ...plan, escenas: normalizeRoles(escenas) };
}

/** Copia la escena justo después de la original. `null` si ya está el máximo. */
export function duplicateScene(plan: VideoPlan, sceneId: string): VideoPlan | null {
  if (plan.escenas.length >= LIMITS.maxEscenas) return null;
  const index = plan.escenas.findIndex((scene) => scene.id === sceneId);
  if (index === -1) return null;

  const original = plan.escenas[index];
  if (original === undefined) return null;

  const copia: Scene = {
    ...original,
    id: nextSceneId(plan.escenas),
    textoPantalla: [...original.textoPantalla],
  };
  const escenas = [...plan.escenas];
  escenas.splice(index + 1, 0, copia);
  return { ...plan, escenas: normalizeRoles(escenas) };
}

/** Ajusta el objetivo a la suma real; lo usa el aviso de `E_DURATION_SUM`. */
export function withTarget(plan: VideoPlan, targetS: number): VideoPlan {
  const redondeado = Math.max(1, Math.round(targetS * 10) / 10);
  return { ...plan, duracionObjetivoS: redondeado };
}
