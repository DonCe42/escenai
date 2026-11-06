import { ProviderNotConfiguredError } from '@escenai/core';
import type { TextModelPort } from '@escenai/core';
import { extractJsonObject, ProviderHttpError } from './text-model';
import { mintAccessToken, parseServiceAccount } from './vertex-credentials';
import type { AccessToken } from './vertex-credentials';

export const DEFAULT_VERTEX_MODEL = 'gemini-3.6-flash';
export const DEFAULT_VERTEX_LOCATION = 'global';

export interface VertexTextModelOptions {
  readonly getCredentials: () => Promise<string>;
  readonly model?: string;
  readonly location?: string;
  readonly fetchImpl?: typeof fetch;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

interface Candidate {
  readonly content?: { readonly parts?: readonly { readonly text?: string }[] };
  readonly finishReason?: string;
}

function endpointFor(location: string): string {
  return location === 'global'
    ? 'https://aiplatform.googleapis.com/v1'
    : `https://${location}-aiplatform.googleapis.com/v1`;
}

/**
 * Gemini por Vertex AI con cuenta de servicio.
 * Nota: los modelos nuevos solo responden en la ubicación "global"; en us-central1 dan 404.
 */
export class VertexTextModel implements TextModelPort {
  private cached: AccessToken | null = null;

  constructor(private readonly options: VertexTextModelOptions) {}

  async generateJson(input: {
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly schemaName: string;
  }): Promise<unknown> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const token = await this.accessToken(fetchImpl);
    const location = this.options.location ?? DEFAULT_VERTEX_LOCATION;
    const model = this.options.model ?? DEFAULT_VERTEX_MODEL;

    let account;
    try {
      account = parseServiceAccount(await this.options.getCredentials());
    } catch (error) {
      if (error instanceof Error && error.name === 'InvalidServiceAccountError') throw error;
      throw new ProviderNotConfiguredError('google-vertex');
    }

    const url = `${endpointFor(location)}/projects/${account.project_id}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: this.options.temperature ?? 0.8,
          maxOutputTokens: this.options.maxOutputTokens ?? 8192,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ProviderHttpError('google-vertex', response.status, body);
    }

    const payload = (await response.json()) as { candidates?: readonly Candidate[] };
    const text =
      payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    if (text.trim().length === 0) {
      throw new Error('Vertex no devolvió texto para el guion.');
    }
    return extractJsonObject(text);
  }

  private async accessToken(fetchImpl: typeof fetch): Promise<string> {
    if (this.cached !== null && this.cached.expiresAtMs > Date.now()) return this.cached.token;

    const raw = await this.options.getCredentials().catch(() => {
      throw new ProviderNotConfiguredError('google-vertex');
    });
    const account = parseServiceAccount(raw);
    this.cached = await mintAccessToken(account, fetchImpl);
    return this.cached.token;
  }
}
