import type { KeyCheck, KeyVerifierPort, ProviderId } from '@escenai/core';

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GoogleKeyVerifierOptions {
  readonly endpoint?: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Verifica una key de Google con la llamada más barata posible: listar un modelo.
 * No consume cuota de generación y distingue key inválida de permiso o cuota.
 */
export class GoogleKeyVerifier implements KeyVerifierPort {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GoogleKeyVerifierOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async verify(provider: ProviderId, apiKey: string): Promise<KeyCheck> {
    if (provider !== 'google') {
      return { ok: false, reason: 'unsupported', detail: 'Todavía no verificamos este proveedor.' };
    }

    try {
      const response = await this.fetchImpl(`${this.endpoint}?pageSize=1`, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (response.ok) return { ok: true };

      if (response.status === 400) {
        return {
          ok: false,
          reason: 'invalid_key',
          detail: 'Google rechazó la key como inválida (API_KEY_INVALID).',
        };
      }
      if (response.status === 403) {
        return {
          ok: false,
          reason: 'permission_denied',
          detail: 'La key existe pero no tiene permiso sobre la Gemini API.',
        };
      }
      if (response.status === 429) {
        return { ok: false, reason: 'quota', detail: 'La key alcanzó su límite de cuota.' };
      }
      return { ok: false, reason: 'unknown', detail: `HTTP ${response.status}` };
    } catch {
      return { ok: false, reason: 'network', detail: 'No se pudo contactar con Google.' };
    }
  }
}
