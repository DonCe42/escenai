import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import type { AssetRef, StoragePort } from '@escenai/core';

/**
 * Almacenamiento local para desarrollo y self-host sin Supabase.
 * En producción esto se sustituye por Supabase Storage u otro adaptador: el puerto es el mismo.
 */
export class FileStorage implements StoragePort {
  private readonly baseDir: string;

  constructor(
    baseDir: string,
    private readonly publicPrefix = '/api/assets',
  ) {
    this.baseDir = resolve(baseDir);
  }

  async put(key: string, bytes: Uint8Array, mimeType: string): Promise<AssetRef> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    return { key, mimeType, bytes: bytes.byteLength };
  }

  async signedUrl(ref: AssetRef): Promise<string> {
    return `${this.publicPrefix}/${ref.key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async read(key: string): Promise<Uint8Array> {
    return readFile(this.resolveKey(key));
  }

  /** Impide que una clave con `..` escriba fuera del directorio de assets. */
  private resolveKey(key: string): string {
    const safe = normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const full = resolve(join(this.baseDir, safe));
    if (!full.startsWith(this.baseDir)) {
      throw new Error('Ruta de asset fuera del directorio permitido.');
    }
    return full;
  }
}
