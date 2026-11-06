import { describe, expect, it } from 'vitest';
import { validateVideoPlan } from '../src/domain/plan-validator';
import type { VideoPlan } from '../src/domain/video-plan';

type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? Mutable<U>[] : Mutable<T[K]>;
};

function validPlan(): VideoPlan {
  return {
    version: 1,
    locale: 'es',
    titulo: 'El café que no te pide nada',
    duracionObjetivoS: 40,
    styleToken: 'ilustración plana, paleta verde botella y crema, sin texto',
    escenas: [
      {
        id: 's1',
        rol: 'hook',
        narracion: 'Son las tres de la tarde y ya no puedes con la vida.',
        textoPantalla: ['3 PM', 'Y YA NO PUEDES'],
        promptImagen: 'Oficina a media tarde, escritorio desordenado, lata de café en primer plano',
        movimiento: 'zoom-in-lento',
        duracionEstimadaS: 8,
      },
      {
        id: 's2',
        rol: 'problema',
        narracion: 'El café de la máquina te deja más cansado que antes de tomarlo.',
        textoPantalla: ['MÁS CANSADO'],
        promptImagen: 'Máquina expendedora en un pasillo, vaso de plástico humeando, tonos apagados',
        movimiento: 'pan-derecha',
        duracionEstimadaS: 8,
      },
      {
        id: 's3',
        rol: 'desarrollo',
        narracion: 'Este cold brew tiene cero azúcar y el doble de cafeína que el normal.',
        textoPantalla: ['CERO AZÚCAR'],
        promptImagen: 'Lata fría sobre superficie de mármol, gotas de condensación, luz lateral',
        movimiento: 'zoom-out-lento',
        duracionEstimadaS: 8,
      },
      {
        id: 's4',
        rol: 'prueba',
        narracion: 'Se toma en dos minutos y te despierta sin ese bajón de las cuatro.',
        textoPantalla: ['SIN BAJÓN'],
        promptImagen: 'Persona caminando por la calle con la lata en la mano, luz de tarde',
        movimiento: 'pan-izquierda',
        duracionEstimadaS: 8,
      },
      {
        id: 's5',
        rol: 'cta',
        narracion: 'Pide la tuya en el link de la bio y cuéntanos cómo te fue.',
        textoPantalla: ['LINK EN LA BIO'],
        promptImagen: 'Lata de cold brew sobre fondo crema, sombra suave, producto centrado',
        movimiento: 'estatico',
        duracionEstimadaS: 8,
      },
    ],
  };
}

function brokenPlan(mutate: (plan: Mutable<VideoPlan>) => void): unknown {
  const plan: Mutable<VideoPlan> = JSON.parse(JSON.stringify(validPlan()));
  mutate(plan);
  return plan;
}

describe('validateVideoPlan', () => {
  it('acepta el plan de Café Aurora', () => {
    expect(validateVideoPlan(validPlan())).toEqual({ ok: true });
  });

  it('rechaza con E_SCHEMA un plan que no es objeto', () => {
    const result = validateVideoPlan('esto no es un plan');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.code)).toContain('E_SCHEMA');
  });

  const casos: ReadonlyArray<[string, (plan: Mutable<VideoPlan>) => void, string]> = [
    ['menos de 5 escenas', (p) => { p.escenas = p.escenas.slice(0, 4); }, 'E_SCENES_COUNT'],
    ['ids repetidos', (p) => { p.escenas[1]!.id = 's1'; }, 'E_IDS_UNIQUE'],
    ['primera escena sin hook', (p) => { p.escenas[0]!.rol = 'problema'; }, 'E_HOOK'],
    ['última escena sin cta', (p) => { p.escenas[p.escenas.length - 1]!.rol = 'desarrollo'; }, 'E_CTA'],
    ['línea de 5 palabras', (p) => { p.escenas[0]!.textoPantalla = ['ESTA LÍNEA TIENE CINCO PALABRAS']; }, 'E_TEXT_LINES'],
    ['narración de 3 palabras', (p) => { p.escenas[2]!.narracion = 'Muy corto ya.'; }, 'E_NARRATION_LENGTH'],
    ['duración total desbordada', (p) => { p.escenas.forEach((e) => { e.duracionEstimadaS = 20; }); }, 'E_DURATION_SUM'],
    ['prompt que pide texto en la imagen', (p) => { p.escenas[1]!.promptImagen = 'Una lata con texto que diga OFERTA'; }, 'E_IMAGE_NO_TEXT'],
    ['campo inventado', (p) => { (p as unknown as Record<string, unknown>).hashtags = ['#cafe']; }, 'E_SCHEMA'],
    ['texto en inglés con locale es', (p) => {
      p.escenas.forEach((e) => { e.narracion = 'This is the best coffee that you can have in the morning today'; });
    }, 'E_LOCALE'],
  ];

  it.each(casos)('detecta: %s', (_nombre, mutate, code) => {
    const result = validateVideoPlan(brokenPlan(mutate));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.issues.map((issue) => issue.code);
      expect(codes).toContain(code);
    }
  });
});
