import { describe, expect, it } from 'vitest';
import {
  findSceneAsset,
  isAssetConsistent,
  recordSceneAsset,
  upsertSceneAsset,
} from '../src/index';
import type {
  ProjectRepositoryPort,
  SceneAsset,
  ScriptProject,
  VersionSource,
  VideoPlan,
} from '../src/index';

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

function imageAsset(sceneId: string, now: string): SceneAsset {
  return {
    sceneId,
    kind: 'image',
    status: 'ready',
    ref: `images/demo/${sceneId}.png`,
    mimeType: 'image/png',
    errorCode: null,
    updatedAt: now,
  };
}

function project(assets: readonly SceneAsset[] | undefined): ScriptProject {
  return {
    id: 'p1',
    nombre: 'Cold brew',
    createdAt: now,
    updatedAt: now,
    activeVersionId: 'v1',
    versions: [{ id: 'v1', version: 1, plan, source: 'generated', createdAt: now, words: 11 }],
    ...(assets === undefined ? {} : { assets }),
  };
}

const now = '2026-11-12T18:00:00.000Z';

class FakeProjects implements ProjectRepositoryPort {
  constructor(public current: ScriptProject | null) {}

  async create(): Promise<ScriptProject> {
    throw new Error('no usado');
  }
  async list(): Promise<readonly ScriptProject[]> {
    return this.current === null ? [] : [this.current];
  }
  async find(): Promise<ScriptProject | null> {
    return this.current;
  }
  async addVersion(
    _id: string,
    _input: { plan: VideoPlan; source: VersionSource; now: string },
  ): Promise<ScriptProject | null> {
    throw new Error('no usado');
  }
  async setActiveVersion(): Promise<ScriptProject | null> {
    throw new Error('no usado');
  }
  async saveAsset(_id: string, asset: SceneAsset): Promise<ScriptProject | null> {
    if (this.current === null) return null;
    this.current = { ...this.current, assets: upsertSceneAsset(this.current.assets, asset) };
    return this.current;
  }
  async remove(): Promise<boolean> {
    throw new Error('no usado');
  }
  async saveStyleReference(): Promise<ScriptProject | null> {
    throw new Error('no usado');
  }
  async removeStyleReference(): Promise<ScriptProject | null> {
    throw new Error('no usado');
  }
}

describe('assets por escena', () => {
  it('añade un asset y no duplica al guardar el mismo de nuevo', () => {
    const uno = upsertSceneAsset([], imageAsset('s1', now));
    expect(uno).toHaveLength(1);

    const dos = upsertSceneAsset(uno, { ...imageAsset('s1', now), ref: 'images/demo/s1-v2.png' });
    expect(dos).toHaveLength(1);
    expect(dos[0]?.ref).toBe('images/demo/s1-v2.png');
  });

  it('mantiene separados imagen y voz de la misma escena', () => {
    const conImagen = upsertSceneAsset([], imageAsset('s1', now));
    const conAmbos = upsertSceneAsset(conImagen, {
      sceneId: 's1',
      kind: 'voice',
      status: 'running',
      ref: null,
      mimeType: null,
      errorCode: null,
      updatedAt: now,
    });

    expect(conAmbos).toHaveLength(2);
    expect(findSceneAsset(conAmbos, 's1', 'image')?.status).toBe('ready');
    expect(findSceneAsset(conAmbos, 's1', 'voice')?.status).toBe('running');
    expect(findSceneAsset(conAmbos, 's2', 'image')).toBeUndefined();
  });

  it('un asset listo sin clave es inconsistente', () => {
    expect(isAssetConsistent(imageAsset('s1', now))).toBe(true);
    expect(isAssetConsistent({ ...imageAsset('s1', now), ref: null })).toBe(false);
    expect(isAssetConsistent({ ...imageAsset('s1', now), status: 'error', ref: null })).toBe(true);
  });

  it('recordSceneAsset rechaza un asset listo sin clave y no toca el repositorio', async () => {
    const projects = new FakeProjects(project([]));
    const result = await recordSceneAsset(
      { projects },
      { projectId: 'p1', asset: { ...imageAsset('s1', now), ref: null } },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_asset');
    expect(projects.current?.assets).toHaveLength(0);
  });

  it('recordSceneAsset persiste el asset en el proyecto existente', async () => {
    const projects = new FakeProjects(project(undefined));
    const result = await recordSceneAsset(
      { projects },
      { projectId: 'p1', asset: imageAsset('s1', now) },
    );

    expect(result.ok).toBe(true);
    expect(projects.current?.assets).toHaveLength(1);
  });

  it('recordSceneAsset falla si el proyecto no existe', async () => {
    const result = await recordSceneAsset(
      { projects: new FakeProjects(null) },
      { projectId: 'nope', asset: imageAsset('s1', now) },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('project_not_found');
  });
});
