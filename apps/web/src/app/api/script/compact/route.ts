import { NextResponse } from 'next/server';
import { MissingSecretError } from '@escenai/adapters';
import { ProviderNotConfiguredError, compactScript, validateVideoPlan } from '@escenai/core';
import type { VideoPlan } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * El guion no cabe en la duración: se reescribe más corto.
 * Nunca se acelera el audio ni se recorta a mitad de palabra.
 */
export async function POST(request: Request): Promise<Response> {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  let body: { plan?: unknown; duracionObjetivoS?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const validation = validateVideoPlan(body.plan);
  if (!validation.ok) {
    return NextResponse.json({ code: 'INVALID_PLAN', issues: validation.issues }, { status: 422 });
  }

  const plan = body.plan as VideoPlan;
  const objetivo =
    typeof body.duracionObjetivoS === 'number' && body.duracionObjetivoS > 0
      ? body.duracionObjetivoS
      : plan.duracionObjetivoS;

  const workspace = await getWorkspace();
  const kind = await container.detectTextProvider(workspace.id);
  if (kind === null) {
    return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
  }

  try {
    const result = await compactScript(
      { text: container.textModel(workspace.id, kind) },
      { plan, duracionObjetivoS: objetivo },
    );

    if (result.ok) return NextResponse.json({ plan: result.value });
    if (result.error.kind === 'invalid_plan') {
      return NextResponse.json({ code: 'INVALID_PLAN', issues: result.error.issues }, { status: 422 });
    }
    return NextResponse.json({ code: 'MODEL_ERROR', message: result.error.message }, { status: 502 });
  } catch (error) {
    if (error instanceof MissingSecretError || error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google-vertex' }, { status: 412 });
    }
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ code: 'COMPACT_ERROR', message }, { status: 502 });
  }
}
