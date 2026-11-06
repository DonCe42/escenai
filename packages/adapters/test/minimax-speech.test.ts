import { describe, expect, it } from 'vitest';
import { MinimaxSpeech } from '../src/providers/minimax/speech';

const words = [
  {
    text: 'Hola mundo',
    timestamped_words: [
      { word: 'Hola', time_begin: 0, time_end: 420 },
      { word: 'mundo', time_begin: 440, time_end: 900 },
    ],
  },
];

function fakeFetch(options: { status?: number; audio?: string; subtitle?: boolean } = {}): typeof fetch {
  return (async (url: string | URL) => {
    const target = String(url);
    if (target.includes('subtitle')) {
      return { ok: true, status: 200, json: async () => words, text: async () => '' };
    }
    return {
      ok: (options.status ?? 200) < 300,
      status: options.status ?? 200,
      json: async () => ({
        data: {
          audio: options.audio ?? 'fffb90',
          ...(options.subtitle === false ? {} : { subtitle_file: 'https://cdn.example/subtitle.json' }),
        },
        extra_info: { audio_length: 900 },
        base_resp: { status_code: 0 },
      }),
      text: async () => 'error',
    };
  }) as unknown as typeof fetch;
}

describe('MinimaxSpeech', () => {
  it('devuelve audio, duración y timestamps por palabra', async () => {
    const speech = new MinimaxSpeech({ getApiKey: async () => 'k', fetchImpl: fakeFetch() });
    const result = await speech.synthesize({ text: 'Hola mundo', locale: 'es' });

    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.durationMs).toBe(900);
    expect(result.audio.byteLength).toBe(3);
    expect(result.words).toEqual([
      { word: 'Hola', startMs: 0, endMs: 420 },
      { word: 'mundo', startMs: 440, endMs: 900 },
    ]);
  });

  it('sigue funcionando si el CDN de subtítulos falla', async () => {
    const speech = new MinimaxSpeech({
      getApiKey: async () => 'k',
      fetchImpl: (async (url: string | URL) => {
        if (String(url).includes('subtitle')) throw new Error('cdn caído');
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { audio: 'ff', subtitle_file: 'https://cdn.example/subtitle.json' }, extra_info: { audio_length: 10 }, base_resp: { status_code: 0 } }),
          text: async () => '',
        };
      }) as unknown as typeof fetch,
    });

    const result = await speech.synthesize({ text: 'Hola', locale: 'es' });
    expect(result.words).toEqual([]);
    expect(result.durationMs).toBe(10);
  });

  it('propaga el error de negocio de MiniMax', async () => {
    const speech = new MinimaxSpeech({
      getApiKey: async () => 'k',
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        json: async () => ({ base_resp: { status_code: 1004, status_msg: 'auth failed' } }),
        text: async () => '',
      })) as unknown as typeof fetch,
    });
    await expect(speech.synthesize({ text: 'Hola', locale: 'es' })).rejects.toThrow(/1004/);
  });
});
