import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sin secretos: solo dice si el proceso está vivo y si tiene lo mínimo configurado. */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    ok: true,
    masterKey: process.env.MASTER_KEY !== undefined && process.env.MASTER_KEY.length > 0,
    demoPassword: process.env.DEMO_PASSWORD !== undefined && process.env.DEMO_PASSWORD.length > 0,
    worker: process.env.REMOTION_BROWSER ?? null,
  });
}
