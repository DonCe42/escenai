/**
 * Style token por defecto hasta que exista la pantalla de marca del proyecto.
 * Se inyecta en TODOS los prompts de imagen: es lo que hace que 8 escenas parezcan
 * del mismo video. Vive en core porque es política de producto, no del proveedor.
 */
export const DEFAULT_STYLE_TOKENS = {
  es: 'ilustración plana vectorial, paleta de tres colores, trazo limpio, luz suave, sin texto, sin logos, sin marcas de agua',
  en: 'flat vector illustration, three-color palette, clean linework, soft light, no text, no logos, no watermarks',
} as const;
