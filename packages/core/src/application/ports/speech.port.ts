import type { Locale } from '../../domain/video-plan';
import type { WordTiming } from '../../domain/word-timing';

export type { WordTiming };

export interface SynthesizedSpeech {
  readonly audio: Uint8Array;
  readonly mimeType: string;
  readonly durationMs: number;
  /** Imprescindible: sin timestamps no hay subtítulos sincronizados ni karaoke. */
  readonly words: readonly WordTiming[];
}

export interface SpeechPort {
  synthesize(input: {
    readonly text: string;
    readonly locale: Locale;
    readonly voiceId?: string;
  }): Promise<SynthesizedSpeech>;
}
