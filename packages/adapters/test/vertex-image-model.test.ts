import { describe, expect, it } from 'vitest';
import { VertexImageModel } from '../src/providers/google/vertex-image-model';

/**
 * El punto de este test es el contrato, no el proveedor: la referencia número
 * uno fija el estilo, se mandan todas las que quepan y nunca más del tope del
 * modelo. Un test con `fetch` simulado lo comprueba sin gastar cuota.
 */

async function serviceAccountJson(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign'],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const b64 = Buffer.from(pkcs8).toString('base64').replace(/(.{64})/g, '$1\n');
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`;
  return JSON.stringify({
    type: 'service_account',
    project_id: 'proyecto-de-prueba',
    private_key_id: 'kid-1',
    private_key: pem,
    client_email: 'bot@proyecto-de-prueba.iam.gserviceaccount.com',
  });
}

const PNG_BASE64 = Buffer.from('imagen-falsa').toString('base64');

interface Capturado {
  readonly parts: readonly { text?: string; inlineData?: { mimeType: string; data: string } }[];
}

function makeFetch(capturado: { body: Capturado | null }): typeof fetch {
  return (async (url: string | URL, init?: { body?: string }) => {
    if (String(url).includes('oauth2.googleapis.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'token-de-prueba', expires_in: 3600 }),
        text: async () => '',
        headers: { get: () => null },
      };
    }
    capturado.body = JSON.parse(init?.body ?? '{}').contents[0] as Capturado;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG_BASE64 } }] } }],
      }),
      text: async () => '',
      headers: { get: () => null },
    };
  }) as unknown as typeof fetch;
}

async function generar(referenceImages: readonly Uint8Array[] | undefined): Promise<Capturado> {
  const credentials = await serviceAccountJson();
  const capturado: { body: Capturado | null } = { body: null };
  const model = new VertexImageModel({
    getCredentials: async () => credentials,
    fetchImpl: makeFetch(capturado),
    model: 'gemini-nano-banana-2.1',
    location: 'global',
  });

  await model.generate({
    prompt: 'una taza plana',
    aspect: '9:16',
    ...(referenceImages === undefined ? {} : { referenceImages }),
  });

  if (capturado.body === null) throw new Error('no se envió ninguna petición');
  return capturado.body;
}

describe('VertexImageModel · referencias', () => {
  it('sin referencias manda solo el texto', async () => {
    const parts = (await generar(undefined)).parts;
    expect(parts).toHaveLength(1);
    expect(parts[0]?.text).toBe('una taza plana');
  });

  it('manda todas las referencias en orden, después del prompt', async () => {
    const parts = (await generar([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])])).parts;
    expect(parts).toHaveLength(3);
    expect(parts[0]?.text).toBe('una taza plana');
    expect(parts[1]?.inlineData?.data).toBe(Buffer.from([1, 2, 3]).toString('base64'));
    expect(parts[2]?.inlineData?.data).toBe(Buffer.from([4, 5]).toString('base64'));
  });

  it('recorta al tope del modelo en vez de mandar una petición que el proveedor rechazaría', async () => {
    const veinte = Array.from({ length: 20 }, (_, i) => new Uint8Array([i]));
    const parts = (await generar(veinte)).parts;
    expect(parts).toHaveLength(1 + 14);
  });
});
