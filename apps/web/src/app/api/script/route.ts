import { NextResponse } from 'next/server';
import { ProviderHttpError } from '@escenai/adapters';
import { MissingSecretError } from '@escenai/adapters';
import {
  DEFAULT_STYLE_TOKENS,
  ProviderNotConfiguredError,
  generateScript,
} from '@escenai/core';
import type { Brief, Locale, Project } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ScriptBody {
  readonly que?: unknown;
  readonly aQuien?: unknown;
  readonly queDebeSentir?: unknown;
  readonly queDebeHacer?: unknown;
  readonly duracionObjetivoS?: unknown;
  readonly locale?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  let body: ScriptBody;
  try {
    body = (await request.json()) as ScriptBody;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const que = text(body.que);
  const aQuien = text(body.aQuien);
  const queDebeSentir = text(body.queDebeSentir);
  const queDebeHacer = text(body.queDebeHacer);
  const duracion = Number(body.duracionObjetivoS);
  const locale: Locale = body.locale === 'en' ? 'en' : 'es';

  if (que.length < 3 || aQuien.length < 3 || queDebeSentir.length < 3 || queDebeHacer.length < 3) {
    return NextResponse.json({ code: 'INVALID_BRIEF' }, { status: 400 });
  }
  if (!Number.isFinite(duracion) || duracion < 15 || duracion > 90) {
    return NextResponse.json({ code: 'INVALID_DURATION' }, { status: 400 });
  }

  const workspace = await getWorkspace();
  const brief: Brief = { que, aQuien, queDebeSentir, queDebeHacer, duracionObjetivoS: duracion };
  const brand: Project = {
    id: workspace.id,
    nombre: process.env.BRAND_NAME ?? 'Mi marca',
    locale,
    styleToken: DEFAULT_STYLE_TOKENS[locale],
    colores: [],
  };

  try {
    const result = await generateScript(
      { text: container.textModel(workspace.id) },
      { brand, brief, locale },
    );

    if (result.ok) {
      return NextResponse.json({ plan: result.value });
    }

    if (result.error.kind === 'invalid_plan') {
      return NextResponse.json(
        { code: 'INVALID_PLAN', attempts: result.error.attempts, issues: result.error.issues },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { code: 'MODEL_ERROR', message: result.error.message },
      { status: 502 },
    );
  } catch (error) {
    if (error instanceof MissingSecretError || error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ code: 'KEY_REQUIRED', provider: 'google' }, { status: 412 });
    }
    if (error instanceof ProviderHttpError) {
      return NextResponse.json(
        { code: 'PROVIDER_HTTP', status: error.status, message: error.body.slice(0, 300) },
        { status: 502 },
      );
    }
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ code: 'UNEXPECTED', message }, { status: 500 });
  }
}
