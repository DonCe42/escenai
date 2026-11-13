export interface WordTiming {
  readonly word: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface SceneProps {
  readonly id: string;
  readonly textoPantalla: readonly string[];
  readonly imageSrc: string;
  /** Si viene, la escena muestra este clip en lugar de la imagen. */
  readonly videoSrc?: string;
  readonly audioSrc: string;
  readonly durationMs: number;
  readonly words: readonly WordTiming[];
  readonly motion: 'zoom-in-lento' | 'zoom-out-lento' | 'pan-derecha' | 'pan-izquierda' | 'estatico';
}

export type VideoFormat = '9:16' | '1:1' | '16:9';

/**
 * Cómo se resuelve el corte entre escenas.
 *
 * - `flash`: fogonazo blanco + entrada con blur/zoom rápido. Default.
 * - `whip`: barrido horizontal con estelas y blur fuerte, tipo latigazo de cámara.
 * - `none`: corte seco, sin overlay (el de antes de R4).
 *
 * Todas las transiciones son visuales por superposición sobre el corte: no
 * consumen frames del timeline, así que la voz sigue clavada a su escena y la
 * duración total no cambia.
 */
export type TransitionStyle = 'flash' | 'whip' | 'none';

/**
 * Estilo de subtítulos.
 *
 * - `caja`: caja oscura detrás del texto. Máximo contraste sobre cualquier foto.
 * - `bold`: texto grande con contorno y la palabra activa sobre el acento.
 * - `minimal`: texto fino, sin fondo, apoyo en la sombra.
 */
export type CaptionStyle = 'caja' | 'bold' | 'minimal';

export interface VideoProps {
  /** Remotion exige que los props sean un Record; el índice lo satisface sin perder tipos. */
  readonly [key: string]: unknown;
  readonly titulo: string;
  readonly formato: VideoFormat;
  readonly colorFondo: string;
  readonly colorTexto: string;
  readonly colorAcento: string;
  readonly scenes: readonly SceneProps[];
  /** Estilo del corte entre escenas. Default `'flash'`. */
  readonly transition?: TransitionStyle;
  /** Whoosh por corte, impacto en hook y CTA, riser antes del CTA. Default `true`. */
  readonly soundDesign?: boolean;
  /**
   * Música de fondo. Sin definir no suena nada: no hay pista por defecto.
   *
   * TODO(R6): pista CC0 propia en `apps/web/public/music/`. Cuando exista, basta
   * con pasar `musicSrc`; el ducking bajo la voz ya está implementado abajo
   * (`duckingGain`), con envolvente calculada desde los timestamps de palabra.
   */
  readonly musicSrc?: string;
  /** Ganancia de la música antes del ducking. Default `MUSIC_BASE_VOLUME` (0.12). */
  readonly musicVolume?: number;
  /** Estilo de subtítulos. Default `'caja'`. */
  readonly captionStyle?: CaptionStyle;
}
