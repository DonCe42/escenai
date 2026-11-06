import { ProviderNotConfiguredError } from '@escenai/core';
import type { Aspect, GeneratedImage, ImageModelPort } from '@escenai/core';

const DEFAULT_BASE_URL = 'https://api.minimax.io';
export const DEFAULT_MINIMAX_IMAGE_MODEL = 'image-01';

export interface MinimaxImageModelOptions {
  readonly getApiKey: () => Promise<string>;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

interface ImageResponse {
  readonly data?: { readonly image_base64?: readonly string[]; readonly image_urls?: readonly string[] };
  readonly base_resp?: { readonly status_code?: number; readonly status_msg?: string };
}

/**
 * Imágenes de MiniMax (image-01). Devuelve JPEG en base64.
 * Es la alternativa cuando el usuario solo tiene key de MiniMax y no de Google.
 */
export class MinimaxImageModel implements ImageModelPort {
  constructor(private readonly options: MinimaxImageModelOptions) {}

  async generate(input: {
    readonly prompt: string;
    readonly aspect: Aspect;
    readonly referenceImage?: Uint8Array;
  }): Promise<GeneratedImage> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const apiKey = await this.options.getApiKey().catch(() => {
      throw new ProviderNotConfiguredError('minimax');
    });
    const baseUrl = this.options.baseUrl ?? DEFAULT_BASE_URL;

    const response = await fetchImpl(`${baseUrl}/v1/image_generation`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.options.model ?? DEFAULT_MINIMAX_IMAGE_MODEL,
        prompt: input.prompt,
        aspect_ratio: input.aspect,
        response_format: 'base64',
        n: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`MiniMax imagen respondió HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as ImageResponse;
    const status = payload.base_resp?.status_code ?? 0;
    if (status !== 0) {
      throw new Error(`MiniMax imagen ${status}: ${payload.base_resp?.status_msg ?? 'error'}`);
    }

    const base64 = payload.data?.image_base64?.[0];
    if (base64 === undefined) {
      throw new Error('MiniMax no devolvió ninguna imagen.');
    }

    return {
      bytes: Uint8Array.from(Buffer.from(base64, 'base64')),
      mimeType: 'image/jpeg',
    };
  }
}
