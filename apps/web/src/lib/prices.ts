import type { PriceTable } from '@escenai/core';

/**
 * Precios de lista al 2026-11-12. En este dominio caducan cada trimestre:
 * cuando cambien, se edita este archivo y nada más.
 *
 * Fuentes:
 * - Vertex Nano Banana 2.1: $0.0336–$0.1134 por imagen (1K–4K), listado público de inference.sh.
 *   Aquí se usa 1K porque el render pide 768×1376.
 * - MiniMax speech-2.8-hd: $100 por millón de caracteres = $0.10 por 1.000 (doc oficial de MiniMax).
 * - MiniMax H3 768P: $0.08/s (solo se usa si se encienden clips generativos).
 * - Render: 0, corre en el worker local.
 */
export const PRICES: PriceTable = {
  imagePerUnit: 0.0336,
  speechPer1kChars: 0.1,
  videoPerSecond: 0.08,
  musicPerTrack: 0,
};

export const PRICE_NOTES = [
  'Imagen: Vertex Nano Banana 2.1, ~1K ($0.0336/unidad)',
  'Voz: MiniMax speech-2.8-hd ($0.10 por 1.000 caracteres)',
  'Render: local, sin coste de proveedor',
] as const;

export const PRICE_SNAPSHOT_LABEL = 'precios de lista · 12 nov 2026';

/** Redondeo a centavos para mostrar, sin acumular error en el total. */
export function usd(value: number): string {
  if (value > 0 && value < 0.01) return '<$0.01';
  return `$${value.toFixed(2)}`;
}
