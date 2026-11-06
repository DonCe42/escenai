import { ProviderNotConfiguredError } from '@escenai/core';
import type {
  ProviderId,
  SecretRepositoryPort,
  SecretStorePort,
  SecretSummary,
  StoredSecret,
} from '@escenai/core';
import type { ClockPort } from '@escenai/core';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const MIN_API_KEY_LENGTH = 8;

export class InvalidApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidApiKeyError';
  }
}

export class MissingSecretError extends ProviderNotConfiguredError {
  constructor(provider: ProviderId) {
    super(provider);
    this.name = 'MissingSecretError';
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  // Se construye sobre un ArrayBuffer explícito: WebCrypto exige BufferSource y
  // Uint8Array<ArrayBufferLike> no es asignable (TS 5.9 con typed arrays genéricos).
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function maskKey(apiKey: string): string {
  return `••••${apiKey.slice(-4)}`;
}

/**
 * Guarda las API keys cifradas con AES-256-GCM (WebCrypto, disponible en Node y en el edge).
 * El texto plano vive solo en memoria del proceso que hace la llamada al proveedor.
 */
export class AesGcmSecretStore implements SecretStorePort {
  private cachedKey: CryptoKey | null = null;

  constructor(
    private readonly repository: SecretRepositoryPort,
    private readonly masterKeyBase64: string,
    private readonly clock: ClockPort,
  ) {}

  async save(workspaceId: string, provider: ProviderId, apiKey: string): Promise<SecretSummary> {
    const trimmed = apiKey.trim();
    if (trimmed.length < MIN_API_KEY_LENGTH) {
      throw new InvalidApiKeyError('La API key es demasiado corta.');
    }
    if (/\s/.test(trimmed)) {
      throw new InvalidApiKeyError('La API key no puede contener espacios.');
    }

    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const encoded = new TextEncoder().encode(trimmed);
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded));

    const ciphertext = sealed.slice(0, sealed.length - TAG_BYTES);
    const tag = sealed.slice(sealed.length - TAG_BYTES);

    const stored: StoredSecret = {
      workspaceId,
      provider,
      ciphertext: toBase64(ciphertext),
      iv: toBase64(iv),
      tag: toBase64(tag),
      masked: maskKey(trimmed),
      updatedAt: this.clock.nowIso(),
      verified: false,
    };

    await this.repository.upsert(stored);
    return { provider, masked: stored.masked, updatedAt: stored.updatedAt, verified: stored.verified };
  }

  async read(workspaceId: string, provider: ProviderId): Promise<string> {
    const stored = await this.repository.findByProvider(workspaceId, provider);
    if (stored === null) throw new MissingSecretError(provider);

    const key = await this.getKey();
    const ciphertext = fromBase64(stored.ciphertext);
    const tag = fromBase64(stored.tag);
    const sealed = new Uint8Array(ciphertext.length + tag.length);
    sealed.set(ciphertext, 0);
    sealed.set(tag, ciphertext.length);

    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(stored.iv) },
      key,
      sealed,
    );
    return new TextDecoder().decode(plain);
  }

  async list(workspaceId: string): Promise<readonly SecretSummary[]> {
    const stored = await this.repository.listByWorkspace(workspaceId);
    return stored.map((secret) => ({
      provider: secret.provider,
      masked: secret.masked,
      updatedAt: secret.updatedAt,
      verified: secret.verified,
    }));
  }

  async remove(workspaceId: string, provider: ProviderId): Promise<void> {
    await this.repository.delete(workspaceId, provider);
  }

  async markVerified(workspaceId: string, provider: ProviderId, verified: boolean): Promise<void> {
    const stored = await this.repository.findByProvider(workspaceId, provider);
    if (stored === null) throw new MissingSecretError(provider);
    await this.repository.upsert({ ...stored, verified });
  }

  private async getKey(): Promise<CryptoKey> {
    if (this.cachedKey !== null) return this.cachedKey;

    const raw = fromBase64(this.masterKeyBase64);
    if (raw.length !== KEY_BYTES) {
      throw new Error(`MASTER_KEY debe tener ${KEY_BYTES} bytes en base64 (tiene ${raw.length}).`);
    }

    this.cachedKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
    return this.cachedKey;
  }
}
