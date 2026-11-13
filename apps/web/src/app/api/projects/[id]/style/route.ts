import { NextResponse } from 'next/server';
import {
  MAX_STYLE_REFERENCES,
  STYLE_KINDS,
  isStyleKind,
  styleReferencesOf,
  type StyleReference,
} from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lo que acepta Nano Banana como referencia; un PDF o un SVG no sirven. */
const ACCEPTED_TYPES: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** 8 MB: suficiente para una foto de producto sin castigar el almacenamiento local. */
const MAX_BYTES = 8 * 1024 * 1024;

export interface StyleReferenceResponse {
  readonly id: string;
  readonly kind: StyleReference['kind'];
  readonly label: string;
  readonly url: string;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();
  const project = await container.projects.find(id);
  if (project === null) return NextResponse.json({ code: 'PROJECT_NOT_FOUND' }, { status: 404 });

  const references: StyleReferenceResponse[] = await Promise.all(
    styleReferencesOf(project.styleReferences).map(async (reference) => ({
      id: reference.id,
      kind: reference.kind,
      label: reference.label,
      url: await container.storage.signedUrl(
        { key: reference.ref, mimeType: reference.mimeType, bytes: 0 },
        3600,
      ),
    })),
  );

  return NextResponse.json({ references, limit: MAX_STYLE_REFERENCES, kinds: STYLE_KINDS });
}

/**
 * Sube una pieza al tablero de estilo del proyecto.
 *
 * El archivo va al almacenamiento y el proyecto guarda solo la clave: así el
 * render y la generación de imágenes leen exactamente el mismo bytes, sin depender
 * de que el navegador siga abierto.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const container = createContainer();
  const project = await container.projects.find(id);
  if (project === null) return NextResponse.json({ code: 'PROJECT_NOT_FOUND' }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ code: 'INVALID_FORM' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ code: 'FILE_REQUIRED' }, { status: 400 });
  }
  const extension = ACCEPTED_TYPES[file.type];
  if (extension === undefined) {
    return NextResponse.json(
      { code: 'UNSUPPORTED_TYPE', accepted: Object.keys(ACCEPTED_TYPES) },
      { status: 415 },
    );
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ code: 'FILE_TOO_LARGE', maxBytes: MAX_BYTES }, { status: 413 });
  }
  if (styleReferencesOf(project.styleReferences).length >= MAX_STYLE_REFERENCES) {
    return NextResponse.json(
      { code: 'STYLE_LIMIT', limit: MAX_STYLE_REFERENCES },
      { status: 409 },
    );
  }

  const rawKind = form.get('kind');
  const kind: StyleReference['kind'] = isStyleKind(rawKind) ? rawKind : 'estilo';
  const rawLabel = form.get('label');
  const fallback = file.name.replace(/\.[^.]+$/, '').slice(0, 60);
  const label =
    typeof rawLabel === 'string' && rawLabel.trim().length > 0
      ? rawLabel.trim().slice(0, 60)
      : fallback || kind;

  const workspace = await getWorkspace();
  const referenceId = crypto.randomUUID();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await container.storage.put(
    `style/${workspace.id}/${referenceId}.${extension}`,
    bytes,
    file.type,
  );

  const reference: StyleReference = {
    id: referenceId,
    kind,
    label,
    ref: stored.key,
    mimeType: stored.mimeType,
    createdAt: container.clock.nowIso(),
  };

  const saved = await container.projects.saveStyleReference(id, reference);
  if (saved === null) {
    // El dominio rechazó la pieza (tope o id repetido): no se deja el archivo huérfano.
    await container.storage.remove(stored.key).catch(() => undefined);
    return NextResponse.json(
      { code: 'STYLE_NOT_SAVED', limit: MAX_STYLE_REFERENCES },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      reference: {
        id: reference.id,
        kind: reference.kind,
        label: reference.label,
        url: await container.storage.signedUrl(stored, 3600),
      } satisfies StyleReferenceResponse,
      count: styleReferencesOf(saved.styleReferences).length,
    },
    { status: 201 },
  );
}
