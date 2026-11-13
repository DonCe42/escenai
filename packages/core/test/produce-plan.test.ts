import { describe, expect, it } from 'vitest';
import { upsertSceneAsset } from '../src/domain/project-assets';
import type { SceneAsset } from '../src/domain/project-assets';
import type { StyleReference } from '../src/domain/style-reference';
import type { ScriptProject } from '../src/domain/script-project';
import type { VideoPlan } from '../src/domain/video-plan';
import type { WordTiming } from '../src/domain/word-timing';
import type { ImageModelPort } from '../src/application/ports/image-model.port';
import type { ProjectRepositoryPort } from '../src/application/ports/project-repository.port';
import type { SpeechPort, SynthesizedSpeech } from '../src/application/ports/speech.port';
import type { AssetRef, StoragePort } from '../src/application/ports/storage.port';
import {
  generateSceneImageAsset,
  generateSceneVoiceAsset,
} from '../src/application/use-cases/scene-assets';
import { pendingAssets, producePlan } from '../src/application/use-cases/produce-plan';

const now = '2026-11-13T12:00:00.000Z';

/** Plan real del validador (5 escenas, 40 s de objetivo). */
function plan(): VideoPlan {
  return {
    version: 1,
    locale: 'es',
    titulo: 'El café que no te pide nada',
    duracionObjetivoS: 40,
    styleToken: 'ilustración plana, paleta verde botella y crema, sin texto',
    escenas: [
      {
        id: 's1',
        rol: 'hook',
        narracion: 'Son las tres de la tarde y ya no puedes con la vida.',
        textoPantalla: ['3 PM', 'Y YA NO PUEDES'],
        promptImagen: 'Oficina a media tarde, lata de café en primer plano',
        movimiento: 'zoom-in-lento',
        duracionEstimadaS: 8,
      },
      {
        id: 's2',
        rol: 'problema',
        narracion: 'El café de la máquina te deja más cansado que antes de tomarlo.',
        textoPantalla: ['MÁS CANSADO'],
        promptImagen: 'Máquina expendedora en un pasillo, tonos apagados',
        movimiento: 'pan-derecha',
        duracionEstimadaS: 8,
      },
      {
        id: 's3',
        rol: 'desarrollo',
        narracion: 'Este cold brew tiene cero azúcar y el doble de cafeína.',
        textoPantalla: ['CERO AZÚCAR'],
        promptImagen: 'Lata fría sobre mármol, gotas de condensación',
        movimiento: 'zoom-out-lento',
        duracionEstimadaS: 8,
      },
      {
        id: 's4',
        rol: 'prueba',
        narracion: 'Se toma en dos minutos y te despierta sin ese bajón.',
        textoPantalla: ['SIN BAJÓN'],
        promptImagen: 'Persona caminando con la lata, luz de tarde',
        movimiento: 'pan-izquierda',
        duracionEstimadaS: 8,
      },
      {
        id: 's5',
        rol: 'cta',
        narracion: 'Pide la tuya en el link de la bio y cuéntanos cómo te fue.',
        textoPantalla: ['LINK EN LA BIO'],
        promptImagen: 'Lata de cold brew sobre fondo crema, producto centrado',
        movimiento: 'estatico',
        duracionEstimadaS: 8,
      },
    ],
  };
}

function ready(sceneId: string, kind: 'image' | 'voice'): SceneAsset {
  return {
    sceneId,
    kind,
    status: 'ready',
    ref: `${kind}/${sceneId}.${kind === 'image' ? 'png' : 'mp3'}`,
    mimeType: kind === 'image' ? 'image/png' : 'audio/mpeg',
    errorCode: null,
    updatedAt: now,
  };
}

function project(
  assets: readonly SceneAsset[] = [],
  styleReferences: readonly StyleReference[] = [],
): ScriptProject {
  return {
    id: 'p1',
    nombre: 'Cold brew',
    createdAt: now,
    updatedAt: now,
    activeVersionId: 'v1',
    versions: [{ id: 'v1', version: 1, plan: plan(), source: 'generated', createdAt: now, words: 11 }],
    assets,
    styleReferences,
  };
}

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
  async addVersion(): Promise<ScriptProject | null> {
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
  async saveStyleReference(): Promise<ScriptProject | null> {
    throw new Error('no usado');
  }
  async removeStyleReference(): Promise<ScriptProject | null> {
    throw new Error('no usado');
  }
  async remove(): Promise<boolean> {
    throw new Error('no usado');
  }
}

class FakeStorage implements StoragePort {
  readonly files = new Map<string, Uint8Array>();
  seeded(key: string, byte: number): void {
    this.files.set(key, new Uint8Array([byte]));
  }
  async put(key: string, bytes: Uint8Array, mimeType: string): Promise<AssetRef> {
    this.files.set(key, bytes);
    return { key, mimeType, bytes: bytes.byteLength };
  }
  async signedUrl(ref: AssetRef): Promise<string> {
    return `/api/assets/${ref.key}`;
  }
  async read(key: string): Promise<Uint8Array> {
    const bytes = this.files.get(key);
    if (bytes === undefined) throw new Error(`no existe ${key}`);
    return bytes;
  }
  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }
}

class FakeImages implements ImageModelPort {
  readonly calls: {
    readonly prompt: string;
    readonly references: number;
    readonly firstReferenceByte: number | null;
  }[] = [];
  /** Mensaje con el que fallan las próximas `failures` llamadas. */
  failNext = 0;
  failMessage = 'boom';

  constructor(private readonly alwaysFail = false) {}

  async generate(input: Parameters<ImageModelPort['generate']>[0]) {
    const refs = input.referenceImages ?? [];
    this.calls.push({
      prompt: input.prompt,
      references: refs.length,
      firstReferenceByte: refs[0]?.[0] ?? null,
    });
    if (this.alwaysFail || this.failNext > 0) {
      this.failNext = Math.max(0, this.failNext - 1);
      throw new Error(this.failMessage);
    }
    return { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' };
  }
}

class FakeSpeech implements SpeechPort {
  calls = 0;
  async synthesize(): Promise<SynthesizedSpeech> {
    this.calls += 1;
    const words: readonly WordTiming[] = [
      { word: 'hola', startMs: 0, endMs: 320 },
      { word: 'mundo', startMs: 320, endMs: 700 },
    ];
    return { audio: new Uint8Array([9, 9]), mimeType: 'audio/mpeg', durationMs: 700, words };
  }
}

const clock = { nowIso: () => now };

describe('imagen y voz de una escena', () => {
  it('la escena 2 manda primero el ancla y después el tablero', async () => {
    const storage = new FakeStorage();
    storage.seeded('image/s1.png', 7);
    storage.seeded('style/vaso.png', 8);
    const repo = new FakeProjects(
      project([ready('s1', 'image')], [
        {
          id: 'ref-1',
          kind: 'producto',
          label: 'vaso',
          ref: 'style/vaso.png',
          mimeType: 'image/png',
          createdAt: now,
        },
      ]),
    );
    const images = new FakeImages();

    const result = await generateSceneImageAsset(
      { projects: repo, storage, clock, imageModel: images, workspaceId: 'demo-local' },
      { projectId: 'p1', sceneId: 's2' },
    );

    expect(result.ok).toBe(true);
    expect(images.calls[0]?.references).toBe(2);
    // El ancla manda el estilo: su byte va primero.
    expect(images.calls[0]?.firstReferenceByte).toBe(7);
    expect(images.calls[0]?.prompt).toContain('Mantén exactamente la paleta');
    if (result.ok) expect(result.value.references).toBe(2);
  });

  it('la primera escena usa solo el tablero, sin ancla', async () => {
    const storage = new FakeStorage();
    storage.seeded('style/vaso.png', 8);
    const repo = new FakeProjects(
      project([], [
        {
          id: 'ref-1',
          kind: 'producto',
          label: 'vaso',
          ref: 'style/vaso.png',
          mimeType: 'image/png',
          createdAt: now,
        },
      ]),
    );
    const images = new FakeImages();

    const result = await generateSceneImageAsset(
      { projects: repo, storage, clock, imageModel: images, workspaceId: 'demo-local' },
      { projectId: 'p1', sceneId: 's1' },
    );

    expect(result.ok).toBe(true);
    expect(images.calls[0]?.references).toBe(1);
    expect(images.calls[0]?.firstReferenceByte).toBe(8);
    expect(images.calls[0]?.prompt).toContain('Estilo:');
    expect(images.calls[0]?.prompt).toContain('no los rediseñes');
  });

  it('un fallo del proveedor deja el asset en error persistido', async () => {
    const storage = new FakeStorage();
    const repo = new FakeProjects(project());
    const images = new FakeImages(true);

    const result = await generateSceneImageAsset(
      { projects: repo, storage, clock, imageModel: images, workspaceId: 'demo-local' },
      { projectId: 'p1', sceneId: 's3' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('provider_error');
    const asset = repo.current?.assets?.find((a) => a.sceneId === 's3' && a.kind === 'image');
    expect(asset?.status).toBe('error');
    expect(asset?.errorCode).toBe('IMAGE_ERROR');
  });

  it('la voz guarda el MP3 y sus timestamps', async () => {
    const storage = new FakeStorage();
    const repo = new FakeProjects(project());
    const speech = new FakeSpeech();

    const result = await generateSceneVoiceAsset(
      { projects: repo, storage, clock, speech, workspaceId: 'demo-local' },
      { projectId: 'p1', sceneId: 's2' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.words).toBe(2);
    const keys = [...storage.files.keys()];
    expect(keys.some((key) => key.endsWith('s2.mp3'))).toBe(true);
    expect(keys.some((key) => key.endsWith('s2.json'))).toBe(true);
  });
});

describe('producir el plan completo', () => {
  it('genera solo lo que falta y salta lo que ya está listo', async () => {
    const repo = new FakeProjects(project([ready('s1', 'image'), ready('s1', 'voice')]));
    const images = new FakeImages();
    const speech = new FakeSpeech();
    const steps: string[] = [];

    const result = await producePlan(
      {
        projects: repo,
        storage: new FakeStorage(),
        clock,
        imageModel: images,
        speech,
        workspaceId: 'demo-local',
        imagePauseMs: 0,
        sleep: async () => undefined,
      },
      { projectId: 'p1', onStep: (step) => void steps.push(`${step.kind}:${step.sceneId}:${step.status}`) },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.generated).toBe(8);
      expect(result.value.skipped).toBe(2);
      expect(result.value.failures).toHaveLength(0);
    }
    // La primera escena ya estaba: el primer paso es la imagen de la segunda.
    expect(steps[0]).toBe('image:s2:start');
    expect(images.calls).toHaveLength(4);
    expect(speech.calls).toBe(4);
  });

  it('no arranca si no falta nada', async () => {
    const assets = plan().escenas.flatMap((scene) => [ready(scene.id, 'image'), ready(scene.id, 'voice')]);
    const repo = new FakeProjects(project(assets));

    const result = await producePlan(
      {
        projects: repo,
        storage: new FakeStorage(),
        clock,
        imageModel: new FakeImages(),
        speech: new FakeSpeech(),
        workspaceId: 'demo-local',
        imagePauseMs: 0,
        sleep: async () => undefined,
      },
      { projectId: 'p1' },
    );

    expect(result).toEqual({ ok: false, error: 'nothing_to_do' });
  });

  it('un fallo de imagen no aborta el lote: la voz de esa escena se sigue generando', async () => {
    const repo = new FakeProjects(project());
    const images = new FakeImages(true);

    const result = await producePlan(
      {
        projects: repo,
        storage: new FakeStorage(),
        clock,
        imageModel: images,
        speech: new FakeSpeech(),
        workspaceId: 'demo-local',
        imagePauseMs: 0,
        sleep: async () => undefined,
      },
      { projectId: 'p1' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failures).toHaveLength(5);
      expect(result.value.failures[0]?.kind).toBe('image');
      // Las cinco voces sí salieron.
      expect(result.value.generated).toBe(5);
    }
    const voice = repo.current?.assets?.find((a) => a.sceneId === 's5' && a.kind === 'voice');
    expect(voice?.status).toBe('ready');
  });

  it('reintenta cuando el proveedor responde 429', async () => {
    const repo = new FakeProjects(project());
    const images = new FakeImages();
    images.failNext = 1;
    images.failMessage = 'Vertex devolvió 429 RESOURCE_EXHAUSTED';

    const result = await producePlan(
      {
        projects: repo,
        storage: new FakeStorage(),
        clock,
        imageModel: images,
        speech: new FakeSpeech(),
        workspaceId: 'demo-local',
        imagePauseMs: 1,
        sleep: async () => undefined,
      },
      { projectId: 'p1' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failures).toHaveLength(0);
      expect(result.value.generated).toBe(10);
    }
    // 5 escenas: la primera se pidió dos veces (429 + reintento).
    expect(images.calls).toHaveLength(6);
  });

  it('deja respirar entre imágenes, pero no después de la última', async () => {
    const repo = new FakeProjects(project());
    const pauses: number[] = [];

    await producePlan(
      {
        projects: repo,
        storage: new FakeStorage(),
        clock,
        imageModel: new FakeImages(),
        speech: new FakeSpeech(),
        workspaceId: 'demo-local',
        imagePauseMs: 1_000,
        sleep: async (ms) => void pauses.push(ms),
      },
      { projectId: 'p1' },
    );

    expect(pauses).toHaveLength(4);
    expect(pauses.every((ms) => ms === 1_000)).toBe(true);
  });

  it('cuenta lo que falta por tipo', () => {
    const assets = [ready('s1', 'image'), ready('s1', 'voice'), ready('s2', 'image')];
    const pending = pendingAssets(plan(), assets);

    expect(pending.images).toEqual(['s3', 's4', 's5']);
    expect(pending.voices).toEqual(['s2', 's3', 's4', 's5']);
    expect(pending.total).toBe(7);
  });
});
