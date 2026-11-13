import type { Locale } from './locale';

export interface LandingCopy {
  readonly nav: { readonly create: string; readonly projects: string; readonly settings: string; readonly cta: string };
  readonly hero: {
    readonly kicker: string;
    readonly titleLead: string;
    readonly titleAccent: string;
    readonly subtitle: string;
    readonly ctaPrimary: string;
    readonly ctaSecondary: string;
    readonly note: string;
    readonly badge: string;
    readonly badgeCost: string;
  };
  readonly stats: readonly { readonly value: string; readonly label: string }[];
  readonly how: {
    readonly kicker: string;
    readonly title: string;
    readonly steps: readonly { readonly title: string; readonly body: string }[];
    readonly shotCaption: string;
  };
  readonly example: {
    readonly kicker: string;
    readonly title: string;
    readonly body: string;
    readonly breakdown: readonly { readonly label: string; readonly value: string }[];
    readonly total: string;
    readonly totalLabel: string;
    readonly note: string;
  };
  readonly keys: {
    readonly kicker: string;
    readonly title: string;
    readonly items: readonly { readonly title: string; readonly body: string }[];
  };
  readonly closing: { readonly title: string; readonly body: string; readonly cta: string };
  readonly footer: string;
}

const ES: LandingCopy = {
  nav: { create: 'Crear', projects: 'Proyectos', settings: 'Ajustes', cta: 'Empezar' },
  hero: {
    kicker: 'BYOK · video vertical con tus propias keys',
    titleLead: 'Un brief. Un short',
    titleAccent: 'listo para publicar.',
    subtitle:
      'Escenai escribe el guion, ilustra cada escena, le pone voz y lo compone en 9:16. Tú le pagas a Google y a MiniMax, no a una suscripción.',
    ctaPrimary: 'Crear mi primer video',
    ctaSecondary: 'Ver el video de ejemplo',
    note: 'El video de la derecha lo generó este pipeline: 7 escenas, voz con timestamps y subtítulos sincronizados.',
    badge: '54 s · 1080×1920',
    badgeCost: '≈ $0.31 en proveedores',
  },
  stats: [
    { value: '54 s', label: 'de video real, vertical' },
    { value: '7', label: 'escenas con voz y karaoke' },
    { value: '$0.31', label: 'de coste en proveedores' },
    { value: '0', label: 'suscripciones o créditos' },
  ],
  how: {
    kicker: 'Cómo funciona',
    title: 'Tres pasos, ninguna plantilla que rellenar',
    steps: [
      {
        title: 'Escribe el brief',
        body: 'Cuatro frases: qué ofreces, a quién, qué debe sentir y qué debe hacer. El resto lo propone el guion.',
      },
      {
        title: 'Revisa el storyboard',
        body: 'Escenas, texto en pantalla y narración, con la duración estimada a la vista. Edita una escena y regenera solo su imagen.',
      },
      {
        title: 'Renderiza',
        body: 'La voz manda el ritmo: cada escena dura lo que dura su audio. Sale un MP4 1080×1920 con subtítulos quemados.',
      },
    ],
    shotCaption: 'El estudio: escenas a la izquierda, preview 9:16 al centro, inspector a la derecha y el coste siempre arriba.',
  },
  example: {
    kicker: 'Un ejemplo con sus números',
    title: 'Cold brew en lata, cero azúcar',
    body: 'Este es el video que estás viendo arriba. No hay demo animada ni maqueta: es el MP4 que salió del worker, con su guion editable al lado.',
    breakdown: [
      { label: '7 imágenes · Vertex Nano Banana 2.1', value: '$0.24' },
      { label: '767 caracteres · MiniMax speech-2.8-hd', value: '$0.08' },
      { label: 'Render local (Chromium + Remotion)', value: '$0.00' },
    ],
    total: '$0.31',
    totalLabel: 'Total del video',
    note: 'Precios de lista al 12 nov 2026. Los tuyos pueden variar según el plan y la región.',
  },
  keys: {
    kicker: 'Sin caja negra',
    title: 'Tus keys, tus datos, tu factura',
    items: [
      {
        title: 'BYOK de verdad',
        body: 'Pegas tu cuenta de servicio de Google y tu key de MiniMax. Escenai no revende créditos ni esconde el margen.',
      },
      {
        title: 'Cifrado en reposo',
        body: 'Las keys se guardan con AES-256-GCM y solo se descifran en memoria del proceso que llama al proveedor.',
      },
      {
        title: 'Coste antes de gastar',
        body: 'Cada acción muestra lo que cuesta. Duplicar una escena sube el contador antes de que aprietes el botón.',
      },
    ],
  },
  closing: {
    title: '¿Empezamos por tu primer short?',
    body: 'Necesitas una cuenta de servicio de Google y, si quieres voz, una key de MiniMax. Se configura en dos minutos.',
    cta: 'Abrir el estudio',
  },
  footer: 'Escenai · código abierto bajo licencia MIT · hecho en Colombia',
};

const EN: LandingCopy = {
  nav: { create: 'Create', projects: 'Projects', settings: 'Settings', cta: 'Start' },
  hero: {
    kicker: 'BYOK · vertical video with your own keys',
    titleLead: 'One brief. One short',
    titleAccent: 'ready to post.',
    subtitle:
      'Escenai writes the script, illustrates every scene, adds the voice and composes it in 9:16. You pay Google and MiniMax, not a subscription.',
    ctaPrimary: 'Create my first video',
    ctaSecondary: 'Watch the example',
    note: 'The video on the right came out of this pipeline: 7 scenes, timestamped voice and synced captions.',
    badge: '54 s · 1080×1920',
    badgeCost: '≈ $0.31 in provider costs',
  },
  stats: [
    { value: '54 s', label: 'of real vertical video' },
    { value: '7', label: 'scenes with voice and karaoke' },
    { value: '$0.31', label: 'in provider costs' },
    { value: '0', label: 'subscriptions or credits' },
  ],
  how: {
    kicker: 'How it works',
    title: 'Three steps, no template to fill in',
    steps: [
      {
        title: 'Write the brief',
        body: 'Four lines: what you offer, to whom, how it should feel and what it should make them do.',
      },
      {
        title: 'Review the storyboard',
        body: 'Scenes, on-screen text and narration with estimated timing in sight. Edit a scene and regenerate only its image.',
      },
      {
        title: 'Render',
        body: 'The voice sets the pace: each scene lasts exactly as long as its audio. Out comes a 1080×1920 MP4 with burned-in captions.',
      },
    ],
    shotCaption: 'The studio: scenes on the left, 9:16 preview in the middle, inspector on the right and the cost always up top.',
  },
  example: {
    kicker: 'One example, real numbers',
    title: 'Canned cold brew, no sugar',
    body: 'This is the video above. No motion demo, no mockup: it is the MP4 that came out of the worker, with its editable script next to it.',
    breakdown: [
      { label: '7 images · Vertex Nano Banana 2.1', value: '$0.24' },
      { label: '767 characters · MiniMax speech-2.8-hd', value: '$0.08' },
      { label: 'Local render (Chromium + Remotion)', value: '$0.00' },
    ],
    total: '$0.31',
    totalLabel: 'Total for the video',
    note: 'List prices as of Nov 12, 2026. Yours may differ by plan and region.',
  },
  keys: {
    kicker: 'No black box',
    title: 'Your keys, your data, your bill',
    items: [
      {
        title: 'Real BYOK',
        body: 'You paste your Google service account and your MiniMax key. Escenai does not resell credits or hide a margin.',
      },
      {
        title: 'Encrypted at rest',
        body: 'Keys are stored with AES-256-GCM and decrypted only in the memory of the process calling the provider.',
      },
      {
        title: 'Cost before you spend',
        body: 'Every action shows what it costs. Duplicating a scene raises the counter before you press the button.',
      },
    ],
  },
  closing: {
    title: 'Shall we start with your first short?',
    body: 'You need a Google service account and, for voice, a MiniMax key. Takes two minutes to configure.',
    cta: 'Open the studio',
  },
  footer: 'Escenai · open source under MIT · built in Colombia',
};

export const LANDING: Record<Locale, LandingCopy> = { es: ES, en: EN };
