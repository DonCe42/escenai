import { ProviderNotConfiguredError } from '@escenai/core';
import type { Locale, SpeechPort, SynthesizedSpeech, WordTiming } from '@escenai/core';

const DEFAULT_BASE_URL = 'https://api.minimax.io';
const DEFAULT_MODEL = 'speech-2.8-hd';
const DEFAULT_VOICE_ES = 'female-shaonv';
const DEFAULT_VOICE_EN = 'female-shaonv';

export type MinimaxVoiceId = string;

export interface MinimaxSpeechOptions {
  readonly getApiKey: () => Promise<string>;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly voiceEs?: MinimaxVoiceId;
  readonly voiceEn?: MinimaxVoiceId;
}

interface Segment {
  readonly timestamped_words?: readonly {
    readonly word?: string;
    readonly time_begin?: number;
    readonly time_end?: number;
  }[];
}

interface TtsResponse {
  readonly data?: { readonly audio?: string; readonly subtitle_file?: string };
  readonly extra_info?: { readonly audio_length?: number };
  readonly base_resp?: { readonly status_code?: number; readonly status_msg?: string };
}

/**
 * MiniMax entrega los timestamps por trozos ("ca", "f", "é"), no por palabras.
 * Los trozos concatenados reproducen el texto exacto, incluidos los espacios,
 * así que se agrupan hasta el siguiente separador. Sin esto el karaoke muestra
 * "ca f é" en pantalla.
 */
function flattenWords(segments: readonly Segment[]): readonly WordTiming[] {
  const words: WordTiming[] = [];

  for (const segment of segments) {
    const chunks = segment.timestamped_words ?? [];
    const hasSeparators = chunks.some((chunk) => (chunk.word ?? '').trim() === '');

    if (!hasSeparators) {
      for (const chunk of chunks) {
        if (chunk.word === undefined) continue;
        words.push({ word: chunk.word, startMs: chunk.time_begin ?? 0, endMs: chunk.time_end ?? 0 });
      }
      continue;
    }

    let current = '';
    let startMs = -1;
    let endMs = 0;

    for (const chunk of chunks) {
      const piece = chunk.word ?? '';
      if (piece.trim().length === 0) {
        if (current.length > 0) {
          words.push({ word: current, startMs, endMs });
          current = '';
          startMs = -1;
        }
        continue;
      }
      if (current.length === 0) startMs = chunk.time_begin ?? 0;
      current += piece;
      endMs = chunk.time_end ?? endMs;
    }

    if (current.length > 0) words.push({ word: current, startMs, endMs });
  }

  return words;
}

/**
 * Voz de MiniMax con marcas de tiempo por palabra.
 * Sin los timestamps el producto pierde el karaoke y los subtítulos sincronizados,
 * así que se piden siempre y se descargan en el momento (la URL caduca a las 24 h).
 */
export class MinimaxSpeech implements SpeechPort {
  constructor(private readonly options: MinimaxSpeechOptions) {}

  async synthesize(input: {
    readonly text: string;
    readonly locale: Locale;
    readonly voiceId?: string;
  }): Promise<SynthesizedSpeech> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const apiKey = await this.options.getApiKey().catch(() => {
      throw new ProviderNotConfiguredError('minimax');
    });
    const baseUrl = this.options.baseUrl ?? DEFAULT_BASE_URL;

    const voiceId =
      input.voiceId ??
      (input.locale === 'en'
        ? (this.options.voiceEn ?? DEFAULT_VOICE_EN)
        : (this.options.voiceEs ?? DEFAULT_VOICE_ES));

    const response = await fetchImpl(`${baseUrl}/v1/t2a_v2`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.options.model ?? DEFAULT_MODEL,
        text: input.text,
        stream: false,
        language_boost: input.locale === 'en' ? 'English' : 'Spanish',
        output_format: 'hex',
        subtitle_enable: true,
        subtitle_type: 'word',
        voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 44100, bitrate: 128000, format: 'mp3', channel: 1 },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`MiniMax respondió HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as TtsResponse;
    const status = payload.base_resp?.status_code ?? 0;
    if (status !== 0) {
      throw new Error(`MiniMax ${status}: ${payload.base_resp?.status_msg ?? 'error desconocido'}`);
    }
    if (payload.data?.audio === undefined) {
      throw new Error('MiniMax no devolvió audio.');
    }

    let words: readonly WordTiming[] = [];
    const subtitleUrl = payload.data.subtitle_file;
    if (subtitleUrl !== undefined) {
      try {
        const subtitleResponse = await fetchImpl(subtitleUrl);
        if (subtitleResponse.ok) {
          words = flattenWords((await subtitleResponse.json()) as readonly Segment[]);
        }
      } catch {
        // Sin subtítulos el video sigue siendo posible; sin audio, no.
        words = [];
      }
    }

    return {
      audio: Uint8Array.from(Buffer.from(payload.data.audio, 'hex')),
      mimeType: 'audio/mpeg',
      durationMs: payload.extra_info?.audio_length ?? 0,
      words,
    };
  }
}
