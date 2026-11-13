import { MUSIC_BASE_VOLUME } from './sound';
import type { TransitionStyle, VideoFormat, VideoProps } from './types';

/**
 * Contrato de props del render, en JSON Schema.
 *
 * Sirve para lo que Remotion no cubre: la API que encola renders valida contra
 * esto antes de escribir el JSON, y el inspector puede generar el formulario.
 *
 * TODO: Remotion acepta un `schema` zod en `<Composition>` para editar props en
 * el Studio, pero eso exige añadir `zod` a las dependencias del worker. Mientras
 * no haga falta el editor del Studio, el contrato vive aquí en JSON Schema y el
 * defaulting se hace en `normalizeVideoProps`.
 */
export const VIDEO_PROPS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'EscenaiVideoProps',
  type: 'object',
  required: ['formato', 'colorFondo', 'colorTexto', 'colorAcento', 'scenes'],
  additionalProperties: true,
  properties: {
    titulo: { type: 'string' },
    formato: { type: 'string', enum: ['9:16', '1:1', '16:9'] },
    colorFondo: { type: 'string' },
    colorTexto: { type: 'string' },
    colorAcento: { type: 'string' },
    transition: {
      type: 'string',
      enum: ['flash', 'whip', 'none'],
      default: 'flash',
      description: 'Transición visual en el corte. No consume timeline.',
    },
    soundDesign: {
      type: 'boolean',
      default: true,
      description: 'Whoosh por corte, impacto en hook/CTA y riser antes del CTA.',
    },
    musicSrc: {
      type: 'string',
      description: 'OPCIONAL: música de fondo. Sin definir, no suena música.',
    },
    musicVolume: { type: 'number', minimum: 0, maximum: 1, default: MUSIC_BASE_VOLUME },
    captionStyle: {
      type: 'string',
      enum: ['caja', 'bold', 'minimal'],
      default: 'caja',
      description: 'Estilo de los subtítulos karaoke.',
    },
    scenes: {
      type: 'array',
      minItems: 0,
      items: {
        type: 'object',
        required: ['id', 'textoPantalla', 'imageSrc', 'audioSrc', 'durationMs', 'words', 'motion'],
        properties: {
          id: { type: 'string' },
          textoPantalla: { type: 'array', items: { type: 'string' } },
          imageSrc: { type: 'string', description: 'Vacío = placeholder animado.' },
          videoSrc: { type: 'string' },
          audioSrc: { type: 'string', description: 'Vacío = escena muda.' },
          durationMs: { type: 'number', minimum: 1, description: 'Duración del AUDIO real.' },
          motion: {
            type: 'string',
            enum: ['zoom-in-lento', 'zoom-out-lento', 'pan-derecha', 'pan-izquierda', 'estatico'],
          },
          words: {
            type: 'array',
            items: {
              type: 'object',
              required: ['word', 'startMs', 'endMs'],
              properties: {
                word: { type: 'string' },
                startMs: { type: 'number' },
                endMs: { type: 'number' },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Rellena defaults y descarta valores imposibles sin romper el render.
 *
 * Es la red de seguridad para props que llegan de la API o de renders antiguos:
 * un `transition` desconocido cae en `'flash'` en vez de dejar el corte sin efecto.
 */
export function normalizeVideoProps(props: VideoProps): VideoProps {
  const transition = isTransition(props.transition) ? props.transition : 'flash';
  const soundDesign = typeof props.soundDesign === 'boolean' ? props.soundDesign : true;
  const musicVolume =
    typeof props.musicVolume === 'number' && props.musicVolume >= 0 && props.musicVolume <= 1
      ? props.musicVolume
      : MUSIC_BASE_VOLUME;

  const captionStyle =
    props.captionStyle === 'bold' || props.captionStyle === 'minimal' ? props.captionStyle : 'caja';

  return {
    ...props,
    formato: isFormat(props.formato) ? props.formato : '9:16',
    scenes: props.scenes ?? [],
    transition,
    soundDesign,
    musicVolume,
    captionStyle,
  };
}

function isTransition(value: unknown): value is TransitionStyle {
  return value === 'flash' || value === 'whip' || value === 'none';
}

function isFormat(value: unknown): value is VideoFormat {
  return value === '9:16' || value === '1:1' || value === '16:9';
}
