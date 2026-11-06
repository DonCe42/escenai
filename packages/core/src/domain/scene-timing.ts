import { MissingAudioError } from './errors';
import type { VideoPlan } from './video-plan';
import type { WordTiming } from './word-timing';

export interface SceneAudio {
  readonly sceneId: string;
  readonly durationMs: number;
  readonly words: readonly WordTiming[];
}

export interface TimelineScene {
  readonly sceneId: string;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  readonly audioDurationMs: number;
  /** Tiempos absolutos dentro del video, ya desplazados por el inicio de la escena. */
  readonly words: readonly WordTiming[];
}

export interface Timeline {
  readonly scenes: readonly TimelineScene[];
  readonly totalMs: number;
  readonly objetivoMs: number;
  readonly overBudgetMs: number;
  readonly exceedsBudget: boolean;
}

export interface TimingOptions {
  readonly leadInMs?: number;
  readonly tailMs?: number;
  readonly betweenScenesMs?: number;
  readonly tolerance?: number;
}

const DEFAULTS = { leadInMs: 200, tailMs: 400, betweenScenesMs: 150, tolerance: 0.15 } as const;

/**
 * La voz manda: la duración de cada escena sale del audio real, no del guion.
 * Nunca se acelera el audio para caber; si sobra tiempo, se recorta texto antes de renderizar.
 */
export function buildTimeline(
  plan: VideoPlan,
  audios: readonly SceneAudio[],
  options: TimingOptions = {},
): Timeline {
  const leadInMs = options.leadInMs ?? DEFAULTS.leadInMs;
  const tailMs = options.tailMs ?? DEFAULTS.tailMs;
  const betweenScenesMs = options.betweenScenesMs ?? DEFAULTS.betweenScenesMs;
  const tolerance = options.tolerance ?? DEFAULTS.tolerance;

  const byScene = new Map(audios.map((audio) => [audio.sceneId, audio]));
  const scenes: TimelineScene[] = [];
  let cursor = 0;

  for (const scene of plan.escenas) {
    const audio = byScene.get(scene.id);
    if (audio === undefined) throw new MissingAudioError(scene.id);

    const startsAtMs = cursor + leadInMs;
    const endsAtMs = startsAtMs + audio.durationMs + tailMs;

    scenes.push({
      sceneId: scene.id,
      startsAtMs,
      endsAtMs,
      audioDurationMs: audio.durationMs,
      words: audio.words.map((word) => ({
        word: word.word,
        startMs: word.startMs + startsAtMs,
        endMs: word.endMs + startsAtMs,
      })),
    });

    cursor = endsAtMs + betweenScenesMs;
  }

  const totalMs = scenes.at(-1)?.endsAtMs ?? 0;
  const objetivoMs = plan.duracionObjetivoS * 1000;
  const overBudgetMs = Math.max(0, totalMs - objetivoMs);

  return {
    scenes,
    totalMs,
    objetivoMs,
    overBudgetMs,
    exceedsBudget: totalMs > objetivoMs * (1 + tolerance),
  };
}
