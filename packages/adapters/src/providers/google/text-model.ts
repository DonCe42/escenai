import { ProviderNotConfiguredError } from '@escenai/core';
import type { TextModelPort } from '@escenai/core';

/**
 * Adaptador de texto de Google (Gemini).
 * Fase 3: usa el modelo configurado en GOOGLE_TEXT_MODEL (nunca hardcodeado: los IDs caducan).
 * El contrato con el núcleo ya está cerrado; falta la llamada real y su contract test.
 */
export class GoogleTextModel implements TextModelPort {
  constructor(private readonly getApiKey: () => Promise<string>) {}

  async generateJson(): Promise<unknown> {
    await this.getApiKey().catch(() => {
      throw new ProviderNotConfiguredError('google');
    });
    throw new ProviderNotConfiguredError('google');
  }
}
