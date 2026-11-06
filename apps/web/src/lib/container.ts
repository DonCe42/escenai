import { join } from 'node:path';
import {
  AesGcmSecretStore,
  FileSecretRepository,
  GoogleKeyVerifier,
  GoogleTextModel,
  SystemClock,
} from '@escenai/adapters';
import { ProviderNotConfiguredError } from '@escenai/core';
import type { KeyVerifierPort, ProviderId, SecretStorePort, TextModelPort } from '@escenai/core';

export type AppMode = 'demo' | 'supabase';

export interface Container {
  readonly mode: AppMode;
  readonly secrets: SecretStorePort | null;
  readonly masterKeyMissing: boolean;
  /** El modelo se construye por workspace porque la key se descifra en cada llamada. */
  readonly textModel: (workspaceId: string) => TextModelPort;
  readonly keyFor: (workspaceId: string, provider: ProviderId) => Promise<string>;
  readonly verifier: KeyVerifierPort;
}

/**
 * Composition root: el único lugar de la app que conoce adaptadores concretos.
 * Cuando exista el adaptador de Supabase, se cambia aquí y en ningún otro sitio.
 */
export function createContainer(): Container {
  const masterKey = process.env.MASTER_KEY ?? '';
  const masterKeyMissing = masterKey.length === 0;

  const secrets = masterKeyMissing
    ? null
    : new AesGcmSecretStore(
        new FileSecretRepository(join(process.cwd(), '.data', 'secrets.json')),
        masterKey,
        new SystemClock(),
      );

  function keyFor(workspaceId: string, provider: ProviderId): Promise<string> {
    if (secrets === null) return Promise.reject(new ProviderNotConfiguredError(provider));
    return secrets.read(workspaceId, provider);
  }

  return {
    mode: 'demo',
    secrets,
    masterKeyMissing,
    keyFor,
    verifier: new GoogleKeyVerifier(),
    textModel: (workspaceId: string) =>
      new GoogleTextModel({
        getApiKey: () => keyFor(workspaceId, 'google'),
        ...(process.env.GOOGLE_TEXT_MODEL ? { model: process.env.GOOGLE_TEXT_MODEL } : {}),
      }),
  };
}
