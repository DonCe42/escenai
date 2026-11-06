import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AesGcmSecretStore, InvalidApiKeyError, MissingSecretError } from '../src/secrets/aes-gcm-secret-store';
import { FileSecretRepository } from '../src/secrets/file-secret-repository';
import { SystemClock } from '../src/clock/system-clock';

const MASTER_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

function masterBytes(): Uint8Array {
  const binary = atob(MASTER_KEY);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

describe('AesGcmSecretStore', () => {
  let dir = '';
  let store: AesGcmSecretStore;
  let repository: FileSecretRepository;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'escenai-'));
    repository = new FileSecretRepository(join(dir, 'secrets.json'));
    store = new AesGcmSecretStore(repository, MASTER_KEY, new SystemClock());
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('cifra, guarda y devuelve la key original', async () => {
    await store.save('ws1', 'google', 'AIzaSyEjemploDeClave1234');
    await expect(store.read('ws1', 'google')).resolves.toBe('AIzaSyEjemploDeClave1234');
  });

  it('no guarda el texto plano en el archivo', async () => {
    await store.save('ws1', 'minimax', 'sk-minimax-secreto-9999');
    const raw = await (await import('node:fs/promises')).readFile(join(dir, 'secrets.json'), 'utf8');
    expect(raw).not.toContain('sk-minimax-secreto-9999');
    expect(raw).toContain('••••9999');
  });

  it('devuelve solo la versión enmascarada al listar', async () => {
    await store.save('ws1', 'google', 'AIzaSyEjemploDeClave1234');
    const list = await store.list('ws1');
    expect(list).toEqual([
      { provider: 'google', masked: '••••1234', updatedAt: expect.any(String), verified: false },
    ]);
  });

  it('rechaza keys demasiado cortas o con caracteres de control', async () => {
    await expect(store.save('ws1', 'google', 'corta')).rejects.toBeInstanceOf(InvalidApiKeyError);
    await expect(store.save('ws1', 'google', 'clave\ncon salto')).rejects.toBeInstanceOf(InvalidApiKeyError);
  });

  it('acepta credenciales con espacios internos, como el JSON de una cuenta de servicio', async () => {
    const json = '{"type":"service_account","private_key":"-----BEGIN PRIVATE KEY----- abc"}';
    await expect(store.save('ws1', 'google-vertex', json)).resolves.toMatchObject({ provider: 'google-vertex' });
  });

  it('falla claro si no hay key guardada', async () => {
    await expect(store.read('ws1', 'minimax')).rejects.toBeInstanceOf(MissingSecretError);
  });

  it('no descifra con otra MASTER_KEY', async () => {
    await store.save('ws1', 'google', 'AIzaSyEjemploDeClave1234');
    const otra = new AesGcmSecretStore(repository, btoa('otra-clave-de-32-bytes-distinta!!'), new SystemClock());
    await expect(otra.read('ws1', 'google')).rejects.toThrow();
  });

  it('la MASTER_KEY debe tener 32 bytes', () => {
    expect(masterBytes().length).toBe(32);
  });
});
