import { ProviderNotConfiguredError } from '@escenai/core';
import type { SpeechPort, SynthesizedSpeech } from '@escenai/core';

/**
 * speech-2.8-hd con subtitle_type: "word".
 * Los timestamps por palabra son obligatorios: sin ellos no hay karaoke ni subtítulos
 * sincronizados, y el producto pierde su rasgo visual. Fase 3.
 */
export class MinimaxSpeech implements SpeechPort {
  async synthesize(): Promise<SynthesizedSpeech> {
    throw new ProviderNotConfiguredError('minimax');
  }
}
