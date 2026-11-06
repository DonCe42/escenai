import { describe, expect, it } from 'vitest';
import { ProviderNotConfiguredError } from '@escenai/core';
import { GoogleTextModel, ProviderHttpError, extractJsonObject } from '../src/providers/google/text-model';

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

const okBody = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });

describe('extractJsonObject', () => {
  it('limpia cercas de markdown', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('ignora texto alrededor del objeto', () => {
    expect(extractJsonObject('Aquí tienes: {"a":2} espero que sirva')).toEqual({ a: 2 });
  });

  it('falla si no hay objeto', () => {
    expect(() => extractJsonObject('lo siento, no puedo')).toThrow(SyntaxError);
  });
});

describe('GoogleTextModel', () => {
  const base = {
    getApiKey: async () => 'AIzaSyDePrueba123456',
    model: 'gemini-de-prueba',
    temperature: 0.5,
  };

  it('envía el modelo configurado, el system prompt y el modo JSON', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const fetchImpl = (async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      const body = okBody('{"escenas":[]}');
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => body,
        text: async () => JSON.stringify(body),
      };
    }) as unknown as typeof fetch;

    const model = new GoogleTextModel({ ...base, fetchImpl });
    const result = await model.generateJson({ systemPrompt: 'sys', userPrompt: 'usr', schemaName: 'videoplan' });

    expect(result).toEqual({ escenas: [] });
    expect(capturedUrl).toContain('/models/gemini-de-prueba:generateContent');
    expect(capturedInit?.headers).toMatchObject({ 'x-goog-api-key': 'AIzaSyDePrueba123456' });

    const body = JSON.parse(String(capturedInit?.body));
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.temperature).toBe(0.5);
  });

  it('convierte una respuesta con cercas en un objeto', async () => {
    const model = new GoogleTextModel({ ...base, fetchImpl: fakeFetch(200, okBody('```json\n{"ok":true}\n```')) });
    await expect(model.generateJson({ systemPrompt: '', userPrompt: '', schemaName: 'x' })).resolves.toEqual({ ok: true });
  });

  it('explica cuando el proveedor devuelve HTML en vez de JSON', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      json: async () => ({}),
      text: async () => '<!DOCTYPE html><html>error del proxy</html>',
    })) as unknown as typeof fetch;

    const model = new GoogleTextModel({ ...base, fetchImpl });
    await expect(
      model.generateJson({ systemPrompt: '', userPrompt: '', schemaName: 'x' }),
    ).rejects.toThrow(/HTML en vez de JSON/);
  });

  it('propaga el status HTTP del proveedor', async () => {
    const model = new GoogleTextModel({ ...base, fetchImpl: fakeFetch(429, { error: 'rate limit' }) });
    await expect(model.generateJson({ systemPrompt: '', userPrompt: '', schemaName: 'x' })).rejects.toBeInstanceOf(
      ProviderHttpError,
    );
  });

  it('avisa si no hay key guardada', async () => {
    const model = new GoogleTextModel({
      ...base,
      getApiKey: async () => {
        throw new Error('sin key');
      },
      fetchImpl: fakeFetch(200, okBody('{}')),
    });
    await expect(model.generateJson({ systemPrompt: '', userPrompt: '', schemaName: 'x' })).rejects.toBeInstanceOf(
      ProviderNotConfiguredError,
    );
  });
});
