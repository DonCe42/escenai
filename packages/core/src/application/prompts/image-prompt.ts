import type { Scene, VideoPlan } from '../../domain/video-plan';

/**
 * Prompt de imagen de una escena.
 *
 * Vive aquí, no en la ruta, porque es política de producto: el ancla de estilo y
 * el tablero cambian el texto y las dos rutas (una escena y el lote) tienen que
 * pedir exactamente lo mismo.
 */
export function sceneImagePrompt(input: {
  readonly plan: VideoPlan;
  readonly scene: Scene;
  readonly index: number;
  /** Si el proyecto tiene tablero de estilo, hay que decirle que no lo rediseñe. */
  readonly hasBoard: boolean;
  /** Si la referencia principal es el ancla de la escena 1. */
  readonly hasAnchor: boolean;
}): string {
  const boardNote = input.hasBoard
    ? ' Respeta el producto, el personaje y el logo de las imágenes de referencia tal como son: no los rediseñes.'
    : '';

  if (input.index === 0) {
    return `${input.scene.promptImagen}. Estilo: ${input.plan.styleToken}.${boardNote}`;
  }

  return `${
    input.hasAnchor
      ? 'Mantén exactamente la paleta, el trazo y el estilo de la imagen de referencia.'
      : `Mantén exactamente la paleta, el trazo y el estilo de la primera escena (${input.plan.styleToken}).`
  } Nueva escena: ${input.scene.promptImagen}${boardNote}`;
}
