import { NextResponse } from 'next/server';
import { createContainer } from '@/lib/container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();
  const project = await container.projects.find(id);
  if (project === null) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();

  let body: { activeVersionId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  if (typeof body.activeVersionId !== 'string') {
    return NextResponse.json({ code: 'INVALID_VERSION' }, { status: 400 });
  }

  const project = await container.projects.setActiveVersion(
    id,
    body.activeVersionId,
    container.clock.nowIso(),
  );
  if (project === null) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();
  const removed = await container.projects.remove(id);
  return new NextResponse(null, { status: removed ? 204 : 404 });
}
