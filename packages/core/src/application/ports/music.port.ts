export interface GeneratedTrack {
  readonly audio: Uint8Array;
  readonly mimeType: string;
  readonly durationMs: number;
}

export interface MusicPort {
  /** Instrumental por defecto: una canción con letra pelea con la narración. */
  generate(input: {
    readonly prompt: string;
    readonly duracionDeseadaS: number;
    readonly instrumental?: boolean;
  }): Promise<GeneratedTrack>;
}
