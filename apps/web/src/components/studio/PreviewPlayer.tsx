'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import {
  EscenaiVideo,
  MUSIC_BASE_VOLUME,
  type TransitionStyle,
  type VideoProps,
} from '@escenai/composition';
import type { VideoPlan } from '@escenai/core';
import { musicUrl } from '@/lib/music';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

export interface PreviewAsset {
  readonly sceneId: string;
  readonly kind: 'image' | 'voice' | 'clip';
  readonly status: 'idle' | 'running' | 'ready' | 'error';
  readonly url: string | null;
}

interface PreviewPlayerProps {
  readonly plan: VideoPlan;
  readonly assets: readonly PreviewAsset[];
  /** Duración y palabras reales por escena, cuando ya existe la voz. */
  readonly voiceMeta?: Readonly<
    Record<string, { readonly durationMs: number; readonly words: readonly { readonly word: string; readonly startMs: number; readonly endMs: number }[] }>
  >;
  readonly transition?: TransitionStyle;
  /** Milisegundo al que saltar cuando se elige otra escena en el riel. */
  readonly seekMs?: number;
  readonly seekToken?: number;
}

/**
 * Preview real: el mismo componente que renderiza el worker, montado en el
 * navegador con @remotion/player. Lo que se ve aquí es lo que sale del render,
 * no una maqueta.
 */
export function PreviewPlayer({
  plan,
  assets,
  voiceMeta,
  transition = 'flash',
  seekMs,
  seekToken,
}: PreviewPlayerProps) {
  const playerRef = useRef<PlayerRef>(null);
  const inputProps = useMemo<VideoProps>(() => {
    const imageOf = (sceneId: string): string =>
      assets.find((a) => a.sceneId === sceneId && a.kind === 'image' && a.url !== null)?.url ?? '';
    const voiceOf = (sceneId: string): string =>
      assets.find((a) => a.sceneId === sceneId && a.kind === 'voice' && a.url !== null)?.url ?? '';

    return {
      titulo: plan.titulo,
      formato: '9:16',
      colorFondo: '#0a0908',
      colorTexto: '#f4efe7',
      colorAcento: '#e2542a',
      transition,
      captionStyle: plan.captionStyle ?? 'caja',
      soundDesign: false,
      // La misma pista que copiará el render: si el preview calla, el MP4 sorprende.
      musicSrc: musicUrl(plan.musicTrack) ?? undefined,
      musicVolume: MUSIC_BASE_VOLUME,
      scenes: plan.escenas.map((scene) => ({
        id: scene.id,
        textoPantalla: scene.textoPantalla,
        imageSrc: imageOf(scene.id),
        audioSrc: voiceOf(scene.id),
        // Sin voz todavía se usa la duración estimada del plan: el preview
        // sirve desde el primer segundo, antes de gastar.
        durationMs: voiceMeta?.[scene.id]?.durationMs ?? Math.round(scene.duracionEstimadaS * 1000),
        words: voiceMeta?.[scene.id]?.words ?? [],
        motion: scene.movimiento,
      })),
    };
  }, [plan, assets, voiceMeta, transition]);

  const durationInFrames = useMemo(
    () =>
      Math.max(
        1,
        inputProps.scenes.reduce(
          (sum, scene) => sum + Math.max(1, Math.round((scene.durationMs / 1000) * FPS)),
          0,
        ),
      ),
    [inputProps],
  );

  // Al elegir otra escena en el riel, el preview salta a su primer frame.
  useEffect(() => {
    if (seekMs === undefined) return;
    const frame = Math.round((seekMs / 1000) * FPS);
    playerRef.current?.seekTo(Math.min(Math.max(frame, 0), Math.max(0, durationInFrames - 1)));
  }, [seekMs, seekToken, durationInFrames]);

  return (
    <Player
      ref={playerRef}
      component={EscenaiVideo}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      style={{ width: '100%', height: '100%' }}
      controls
      loop
      doubleClickToFullscreen
      clickToPlay
    />
  );
}
