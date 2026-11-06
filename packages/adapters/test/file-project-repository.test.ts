import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileProjectRepository } from '../src/storage/file-project-repository';
import type { VideoPlan } from '@escenai/core';

const plan: VideoPlan = {
  version: 1,
  locale: 'es',
  titulo: 'Cold brew',
  duracionObjetivoS: 8,
  styleToken: 'ilustración plana',
  escenas: [
    {
      id: 's1',
      rol: 'hook',
      narracion: 'Son las tres de la tarde y ya no puedes con la vida.',
      textoPantalla: ['TRES PM'],
      promptImagen: 'oficina por la tarde con luz cálida y una lata',
      movimiento: 'zoom-in-lento',
      duracionEstimadaS: 8,
    },
  ],
};

describe('FileProjectRepository', () => {
  let dir = '';
  let repo: FileProjectRepository;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'escenai-proj-'));
    repo = new FileProjectRepository(join(dir, 'projects'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('crea un proyecto con la versión 1 activa y cuenta palabras', async () => {
    const project = await repo.create({ nombre: 'Café Aurora', plan, now: '2026-11-06T10:00:00.000Z' });

    expect(project.versions).toHaveLength(1);
    expect(project.activeVersionId).toBe(project.versions[0]!.id);
    expect(project.versions[0]!.words).toBe(13);
    expect(project.versions[0]!.source).toBe('generated');
  });

  it('añade versiones incrementales y deja la última activa', async () => {
    const created = await repo.create({ nombre: 'Café Aurora', plan, now: '2026-11-06T10:00:00.000Z' });
    const updated = await repo.addVersion(created.id, {
      plan: { ...plan, titulo: 'Cold brew v2' },
      source: 'edited',
      now: '2026-11-06T10:05:00.000Z',
    });

    expect(updated?.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(updated?.activeVersionId).toBe(updated?.versions[1]?.id);
    expect(updated?.versions[1]?.plan.titulo).toBe('Cold brew v2');
  });

  it('permite volver a una versión anterior', async () => {
    const created = await repo.create({ nombre: 'P', plan, now: '2026-11-06T10:00:00.000Z' });
    const withTwo = await repo.addVersion(created.id, { plan, source: 'edited', now: '2026-11-06T10:05:00.000Z' });
    const first = withTwo!.versions[0]!.id;

    const restored = await repo.setActiveVersion(created.id, first, '2026-11-06T10:06:00.000Z');
    expect(restored?.activeVersionId).toBe(first);
  });

  it('no encuentra proyectos inexistentes y lista por fecha', async () => {
    await repo.create({ nombre: 'A', plan, now: '2026-11-06T10:00:00.000Z' });
    await repo.create({ nombre: 'B', plan, now: '2026-11-06T11:00:00.000Z' });

    const list = await repo.list();
    expect(list.map((p) => p.nombre)).toEqual(['B', 'A']);
    expect(await repo.find('no-existe')).toBeNull();
    expect(await repo.addVersion('no-existe', { plan, source: 'edited', now: 'x' })).toBeNull();
  });

  it('no deja salir del directorio con un id con barras', async () => {
    expect(await repo.find('../../etc/passwd')).toBeNull();
  });
});
