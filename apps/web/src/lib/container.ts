import { join } from 'node:path';
import { AesGcmSecretStore, FileSecretRepository, SystemClock } from '@escenai/adapters';
import type { SecretStorePort } from '@escenai/core';

export type AppMode = 'demo' | 'supabase';

export interface Container {
  readonly mode: AppMode;
  readonly secrets: SecretStorePort | null;
  readonly masterKeyMissing: boolean;
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

  return { mode: 'demo', secrets, masterKeyMissing };
}
