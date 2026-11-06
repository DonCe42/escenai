import type { Aspect, Locale, VideoPlan } from '../../domain/video-plan';
import type { Timeline } from '../../domain/scene-timing';

export interface RenderAsset {
  readonly sceneId: string;
  readonly kind: 'image' | 'clip';
  readonly uri: string;
}

export interface RenderedVideo {
  readonly video: Uint8Array;
  readonly thumbnail: Uint8Array;
  readonly durationMs: number;
}

export interface RendererPort {
  render(input: {
    readonly plan: VideoPlan;
    readonly timeline: Timeline;
    readonly assets: readonly RenderAsset[];
    readonly audioByScene: Readonly<Record<string, string>>;
    readonly musicUri?: string;
    readonly format: Aspect;
    readonly locale: Locale;
  }): Promise<RenderedVideo>;
}
