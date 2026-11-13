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

  it('guarda assets por escena sin tocar las versiones del plan', async () => {
    const created = await repo.create({ nombre: 'A', plan, now: '2026-11-06T10:00:00.000Z' });

    const updated = await repo.saveAsset(created.id, {
      sceneId: 's1',
      kind: 'image',
      status: 'ready',
      ref: 'images/demo/s1.png',
      mimeType: 'image/png',
      errorCode: null,
      updatedAt: '2026-11-06T10:10:00.000Z',
    });

    expect(updated?.assets).toHaveLength(1);
    expect(updated?.versions).toHaveLength(1);

    // Releer del disco: el asset sobrevive al proceso.
    const reloaded = await repo.find(created.id);
    expect(reloaded?.assets?.[0]?.ref).toBe('images/demo/s1.png');
  });

  it('reemplaza el asset de la misma escena y tipo en vez de duplicarlo', async () => {
    const created = await repo.create({ nombre: 'A', plan, now: '2026-11-06T10:00:00.000Z' });
    const base = {
      sceneId: 's1',
      kind: 'voice' as const,
      status: 'ready' as const,
      ref: 'audio/a.mp3',
      mimeType: 'audio/mpeg',
      errorCode: null,
      updatedAt: '2026-11-06T10:10:00.000Z',
    };

    await repo.saveAsset(created.id, base);
    const updated = await repo.saveAsset(created.id, { ...base, ref: 'audio/b.mp3' });

    expect(updated?.assets).toHaveLength(1);
    expect(updated?.assets?.[0]?.ref).toBe('audio/b.mp3');
  });

  it('normaliza a [] los proyectos guardados antes de los assets', async () => {
    const created = await repo.create({ nombre: 'A', plan, now: '2026-11-06T10:00:00.000Z' });
    const legacy: Record<string, unknown> = { ...created };
    delete legacy.assets;
    delete legacy.styleReferences;
    await rm(join(dir, 'projects'), { recursive: true, force: true });
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(join(dir, 'projects'), { recursive: true });
    await writeFile(join(dir, 'projects', `${created.id}.json`), JSON.stringify(legacy), 'utf8');

    const reloaded = await repo.find(created.id);
    expect(reloaded?.assets).toEqual([]);
    expect(reloaded?.styleReferences).toEqual([]);
  });

  it('guarda el tablero de estilo y sobrevive a releer del disco', async () => {
    const created = await repo.create({ nombre: 'A', plan, now: '2026-11-06T10:00:00.000Z' });
    const updated = await repo.saveStyleReference(created.id, {
      id: 'ref-1',
      kind: 'producto',
      label: 'lata cold brew',
      ref: 'style/demo/ref-1.png',
      mimeType: 'image/png',
      createdAt: '2026-11-06T10:20:00.000Z',
    });

    expect(updated?.styleReferences).toHaveLength(1);
    // El tablero no crea versiones del plan: cambiar una referencia no es cambiar el guion.
    expect(updated?.versions).toHaveLength(1);

    const reloaded = await repo.find(created.id);
    expect(reloaded?.styleReferences?.[0]?.label).toBe('lata cold brew');
  });

  it('rechaza la séptima referencia en vez de guardarla a medias', async () => {
    const created = await repo.create({ nombre: 'A', plan, now: '2026-11-06T10:00:00.000Z' });
    for (let index = 0; index < 6; index += 1) {
      const saved = await repo.saveStyleReference(created.id, {
        id: `ref-${index}`,
        kind: 'estilo',
        label: `pieza ${index}`,
        ref: `style/demo/ref-${index}.png`,
        mimeType: 'image/png',
        createdAt: '2026-11-06T10:20:00.000Z',
      });
      expect(saved).not.toBeNull();
    }

    const overflow = await repo.saveStyleReference(created.id, {
      id: 'ref-6',
      kind: 'estilo',
      label: 'sobra',
      ref: 'style/demo/ref-6.png',
      mimeType: 'image/png',
      createdAt: '2026-11-06T10:21:00.000Z',
    });

    expect(overflow).toBeNull();
    expect((await repo.find(created.id))?.styleReferences).toHaveLength(6);
  });

  it('quita una referencia del tablero y deja las demás', async () => {
    const created = await repo.create({ nombre: 'A', plan, now: '2026-11-06T10:00:00.000Z' });
    for (const id of ['ref-1', 'ref-2']) {
      await repo.saveStyleReference(created.id, {
        id,
        kind: 'personaje',
        label: id,
        ref: `style/demo/${id}.png`,
        mimeType: 'image/png',
        createdAt: '2026-11-06T10:20:00.000Z',
      });
    }

    const updated = await repo.removeStyleReference(created.id, 'ref-1', '2026-11-06T10:30:00.000Z');
    expect(updated?.styleReferences?.map((reference) => reference.id)).toEqual(['ref-2']);

    expect(await repo.removeStyleReference(created.id, 'no-existe', 'x')).toBeNull();
  });
});
