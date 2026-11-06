import { describe, expect, it } from 'vitest';
import { estimateClipCost, estimateCost } from '../src/domain/cost-estimator';
import type { VideoPlan } from '../src/domain/video-plan';

const plan: VideoPlan = {
  version: 1,
  locale: 'es',
  titulo: 'Prueba',
  duracionObjetivoS: 10,
  styleToken: 'x',
  escenas: [
    { id: 's1', rol: 'hook', narracion: 'a'.repeat(500), textoPantalla: ['HOLA'], promptImagen: 'algo suficientemente largo', movimiento: 'estatico', duracionEstimadaS: 5 },
    { id: 's2', rol: 'cta', narracion: 'a'.repeat(510), textoPantalla: ['ADIOS'], promptImagen: 'otra cosa suficientemente larga', movimiento: 'estatico', duracionEstimadaS: 5 },
  ],
};

const prices = { imagePerUnit: 0.04, speechPer1kChars: 0.15, videoPerSecond: 0.4, musicPerTrack: 0.3 };

describe('estimateCost', () => {
  it('suma imágenes y voz sin clips', () => {
    const cost = estimateCost(plan, prices);
    expect(cost.images).toBe(0.08);
    expect(cost.speech).toBe(0.1515);
    expect(cost.video).toBe(0);
    expect(cost.music).toBe(0);
    expect(cost.total).toBe(0.2315);
  });

  it('estima el costo de un clip con la tabla oficial de MiniMax', () => {
    expect(estimateClipCost('MiniMax-H3-Lite', '768P', 5)).toBe(0.2);
    expect(estimateClipCost('MiniMax-H3', '2K', 5)).toBe(0.65);
    expect(estimateClipCost('MiniMax-H3-Highspeed', '480P', 6)).toBe(0.24);
    // resolución desconocida: cae a la primera de la tabla, nunca devuelve NaN
    expect(estimateClipCost('MiniMax-H3-Lite', '4K', 5)).toBe(0.2);
  });

  it('el clip generativo domina el costo', () => {
    const cost = estimateCost(plan, prices, { clips: { count: 1, seconds: 5 }, music: true });
    expect(cost.video).toBe(2);
    expect(cost.total).toBeCloseTo(2.5315, 4);
  });
});
