import type { VideoPlan } from '@escenai/core';

/**
 * Ejemplo público de la landing.
 *
 * Es un manifiesto estático (`public/demo/plan.json` + miniaturas + MP4) y no un
 * proyecto del repositorio de datos: así cualquiera que clone o despliegue la app
 * ve el ejemplo sin keys, sin gastar y sin que exista `.data`. El día que este
 * JSON y el MP4 no cuadren, la página lo nota porque valida el plan al leerlo.
 */

export interface DemoScene {
  readonly id: string;
  readonly image: string;
  readonly durationMs: number;
  readonly words: number;
}

export interface DemoPayload {
  readonly generatedAt: string;
  readonly plan: VideoPlan;
  readonly scenes: readonly DemoScene[];
  readonly videoUrl: string;
  readonly poster: string;
}

export interface DemoCopy {
  readonly kicker: string;
  readonly title: string;
  readonly intro: string;
  readonly cta: string;
  readonly ctaSecondary: string;
  readonly rail: string;
  readonly inspector: string;
  readonly editable: readonly string[];
  readonly facts: {
    readonly duration: string;
    readonly scenes: string;
    readonly cost: string;
    readonly keys: string;
  };
  readonly labels: {
    readonly narracion: string;
    readonly texto: string;
    readonly movimiento: string;
    readonly duracion: string;
    readonly coste: string;
    readonly real: string;
  };
}

export const DEMO_COPY: Record<'es' | 'en', DemoCopy> = {
  es: {
    kicker: 'ejemplo abierto · sin keys',
    title: 'Este es el proyecto, no una captura',
    intro:
      'Salió de este pipeline con siete escenas: guion, imagen y voz por escena, karaoke con timestamps reales y render en 9:16. Aquí se ve en modo lectura; en tu estudio cada campo es editable y cada escena se regenera sola.',
    cta: 'Crear el mío',
    ctaSecondary: 'Ver cómo funciona',
    rail: 'Escenas',
    inspector: 'Lo que hay dentro',
    editable: [
      'Narración y texto en pantalla, con el validador del contrato',
      'Imagen y voz por escena: regeneras una, no las siete',
      'Movimiento, estilo de subtítulos y música',
      'El render se lanza cuando el coste te cuadra',
    ],
    facts: {
      duration: 'de video real',
      scenes: 'escenas con voz y karaoke',
      cost: 'coste en proveedores',
      keys: 'keys necesarias para verlo',
    },
    labels: {
      narracion: 'Narración',
      texto: 'Texto en pantalla',
      movimiento: 'Movimiento',
      duracion: 'Duración de la voz',
      coste: 'Coste de esta pieza',
      real: 'medido',
    },
  },
  en: {
    kicker: 'open example · no keys',
    title: 'This is the project, not a screenshot',
    intro:
      'It came out of this pipeline with seven scenes: script, per-scene image and voice, karaoke from real timestamps and a 9:16 render. Here it is read-only; in your studio every field is editable and each scene regenerates on its own.',
    cta: 'Create mine',
    ctaSecondary: 'How it works',
    rail: 'Scenes',
    inspector: 'What is inside',
    editable: [
      'Narration and on-screen text, with the contract validator',
      'Image and voice per scene: regenerate one, not seven',
      'Motion, caption style and music',
      'The render runs when the cost suits you',
    ],
    facts: {
      duration: 'of real video',
      scenes: 'scenes with voice and karaoke',
      cost: 'provider cost',
      keys: 'keys needed to watch it',
    },
    labels: {
      narracion: 'Narration',
      texto: 'On-screen text',
      movimiento: 'Motion',
      duracion: 'Voice duration',
      coste: 'Cost of this piece',
      real: 'measured',
    },
  },
};
