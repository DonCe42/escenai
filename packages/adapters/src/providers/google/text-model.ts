import { ProviderNotConfiguredError } from '@escenai/core';
import type { TextModelPort } from '@escenai/core';

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.8-flash';

export class ProviderHttpError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`HTTP ${status} del proveedor ${provider}: ${body.slice(0, 300)}`);
    this.name = 'ProviderHttpError';
  }
}

export interface GoogleTextModelOptions {
  /** Se resuelve en cada llamada: la key descifrada no se guarda en el objeto. */
  readonly getApiKey: () => Promise<string>;
  readonly model?: string;
  readonly endpoint?: string;
  readonly fetchImpl?: typeof fetch;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

/** Quita cercas de markdown y texto alrededor del primer objeto JSON. */
export function extractJsonObject(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new SyntaxError('La respuesta del modelo no contiene un objeto JSON.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

interface GoogleResponse {
  readonly candidates?: readonly {
    readonly content?: { readonly parts?: readonly { readonly text?: string }[] };
    readonly finishReason?: string;
  }[];
  readonly promptFeedback?: { readonly blockReason?: string };
}

function readText(payload: GoogleResponse): string {
  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (text.trim().length === 0) {
    const reason = payload.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'sin texto';
    throw new Error(`El modelo no devolvió texto (${reason}).`);
  }
  return text;
}

/**
 * Texto de Google por la API generateContent (sigue soportada; la Interactions API
 * es la ruta nueva y se migrará cuando haya una razón concreta).
 * El modelo llega por configuración: los IDs caducan cada trimestre.
 */
export class GoogleTextModel implements TextModelPort {
  private readonly model: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GoogleTextModelOptions) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateJson(input: {
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly schemaName: string;
  }): Promise<unknown> {
    const apiKey = await this.options.getApiKey().catch(() => {
      throw new ProviderNotConfiguredError('google');
    });

    const url = `${this.endpoint}/${encodeURIComponent(this.model)}:generateContent`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
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
      throw new ProviderHttpError('google', response.status, body);
    }

    const payload = (await response.json()) as GoogleResponse;
    return extractJsonObject(readText(payload));
  }
}
