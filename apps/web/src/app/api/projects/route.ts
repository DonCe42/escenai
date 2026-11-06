import { NextResponse } from 'next/server';
import { savePlan, summarize } from '@escenai/core';
import { createContainer } from '@/lib/container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const container = createContainer();
  const projects = await container.projects.list();
  return NextResponse.json({ projects: projects.map(summarize) });
}

export async function POST(request: Request): Promise<Response> {
  const container = createContainer();

  let body: { nombre?: unknown; plan?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const nombre =
    typeof body.nombre === 'string' && body.nombre.trim().length > 0
      ? body.nombre.trim()
      : 'Sin nombre';

  const result = await savePlan(
    { projects: container.projects, clock: container.clock },
    { nombre, plan: body.plan, source: 'generated' },
  );

  if (!result.ok) {
    return NextResponse.json({ code: 'INVALID_PLAN', issues: result.error }, { status: 422 });
  }
  return NextResponse.json({ project: result.value }, { status: 201 });
}
