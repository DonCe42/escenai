import type { VideoPlan } from './video-plan';

/** Precios por unidad. Vienen de configuración: en este dominio los precios caducan. */
export interface PriceTable {
  readonly imagePerUnit: number;
  readonly speechPer1kChars: number;
  readonly videoPerSecond: number;
  readonly musicPerTrack: number;
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
