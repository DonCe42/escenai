import { describe, expect, it } from 'vitest';
import { VertexTextModel } from '../src/providers/google/vertex-text-model';
import { parseServiceAccount, InvalidServiceAccountError } from '../src/providers/google/vertex-credentials';

async function serviceAccountJson(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign'],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\\n${Buffer.from(pkcs8).toString('base64')}\\n-----END PRIVATE KEY-----\\n`;
  return JSON.stringify({
    type: 'service_account',
    project_id: 'proyecto-de-prueba',
    private_key_id: 'kid-1',
    private_key: pem,
    client_email: 'bot@proyecto-de-prueba.iam.gserviceaccount.com',
  });
}

function makeFetch(counter: { token: number; generate: number }): typeof fetch {
  return (async (url: string | URL) => {
    const target = String(url);
    if (target.includes('oauth2.googleapis.com')) {
      counter.token += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'token-de-prueba', expires_in: 3600 }),
        text: async () => '',
      };
    }
    counter.generate += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"escenas":[]}' }] } }] }),
      text: async () => '',
    };
  }) as unknown as typeof fetch;
}

describe('VertexTextModel', () => {
  it('canjea el JWT por un token y reutiliza el token entre llamadas', async () => {
    const credentials = await serviceAccountJson();
    const counter = { token: 0, generate: 0 };
    const model = new VertexTextModel({
      getCredentials: async () => credentials,
      fetchImpl: makeFetch(counter),
      model: 'gemini-de-prueba',
      location: 'global',
    });

    await expect(model.generateJson({ systemPrompt: 's', userPrompt: 'u', schemaName: 'x' })).resolves.toEqual({
      escenas: [],
    });
    await model.generateJson({ systemPrompt: 's', userPrompt: 'u', schemaName: 'x' });

    expect(counter.token).toBe(1);
    expect(counter.generate).toBe(2);
  });

  it('rechaza un JSON que no es cuenta de servicio', async () => {
    const model = new VertexTextModel({
      getCredentials: async () => JSON.stringify({ type: 'authorized_user' }),
      fetchImpl: makeFetch({ token: 0, generate: 0 }),
    });
    await expect(model.generateJson({ systemPrompt: 's', userPrompt: 'u', schemaName: 'x' })).rejects.toBeInstanceOf(
      InvalidServiceAccountError,
    );
  });
});

describe('parseServiceAccount', () => {
  it('exige type, project_id, client_email y private_key', () => {
    expect(() => parseServiceAccount('no es json')).toThrow(InvalidServiceAccountError);
    expect(() => parseServiceAccount(JSON.stringify({ type: 'service_account' }))).toThrow(InvalidServiceAccountError);
  });
});
