/** Contrato central del producto. Ver 01_Arquitectura/02_contrato_videoplan.md */

export type Locale = 'es' | 'en';
export type Aspect = '9:16' | '1:1' | '16:9';
export type SceneRole = 'hook' | 'problema' | 'desarrollo' | 'prueba' | 'cta';
export type Motion = 'zoom-in-lento' | 'zoom-out-lento' | 'pan-derecha' | 'pan-izquierda' | 'estatico';

export const SCENE_ROLES: readonly SceneRole[] = [
  'hook',
  'problema',
  'desarrollo',
  'prueba',
  'cta',
];

export const MOTIONS: readonly Motion[] = [
  'zoom-in-lento',
  'zoom-out-lento',
  'pan-derecha',
  'pan-izquierda',
  'estatico',
];

export const LIMITS = {
  minEscenas: 5,
  maxEscenas: 12,
  maxLineas: 2,
  maxPalabrasPorLinea: 4,
  minPalabrasNarracion: 8,
  maxPalabrasNarracion: 25,
  minRatioDuracion: 0.85,
  maxRatioDuracion: 1.1,
} as const;

export interface Scene {
  readonly id: string;
  readonly rol: SceneRole;
  readonly narracion: string;
  readonly textoPantalla: readonly string[];
  readonly promptImagen: string;
  readonly movimiento: Motion;
  readonly duracionEstimadaS: number;
}

export type CaptionStyle = 'caja' | 'bold' | 'minimal';

export const CAPTION_STYLES: readonly CaptionStyle[] = ['caja', 'bold', 'minimal'];

/**
 * Música de fondo. No la elige el modelo: es una decisión del usuario y se guarda con
 * la versión para que el render repita exactamente lo que se oyó en el preview.
 */
/**
 * Tope de imágenes de referencia por generación. Nano Banana 2.1 admite 14; se
 * deja aquí para que el puerto y la interfaz no inventen límites distintos.
 */
export const MAX_REFERENCE_IMAGES = 14;

export type MusicTrack = 'ninguna' | 'corporativo' | 'upbeat' | 'piano';

export const MUSIC_TRACKS: readonly MusicTrack[] = ['ninguna', 'corporativo', 'upbeat', 'piano'];

export interface VideoPlan {
  readonly version: 1;
  readonly locale: Locale;
  readonly titulo: string;
  readonly duracionObjetivoS: number;
  readonly styleToken: string;
  /** Estilo de subtítulos. Opcional: los planes viejos usan 'caja'. */
  readonly captionStyle?: CaptionStyle;
  /** Pista de fondo. Opcional: los planes viejos van sin música. */
  readonly musicTrack?: MusicTrack;
  readonly escenas: readonly Scene[];
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}
