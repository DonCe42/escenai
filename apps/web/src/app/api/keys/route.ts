import { NextResponse } from 'next/server';
import type { ProviderId } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDERS: readonly ProviderId[] = ['google', 'google-vertex', 'minimax'];

function isProvider(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value);
}

export async function GET() {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ error: 'MASTER_KEY_MISSING' }, { status: 503 });
  }
  const workspace = await getWorkspace();
  const secrets = await container.secrets.list(workspace.id);
  return NextResponse.json({ mode: workspace.mode, secrets });
}

export async function POST(request: Request) {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ error: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const provider = (body as { provider?: unknown }).provider;
  const apiKey = (body as { apiKey?: unknown }).apiKey;

  if (!isProvider(provider)) {
    return NextResponse.json({ error: 'INVALID_PROVIDER' }, { status: 400 });
  }
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return NextResponse.json({ error: 'INVALID_API_KEY' }, { status: 400 });
  }

  // La cuenta de servicio se guarda compacta: sin espacios ni saltos de línea,
  // y validada antes de tocar el almacén.
  let normalized = apiKey.trim();
  let displayHint: string | undefined;
  if (provider === 'google-vertex') {
    try {
      const parsed = JSON.parse(normalized) as {
        type?: string;
        private_key?: string;
        project_id?: string;
      };
      if (parsed.type !== 'service_account' || typeof parsed.private_key !== 'string') {
        return NextResponse.json({ error: 'INVALID_SERVICE_ACCOUNT' }, { status: 400 });
      }
      normalized = JSON.stringify(parsed);
      displayHint = parsed.project_id;
    } catch {
      return NextResponse.json({ error: 'INVALID_SERVICE_ACCOUNT' }, { status: 400 });
    }
  }

  const workspace = await getWorkspace();

  try {
    const secret = await container.secrets.save(workspace.id, provider, normalized, displayHint);

    // Guardar y verificar son pasos distintos: si el proveedor rechaza la key,
    // el usuario tiene que enterarse aquí y no tres pantallas más adelante.
    const check = await container.verifier.verify(provider, normalized);
    if (check.ok) await container.secrets.markVerified(workspace.id, provider, true);

    return NextResponse.json({ secret: { ...secret, verified: check.ok }, check }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ error: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  const provider = new URL(request.url).searchParams.get('provider');
  if (!isProvider(provider)) {
    return NextResponse.json({ error: 'INVALID_PROVIDER' }, { status: 400 });
  }

  const workspace = await getWorkspace();
  await container.secrets.remove(workspace.id, provider);
  return new NextResponse(null, { status: 204 });
}
