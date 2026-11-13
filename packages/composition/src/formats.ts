import type { VideoFormat } from './types';

export interface FormatSpec {
  readonly width: number;
  readonly height: number;
  /** Zona que la interfaz de la plataforma tapa: subtítulos y logo no entran ahí. */
  readonly safeBottom: number;
  readonly sidePadding: number;
}

export const FORMATS: Record<VideoFormat, FormatSpec> = {
  '9:16': { width: 1080, height: 1920, safeBottom: 320, sidePadding: 90 },
  '1:1': { width: 1080, height: 1080, safeBottom: 120, sidePadding: 70 },
  '16:9': { width: 1920, height: 1080, safeBottom: 70, sidePadding: 140 },
};

export function formatSpec(format: VideoFormat): FormatSpec {
  return FORMATS[format];
}
