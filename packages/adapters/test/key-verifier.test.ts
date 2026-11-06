import { describe, expect, it } from 'vitest';
import { GoogleKeyVerifier } from '../src/providers/google/key-verifier';

function fake(status: number): typeof fetch {
  return (async () => ({ ok: status >= 200 && status < 300, status })) as unknown as typeof fetch;
}

describe('GoogleKeyVerifier', () => {
  it('acepta una key que lista modelos', async () => {
    const check = await new GoogleKeyVerifier({ fetchImpl: fake(200) }).verify('google', 'AIzaOK');
    expect(check).toEqual({ ok: true });
  });

  it('distingue key inválida de permiso y de cuota', async () => {
    await expect(new GoogleKeyVerifier({ fetchImpl: fake(400) }).verify('google', 'x')).resolves.toMatchObject({
      ok: false,
      reason: 'invalid_key',
    });
    await expect(new GoogleKeyVerifier({ fetchImpl: fake(403) }).verify('google', 'x')).resolves.toMatchObject({
      ok: false,
      reason: 'permission_denied',
    });
    await expect(new GoogleKeyVerifier({ fetchImpl: fake(429) }).verify('google', 'x')).resolves.toMatchObject({
      ok: false,
      reason: 'quota',
    });
  });

  it('no verifica proveedores que aún no soporta', async () => {
    const check = await new GoogleKeyVerifier({ fetchImpl: fake(200) }).verify('minimax', 'x');
    expect(check).toMatchObject({ ok: false, reason: 'unsupported' });
  });

  it('no rompe si no hay red', async () => {
    const fetchImpl = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const check = await new GoogleKeyVerifier({ fetchImpl }).verify('google', 'x');
    expect(check).toMatchObject({ ok: false, reason: 'network' });
  });
});
