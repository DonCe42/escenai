import { describe, expect, it } from 'vitest';
import {
  MAX_STYLE_REFERENCES,
  addStyleReference,
  isStyleKind,
  removeStyleReference,
  styleReferencesOf,
} from '../src/domain/style-reference';
import type { StyleReference } from '../src/domain/style-reference';

function piece(id: string, kind: StyleReference['kind'] = 'producto'): StyleReference {
  return {
    id,
    kind,
    label: id,
    ref: `style/${id}.png`,
    mimeType: 'image/png',
    createdAt: '2026-11-13T10:00:00.000Z',
  };
}

describe('tablero de estilo', () => {
  it('lee como vacío un proyecto anterior al tablero', () => {
    expect(styleReferencesOf(undefined)).toEqual([]);
  });

  it('añade al final y no muta la lista original', () => {
    const original = [piece('a')];
    const result = addStyleReference(original, piece('b', 'logo'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((reference) => reference.id)).toEqual(['a', 'b']);
    expect(original).toHaveLength(1);
  });

  it('corta al llegar al tope del proyecto', () => {
    const full = Array.from({ length: MAX_STYLE_REFERENCES }, (_, index) => piece(`p${index}`));
    const result = addStyleReference(full, piece('sobra'));

    expect(result).toEqual({ ok: false, error: 'limit_reached' });
  });

  it('rechaza un id repetido en vez de duplicar la miniatura', () => {
    const result = addStyleReference([piece('a')], piece('a'));

    expect(result).toEqual({ ok: false, error: 'duplicate_id' });
  });

  it('quita la pieza pedida y devuelve la que salió', () => {
    const result = removeStyleReference([piece('a'), piece('b')], 'b');

    expect(result.removed?.id).toBe('b');
    expect(result.styleReferences.map((reference) => reference.id)).toEqual(['a']);
  });

  it('no toca la lista cuando el id no existe', () => {
    const list = [piece('a')];
    const result = removeStyleReference(list, 'z');

    expect(result.removed).toBeNull();
    expect(result.styleReferences).toBe(list);
  });

  it('solo acepta los tipos del contrato', () => {
    expect(isStyleKind('producto')).toBe(true);
    expect(isStyleKind('reggaeton')).toBe(false);
    expect(isStyleKind(null)).toBe(false);
  });
});
