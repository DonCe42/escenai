/** Marca temporal de una palabra dentro de un audio. Vive en el dominio: no es un detalle del proveedor. */
export interface WordTiming {
  readonly word: string;
  readonly startMs: number;
  readonly endMs: number;
}
