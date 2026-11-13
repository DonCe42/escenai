import { describe, expect, it } from 'vitest';
import {
  duplicateScene,
  moveScene,
  nextSceneId,
  normalizeRoles,
  removeScene,
  totalDuration,
  withTarget,
} from '../src/index';
import type { Scene, VideoPlan } from '../src/index';

function scene(id: string, rol: Scene['rol'], duration = 5): Scene {
  return {
    id,
    rol,
    narracion: 'Son las tres de la tarde y ya no puedes con la vida entera.',
    textoPantalla: ['TRES PM'],
    promptImagen: 'oficina por la tarde con luz cálida y una lata fría',
    movimiento: 'zoom-in-lento',
    duracionEstimadaS: duration,
  };
}

const plan: VideoPlan = {
  version: 1,
  locale: 'es',
  titulo: 'Cold brew',
  duracionObjetivoS: 25,
  styleToken: 'ilustración plana',
  escenas: [
    scene('s1', 'hook'),
    scene('s2', 'problema'),
    scene('s3', 'desarrollo'),
    scene('s4', 'prueba'),
    scene('s5', 'cta'),
  ],
};

describe('ediciones del plan', () => {
  it('mueve una escena y reasigna roles por posición', () => {
    const movido = moveScene(plan, 2, 0);
    expect(movido.escenas.map((s) => s.id)).toEqual(['s3', 's1', 's2', 's4', 's5']);
    // La que ahora abre pasa a hook y la que cierra sigue siendo cta.
    expect(movido.escenas[0]?.rol).toBe('hook');
    expect(movido.escenas.at(-1)?.rol).toBe('cta');
    // El hook que quedó en medio deja de serlo: dos hooks rompen el contrato de ritmo.
    expect(movido.escenas[1]?.rol).toBe('desarrollo');
  });

  it('mover al final deja el cta en su sitio', () => {
    const movido = moveScene(plan, 4, 0);
    expect(movido.escenas[0]?.id).toBe('s5');
    expect(movido.escenas[0]?.rol).toBe('hook');
    expect(movido.escenas.at(-1)?.id).toBe('s4');
    expect(movido.escenas.at(-1)?.rol).toBe('cta');
  });

  it('acota los índices fuera de rango en vez de romper', () => {
    expect(moveScene(plan, -3, 99).escenas.map((s) => s.id)).toEqual([
      's2',
      's3',
      's4',
      's5',
      's1',
    ]);
    expect(moveScene(plan, 1, 1)).toBe(plan);
  });

  it('no borra por debajo del mínimo de escenas', () => {
    // El plan de 5 ya está en el mínimo: borrar debe negarse.
    expect(removeScene(plan, 's2')).toBeNull();

    // Con 6 escenas sí se puede, y los roles se reacomodan.
    const seis = duplicateScene(plan, 's1');
    if (seis === null) throw new Error('duplicateScene devolvió null');
    const cinco = removeScene(seis, 's3');
    expect(cinco?.escenas).toHaveLength(5);
    expect(cinco?.escenas[0]?.rol).toBe('hook');
    expect(cinco?.escenas.at(-1)?.rol).toBe('cta');
  });

  it('devuelve null si la escena no existe', () => {
    expect(removeScene(plan, 's99')).toBeNull();
    expect(duplicateScene(plan, 's99')).toBeNull();
  });

  it('duplica una escena después de la original con id nuevo', () => {
    const duplicado = duplicateScene(plan, 's3');
    expect(duplicado?.escenas.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's6', 's4', 's5']);
    expect(duplicado?.escenas[3]?.narracion).toBe(plan.escenas[2]?.narracion);
    expect(new Set(duplicado?.escenas.map((s) => s.id)).size).toBe(6);
  });

  it('no duplica si el plan ya está en el máximo', () => {
    const doce: VideoPlan = {
      ...plan,
      escenas: Array.from({ length: 12 }, (_, i) =>
        scene(`s${i + 1}`, i === 0 ? 'hook' : i === 11 ? 'cta' : 'desarrollo'),
      ),
    };
    expect(duplicateScene(doce, 's1')).toBeNull();
  });

  it('genera ids que no chocan con los existentes', () => {
    expect(nextSceneId(plan.escenas)).toBe('s6');
    expect(nextSceneId([scene('s6', 'hook')])).not.toBe('s6');
  });

  it('normaliza roles sin tocar los válidos del medio', () => {
    const escenas = normalizeRoles([scene('a', 'cta'), scene('b', 'prueba'), scene('c', 'hook')]);
    expect(escenas.map((s) => s.rol)).toEqual(['hook', 'prueba', 'cta']);
  });

  it('ajusta el objetivo a la suma real', () => {
    expect(totalDuration(plan)).toBe(25);
    const ajustado = withTarget(plan, 31.44);
    expect(ajustado.duracionObjetivoS).toBe(31.4);
  });
});
