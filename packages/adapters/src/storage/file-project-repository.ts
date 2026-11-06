import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { countPlanWords } from '@escenai/core';
import type { ProjectRepositoryPort, ScriptProject, VersionSource, VideoPlan } from '@escenai/core';

/**
 * Proyectos y versiones en disco, un JSON por proyecto.
 * Es el adaptador del modo demo; el puerto permite cambiarlo por Postgres sin tocar casos de uso.
 */
export class FileProjectRepository implements ProjectRepositoryPort {
  constructor(private readonly dir: string) {}

  async create(input: {
    readonly nombre: string;
    readonly plan: VideoPlan;
    readonly now: string;
  }): Promise<ScriptProject> {
    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const project: ScriptProject = {
      id,
      nombre: input.nombre,
      createdAt: input.now,
      updatedAt: input.now,
      activeVersionId: versionId,
      versions: [
        {
          id: versionId,
          version: 1,
          plan: input.plan,
          source: 'generated',
          createdAt: input.now,
          words: countPlanWords(input.plan),
        },
      ],
    };
    await this.persist(project);
    return project;
  }

  async list(): Promise<readonly ScriptProject[]> {
    const files = await readdir(this.dir).catch(() => []);
    const projects: ScriptProject[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const project = await this.read(join(this.dir, file));
      if (project !== null) projects.push(project);
    }
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async find(id: string): Promise<ScriptProject | null> {
    return this.read(this.pathFor(id));
  }

  async addVersion(
    id: string,
    input: { readonly plan: VideoPlan; readonly source: VersionSource; readonly now: string },
  ): Promise<ScriptProject | null> {
    const project = await this.find(id);
    if (project === null) return null;

    const versionId = crypto.randomUUID();
    const nextNumber = Math.max(...project.versions.map((v) => v.version), 0) + 1;
    const updated: ScriptProject = {
      ...project,
      updatedAt: input.now,
      activeVersionId: versionId,
      versions: [
        ...project.versions,
        {
          id: versionId,
          version: nextNumber,
          plan: input.plan,
          source: input.source,
          createdAt: input.now,
          words: countPlanWords(input.plan),
        },
      ],
    };
    await this.persist(updated);
    return updated;
  }

  async setActiveVersion(id: string, versionId: string, now: string): Promise<ScriptProject | null> {
    const project = await this.find(id);
    if (project === null) return null;
    if (!project.versions.some((version) => version.id === versionId)) return null;

    const updated: ScriptProject = { ...project, activeVersionId: versionId, updatedAt: now };
    await this.persist(updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const project = await this.find(id);
    if (project === null) return false;
    await rm(this.pathFor(id), { force: true });
    return true;
  }

  private pathFor(id: string): string {
    // El id viene de la URL: se descartan separadores para no salir del directorio.
    const safe = id.replace(/[^a-zA-Z0-9-]/g, '');
    return join(this.dir, `${safe}.json`);
  }

  private async read(path: string): Promise<ScriptProject | null> {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as ScriptProject;
    } catch {
      return null;
    }
  }

  private async persist(project: ScriptProject): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(project.id), JSON.stringify(project, null, 2), 'utf8');
  }
}
