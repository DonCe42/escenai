import type { Locale } from './locale';

export type { Locale };
export { LOCALE_COOKIE } from './locale';

export interface Dictionary {
  readonly nav: {
    readonly create: string;
    readonly projects: string;
    readonly settings: string;
    readonly github: string;
  };
  readonly home: {
    readonly kicker: string;
    readonly title: string;
    readonly subtitle: string;
    readonly cta: string;
    readonly stepsTitle: string;
    readonly steps: readonly (readonly [string, string])[];
    readonly footnote: string;
  };
  readonly settings: {
    readonly title: string;
    readonly subtitle: string;
    readonly provider: string;
    readonly apiKey: string;
    readonly placeholder: string;
    readonly save: string;
    readonly saving: string;
    readonly remove: string;
    readonly saved: string;
    readonly notVerified: string;
    readonly empty: string;
    readonly demoBanner: string;
    readonly missingMasterKey: string;
    readonly maskedNote: string;
    readonly verifiedOk: string;
    readonly verifiedFailed: string;
    readonly verified: string;
  };
  readonly create: {
    readonly title: string;
    readonly subtitle: string;
    readonly fields: {
      readonly que: string;
      readonly aQuien: string;
      readonly queDebeSentir: string;
      readonly queDebeHacer: string;
    };
    readonly duration: string;
    readonly submit: string;
    readonly generating: string;
    readonly scenes: string;
    readonly total: string;
    readonly keyRequired: string;
    readonly openSettings: string;
    readonly generateImages: string;
    readonly generatingImages: string;
    readonly generateVoice: string;
    readonly generatingVoice: string;
    readonly voiceTotal: string;
    readonly voiceOverBudget: string;
    readonly render: string;
    readonly rendering: string;
    readonly renderNeedsAssets: string;
    readonly slowHint: string;
    readonly regenTitle: string;
    readonly regenBody: string;
    readonly regenConfirm: string;
    readonly format: string;
    readonly translating: string;
    readonly compact: string;
    readonly compacting: string;
  };
  readonly projects: {
    readonly title: string;
    readonly new: string;
    readonly empty: string;
    readonly versions: string;
    readonly words: string;
    readonly scenes: string;
    readonly active: string;
    readonly activate: string;
    readonly activating: string;
    readonly activateFailed: string;
    readonly activePlan: string;
    readonly saved: string;
    readonly openProject: string;
    readonly remove: string;
    readonly removeTitle: string;
    readonly removeBody: string;
    readonly removeConfirm: string;
    readonly removing: string;
  };
  readonly common: { readonly loading: string; readonly error: string; readonly close: string };
}

export const dictionaries: { readonly es: Dictionary; readonly en: Dictionary } = {
  es: {
    nav: { create: 'Crear', projects: 'Proyectos', settings: 'Ajustes', github: 'GitHub' },
    home: {
      kicker: 'MVP en construcción',
      title: 'Tu brief entra. Tu campaña sale.',
      subtitle:
        'Escenai convierte una idea en video vertical con voz, texto animado y subtítulos, usando tus propias API keys. Sin suscripción, sin intermediarios.',
      cta: 'Configurar mis keys',
      stepsTitle: 'Cómo funciona',
      steps: [
        ['Brief', 'Cuatro campos: qué ofreces, a quién, qué debe sentir y qué debe hacer.'],
        ['Guion', 'El modelo propone escenas; un validador determinista las acepta o las rechaza.'],
        ['Video', 'Imágenes, voz con timestamps y composición con Remotion. 1080x1920.'],
      ],
      footnote: 'Fase 0: esqueleto, núcleo y cifrado de keys. El pipeline de video llega en la fase 3-4.',
    },
    settings: {
      title: 'Ajustes',
      subtitle: 'Tus keys se guardan cifradas con AES-256-GCM y nunca se envían al navegador.',
      provider: 'Proveedor',
      apiKey: 'API key',
      placeholder: 'Pega la key aquí',
      save: 'Guardar',
      saving: 'Guardando…',
      remove: 'Eliminar',
      saved: 'Guardada',
      notVerified: 'Sin verificar',
      empty: 'Todavía no hay ninguna key guardada.',
      demoBanner:
        'Modo demo: sin login todavía. Los datos viven en .data/secrets.json de tu máquina. No uses este modo en producción.',
      missingMasterKey:
        'Falta MASTER_KEY en el entorno. Genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
      maskedNote: 'Solo mostramos los últimos 4 caracteres.',
      verifiedOk: 'Key verificada contra el proveedor.',
      verifiedFailed: 'Se guardó, pero el proveedor la rechazó:',
      verified: 'Verificada',
    },
    create: {
      title: 'Nuevo video',
      subtitle:
        'Cuatro campos. El modelo propone el guion y el validador decide si sirve: escenas, texto en pantalla, narración y prompt de imagen.',
      fields: {
        que: 'Qué ofreces',
        aQuien: 'A quién',
        queDebeSentir: 'Qué debe sentir',
        queDebeHacer: 'Qué debe hacer',
      },
      duration: 'Duración (s)',
      submit: 'Generar guion',
      generating: 'Generando…',
      scenes: 'escenas',
      total: 'Total',
      keyRequired: 'Falta tu API key de Google para generar el guion.',
      openSettings: 'Configurar keys',
      generateImages: 'Generar imágenes',
      generatingImages: 'Generando imágenes…',
      generateVoice: 'Generar voz',
      generatingVoice: 'Generando voz…',
      voiceTotal: 'Duración real de la voz',
      voiceOverBudget: 'se pasa del objetivo: hay que recortar texto',
      render: 'Renderizar video',
      rendering: 'Renderizando… (1-3 min)',
      renderNeedsAssets: 'Genera primero las imágenes y la voz',
      slowHint:
        'Esto llama a los proveedores de verdad: imágenes 3-5 min, voz ~20 s, render 3-5 min. El contador no se detiene hasta que termine.',
      regenTitle: '¿Regenerar las imágenes?',
      regenBody: 'Vuelve a llamar al proveedor para las siete escenas y consume cuota otra vez. La voz y el video actuales se descartan.',
      regenConfirm: 'Regenerar',
      format: 'Formato del video',
      translating: 'Traduciendo al inglés…',
      compact: 'Recortar guion',
      compacting: 'Recortando…',
    },
    projects: {
      title: 'Proyectos',
      new: 'Nuevo video',
      empty: 'Todavía no hay proyectos. Genera un guion y se guarda solo.',
      versions: 'versiones',
      words: 'palabras',
      scenes: 'escenas',
      active: 'activa',
      activate: 'Usar esta versión',
      activating: 'Aplicando…',
      activateFailed: 'No se pudo cambiar de versión.',
      activePlan: 'Plan de la versión activa',
      saved: 'Guardado como proyecto',
      openProject: 'Abrir proyecto',
      remove: 'Eliminar proyecto',
      removeTitle: '¿Eliminar este proyecto?',
      removeBody: 'Se borran todas sus versiones del plan. Las imágenes y audios ya generados quedan en disco.',
      removeConfirm: 'Eliminar',
      removing: 'Eliminando…',
    },
    common: { loading: 'Cargando…', error: 'Algo falló', close: 'Cerrar' },
  },
  en: {
    nav: { create: 'Create', projects: 'Projects', settings: 'Settings', github: 'GitHub' },
    home: {
      kicker: 'MVP in progress',
      title: 'Your brief goes in. Your campaign comes out.',
      subtitle:
        'Escenai turns an idea into a vertical video with voice, animated text and captions, using your own API keys. No subscription, no middleman.',
      cta: 'Set up my keys',
      stepsTitle: 'How it works',
      steps: [
        ['Brief', 'Four fields: what you offer, to whom, how it should feel, what to do next.'],
        ['Script', 'The model proposes scenes; a deterministic validator accepts or rejects them.'],
        ['Video', 'Images, voice with timestamps and Remotion composition. 1080x1920.'],
      ],
      footnote: 'Phase 0: skeleton, core and key encryption. The video pipeline lands in phases 3-4.',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Your keys are encrypted with AES-256-GCM and never sent to the browser.',
      provider: 'Provider',
      apiKey: 'API key',
      placeholder: 'Paste your key here',
      save: 'Save',
      saving: 'Saving…',
      remove: 'Remove',
      saved: 'Saved',
      notVerified: 'Not verified',
      empty: 'No keys saved yet.',
      demoBanner:
        'Demo mode: no login yet. Data lives in .data/secrets.json on your machine. Do not use this mode in production.',
      missingMasterKey:
        'MASTER_KEY is missing. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
      maskedNote: 'Only the last 4 characters are shown.',
      verifiedOk: 'Key verified against the provider.',
      verifiedFailed: 'Saved, but the provider rejected it:',
      verified: 'Verified',
    },
    create: {
      title: 'New video',
      subtitle:
        'Four fields. The model proposes the script and the validator decides whether it works: scenes, on-screen text, narration and image prompt.',
      fields: {
        que: 'What you offer',
        aQuien: 'To whom',
        queDebeSentir: 'How it should feel',
        queDebeHacer: 'What they should do',
      },
      duration: 'Duration (s)',
      submit: 'Generate script',
      generating: 'Generating…',
      scenes: 'scenes',
      total: 'Total',
      keyRequired: 'Your Google API key is missing to generate the script.',
      openSettings: 'Set up keys',
      generateImages: 'Generate images',
      generatingImages: 'Generating images…',
      generateVoice: 'Generate voice',
      generatingVoice: 'Generating voice…',
      voiceTotal: 'Real voice duration',
      voiceOverBudget: 'over budget: trim the script',
      render: 'Render video',
      rendering: 'Rendering… (1-3 min)',
      renderNeedsAssets: 'Generate images and voice first',
      slowHint:
        'This calls the real providers: images 3-5 min, voice ~20 s, render 3-5 min. The counter keeps running until it finishes.',
      regenTitle: 'Regenerate the images?',
      regenBody: 'Calls the provider again for all seven scenes and burns quota again. The current voice and video are discarded.',
      regenConfirm: 'Regenerate',
      format: 'Video format',
      translating: 'Translating to Spanish…',
      compact: 'Trim script',
      compacting: 'Trimming…',
    },
    projects: {
      title: 'Projects',
      new: 'New video',
      empty: 'No projects yet. Generate a script and it saves itself.',
      versions: 'versions',
      words: 'words',
      scenes: 'scenes',
      active: 'active',
      activate: 'Use this version',
      activating: 'Applying…',
      activateFailed: 'Could not switch version.',
      activePlan: 'Active version plan',
      saved: 'Saved as project',
      openProject: 'Open project',
      remove: 'Delete project',
      removeTitle: 'Delete this project?',
      removeBody: 'All plan versions are deleted. Images and audio already generated stay on disk.',
      removeConfirm: 'Delete',
      removing: 'Deleting…',
    },
    common: { loading: 'Loading…', error: 'Something failed', close: 'Close' },
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
