import type { Brief, Project } from '../../domain/project';
import type { Locale } from '../../domain/video-plan';
import type { PlanIssue } from '../../domain/plan-validator';

/** Los prompts son política de producto: se versionan con el contrato, no con el adaptador. */
export const SCRIPT_PROMPT_VERSION = '1.0.0';

export interface ScriptPromptInput {
  readonly brand: Project;
  readonly brief: Brief;
  readonly locale: Locale;
  readonly previousIssues?: readonly PlanIssue[];
}

export interface ScriptPrompt {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly schemaName: string;
}

const LANGUAGE_NAME: Record<Locale, string> = {
  es: 'español neutro de Latinoamérica',
  en: 'inglés natural de Estados Unidos',
};

export function buildScriptPrompt(input: ScriptPromptInput): ScriptPrompt {
  const { brand, brief, locale, previousIssues } = input;

  const systemPrompt = [
    'Eres guionista de videos cortos verticales para redes sociales.',
    'Escribes para que alguien deje de hacer scroll en los primeros tres segundos.',
    'Reglas de estilo: frases cortas, segunda persona, cero jerga corporativa, cero emojis,',
    'cero promesas médicas o financieras, cero testimonios inventados con nombre propio.',
    'Devuelves únicamente un objeto JSON válido. No explicas nada, no usas bloques de código.',
  ].join(' ');

  const feedback =
    previousIssues !== undefined && previousIssues.length > 0
      ? [
          '',
          'Tu intento anterior fue rechazado por el validador. Corrige EXACTAMENTE esto y no cambies lo que ya estaba bien:',
          ...previousIssues.map((issue) => `- [${issue.code}] ${issue.message}`),
        ].join('\n')
      : '';

  const userPrompt = [
    `Marca: ${brand.nombre}.`,
    `Estilo visual ya definido (no lo cambies): ${brand.styleToken}.`,
    `Colores de marca: ${brand.colores.join(', ')}.`,
    '',
    'Brief:',
    `- Qué se ofrece: ${brief.que}`,
    `- A quién: ${brief.aQuien}`,
    `- Qué debe sentir: ${brief.queDebeSentir}`,
    `- Qué debe hacer: ${brief.queDebeHacer}`,
    `- Duración objetivo: ${brief.duracionObjetivoS} segundos.`,
    `- Idioma del guion: ${LANGUAGE_NAME[locale]}.`,
    '',
    'Devuelve un objeto con esta forma exacta:',
    '{',
    '  "version": 1,',
    '  "locale": "es" | "en",',
    '  "titulo": string,',
    '  "duracionObjetivoS": number,',
    '  "styleToken": string,',
    '  "escenas": [',
    '    {',
    '      "id": "s1",',
    '      "rol": "hook" | "problema" | "desarrollo" | "prueba" | "cta",',
    '      "narracion": string,',
    '      "textoPantalla": [string, ...],',
    '      "promptImagen": string,',
    '      "movimiento": "zoom-in-lento" | "zoom-out-lento" | "pan-derecha" | "pan-izquierda" | "estatico",',
    '      "duracionEstimadaS": number',
    '    }',
    '  ]',
    '}',
    '',
    'Reglas obligatorias:',
    '- Entre 5 y 12 escenas. La primera es "hook"; la última es "cta".',
    '- "textoPantalla": máximo 2 líneas y máximo 4 palabras por línea. Es texto grande en pantalla.',
    '- "narracion": entre 8 y 25 palabras. Es lo que dice la voz en off.',
    '- La suma de "duracionEstimadaS" debe quedar dentro del ±10% de la duración objetivo.',
    '- "promptImagen": describe solo la escena visual, sin pedir texto, letras, logos ni marcas de agua. Nunca incluyas el style token.',
    '- "id": s1, s2, s3... en orden.',
    '- No inventes estadísticas, precios ni nombres de clientes.',
    feedback,
  ].join('\n');

  return { systemPrompt, userPrompt, schemaName: 'videoplan' };
}
