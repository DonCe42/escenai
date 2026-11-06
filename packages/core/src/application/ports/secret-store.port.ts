export type ProviderId = 'google' | 'minimax';

export interface SecretSummary {
  readonly provider: ProviderId;
  readonly masked: string;
  readonly updatedAt: string;
  readonly verified: boolean;
}

/** Lo que se guarda cifrado. El texto plano nunca se persiste ni se loguea. */
export interface StoredSecret {
  readonly workspaceId: string;
  readonly provider: ProviderId;
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
  readonly masked: string;
  readonly updatedAt: string;
  readonly verified: boolean;
}

export interface SecretRepositoryPort {
  upsert(secret: StoredSecret): Promise<void>;
  findByProvider(workspaceId: string, provider: ProviderId): Promise<StoredSecret | null>;
  listByWorkspace(workspaceId: string): Promise<readonly StoredSecret[]>;
  delete(workspaceId: string, provider: ProviderId): Promise<void>;
}

export interface SecretStorePort {
  save(workspaceId: string, provider: ProviderId, apiKey: string): Promise<SecretSummary>;
  /** Solo para el adaptador que va a llamar al proveedor. Nunca se devuelve por HTTP. */
  read(workspaceId: string, provider: ProviderId): Promise<string>;
  list(workspaceId: string): Promise<readonly SecretSummary[]>;
  remove(workspaceId: string, provider: ProviderId): Promise<void>;
}
