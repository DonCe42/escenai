export interface AssetRef {
  readonly key: string;
  readonly mimeType: string;
  readonly bytes: number;
}

export interface StoragePort {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<AssetRef>;
  signedUrl(ref: AssetRef, ttlSeconds: number): Promise<string>;
  /** Lectura necesaria para reutilizar un asset como referencia de imagen. */
  read(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
