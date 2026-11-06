import type { Aspect } from '../../domain/video-plan';

export type ProviderJobState = 'queued' | 'running' | 'succeeded' | 'failed';

export interface ProviderJob<T> {
  readonly state: ProviderJobState;
  readonly value?: T;
  readonly error?: string;
}

export interface GeneratedClip {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface VideoClipPort {
  submit(input: {
    readonly prompt: string;
    readonly aspect: Aspect;
    readonly durationS: number;
    readonly firstFrame?: Uint8Array;
  }): Promise<{ readonly providerJobId: string }>;
  poll(providerJobId: string): Promise<ProviderJob<GeneratedClip>>;
}
