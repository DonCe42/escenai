import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { formatSpec } from './formats';
import type { FormatSpec } from './formats';
import type { SceneProps, VideoProps } from './types';
// Chrome headless cae en serif si no se declara familia: se nota mucho.
const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif";

/** Acepta URLs absolutas o rutas dentro de public/ (lo normal en el render). */
function resolveSrc(src: string): string {
  return src.startsWith('http') || src.startsWith('data:') ? src : staticFile(src);
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
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: `0 ${spec.sidePadding}px`,
        gap: 12 * scale,
      }}
    >
      {lines.map((line, index) => {
        const start = Math.round(index * 0.18 * fps);
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
              fontSize: Math.round(96 * scale),
              lineHeight: 1.02,
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
}: {
  scene: SceneProps;
  accent: string;
  scale: number;
  spec: FormatSpec;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // Dos líneas de tres palabras como máximo, siempre alrededor de la que suena.
  // Pintar la escena entera hacía bloques de cuatro líneas ilegibles en narraciones largas.
  const words = scene.words;
  if (words.length === 0) return null;

  const PER_LINE = 3;
  const VISIBLE = PER_LINE * 2;
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
          maxWidth: Math.round(820 * scale),
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: Math.round(52 * scale),
          fontWeight: 600,
          lineHeight: 1.25,
          textShadow: '0 4px 18px rgba(0,0,0,0.85)',
          // El blanco sobre ilustración clara se pierde: la caja garantiza contraste.
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderRadius: Math.round(18 * scale),
          padding: `${Math.round(10 * scale)}px ${Math.round(22 * scale)}px`,
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
                    color: active ? accent : past ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.85)',
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

export function EscenaiVideo({
  scenes,
  colorFondo,
  colorTexto,
  colorAcento,
  formato,
}: VideoProps) {
  const { fps, width, height } = useVideoConfig();
  const spec = formatSpec(formato ?? '9:16');
  // Escala por área: el mismo texto respira igual en 9:16, 1:1 y 16:9.
  const scale = Math.sqrt((width * height) / (1080 * 1920));
  let from = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: colorFondo }}>
      {scenes.map((scene) => {
        const durationInFrames = Math.max(1, Math.round((scene.durationMs / 1000) * fps));
        const start = from;
        from += durationInFrames;

        return (
          <Sequence key={scene.id} from={start} durationInFrames={durationInFrames}>
            <AbsoluteFill style={{ backgroundColor: colorFondo }}>
              {scene.videoSrc === undefined ? (
                <KenBurns scene={scene} durationInFrames={durationInFrames} />
              ) : (
                <OffthreadVideo
                  src={resolveSrc(scene.videoSrc)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  muted
                />
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
              <Karaoke scene={scene} accent={colorAcento} scale={scale} spec={spec} />
              {scene.audioSrc !== '' && <Audio src={resolveSrc(scene.audioSrc)} />}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: 6,
                  width: `${(100 * (start + durationInFrames)) / Math.max(1, scenes.reduce((s, x) => s + Math.round((x.durationMs / 1000) * fps), 0))}%`,
                  backgroundColor: colorAcento,
                  opacity: 0.9,
                }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 24, pointerEvents: 'none' }}>
        <span style={{ color: colorTexto, opacity: 0.25,      fontFamily: FONT, fontSize: 22, letterSpacing: '0.3em' }}>
          ESCENAI
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
