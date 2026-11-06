import type { VideoPlan } from '../../domain/video-plan.js';

export const COMPACT_PROMPT_VERSION = '1.0.0';

export interface CompactPromptInput {
  readonly plan: VideoPlan;
  readonly duracionObjetivoS: number;
  readonly palabrasPorSegundo: number;
}

/**
 * El guion se pasó de tiempo: hay que decir lo mismo con menos palabras.
 * Recortar la voz o acelerarla arruina el ritmo; reescribir es lo único honesto.
 */
export function buildCompactPrompt(input: CompactPromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const objetivoPalabras = Math.floor(input.duracionObjetivoS * input.palabrasPorSegundo);
  const actuales = input.plan.escenas.reduce(
    (sum, scene) => sum + scene.narracion.trim().split(/\s+/).length,
    0,
  );

  const systemPrompt = [
    'Eres editor de guiones para video corto.',
    'Tu trabajo es decir lo mismo con menos palabras, sin perder el gancho ni el mensaje.',
    'No añades escenas, no cambias el orden, no cambias los roles.',
    'Devuelves únicamente el objeto JSON completo, con la misma forma que recibes.',
  ].join(' ');

  const userPrompt = [
    `El guion dura ${actuales} palabras pero debe caber en ${objetivoPalabras} palabras (${input.duracionObjetivoS} s a ${input.palabrasPorSegundo} palabras por segundo).`,
    'Recorta entre un 10 % y un 45 % del texto de cada narración, según haga falta.',
    'Conserva los datos concretos (producto, promesa, llamada a la acción) y elimina adornos.',
    'Ajusta "duracionEstimadaS" de cada escena para que la suma quede dentro del ±5 % del objetivo.',
    'Si una línea de "textoPantalla" queda redundante con la narración recortada, puedes acortarla.',
    '',
    'Guion actual:',
    JSON.stringify(input.plan),
  ].join('\n');

  return { systemPrompt, userPrompt };
}
