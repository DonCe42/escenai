import { describe, expect, it } from 'vitest';
import { groupWordChunks } from '../src/index';

describe('groupWordChunks', () => {
  it('agrupa trozos de letra en palabras y no deja letras sueltas', () => {
    const chunks = [
      { word: 'E', startMs: 0, endMs: 40 },
      { word: 'l', startMs: 40, endMs: 80 },
      { word: ' ', startMs: 80, endMs: 90 },
      { word: 'ca', startMs: 90, endMs: 140 },
      { word: 'f', startMs: 140, endMs: 170 },
      { word: 'é', startMs: 170, endMs: 220 },
      { word: ' ', startMs: 220, endMs: 230 },
      { word: 'd', startMs: 230, endMs: 260 },
      { word: 'e', startMs: 260, endMs: 300 },
    ];

    const words = groupWordChunks(chunks);
    expect(words.map((w) => w.word)).toEqual(['El', 'café', 'de']);
    expect(words[0]).toEqual({ word: 'El', startMs: 0, endMs: 80 });
    expect(words[1]?.endMs).toBe(220);
  });

  it('deja intacto un arreglo ya agrupado', () => {
    const words = [
      { word: 'El', startMs: 0, endMs: 80 },
      { word: 'café', startMs: 90, endMs: 220 },
    ];
    expect(groupWordChunks(words)).toBe(words);
  });

  it('cierra la última palabra aunque no haya espacio final', () => {
    const words = groupWordChunks([
      { word: 'h', startMs: 0, endMs: 10 },
      { word: 'o', startMs: 10, endMs: 20 },
      { word: 'l', startMs: 20, endMs: 30 },
      { word: 'a', startMs: 30, endMs: 40 },
      { word: ' ', startMs: 40, endMs: 50 },
      { word: 'y', startMs: 50, endMs: 60 },
      { word: 'a', startMs: 60, endMs: 70 },
    ]);
    expect(words.map((w) => w.word)).toEqual(['hola', 'ya']);
    expect(words[1]).toEqual({ word: 'ya', startMs: 50, endMs: 70 });
  });

  it('sin trozos de espacio no inventa agrupaciones', () => {
    const chunks = [
      { word: 'hola', startMs: 0, endMs: 40 },
      { word: 'ya', startMs: 50, endMs: 70 },
    ];
    expect(groupWordChunks(chunks)).toBe(chunks);
  });
});
