import type { WordTiming } from './types';

export type SfxName = 'whoosh' | 'impact' | 'riser';

/** Archivos de `public/sfx`, sintetizados por `scripts/make-sfx.sh` (ffmpeg puro). */
export const SFX_SRC: Record<SfxName, string> = {
  whoosh: 'sfx/whoosh.wav',
  impact: 'sfx/impact.wav',
  riser: 'sfx/riser.wav',
};

/** Duración real de cada wav; evita leer metadata en tiempo de render. */
export const SFX_DURATION_MS: Record<SfxName, number> = {
  whoosh: 400,
  impact: 550,
  riser: 600,
};

/** Volúmenes conservadores: la voz manda, el SFX solo marca el corte. */
export const SFX_VOLUME: Record<SfxName, number> = {
  whoosh: 0.18,
  impact: 0.22,
  riser: 0.12,
};

/**
 * Fades por frame, por efecto. El impacto lleva fade-in 0 a propósito: su
 * transitorio vive en los primeros 20 ms y un fade de 2 frames (66 ms) se lo
 * comía entero (-10 dB de pico medidos en el render).
 */
export const SFX_FADE_IN_FRAMES: Record<SfxName, number> = { whoosh: 2, impact: 0, riser: 2 };
export const SFX_FADE_OUT_FRAMES: Record<SfxName, number> = { whoosh: 5, impact: 8, riser: 3 };

/** El whoosh arranca antes del corte para que su cuerpo caiga justo en el corte. */
export const WHOOSH_LEAD_MS = 200;
/** Riser de 0,6 s que termina exactamente en el corte del CTA. */
export const RISER_MS = 600;

export interface VoiceSpan {
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * Ganancia base de la música, antes de que la voz la empuje abajo.
 *
 * Las pistas están normalizadas a -18 LUFS: 0.26 las deja sobre -31 dBFS, unos
 * 6 dB por debajo de la voz y audibles en los silencios. Con el valor anterior
 * (0.12) el fondo quedaba a -44 dBFS y no se oía ni en los cortes.
 */
export const MUSIC_BASE_VOLUME = 0.26;
/**
 * A cuánto baja la música mientras hay voz.
 *
 * 0.45 relativo a la base: -38 dBFS con la voz a -25, es decir 13 dB por debajo.
 * Bajar más (0.3, el valor viejo) la volvía inaudible en un video con narración
 * casi continua.
 */
export const DUCKING_GAIN = 0.45;
/** Ataque/liberación del ducking; más corto suena a bombeo. */
export const DUCKING_RAMP_MS = 180;

export interface VoiceSceneInput {
  readonly words: readonly WordTiming[];
  /** Frame del timeline en el que empieza la escena, convertido a ms. */
  readonly startMs: number;
}

/**
 * Intervalos con voz a lo largo del video, en ms absolutos.
 *
 * Los huecos entre palabras (~40-130 ms) se funden: si no, el ducking bombearía
 * entre palabra y palabra.
 */
export function buildVoiceSpans(scenes: readonly VoiceSceneInput[]): VoiceSpan[] {
  const raw: VoiceSpan[] = [];
  for (const scene of scenes) {
    for (const word of scene.words) {
      if (word.endMs <= word.startMs) continue;
      raw.push({ startMs: scene.startMs + word.startMs, endMs: scene.startMs + word.endMs });
    }
  }
  raw.sort((a, b) => a.startMs - b.startMs);

  const MERGE_GAP_MS = 220;
  const merged: VoiceSpan[] = [];
  for (const span of raw) {
    const last = merged[merged.length - 1];
    if (last !== undefined && span.startMs - last.endMs <= MERGE_GAP_MS) {
      merged[merged.length - 1] = { startMs: last.startMs, endMs: Math.max(last.endMs, span.endMs) };
    } else {
      merged.push(span);
    }
  }
  return merged;
}

/**
 * Envolvente de ducking: 1 sin voz, `DUCKING_GAIN` con voz, con rampas lineales
 * de `DUCKING_RAMP_MS` a la entrada y a la salida de cada frase.
 */
export function duckingGain(ms: number, spans: readonly VoiceSpan[]): number {
  let gain = 1;
  for (const span of spans) {
    if (ms >= span.startMs && ms <= span.endMs) return DUCKING_GAIN;

    if (ms > span.endMs && ms < span.endMs + DUCKING_RAMP_MS) {
      const t = (ms - span.endMs) / DUCKING_RAMP_MS;
      gain = Math.min(gain, DUCKING_GAIN + (1 - DUCKING_GAIN) * t);
    } else if (ms < span.startMs && ms > span.startMs - DUCKING_RAMP_MS) {
      // 0 en el borde de la rampa, 1 justo en la primera palabra.
      const t = 1 - (span.startMs - ms) / DUCKING_RAMP_MS;
      gain = Math.min(gain, 1 - (1 - DUCKING_GAIN) * t);
    }
  }
  return gain;
}
