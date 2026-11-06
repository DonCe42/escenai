import type { Aspect } from '../../domain/video-plan';

export interface GeneratedImage {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface ImageModelPort {
  generate(input: {
    readonly prompt: string;
    readonly aspect: Aspect;
    readonly referenceImage?: Uint8Array;
  }): Promise<GeneratedImage>;
}
