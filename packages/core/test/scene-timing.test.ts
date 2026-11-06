import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../src/domain/scene-timing';
import type { SceneAudio } from '../src/domain/scene-timing';
import { MissingAudioError } from '../src/domain/errors';
import type { VideoPlan } from '../src/domain/video-plan';

const plan: VideoPlan = {
  version: 1,
  locale: 'es',
  titulo: 'Prueba',
  duracionObjetivoS: 10,
  styleToken: 'x',
  escenas: [
    { id: 's1', rol: 'hook', narracion: 'a b c d e f g h', textoPantalla: ['HOLA'], promptImagen: 'algo suficientemente largo', movimiento: 'estatico', duracionEstimadaS: 3 },
    { id: 's2', rol: 'cta', narracion: 'a b c d e f g h', textoPantalla: ['ADIOS'], promptImagen: 'otra cosa suficientemente larga', movimiento: 'estatico', duracionEstimadaS: 3 },
  ],
};

const audios: readonly SceneAudio[] = [
  { sceneId: 's1', durationMs: 2000, words: [{ word: 'hola', startMs: 0, endMs: 300 }] },
  { sceneId: 's2', durationMs: 2500, words: [{ word: 'adios', startMs: 100, endMs: 400 }] },
];

describe('buildTimeline', () => {
  it('encadena escenas con lead-in y cola, y desplaza los timestamps de las palabras', () => {
    const timeline = buildTimeline(plan, audios, { leadInMs: 100, tailMs: 200, betweenScenesMs: 50, tolerance: 0.15 });

    expect(timeline.scenes.map((s) => [s.startsAtMs, s.endsAtMs])).toEqual([
      [100, 2300],
      [2450, 5150],
    ]);
    expect(timeline.totalMs).toBe(5150);
    expect(timeline.scenes[1]!.words[0]!.startMs).toBe(2550);
  });

  it('marca el exceso de presupuesto cuando la voz no cabe', () => {
    const timeline = buildTimeline(plan, audios, { leadInMs: 0, tailMs: 0, betweenScenesMs: 0, tolerance: 0.1 });
    expect(timeline.totalMs).toBe(4500);
    expect(timeline.exceedsBudget).toBe(false);
  });

  it('falla si una escena no tiene audio', () => {
    expect(() => buildTimeline(plan, [audios[0]!])).toThrow(MissingAudioError);
  });
});
