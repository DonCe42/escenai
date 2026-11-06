import { ProviderNotConfiguredError } from '@escenai/core';
import type { GeneratedImage, ImageModelPort } from '@escenai/core';

/**
 * Nano Banana (gemini-nano-banana-2.1) para las ilustraciones de cada escena.
 * Fase 3. El puerto ya define el contrato: prompt, aspect y opcional imagen de referencia.
 */
export class NanoBananaImageModel implements ImageModelPort {
  async generate(): Promise<GeneratedImage> {
    throw new ProviderNotConfiguredError('google');
  }
}
