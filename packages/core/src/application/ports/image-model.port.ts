import { MAX_REFERENCE_IMAGES } from '../../domain/video-plan';
import type { Aspect } from '../../domain/video-plan';

export interface GeneratedImage {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export { MAX_REFERENCE_IMAGES };

export interface ImageModelPort {
  generate(input: {
    readonly prompt: string;
    readonly aspect: Aspect;
    /**
     * Imágenes de referencia, en orden de importancia: la primera manda el estilo.
     * Nano Banana 2.1 acepta hasta `MAX_REFERENCE_IMAGES`; quien no soporte
     * referencias simplemente las ignora.
     */
    readonly referenceImages?: readonly Uint8Array[];
  }): Promise<GeneratedImage>;
}
