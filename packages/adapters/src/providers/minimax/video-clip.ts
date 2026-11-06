import { ProviderNotConfiguredError } from '@escenai/core';
import type {
  Aspect,
  GeneratedClip,
  ProviderJob,
  VideoClipPort,
} from '@escenai/core';

const DEFAULT_BASE_URL = 'https://api.minimax.io';
/**
 * H3 vive en la API v2 y exige plan superior. Los modelos anteriores
 * (MiniMax-Hailuo-02, T2V-01) siguen en la v1 y sí entran en planes más bajos.
 */
export const DEFAULT_MINIMAX_VIDEO_MODEL = 'MiniMax-Hailuo-02';

export type MinimaxVideoApi = 'v1' | 'v2';

export interface MinimaxVideoClipOptions {
  readonly getApiKey: () => Promise<string>;
  readonly model?: string;
  readonly apiVersion?: MinimaxVideoApi;
  readonly baseUrl?: string;
  readonly resolution?: '768P' | '2K';
  readonly fetchImpl?: typeof fetch;
}

function inferApi(model: string): MinimaxVideoApi {
  return model.startsWith('MiniMax-H3') ? 'v2' : 'v1';
}

interface CreateResponse {
  readonly task_id?: string;
  readonly base_resp?: { readonly status_code?: number; readonly status_msg?: string };
}

interface QueryResponse {
  readonly task?: {
    readonly id?: string;
    readonly status?: string;
    readonly content?: { readonly url?: string };
    readonly error?: { readonly message?: string };
  };
}

function mapStatus(status: string | undefined): ProviderJob<GeneratedClip>['state'] {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'failed':
    case 'cancelled':
      return 'failed';
    case 'processing':
    case 'running':
      return 'running';
    default:
      return 'queued';
  }
}

/**
 * Clips generativos de MiniMax H3. Asíncrono de verdad: puede tardar minutos,
 * por eso el puerto separa submit de poll y el trabajo vive en un job.
 */
export class MinimaxVideoClip implements VideoClipPort {
  constructor(private readonly options: MinimaxVideoClipOptions) {}

  async submit(input: {
    readonly prompt: string;
    readonly aspect: Aspect;
    readonly durationS: number;
    readonly firstFrame?: Uint8Array;
  }): Promise<{ readonly providerJobId: string }> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const baseUrl = this.options.baseUrl ?? DEFAULT_BASE_URL;
    const apiKey = await this.apiKey();

    const content: unknown[] = [{ type: 'text', text: input.prompt }];
    if (input.firstFrame !== undefined) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${Buffer.from(input.firstFrame).toString('base64')}` },
        role: 'first_frame',
      });
    }

    const model = this.options.model ?? DEFAULT_MINIMAX_VIDEO_MODEL;
    const api = this.options.apiVersion ?? inferApi(model);
    const duration = Math.min(15, Math.max(2, Math.round(input.durationS)));
    const resolution = this.options.resolution ?? '768P';

    const payloadBody =
      api === 'v2'
        ? { model, content, duration, resolution, ratio: input.aspect }
        : // los modelos v1 solo aceptan clips de 6 s; con imagen de arranque
          // respetan la relación de aspecto de esa imagen (9:16 en vertical)
          {
            model,
            prompt: input.prompt,
            duration: 6,
            resolution,
            ...(input.firstFrame === undefined
              ? {}
              : {
                  first_frame_image: `data:image/png;base64,${Buffer.from(input.firstFrame).toString('base64')}`,
                }),
          };

    const response = await fetchImpl(`${baseUrl}/${api}/video_generation`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payloadBody),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 402) {
        throw new Error(
          'MiniMax H3 no entra en tu Token Plan: se cobra por Pay-as-you-go. ' +
            'Recarga saldo en Video (platform.minimax.io/user-center/payment/balance) y reintenta. ' +
            `Detalle: ${body.slice(0, 160)}`,
        );
      }
      throw new Error(`MiniMax video respondió HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as CreateResponse;
    const status = payload.base_resp?.status_code ?? 0;
    if (status !== 0 || payload.task_id === undefined) {
      throw new Error(`MiniMax video ${status}: ${payload.base_resp?.status_msg ?? 'sin task_id'}`);
    }
    return { providerJobId: payload.task_id };
  }

  async poll(providerJobId: string): Promise<ProviderJob<GeneratedClip>> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const baseUrl = this.options.baseUrl ?? DEFAULT_BASE_URL;
    const apiKey = await this.apiKey();

    const model = this.options.model ?? DEFAULT_MINIMAX_VIDEO_MODEL;
    const api = this.options.apiVersion ?? inferApi(model);

    if (api === 'v1') {
      const query = await fetchImpl(
        `${baseUrl}/v1/query/video_generation?task_id=${encodeURIComponent(providerJobId)}`,
        { headers: { authorization: `Bearer ${apiKey}` } },
      );
      if (!query.ok) return { state: 'failed', error: `HTTP ${query.status}` };

      const body = (await query.json()) as { status?: string; file_id?: string };
      const status = body.status ?? '';
      if (status === 'Fail') return { state: 'failed', error: 'la generación falló' };
      if (status !== 'Success' || body.file_id === undefined) {
        return { state: 'running' };
      }

      const file = await fetchImpl(
        `${baseUrl}/v1/files/retrieve?file_id=${encodeURIComponent(body.file_id)}`,
        { headers: { authorization: `Bearer ${apiKey}` } },
      );
      const fileBody = (await file.json()) as { file?: { download_url?: string } };
      const url = fileBody.file?.download_url;
      if (url === undefined) return { state: 'failed', error: 'sin download_url' };

      const download = await fetchImpl(url);
      if (!download.ok) return { state: 'failed', error: `descarga HTTP ${download.status}` };
      return {
        state: 'succeeded',
        value: { bytes: new Uint8Array(await download.arrayBuffer()), mimeType: 'video/mp4' },
      };
    }

    const response = await fetchImpl(`${baseUrl}/v2/query/video_generation/${providerJobId}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return { state: 'failed', error: `HTTP ${response.status}` };
    }

    const payload = (await response.json()) as QueryResponse;
    const task = payload.task;
    const state = mapStatus(task?.status);

    if (state === 'failed') {
      return { state: 'failed', error: task?.error?.message ?? task?.status ?? 'desconocido' };
    }
    if (state !== 'succeeded' || task?.content?.url === undefined) {
      return { state };
    }

    const file = await fetchImpl(task.content.url);
    if (!file.ok) {
      return { state: 'failed', error: `descarga HTTP ${file.status}` };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { state: 'succeeded', value: { bytes, mimeType: 'video/mp4' } };
  }

  private apiKey(): Promise<string> {
    return this.options.getApiKey().catch(() => {
      throw new ProviderNotConfiguredError('minimax');
    });
  }
}
