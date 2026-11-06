import type { VideoPlan } from '../../domain/video-plan';

export const TRANSLATE_PROMPT_VERSION = '1.0.0';

export interface TranslatePromptInput {
  readonly plan: VideoPlan;
  readonly locale: 'es' | 'en';
}

/**
 * El inglés no es una traducción literal: un hook que funciona en español
 * suele sonar doblado en inglés. Se pide adaptación, no calco.
 */
export function buildTranslatePrompt(input: TranslatePromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const target = input.locale === 'en' ? 'inglés natural de Estados Unidos' : 'español neutro de Latinoamérica';

  const systemPrompt = [
    'Eres guionista bilingüe de video corto.',
    'Adaptas un guion ya escrito a otro idioma sin perder el gancho ni el mensaje.',
    'Mantienes el número de escenas, sus roles y sus duraciones exactas.',
    'Devuelves únicamente el objeto JSON completo, con la misma forma que recibes.',
  ].join(' ');

  const userPrompt = [
    `Traduce y adapta este guion a ${target}.`,
    'Reglas:',
    '- "narracion": entre 8 y 25 palabras, ritmo hablado, misma idea y mismo dato concreto.',
    '- "textoPantalla": máximo 2 líneas de 4 palabras. Es texto grande: en inglés suele necesitar menos palabras.',
    '- "titulo": adaptado, no calcado.',
    '- No cambies "id", "rol", "movimiento", "promptImagen" ni "duracionEstimadaS".',
    '- "locale" debe ser el idioma destino.',
    '',
    'Guion:',
    JSON.stringify(input.plan),
  ].join('\n');

  return { systemPrompt, userPrompt };
}
