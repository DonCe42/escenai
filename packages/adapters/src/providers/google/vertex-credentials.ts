/**
 * Credenciales de cuenta de servicio de Google Cloud (Vertex AI).
 * Se firma un JWT RS256 con la clave privada y se canjea por un access token.
 * Nada de esto sale del proceso: el token vive en memoria con su expiración.
 */

export interface ServiceAccount {
  readonly type: string;
  readonly project_id: string;
  readonly private_key: string;
  readonly private_key_id: string;
  readonly client_email: string;
}

export interface AccessToken {
  readonly token: string;
  readonly expiresAtMs: number;
}

export class InvalidServiceAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidServiceAccountError';
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseServiceAccount(raw: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidServiceAccountError('El JSON de la cuenta de servicio no se puede leer.');
  }
  const value = parsed as Partial<ServiceAccount>;
  if (value.type !== 'service_account' || typeof value.private_key !== 'string') {
    throw new InvalidServiceAccountError('El JSON no es una cuenta de servicio de Google Cloud.');
  }
  if (typeof value.project_id !== 'string' || typeof value.client_email !== 'string') {
    throw new InvalidServiceAccountError('A la cuenta de servicio le faltan project_id o client_email.');
  }
  return value as ServiceAccount;
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  const binary = atob(body);
  // ArrayBuffer explícito: WebCrypto exige BufferSource (TS 5.9 con typed arrays genéricos).
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function mintAccessToken(
  account: ServiceAccount,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessToken> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: account.private_key_id };
  const claims = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const encoder = new TextEncoder();
  const unsigned = `${toBase64Url(encoder.encode(JSON.stringify(header)))}.${toBase64Url(
    encoder.encode(JSON.stringify(claims)),
  )}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const assertion = `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;

  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`No se pudo obtener el token de Google: HTTP ${response.status} ${body.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (typeof payload.access_token !== 'string') {
    throw new Error('La respuesta de Google no trae access_token.');
  }

  return {
    token: payload.access_token,
    expiresAtMs: Date.now() + (payload.expires_in ?? 3600) * 1000 - 60_000,
  };
}
