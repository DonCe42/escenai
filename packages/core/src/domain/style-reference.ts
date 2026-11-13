import { err, ok } from './result';
import type { Result } from './result';

/**
 * Tablero de estilo del proyecto.
 *
 * Hasta ahora la consistencia dependía de una sola imagen: la de la escena 1 como
 * ancla. El tablero deja que el usuario suba el producto, el personaje o el logo
 * una vez, y esas piezas viajan como referencia en **todas** las escenas: la marca
 * no se reinventa en cada una.
 */

export const STYLE_KINDS = ['producto', 'personaje', 'logo', 'estilo'] as const;

export type StyleKind = (typeof STYLE_KINDS)[number];

export interface StyleReference {
  readonly id: string;
  readonly kind: StyleKind;
  /** Nombre visible; por defecto el del archivo subido. */
  readonly label: string;
  /** Clave en el almacenamiento del archivo original. */
  readonly ref: string;
  readonly mimeType: string;
  readonly createdAt: string;
}

/**
 * Tope del proyecto. El proveedor acepta `MAX_REFERENCE_IMAGES` (14), pero por
 * encima de seis piezas las referencias se diluyen: el modelo reparte atención y
 * la escena sale peor.
 */
export const MAX_STYLE_REFERENCES = 6;

export function styleReferencesOf(
  list: readonly StyleReference[] | undefined,
): readonly StyleReference[] {
  return list ?? [];
}

export function isStyleKind(value: unknown): value is StyleKind {
  return typeof value === 'string' && (STYLE_KINDS as readonly string[]).includes(value);
}

export function addStyleReference(
  list: readonly StyleReference[] | undefined,
  next: StyleReference,
): Result<readonly StyleReference[], 'limit_reached' | 'duplicate_id'> {
  const current = styleReferencesOf(list);
  if (current.some((reference) => reference.id === next.id)) return err('duplicate_id');
  if (current.length >= MAX_STYLE_REFERENCES) return err('limit_reached');
  return ok([...current, next]);
}

export function removeStyleReference(
  list: readonly StyleReference[] | undefined,
  id: string,
): { readonly removed: StyleReference | null; readonly styleReferences: readonly StyleReference[] } {
  const current = styleReferencesOf(list);
  const removed = current.find((reference) => reference.id === id) ?? null;
  if (removed === null) return { removed: null, styleReferences: current };
  return {
    removed,
    styleReferences: current.filter((reference) => reference.id !== id),
  };
}
