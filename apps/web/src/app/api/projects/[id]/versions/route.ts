import { NextResponse } from 'next/server';
import { savePlan } from '@escenai/core';
import { createContainer } from '@/lib/container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();

  let body: { plan?: unknown; source?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const source =
    body.source === 'compacted' || body.source === 'edited' ? body.source : 'edited';

  const result = await savePlan(
    { projects: container.projects, clock: container.clock },
    { projectId: id, nombre: 'Sin nombre', plan: body.plan, source },
  );

  if (!result.ok) {
    const status = result.error.kind === 'project_not_found' ? 404 : 422;
    return NextResponse.json({ code: 'SAVE_FAILED', detail: result.error }, { status });
  }
  return NextResponse.json({ project: result.value }, { status: 201 });
}
