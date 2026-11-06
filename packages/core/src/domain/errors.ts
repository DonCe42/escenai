export class MissingAudioError extends Error {
  constructor(public readonly sceneId: string) {
    super(`La escena ${sceneId} no tiene audio generado.`);
    this.name = 'MissingAudioError';
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor(public readonly providerId: string) {
    super(
      `El proveedor "${providerId}" no está configurado. Añade una API key en Ajustes para usarlo.`,
    );
    this.name = 'ProviderNotConfiguredError';
  }
}
