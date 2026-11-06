import { join } from 'node:path';
import {
  AesGcmSecretStore,
  FileSecretRepository,
  GoogleKeyVerifier,
  GoogleTextModel,
  SystemClock,
  VertexKeyVerifier,
  VertexTextModel,
} from '@escenai/adapters';
import { ProviderNotConfiguredError } from '@escenai/core';
import type { KeyVerifierPort, ProviderId, SecretStorePort, TextModelPort } from '@escenai/core';

export type AppMode = 'demo' | 'supabase';

/** Vertex exige cuenta de servicio; la API key directa es otra vía de acceso al mismo modelo. */
export type TextProviderKind = 'vertex' | 'api-key';

export interface Container {
  readonly mode: AppMode;
  readonly secrets: SecretStorePort | null;
  readonly masterKeyMissing: boolean;
  /** El modelo se construye por workspace porque la key se descifra en cada llamada. */
  readonly textModel: (workspaceId: string, kind: TextProviderKind) => TextModelPort;
  readonly detectTextProvider: (workspaceId: string) => Promise<TextProviderKind | null>;
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
    verifier: {
      verify: (provider, apiKey) =>
        provider === 'google-vertex'
          ? new VertexKeyVerifier({
              ...(process.env.GOOGLE_TEXT_MODEL ? { model: process.env.GOOGLE_TEXT_MODEL } : {}),
              ...(process.env.VERTEX_LOCATION ? { location: process.env.VERTEX_LOCATION } : {}),
            }).verify(provider, apiKey)
          : new GoogleKeyVerifier().verify(provider, apiKey),
    },
    async detectTextProvider(workspaceId: string): Promise<TextProviderKind | null> {
      if (secrets === null) return null;
      const list = await secrets.list(workspaceId);
      if (list.some((secret) => secret.provider === 'google-vertex')) return 'vertex';
      if (list.some((secret) => secret.provider === 'google')) return 'api-key';
      return null;
    },
    textModel: (workspaceId: string, kind: TextProviderKind) =>
      kind === 'vertex'
        ? new VertexTextModel({
            getCredentials: () => keyFor(workspaceId, 'google-vertex'),
            ...(process.env.GOOGLE_TEXT_MODEL ? { model: process.env.GOOGLE_TEXT_MODEL } : {}),
            ...(process.env.VERTEX_LOCATION ? { location: process.env.VERTEX_LOCATION } : {}),
          })
        : new GoogleTextModel({
            getApiKey: () => keyFor(workspaceId, 'google'),
            ...(process.env.GOOGLE_TEXT_MODEL ? { model: process.env.GOOGLE_TEXT_MODEL } : {}),
          }),
  };
}
