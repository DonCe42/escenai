import { NextResponse } from 'next/server';
import type { ProviderId } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDERS: readonly ProviderId[] = ['google', 'minimax'];

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

  const workspace = await getWorkspace();

  try {
    const secret = await container.secrets.save(workspace.id, provider, apiKey);
    return NextResponse.json({ secret }, { status: 201 });
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
