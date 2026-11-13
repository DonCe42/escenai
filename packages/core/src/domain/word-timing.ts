/** Marca temporal de una palabra dentro de un audio. Vive en el dominio: no es un detalle del proveedor. */
export interface WordTiming {
  readonly word: string;
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * Algunos proveedores (y audios viejos guardados antes del arreglo) entregan los
 * timestamps por trozos: "E", "l", " ", "ca", "f", "é". Concatenados dan el texto
 * exacto, pero el karaoke mostraría letras sueltas. Se agrupan hasta el espacio.
 *
 * Si no hay trozos de espacio, ya viene agrupado y se devuelve igual.
 */
export function groupWordChunks(chunks: readonly WordTiming[]): readonly WordTiming[] {
  const hasSeparators = chunks.some((chunk) => chunk.word.trim() === '');
  if (!hasSeparators) return chunks;

  const words: WordTiming[] = [];
  let current = '';
  let startMs = -1;
  let endMs = 0;

  for (const chunk of chunks) {
    if (chunk.word.trim() === '') {
      if (current.length > 0) {
        words.push({ word: current, startMs, endMs });
        current = '';
        startMs = -1;
      }
      continue;
    }
    if (current.length === 0) startMs = chunk.startMs;
    current += chunk.word;
    endMs = chunk.endMs;
  }

  if (current.length > 0) words.push({ word: current, startMs, endMs });
  return words;
}
