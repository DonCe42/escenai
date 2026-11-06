import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ProviderId, SecretRepositoryPort, StoredSecret } from '@escenai/core';

type FileShape = Record<string, Record<string, StoredSecret>>;

/**
 * Persistencia local para desarrollo (modo demo). No se usa en producción:
 * en producción el repositorio es Supabase con RLS por workspace.
 */
export class FileSecretRepository implements SecretRepositoryPort {
  constructor(private readonly filePath: string) {}

  async upsert(secret: StoredSecret): Promise<void> {
    const data = await this.load();
    const workspace = data[secret.workspaceId] ?? {};
    workspace[secret.provider] = secret;
    data[secret.workspaceId] = workspace;
    await this.persist(data);
  }

  async findByProvider(workspaceId: string, provider: ProviderId): Promise<StoredSecret | null> {
    const data = await this.load();
    return data[workspaceId]?.[provider] ?? null;
  }

  async listByWorkspace(workspaceId: string): Promise<readonly StoredSecret[]> {
    const data = await this.load();
    return Object.values(data[workspaceId] ?? {});
  }

  async delete(workspaceId: string, provider: ProviderId): Promise<void> {
    const data = await this.load();
    const workspace = data[workspaceId];
    if (workspace === undefined) return;
    delete workspace[provider];
    await this.persist(data);
  }

  private async load(): Promise<FileShape> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as FileShape;
    } catch {
      return {};
    }
  }

  private async persist(data: FileShape): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
