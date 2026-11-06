import type { ProviderId } from './secret-store.port';

export type KeyCheckReason =
  | 'invalid_key'
  | 'permission_denied'
  | 'quota'
  | 'network'
  | 'unsupported'
  | 'unknown';

export type KeyCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: KeyCheckReason; readonly detail?: string };

/** Comprueba una key contra el proveedor antes de confiar en ella. */
export interface KeyVerifierPort {
  verify(provider: ProviderId, apiKey: string): Promise<KeyCheck>;
}
