import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import { estimateCost, validateVideoPlan } from '@escenai/core';
import { DemoViewer } from '@/components/demo/DemoViewer';
import { DEMO_COPY, type DemoPayload } from '@/lib/demo';
import { getLocale } from '@/lib/locale-server';
import { PRICES } from '@/lib/prices';

export const dynamic = 'force-dynamic';

/**
 * Ejemplo abierto: el proyecto completo en modo lectura, sin keys y sin `.data`.
 *
 * Todo sale de `public/demo/` (plan, miniaturas y MP4). El plan se valida al leerlo:
 * si el manifiesto y el video dejan de cuadrar, la página falla en vez de enseñar
 * un ejemplo que no es lo que dice ser.
 */
export default async function DemoPage() {
  const payload = await readFile(join(process.cwd(), 'public', 'demo', 'plan.json'), 'utf8')
    .then((raw) => JSON.parse(raw) as DemoPayload)
    .catch(() => null);
  if (payload === null) notFound();

  const validation = validateVideoPlan(payload.plan);
  if (!validation.ok) notFound();

  const locale = await getLocale();
  const cost = estimateCost(payload.plan, PRICES);

  return (
    <DemoViewer payload={payload} copy={DEMO_COPY[locale]} cost={cost} locale={locale} />
  );
}
