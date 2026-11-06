import type { KeyCheck, KeyVerifierPort, ProviderId } from '@escenai/core';
import { DEFAULT_VERTEX_LOCATION, DEFAULT_VERTEX_MODEL } from './vertex-text-model';
import { InvalidServiceAccountError, mintAccessToken, parseServiceAccount } from './vertex-credentials';

export interface VertexKeyVerifierOptions {
  readonly model?: string;
  readonly location?: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Verifica la cuenta de servicio pidiendo un token y una generación de un token de salida.
 * Es la comprobación más barata que demuestra que la credencial y el modelo funcionan.
 */
export class VertexKeyVerifier implements KeyVerifierPort {
  constructor(private readonly options: VertexKeyVerifierOptions = {}) {}

  async verify(provider: ProviderId, apiKey: string): Promise<KeyCheck> {
    if (provider !== 'google-vertex') {
      return { ok: false, reason: 'unsupported', detail: 'Verificador no aplicable a este proveedor.' };
    }

    const fetchImpl = this.options.fetchImpl ?? fetch;
    let account;
    try {
      account = parseServiceAccount(apiKey);
    } catch (error) {
      const detail =
        error instanceof InvalidServiceAccountError ? error.message : 'JSON de credenciales inválido.';
      return { ok: false, reason: 'invalid_key', detail };
    }

    try {
      const token = await mintAccessToken(account, fetchImpl);
      const location = this.options.location ?? DEFAULT_VERTEX_LOCATION;
      const model = this.options.model ?? DEFAULT_VERTEX_MODEL;
      const base =
        location === 'global'
          ? 'https://aiplatform.googleapis.com/v1'
          : `https://${location}-aiplatform.googleapis.com/v1`;

      const response = await fetchImpl(
        `${base}/projects/${account.project_id}/locations/${location}/publishers/google/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token.token}` },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
            generationConfig: { maxOutputTokens: 1, temperature: 0 },
          }),
        },
      );

      if (response.ok) return { ok: true };
      if (response.status === 404) {
        return {
          ok: false,
          reason: 'permission_denied',
          detail: `La cuenta no tiene acceso al modelo ${model} en ${location}.`,
        };
      }
      if (response.status === 403) {
        return { ok: false, reason: 'permission_denied', detail: 'La cuenta no tiene rol de Vertex AI.' };
      }
      if (response.status === 429) return { ok: false, reason: 'quota' };
      return { ok: false, reason: 'unknown', detail: `HTTP ${response.status}` };
    } catch (error) {
      return {
        ok: false,
        reason: 'network',
        detail: error instanceof Error ? error.message.slice(0, 160) : undefined,
      };
    }
  }
}
