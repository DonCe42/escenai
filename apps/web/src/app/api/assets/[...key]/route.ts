import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  wav: 'audio/wav',
};

/** Sirve assets locales del modo demo. En producción esto es Supabase Storage con URL firmada. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await context.params;
  const segments = key.map((segment) => segment.replace(/\.\./g, ''));
  const path = join(process.cwd(), '.data', 'assets', ...segments);

  try {
    const bytes = await readFile(path);
    const extension = segments.at(-1)?.split('.').pop()?.toLowerCase() ?? '';
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'content-type': MIME[extension] ?? 'application/octet-stream',
        'cache-control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'ASSET_NOT_FOUND' }, { status: 404 });
  }
}
