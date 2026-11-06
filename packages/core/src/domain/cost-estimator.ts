import type { VideoPlan } from './video-plan';

/** Precios por unidad. Vienen de configuración: en este dominio los precios caducan. */
export interface PriceTable {
  readonly imagePerUnit: number;
  readonly speechPer1kChars: number;
  readonly videoPerSecond: number;
  readonly musicPerTrack: number;
}

/**
 * Precio por segundo de video en MiniMax (consultado el 2026-11-06).
 * H3 se cobra por Pay-as-you-go, no por el plan de tokens.
 */
export const VIDEO_PRICE_PER_SECOND = {
  'MiniMax-H3': { '2K': 0.13, '768P': 0.08 },
  'MiniMax-H3-Highspeed': { '768P': 0.06, '480P': 0.04 },
  'MiniMax-H3-Lite': { '768P': 0.04, '480P': 0.025 },
} as const;

export type VideoModelId = keyof typeof VIDEO_PRICE_PER_SECOND;

export function estimateClipCost(model: VideoModelId, resolution: string, seconds: number): number {
  const table = VIDEO_PRICE_PER_SECOND[model] as Record<string, number | undefined>;
  const perSecond = table[resolution] ?? Object.values(table)[0] ?? 0;
  return Math.round(perSecond * seconds * 10000) / 10000;
}

export interface CostOptions {
  readonly clips?: { readonly count: number; readonly seconds: number };
  readonly music?: boolean;
}

export interface CostBreakdown {
  readonly images: number;
  readonly speech: number;
  readonly video: number;
  readonly music: number;
  readonly total: number;
  readonly currency: 'USD';
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function estimateCost(plan: VideoPlan, prices: PriceTable, options: CostOptions = {}): CostBreakdown {
  const images = round(plan.escenas.length * prices.imagePerUnit);

  const characters = plan.escenas.reduce((sum, scene) => sum + scene.narracion.length, 0);
  const speech = round((characters / 1000) * prices.speechPer1kChars);

  const clips = options.clips;
  const video = clips === undefined ? 0 : round(clips.count * clips.seconds * prices.videoPerSecond);
  const music = options.music === true ? prices.musicPerTrack : 0;

  return {
    images,
    speech,
    video,
    music: round(music),
    total: round(images + speech + video + music),
    currency: 'USD',
  };
}
