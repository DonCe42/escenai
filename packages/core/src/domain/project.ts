import type { Locale } from './video-plan';

/** Identidad de marca del proyecto. El style token se inyecta en todos los prompts de imagen. */
export interface Project {
  readonly id: string;
  readonly nombre: string;
  readonly locale: Locale;
  readonly styleToken: string;
  readonly colores: readonly string[];
}

/** Los cuatro campos del brief. Si un quinto campo no cambia el video, no entra. */
export interface Brief {
  readonly que: string;
  readonly aQuien: string;
  readonly queDebeSentir: string;
  readonly queDebeHacer: string;
  readonly duracionObjetivoS: number;
}
