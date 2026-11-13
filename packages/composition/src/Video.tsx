import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { formatSpec } from './formats';
import type { FormatSpec } from './formats';
import {
  MUSIC_BASE_VOLUME,
  SFX_DURATION_MS,
  SFX_FADE_IN_FRAMES,
  SFX_FADE_OUT_FRAMES,
  SFX_SRC,
  SFX_VOLUME,
  RISER_MS,
  WHOOSH_LEAD_MS,
  buildVoiceSpans,
  duckingGain,
} from './sound';
import type { SfxName, VoiceSpan } from './sound';
import type { CaptionStyle, SceneProps, TransitionStyle, VideoProps } from './types';
// Chrome headless cae en serif si no se declara familia: se nota mucho.
const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif";

/**
 * La transición ocupa 8 frames (≈ 0,27 s a 30 fps) centrados en el corte:
 * 4 antes y 4 después. Es un overlay: NO recorta ni desplaza ninguna escena,
 * así que la duración total sigue siendo la suma exacta de los `durationMs` y
 * cada voz sigue pegada al frame en que empieza su escena.
 */
const TRANSITION_HALF_FRAMES = 4;
const TRANSITION_FRAMES = TRANSITION_HALF_FRAMES * 2;

/** Acepta URLs absolutas o rutas dentro de public/ (lo normal en el render). */
function resolveSrc(src: string): string {
  return src.startsWith('http') || src.startsWith('data:') ? src : staticFile(src);
}

/** `#rrggbb` -> `rgba()`. Si no es hex, devuelve el color tal cual (no rompe el render). */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const full = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
  if (full === null) return color;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface SceneSlice {
  readonly scene: SceneProps;
  readonly start: number;
  readonly durationInFrames: number;
}

/** Reparto determinista de frames: cada escena dura su audio redondeado a frames. */
function layoutScenes(scenes: readonly SceneProps[], fps: number): SceneSlice[] {
  const slices: SceneSlice[] = [];
  let from = 0;
  for (const scene of scenes) {
    const durationInFrames = Math.max(1, Math.round((scene.durationMs / 1000) * fps));
    slices.push({ scene, start: from, durationInFrames });
    from += durationInFrames;
  }
  return slices;
}

function KenBurns({ scene, durationInFrames }: { scene: SceneProps; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    easing: Easing.inOut(Easing.ease),
    extrapolateRight: 'clamp',
  });

  const zoomIn = scene.motion === 'zoom-in-lento';
  const zoomOut = scene.motion === 'zoom-out-lento';
  const scale = zoomIn ? 1 + progress * 0.09 : zoomOut ? 1.09 - progress * 0.09 : 1.04;
  const translateX =
    scene.motion === 'pan-derecha' ? -40 + progress * 80 : scene.motion === 'pan-izquierda' ? 40 - progress * 80 : 0;

  return (
    <AbsoluteFill>
      <Img
        src={resolveSrc(scene.imageSrc)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateX(${translateX}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Escena sin imagen todavía (la generación de imágenes es asíncrona).
 * Debe existir para que la transición se vea también aquí: el overlay del corte
 * está por encima de todo, así que el flash entra igual sobre el placeholder.
 */
function ScenePlaceholder({
  accent,
  colorFondo,
  durationInFrames,
}: {
  accent: string;
  colorFondo: string;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const progress = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);
  const breathe = 0.5 + 0.5 * Math.sin(progress * Math.PI * 2);

  return (
    <AbsoluteFill style={{ backgroundColor: colorFondo, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: '-20%',
          top: '-10%',
          width: '140%',
          height: '120%',
          background: `radial-gradient(circle at 50% ${30 + progress * 20}%, ${withAlpha(accent, 0.26)} 0%, ${withAlpha(
            accent,
            0.07,
          )} 40%, rgba(0,0,0,0) 72%)`,
          transform: `scale(${1.04 + progress * 0.05})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          width: '46%',
          paddingBottom: '46%',
          transform: 'translate(-50%, -50%)',
          border: `2px solid ${withAlpha(accent, 0.18 + breathe * 0.18)}`,
          borderRadius: '50%',
        }}
      />
    </AbsoluteFill>
  );
}

interface EdgeStyle {
  readonly transform: string | undefined;
  readonly filter: string | undefined;
}

/**
 * Movimiento de borde de escena: entra animada y sale animada, pero SIN mover
 * el inicio ni el fin de la Sequence. El peso decae a 0 a los 4 frames, así que
 * el 99 % de la escena se dibuja sin transform ni blur (coste de rasterizado cero).
 */
function edgeStyle(
  transition: TransitionStyle,
  frame: number,
  durationInFrames: number,
  half: number,
  hasEnter: boolean,
  hasExit: boolean,
): EdgeStyle {
  if (transition === 'none' || half < 1) return { transform: undefined, filter: undefined };

  const enterEase = Easing.out(Easing.cubic)(Math.min(1, frame / half));
  const remaining = durationInFrames - 1 - frame;
  const exit = Math.min(1, Math.max(0, remaining / half));
  // La primera escena no "entra" de ningún sitio y la última no "sale": sin esto
  // el frame 0 del video (y del preview) sale desenfocado.
  const inWeight = hasEnter ? 1 - enterEase : 0;
  const outWeight = hasExit ? 1 - exit : 0;
  const weight = Math.max(inWeight, outWeight);

  if (weight < 0.01) return { transform: undefined, filter: undefined };

  if (transition === 'whip') {
    // Escala > 1 para que el desplazamiento lateral nunca descubra el fondo,
    // estirado horizontal para simular arrastre de obturador, y blur alto.
    const fromIn = inWeight >= outWeight;
    const w = fromIn ? inWeight : outWeight;
    const translateX = fromIn ? 6 * w : -6 * w;
    return {
      transform: `translateX(${translateX}%) scaleX(${1 + 0.22 * w}) scaleY(${1 + 0.08 * w})`,
      filter: `blur(${(22 * Math.pow(w, 1.3)).toFixed(2)}px) brightness(${1 + 0.18 * w})`,
    };
  }

  // flash: micro-zoom y blur que se asientan en 4 frames; el fogonazo lo pone el overlay.
  // La salida lleva menos blur que la entrada: el fogonazo ya cubre el corte.
  const blur = 9 * inWeight + 4 * outWeight;
  return {
    transform: `scale(${1 + 0.05 * inWeight + 0.02 * outWeight})`,
    filter: `blur(${blur.toFixed(2)}px) brightness(${1 + 0.22 * inWeight + 0.1 * outWeight})`,
  };
}

function SceneFx({
  transition,
  durationInFrames,
  hasEnter,
  hasExit,
  children,
}: {
  transition: TransitionStyle;
  durationInFrames: number;
  hasEnter: boolean;
  hasExit: boolean;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const half = Math.min(TRANSITION_HALF_FRAMES, Math.max(1, Math.floor(durationInFrames / 2)));
  const style = edgeStyle(transition, frame, durationInFrames, half, hasEnter, hasExit);

  return (
    <AbsoluteFill
      style={{
        transform: style.transform,
        filter: style.filter,
        overflow: 'hidden',
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/**
 * Overlay del corte. Se monta en `cut - TRANSITION_HALF_FRAMES` y dura 8 frames:
 * la mitad pisa el final de la escena saliente y la otra mitad el arranque de la
 * entrante. No añade ni quita frames a nadie.
 */
function CutOverlay({ transition, colorAcento }: { transition: TransitionStyle; colorAcento: string }) {
  const frame = useCurrentFrame();
  if (transition === 'none') return null;

  const progress = (frame + 0.5) / TRANSITION_FRAMES;
  const envelope = Math.sin(Math.PI * progress);
  if (envelope <= 0.001) return null;

  if (transition === 'whip') {
    // Barrido de luz, no rayas: unas bandas verticales fijas sobre un frame
    // quieto se leen como persianas. Una banda que avanza con el frame sí
    // transmite movimiento horizontal.
    const sweep = 10 + frame * 20;
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <AbsoluteFill style={{ backgroundColor: withAlpha(colorAcento, 0.08 * envelope) }} />
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(255,255,255,${(0.2 * envelope).toFixed(
              3,
            )}) 0%, rgba(255,255,255,0) ${sweep}%, rgba(255,255,255,${(0.3 * envelope).toFixed(
              3,
            )}) ${sweep + 16}%, rgba(255,255,255,0) ${sweep + 38}%, rgba(255,255,255,${(0.2 * envelope).toFixed(
              3,
            )}) 100%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ backgroundColor: `rgba(255,255,255,${(0.72 * envelope).toFixed(3)})` }} />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 46%, rgba(255,255,255,${(0.5 * envelope).toFixed(
            3,
          )}) 0%, rgba(255,255,255,0) 58%)`,
        }}
      />
    </AbsoluteFill>
  );
}

function ScreenText({
  lines,
  accent,
  scale,
  spec,
}: {
  lines: readonly string[];
  accent: string;
  scale: number;
  spec: FormatSpec;
}) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // El tamaño se calcula para que cada línea del plan quepa en UN renglón: con
  // 96 px fijos, un titular largo hacía wrap, sus dos renglones se tocaban
  // (line-height 1.02) y la segunda línea del titular se le montaba encima.
  const usable = width - spec.sidePadding * 2;
  const longest = Math.max(...lines.map((line) => line.length), 1);
  const cap = lines.length > 1 ? 84 : 96;
  const fontSize = Math.round(Math.min(cap, usable / (longest * 0.66)) * scale);

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        // El titular vive por encima de la zona de subtítulos: centrado puro se
        // metía debajo de la caja del karaoke y lo tapaba.
        justifyContent: 'center',
        paddingLeft: spec.sidePadding,
        paddingRight: spec.sidePadding,
        paddingBottom: spec.safeBottom * 1.35,
        gap: 34 * scale,
      }}
    >
      {lines.map((line, index) => {
        // La entrada arranca antes del frame 0: sin esto el primer frame de cada
        // escena sale vacío y el preview parece roto al abrirlo o al hacer seek.
        const start = Math.round(index * 0.18 * fps) - 5;
        const opacity = interpolate(frame, [start, start + 8], [0, 1], { extrapolateRight: 'clamp' });
        const y = interpolate(frame, [start, start + 8], [28, 0], {
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        return (
          <p
            key={`${line}-${index}`}
            style={{
              margin: 0,
              opacity,
              transform: `translateY(${y}px)`,
              color: index === lines.length - 1 ? accent : '#ffffff',
              fontFamily: FONT,
              fontSize,
              lineHeight: 1.16,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              textAlign: 'center',
              textShadow: '0 6px 30px rgba(0,0,0,0.45)',
            }}
          >
            {line}
          </p>
        );
      })}
    </AbsoluteFill>
  );
}

function Karaoke({
  scene,
  accent,
  scale,
  spec,
  style,
}: {
  scene: SceneProps;
  accent: string;
  scale: number;
  spec: FormatSpec;
  style: CaptionStyle;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // Dos líneas de tres palabras como máximo, siempre alrededor de la que suena.
  // Pintar la escena entera hacía bloques de cuatro líneas ilegibles en narraciones largas.
  const words = scene.words;
  if (words.length === 0) return null;

  // 'bold' enseña más palabras y 'minimal' menos: cada estilo tiene su ritmo.
  const PER_LINE = style === 'bold' ? 3 : 3;
  const VISIBLE = style === 'bold' ? PER_LINE * 2 + 1 : style === 'minimal' ? PER_LINE : PER_LINE * 2;
  const spoken = words.findIndex((word) => currentMs >= word.startMs - 40 && currentMs <= word.endMs + 60);
  const primera = words[0];
  const index =
    spoken === -1 ? (primera !== undefined && currentMs < primera.startMs ? 0 : words.length - 1) : spoken;
  const first = Math.max(0, Math.min(index - PER_LINE + 1, Math.max(0, words.length - VISIBLE)));
  const visible = words.slice(first, first + VISIBLE);
  const lines = [visible.slice(0, PER_LINE), visible.slice(PER_LINE)];

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', paddingBottom: spec.safeBottom }}>
      <div
        style={{
          margin: '0 auto',
          maxWidth: Math.round((style === 'bold' ? 900 : 820) * scale),
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: Math.round((style === 'bold' ? 60 : style === 'minimal' ? 44 : 52) * scale),
          fontWeight: style === 'bold' ? 800 : style === 'minimal' ? 500 : 600,
          lineHeight: 1.25,
          ...(style === 'minimal' ? {} : { textTransform: 'none' as const }),
          // 'caja' garantiza contraste sobre cualquier ilustración; 'bold' usa un
          // contorno grueso; 'minimal' confía en la sombra y va sin fondo.
          textShadow:
            style === 'bold'
              ? '0 0 12px rgba(0,0,0,0.9), 0 6px 24px rgba(0,0,0,0.85)'
              : '0 4px 18px rgba(0,0,0,0.85)',
          ...(style === 'caja'
            ? {
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: Math.round(18 * scale),
                padding: `${Math.round(10 * scale)}px ${Math.round(22 * scale)}px`,
              }
            : style === 'bold'
              ? {
                  backgroundColor: 'rgba(0,0,0,0.28)',
                  borderRadius: Math.round(6 * scale),
                  padding: `${Math.round(6 * scale)}px ${Math.round(14 * scale)}px`,
                  WebkitTextStroke: `${Math.max(1, Math.round(1.4 * scale))}px rgba(0,0,0,0.55)`,
                }
              : { padding: '0', opacity: 0.94 }),
          width: 'fit-content',
        }}
      >
        {lines.map((line, index) => (
          <p key={index} style={{ margin: '0 0 6px' }}>
            {line.map((word, wordIndex) => {
              const active = currentMs >= word.startMs - 40 && currentMs <= word.endMs + 60;
              const past = currentMs > word.endMs + 60;
              return (
                <span
                  key={`${wordIndex}-${word.startMs}`}
                  style={{
                    color: active
                      ? style === 'bold'
                        ? '#0c0a09'
                        : accent
                      : past
                        ? 'rgba(255,255,255,0.55)'
                        : 'rgba(255,255,255,0.88)',
                    ...(active && style === 'bold'
                      ? {
                          backgroundColor: accent,
                          borderRadius: Math.round(6 * scale),
                          padding: `0 ${Math.round(4 * scale)}px`,
                        }
                      : {}),
                    transition: 'none',
                  }}
                >
                  {word.word}{' '}
                </span>
              );
            })}
          </p>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Un SFX con fades por frame. El wav también trae fades horneados, pero el
 * recorte de la Sequence puede cortar el final: esto garantiza 0 en los bordes.
 */
function Sfx({
  name,
  volume,
  durationInFrames,
}: {
  name: SfxName;
  volume: number;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const remaining = durationInFrames - 1 - frame;
  const fadeIn = SFX_FADE_IN_FRAMES[name];
  const fadeOut = Math.max(1, SFX_FADE_OUT_FRAMES[name]);
  const inFactor = fadeIn === 0 ? 1 : Math.min(1, frame / fadeIn);
  const envelope = Math.min(1, inFactor, remaining / fadeOut);
  const gain = Math.max(0, volume * envelope);

  return <Audio src={staticFile(SFX_SRC[name])} volume={gain} />;
}

/**
 * Pista de música con ducking bajo la voz.
 *
 * La pista va en bucle (las tres duran menos que un video típico) y entra y sale
 * con rampa: un corte en seco a mitad de compás delata que el audio es de relleno.
 * El ducking baja a `DUCKING_GAIN` mientras hay palabra, con rampas de 180 ms
 * calculadas desde los timestamps reales del TTS.
 */
const MUSIC_FADE_IN_S = 0.8;
const MUSIC_FADE_OUT_S = 1.6;

function MusicBed({ src, volume, spans }: { src: string; volume: number; spans: readonly VoiceSpan[] }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fadeIn = Math.max(1, Math.round(MUSIC_FADE_IN_S * fps));
  const fadeOut = Math.max(1, Math.round(MUSIC_FADE_OUT_S * fps));
  const entrada = Math.min(1, frame / fadeIn);
  const salida = Math.min(1, Math.max(0, (durationInFrames - frame) / fadeOut));
  const gain = volume * duckingGain((frame / fps) * 1000, spans) * entrada * salida;

  return <Audio src={resolveSrc(src)} loop volume={gain} />;
}

export function EscenaiVideo({
  scenes,
  colorFondo,
  colorTexto,
  colorAcento,
  formato,
  transition,
  soundDesign,
  musicSrc,
  musicVolume,
  captionStyle,
}: VideoProps) {
  const { fps, width, height } = useVideoConfig();
  const spec = formatSpec(formato ?? '9:16');
  // Escala por área: el mismo texto respira igual en 9:16, 1:1 y 16:9.
  const scale = Math.sqrt((width * height) / (1080 * 1920));
  const mode: TransitionStyle = transition === 'whip' || transition === 'none' ? transition : 'flash';
  const withSound = soundDesign !== false;
  const caption: CaptionStyle =
    captionStyle === 'bold' || captionStyle === 'minimal' ? captionStyle : 'caja';

  const slices = useMemo(() => layoutScenes(scenes ?? [], fps), [scenes, fps]);
  const totalFrames = Math.max(
    1,
    slices.reduce((sum, slice) => sum + slice.durationInFrames, 0),
  );
  const voiceSpans = useMemo(
    () =>
      buildVoiceSpans(
        slices.map((slice) => ({ words: slice.scene.words, startMs: (slice.start / fps) * 1000 })),
      ),
    [slices, fps],
  );

  const cuts = slices.slice(1).map((slice) => slice.start);
  const lastSlice = slices[slices.length - 1];
  const ctaStart = slices.length > 1 && lastSlice !== undefined ? lastSlice.start : undefined;

  const whooshFrames = Math.max(1, Math.round((SFX_DURATION_MS.whoosh / 1000) * fps));
  const impactFrames = Math.max(1, Math.round((SFX_DURATION_MS.impact / 1000) * fps));
  const riserFrames = Math.max(1, Math.round((RISER_MS / 1000) * fps));
  const whooshLead = Math.round((WHOOSH_LEAD_MS / 1000) * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: colorFondo }}>
      {slices.map(({ scene, start, durationInFrames }, index) => (
        <Sequence key={scene.id} from={start} durationInFrames={durationInFrames}>
          <SceneFx
            transition={mode}
            durationInFrames={durationInFrames}
            hasEnter={index > 0}
            hasExit={index < slices.length - 1}
          >
            <AbsoluteFill style={{ backgroundColor: colorFondo }}>
              {scene.videoSrc !== undefined ? (
                <OffthreadVideo
                  src={resolveSrc(scene.videoSrc)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  muted
                />
              ) : scene.imageSrc !== '' ? (
                <KenBurns scene={scene} durationInFrames={durationInFrames} />
              ) : (
                <ScenePlaceholder accent={colorAcento} colorFondo={colorFondo} durationInFrames={durationInFrames} />
              )}
              <AbsoluteFill
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.20) 55%, rgba(0,0,0,0.84) 100%)',
                }}
              />
              <ScreenText
                lines={scene.textoPantalla}
                accent={colorAcento}
                scale={scale}
                spec={spec}
              />
              <Karaoke
                scene={scene}
                accent={colorAcento}
                scale={scale}
                spec={spec}
                style={caption}
              />
              {scene.audioSrc !== '' && <Audio src={resolveSrc(scene.audioSrc)} />}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: 6,
                  width: `${(100 * (start + durationInFrames)) / totalFrames}%`,
                  backgroundColor: colorAcento,
                  opacity: 0.9,
                }}
              />
            </AbsoluteFill>
          </SceneFx>
        </Sequence>
      ))}

      {/* Overlays de corte: por encima de las escenas y por debajo de la firma. */}
      {mode !== 'none' &&
        cuts.map((cutFrame) => (
          <Sequence
            key={`cut-${cutFrame}`}
            from={Math.max(0, cutFrame - TRANSITION_HALF_FRAMES)}
            durationInFrames={TRANSITION_FRAMES}
            layout="none"
          >
            <CutOverlay transition={mode} colorAcento={colorAcento} />
          </Sequence>
        ))}

      {withSound && (
        <>
          {/* Hook: impacto en el primer frame. */}
          <Sequence from={0} durationInFrames={impactFrames} layout="none">
            <Sfx name="impact" volume={SFX_VOLUME.impact} durationInFrames={impactFrames} />
          </Sequence>
          {/* Un whoosh por cada corte, centrado en el corte. */}
          {cuts.map((cutFrame) => (
            <Sequence
              key={`whoosh-${cutFrame}`}
              from={Math.max(0, cutFrame - whooshLead)}
              durationInFrames={whooshFrames}
              layout="none"
            >
              <Sfx name="whoosh" volume={SFX_VOLUME.whoosh} durationInFrames={whooshFrames} />
            </Sequence>
          ))}
          {ctaStart !== undefined && (
            <>
              {/* Riser de 0,6 s que muere justo en el corte del CTA. */}
              <Sequence from={Math.max(0, ctaStart - riserFrames)} durationInFrames={riserFrames} layout="none">
                <Sfx name="riser" volume={SFX_VOLUME.riser} durationInFrames={riserFrames} />
              </Sequence>
              {/* Impacto que aterriza con el CTA. */}
              <Sequence from={ctaStart} durationInFrames={impactFrames} layout="none">
                <Sfx name="impact" volume={SFX_VOLUME.impact} durationInFrames={impactFrames} />
              </Sequence>
            </>
          )}
        </>
      )}

      {musicSrc !== undefined && musicSrc !== '' && (
        <MusicBed src={musicSrc} volume={musicVolume ?? MUSIC_BASE_VOLUME} spans={voiceSpans} />
      )}

      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 24, pointerEvents: 'none' }}>
        <span style={{ color: colorTexto, opacity: 0.25, fontFamily: FONT, fontSize: 22, letterSpacing: '0.3em' }}>
          ESCENAI
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
