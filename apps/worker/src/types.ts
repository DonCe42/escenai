export interface WordTiming {
  readonly word: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface SceneProps {
  readonly id: string;
  readonly textoPantalla: readonly string[];
  readonly imageSrc: string;
  readonly audioSrc: string;
  readonly durationMs: number;
  readonly words: readonly WordTiming[];
  readonly motion: 'zoom-in-lento' | 'zoom-out-lento' | 'pan-derecha' | 'pan-izquierda' | 'estatico';
}

export interface VideoProps {
  /** Remotion exige que los props sean un Record; el índice lo satisface sin perder tipos. */
  readonly [key: string]: unknown;
  readonly titulo: string;
  readonly colorFondo: string;
  readonly colorTexto: string;
  readonly colorAcento: string;
  readonly scenes: readonly SceneProps[];
}
