import { NextResponse } from 'next/server';
import { styleReferencesOf } from '@escenai/core';
import { createContainer } from '@/lib/container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Quita una pieza del tablero y borra su archivo. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; refId: string }> },
): Promise<Response> {
  const { id, refId } = await context.params;
  const container = createContainer();
  const project = await container.projects.find(id);
  if (project === null) return NextResponse.json({ code: 'PROJECT_NOT_FOUND' }, { status: 404 });

  const reference = styleReferencesOf(project.styleReferences).find((item) => item.id === refId);
  if (reference === undefined) {
    return NextResponse.json({ code: 'REFERENCE_NOT_FOUND' }, { status: 404 });
  }

  const updated = await container.projects.removeStyleReference(
    id,
    refId,
    container.clock.nowIso(),
  );
  if (updated === null) {
    return NextResponse.json({ code: 'REFERENCE_NOT_FOUND' }, { status: 404 });
  }

  // El JSON se actualiza primero: si el borrado del archivo falla, sobra un archivo
  // sin dueño, que es menos grave que una referencia rota en el proyecto.
  await container.storage.remove(reference.ref).catch(() => undefined);

  return new NextResponse(null, { status: 204 });
}
