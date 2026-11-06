import { LIMITS, MOTIONS, SCENE_ROLES, countWords } from './video-plan';
import type { Motion, SceneRole, VideoPlan } from './video-plan';

export type PlanErrorCode =
  | 'E_SCHEMA'
  | 'E_IDS_UNIQUE'
  | 'E_SCENES_COUNT'
  | 'E_HOOK'
  | 'E_CTA'
  | 'E_TEXT_LINES'
  | 'E_NARRATION_LENGTH'
  | 'E_DURATION_SUM'
  | 'E_IMAGE_NO_TEXT'
  | 'E_LOCALE';

export interface PlanIssue {
  readonly code: PlanErrorCode;
  readonly sceneId?: string;
  readonly message: string;
}

export type PlanValidation = { readonly ok: true } | { readonly ok: false; readonly issues: readonly PlanIssue[] };

const PLAN_KEYS = ['version', 'locale', 'titulo', 'duracionObjetivoS', 'styleToken', 'escenas'];
const SCENE_KEYS = [
  'id',
  'rol',
  'narracion',
  'textoPantalla',
  'promptImagen',
  'movimiento',
  'duracionEstimadaS',
];

/** Frases que piden texto dentro de la imagen: la IA escribe mal y el texto lo pone el render. */
const IMAGE_TEXT_PATTERNS: readonly RegExp[] = [
  /con\s+texto/i,
  /texto\s+(que|diciendo|en\s+la\s+imagen)/i,
  /que\s+diga/i,
  /letras/i,
  /tipograf[ií]a/i,
  /logotipo/i,
  /marca\s+de\s+agua/i,
  /watermark/i,
];

const ES_WORDS = new Set([
  'de','la','que','el','en','y','los','un','una','para','con','por','tu','no','te','se','del',
  'las','más','pero','sin','es','al','lo','como','su','ya','muy','este','esta','hay','nos',
]);
const EN_WORDS = new Set([
  'the','and','you','of','to','a','in','is','it','that','for','with','your','not','this','but',
  'have','on','are','be','as','at','or','from','they','we','can','will','my',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function schemaIssues(input: unknown): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const bad = (message: string, sceneId?: string): void => {
    issues.push(sceneId === undefined ? { code: 'E_SCHEMA', message } : { code: 'E_SCHEMA', sceneId, message });
  };

  if (!isRecord(input)) {
    bad('El plan debe ser un objeto.');
    return issues;
  }

  const extraPlanKeys = hasOnlyKeys(input, PLAN_KEYS);
  if (extraPlanKeys.length > 0) bad(`Campos no permitidos en el plan: ${extraPlanKeys.join(', ')}.`);

  if (input.version !== 1) bad('version debe ser 1.');
  if (input.locale !== 'es' && input.locale !== 'en') bad('locale debe ser "es" o "en".');
  if (typeof input.titulo !== 'string' || input.titulo.trim().length === 0) bad('titulo vacío.');
  if (typeof input.duracionObjetivoS !== 'number' || input.duracionObjetivoS <= 0)
    bad('duracionObjetivoS debe ser un número positivo.');
  if (typeof input.styleToken !== 'string' || input.styleToken.trim().length === 0)
    bad('styleToken vacío.');

  if (!Array.isArray(input.escenas)) {
    bad('escenas debe ser un arreglo.');
    return issues;
  }

  input.escenas.forEach((scene: unknown, index: number) => {
    const label = `escena ${index + 1}`;
    if (!isRecord(scene)) {
      bad(`${label} no es un objeto.`);
      return;
    }
    const sceneId = typeof scene.id === 'string' ? scene.id : undefined;

    const extra = hasOnlyKeys(scene, SCENE_KEYS);
    if (extra.length > 0) bad(`${label} tiene campos no permitidos: ${extra.join(', ')}.`, sceneId);

    if (typeof scene.id !== 'string' || scene.id.trim().length === 0) bad(`${label}: id vacío.`);
    if (!SCENE_ROLES.includes(scene.rol as SceneRole)) bad(`${label}: rol inválido.`, sceneId);
    if (typeof scene.narracion !== 'string') bad(`${label}: narracion debe ser texto.`, sceneId);
    if (!Array.isArray(scene.textoPantalla) || scene.textoPantalla.some((line) => typeof line !== 'string'))
      bad(`${label}: textoPantalla debe ser un arreglo de textos.`, sceneId);
    if (typeof scene.promptImagen !== 'string' || scene.promptImagen.trim().length < 10)
      bad(`${label}: promptImagen demasiado corto.`, sceneId);
    if (!MOTIONS.includes(scene.movimiento as Motion))
      bad(`${label}: movimiento inválido.`, sceneId);
    if (typeof scene.duracionEstimadaS !== 'number' || scene.duracionEstimadaS <= 0)
      bad(`${label}: duracionEstimadaS debe ser positiva.`, sceneId);
  });

  return issues;
}

/**
 * Valida un plan generado por el LLM. Devuelve TODOS los problemas, no el primero:
 * el modelo recibe la lista completa como feedback en el reintento.
 */
export function validateVideoPlan(input: unknown): PlanValidation {
  const shape = schemaIssues(input);
  if (shape.length > 0) return { ok: false, issues: shape };

  const plan = input as VideoPlan;
  const issues: PlanIssue[] = [];

  if (plan.escenas.length < LIMITS.minEscenas || plan.escenas.length > LIMITS.maxEscenas) {
    issues.push({
      code: 'E_SCENES_COUNT',
      message: `El plan tiene ${plan.escenas.length} escenas; debe tener entre ${LIMITS.minEscenas} y ${LIMITS.maxEscenas}.`,
    });
  }

  const ids = plan.escenas.map((scene) => scene.id);
  const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (repeated.length > 0) {
    issues.push({
      code: 'E_IDS_UNIQUE',
      message: `Ids de escena repetidos: ${[...new Set(repeated)].join(', ')}.`,
    });
  }

  const first = plan.escenas[0];
  if (first !== undefined && first.rol !== 'hook') {
    issues.push({ code: 'E_HOOK', sceneId: first.id, message: 'La primera escena debe ser el hook.' });
  }

  const last = plan.escenas.at(-1);
  if (last !== undefined && last.rol !== 'cta') {
    issues.push({ code: 'E_CTA', sceneId: last.id, message: 'La última escena debe ser el CTA.' });
  }

  for (const scene of plan.escenas) {
    if (scene.textoPantalla.length === 0 || scene.textoPantalla.length > LIMITS.maxLineas) {
      issues.push({
        code: 'E_TEXT_LINES',
        sceneId: scene.id,
        message: `textoPantalla debe tener entre 1 y ${LIMITS.maxLineas} líneas.`,
      });
    }
    for (const line of scene.textoPantalla) {
      const words = countWords(line);
      if (words === 0 || words > LIMITS.maxPalabrasPorLinea) {
        issues.push({
          code: 'E_TEXT_LINES',
          sceneId: scene.id,
          message: `La línea "${line}" tiene ${words} palabras; el máximo es ${LIMITS.maxPalabrasPorLinea}.`,
        });
      }
    }

    const narrationWords = countWords(scene.narracion);
    if (narrationWords < LIMITS.minPalabrasNarracion || narrationWords > LIMITS.maxPalabrasNarracion) {
      issues.push({
        code: 'E_NARRATION_LENGTH',
        sceneId: scene.id,
        message: `La narración tiene ${narrationWords} palabras; debe estar entre ${LIMITS.minPalabrasNarracion} y ${LIMITS.maxPalabrasNarracion}.`,
      });
    }

    if (IMAGE_TEXT_PATTERNS.some((pattern) => pattern.test(scene.promptImagen))) {
      issues.push({
        code: 'E_IMAGE_NO_TEXT',
        sceneId: scene.id,
        message: 'El prompt de imagen no debe pedir texto ni logos: eso lo compone el render.',
      });
    }
  }

  const total = plan.escenas.reduce((sum, scene) => sum + scene.duracionEstimadaS, 0);
  const ratio = total / plan.duracionObjetivoS;
  if (ratio < LIMITS.minRatioDuracion || ratio > LIMITS.maxRatioDuracion) {
    issues.push({
      code: 'E_DURATION_SUM',
      message: `La suma de duraciones (${total.toFixed(1)} s) no cuadra con el objetivo (${plan.duracionObjetivoS} s). Debe quedar entre ${LIMITS.minRatioDuracion} y ${LIMITS.maxRatioDuracion}.`,
    });
  }

  const spoken = plan.escenas.map((scene) => `${scene.narracion} ${scene.textoPantalla.join(' ')}`).join(' ');
  const tokens = spoken.toLowerCase().match(/[a-záéíóúñü]+/gi) ?? [];
  let esHits = 0;
  let enHits = 0;
  for (const token of tokens) {
    if (ES_WORDS.has(token)) esHits += 1;
    if (EN_WORDS.has(token)) enHits += 1;
  }
  const wrongLanguage =
    (plan.locale === 'es' && enHits - esHits >= 2) || (plan.locale === 'en' && esHits - enHits >= 2);
  if (wrongLanguage) {
    issues.push({
      code: 'E_LOCALE',
      message: `El texto no parece estar en "${plan.locale}" (${esHits} marcas en español, ${enHits} en inglés).`,
    });
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
