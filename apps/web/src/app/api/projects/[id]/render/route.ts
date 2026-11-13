import { NextResponse } from 'next/server';
import { enqueueRender } from '@/lib/render-job';
import { createContainer } from '@/lib/container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

/**
 * Encola el render de un proyecto y responde 202 con el id del trabajo.
 *
 * El proceso de Remotion corre desacoplado (`detached`, log a archivo): ni un F5
 * ni un corte del navegador lo matan. `GET /api/jobs/:id` devuelve el estado
 * cuando se pregunte, incluso después de recargar la página.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();
  if (container.secrets === null) {
    return NextResponse.json({ code: 'MASTER_KEY_MISSING' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { formato?: unknown };
  const result = await enqueueRender({ projectId: id, formato: body.formato });

  if (!result.ok) {
    const status =
      result.code === 'PROJECT_NOT_FOUND'
        ? 404
        : result.code === 'INVALID_PLAN'
          ? 422
          : result.code === 'ASSETS_MISSING'
            ? 409
            : 502;
    return NextResponse.json(
      {
        code: result.code,
        ...(result.scenes === undefined ? {} : { scenes: result.scenes }),
        ...(result.issues === undefined ? {} : { issues: result.issues }),
        ...(result.message === undefined ? {} : { message: result.message }),
      },
      { status },
    );
  }

  return NextResponse.json(
    { jobId: result.jobId, status: 'running', formato: result.formato },
    { status: 202 },
  );
}
