/**
 * Puerto de generación de texto estructurado.
 * El proveedor devuelve datos; la forma la exige el validador del dominio, no el SDK.
 */
export interface TextModelPort {
  generateJson(input: {
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly schemaName: string;
  }): Promise<unknown>;
}
