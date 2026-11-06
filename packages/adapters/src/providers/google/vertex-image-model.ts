import { ProviderNotConfiguredError } from '@escenai/core';
import type { Aspect, GeneratedImage, ImageModelPort } from '@escenai/core';
import { mintAccessToken, parseServiceAccount } from './vertex-credentials';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
import type { AccessToken, ServiceAccount } from './vertex-credentials';

export const DEFAULT_IMAGE_MODEL = 'gemini-nano-banana-2.1';
export type ImageSize = '1K' | '2K';

export interface VertexImageModelOptions {
  readonly getCredentials: () => Promise<string>;
  readonly model?: string;
  readonly location?: string;
  readonly imageSize?: ImageSize;
  readonly fetchImpl?: typeof fetch;
  /** Vertex limita por minuto: sin reintento, un lote de 7 escenas falla a la mitad. */
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
}

interface InlineData {
  readonly mimeType?: string;
  readonly data?: string;
}

interface Candidate {
  readonly content?: { readonly parts?: readonly { readonly inlineData?: InlineData }[] };
}

function baseUrl(location: string): string {
  return location === 'global'
    ? 'https://aiplatform.googleapis.com/v1'
    : `https://${location}-aiplatform.googleapis.com/v1`;
}

/**
 * Nano Banana por Vertex AI con cuenta de servicio.
 * La relación de aspecto se pide en generationConfig.imageConfig, no en el texto:
 * pedirla en el prompt da resultados inconsistentes.
 */
export class VertexImageModel implements ImageModelPort {
  private cached: AccessToken | null = null;

  constructor(private readonly options: VertexImageModelOptions) {}

  async generate(input: {
    readonly prompt: string;
    readonly aspect: Aspect;
    readonly referenceImage?: Uint8Array;
  }): Promise<GeneratedImage> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const raw = await this.options.getCredentials().catch(() => {
      throw new ProviderNotConfiguredError('google-vertex');
    });
    const account = parseServiceAccount(raw);
    const token = await this.accessToken(account, fetchImpl);

    const location = this.options.location ?? 'global';
    const model = this.options.model ?? DEFAULT_IMAGE_MODEL;
    const url = `${baseUrl(location)}/projects/${account.project_id}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const parts: unknown[] = [{ text: input.prompt }];
    if (input.referenceImage !== undefined) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: Buffer.from(input.referenceImage).toString('base64'),
        },
      });
    }

    const payloadBody = JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: input.aspect,
          ...(this.options.imageSize === undefined ? {} : { imageSize: this.options.imageSize }),
        },
      },
    });

    const maxAttempts = this.options.maxAttempts ?? 5;
    const baseDelayMs = this.options.baseDelayMs ?? 15000;
    let response: Response | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: payloadBody,
      });

      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt === maxAttempts) break;

      // Si Google dice cuánto esperar, se respeta; si no, espera creciente.
      const retryAfter = Number(response.headers?.get?.('retry-after') ?? 0);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * attempt;
      await sleep(waitMs);
    }

    if (response === null || !response.ok) {
      const body = await response?.text().catch(() => '');
      throw new Error(
        `Nano Banana respondió HTTP ${response?.status ?? 0}: ${(body ?? '').slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as { candidates?: readonly Candidate[] };
    const inline = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
    if (inline?.data === undefined) {
      throw new Error('El modelo de imagen no devolvió ninguna imagen.');
    }

    return {
      bytes: Uint8Array.from(Buffer.from(inline.data, 'base64')),
      mimeType: inline.mimeType ?? 'image/png',
    };
  }

  private async accessToken(account: ServiceAccount, fetchImpl: typeof fetch): Promise<string> {
    if (this.cached !== null && this.cached.expiresAtMs > Date.now()) return this.cached.token;
    this.cached = await mintAccessToken(account, fetchImpl);
    return this.cached.token;
  }
}
