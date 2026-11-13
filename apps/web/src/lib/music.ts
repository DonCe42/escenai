import type { MusicTrack } from '@escenai/core';

/**
 * Los archivos viven en `apps/web/public/music/`, con su licencia CC0 documentada
 * en `LICENSES.md`. El render los copia al `public/` del worker: Remotion solo sirve
 * `staticFile` desde ahí, no puede leer una URL del navegador.
 */
export interface MusicOption {
  readonly id: MusicTrack;
  readonly label: string;
  readonly hint: string;
}

export const MUSIC_OPTIONS: readonly MusicOption[] = [
  { id: 'ninguna', label: 'Sin música', hint: 'solo voz y sonido' },
  { id: 'corporativo', label: 'Corporativo', hint: '38 s · neutro' },
  { id: 'upbeat', label: 'Upbeat', hint: '30 s · enérgico' },
  { id: 'piano', label: 'Piano', hint: '104 s · cálido' },
];

/** Ruta pública del archivo, la misma que sirve Next desde `/public`. */
export function musicUrl(track: MusicTrack | undefined): string | null {
  if (track === undefined || track === 'ninguna') return null;
  return `/music/${track}.mp3`;
}
