'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PlanIssue, VideoPlan } from '@escenai/core';
import { ConfirmDialog } from './ConfirmDialog';
import type { Dictionary } from '@/lib/i18n';
import type { Locale } from '@/lib/locale';

interface BriefFormProps {
  readonly locale: Locale;
  readonly dict: Dictionary;
}

interface BriefState {
  que: string;
  aQuien: string;
  queDebeSentir: string;
  queDebeHacer: string;
  duracionObjetivoS: number;
}

interface ApiError {
  code: string;
  message?: string;
  issues?: readonly PlanIssue[];
}

const INITIAL: BriefState = {
  que: '',
  aQuien: '',
  queDebeSentir: '',
  queDebeHacer: '',
  duracionObjetivoS: 45,
};

function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return seconds;
}

export function BriefForm({ locale, dict }: BriefFormProps) {
  const [brief, setBrief] = useState<BriefState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [planEn, setPlanEn] = useState<VideoPlan | null>(null);
  const [viewLocale, setViewLocale] = useState<'es' | 'en'>('es');
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [voice, setVoice] = useState<Record<string, string>>({});
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceTotal, setVoiceTotal] = useState<number | null>(null);
  const [imageBatch, setImageBatch] = useState<string | null>(null);
  const [audioBatch, setAudioBatch] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [formato, setFormato] = useState<'9:16' | '1:1' | '16:9'>('9:16');
  const [loadingRender, setLoadingRender] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [compacting, setCompacting] = useState(false);
  const [pendingRegen, setPendingRegen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [compactError, setCompactError] = useState<string | null>(null);

  function update<K extends keyof BriefState>(key: K, value: BriefState[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPlan(null);
    setImages({});
    setImageError(null);
    setVoice({});
    setVoiceError(null);
    setVoiceTotal(null);
    setVideoUrl(null);
    setImageBatch(null);
    setAudioBatch(null);
    setProjectId(null);

    try {
      const response = await fetch('/api/script', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...brief, locale }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        plan?: VideoPlan;
        code?: string;
        message?: string;
        issues?: readonly PlanIssue[];
      };

      if (!response.ok) {
        setError({ code: payload.code ?? 'UNKNOWN', message: payload.message, issues: payload.issues });
        return;
      }
      if (payload.plan) {
        setPlan(payload.plan);
        setPlanEn(null);
        setViewLocale(payload.plan.locale);
        // El plan se persiste en cuanto existe: recargar la página ya no lo pierde.
        void fetch('/api/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nombre: brief.que.slice(0, 60) || payload.plan.titulo,
            plan: payload.plan,
          }),
        })
          .then(async (saved) => {
            if (!saved.ok) return;
            const body = (await saved.json()) as { project?: { id: string } };
            if (body.project?.id) setProjectId(body.project.id);
          })
          .catch(() => undefined);
      }
    } catch {
      setError({ code: 'NETWORK' });
    } finally {
      setLoading(false);
    }
  }

  function generateImages() {
    if (activePlan === null) return;
    if (imageBatch !== null) {
      setPendingRegen(true);
      return;
    }
    void runImages();
  }

  async function runImages() {
    if (activePlan === null) return;
    setLoadingImages(true);
    setImageError(null);
    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: activePlan }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        batchId?: string;
        assets?: readonly { sceneId: string; url: string }[];
        code?: string;
        message?: string;
      };
      if (!response.ok || payload.assets === undefined) {
        setImageError(payload.message ?? payload.code ?? dict.common.error);
        return;
      }
      setImageBatch(payload.batchId ?? null);
      setImages(Object.fromEntries(payload.assets.map((asset) => [asset.sceneId, asset.url])));
    } catch {
      setImageError(dict.common.error);
    } finally {
      setLoadingImages(false);
    }
  }

  async function generateVoice() {
    if (activePlan === null) return;
    setLoadingVoice(true);
    setVoiceError(null);
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: activePlan }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        batchId?: string;
        clips?: readonly { sceneId: string; url: string }[];
        timeline?: { totalMs: number; objetivoMs: number; exceedsBudget: boolean };
        code?: string;
        message?: string;
      };
      if (!response.ok || payload.clips === undefined) {
        setVoiceError(payload.message ?? payload.code ?? dict.common.error);
        return;
      }
      setAudioBatch(payload.batchId ?? null);
      setVoice(Object.fromEntries(payload.clips.map((clip) => [clip.sceneId, clip.url])));
      setVoiceTotal(payload.timeline?.totalMs ?? null);
    } catch {
      setVoiceError(dict.common.error);
    } finally {
      setLoadingVoice(false);
    }
  }

  async function switchLocale(target: 'es' | 'en') {
    if (plan === null) return;
    if (target === viewLocale) return;

    // Cambiar de idioma invalida la voz y el video (el audio es de otro idioma),
    // pero no las imágenes: el plan traducido conserva los prompts.
    setVoice({});
    setVoiceTotal(null);
    setAudioBatch(null);
    setVideoUrl(null);

    if (target === 'es') {
      setViewLocale('es');
      return;
    }
    if (planEn !== null) {
      setViewLocale('en');
      return;
    }

    setTranslating(true);
    setError(null);
    try {
      const response = await fetch('/api/script/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, locale: 'en' }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        plan?: VideoPlan;
        code?: string;
        message?: string;
      };
      if (!response.ok || payload.plan === undefined) {
        setError({ code: payload.code ?? 'TRANSLATE', message: payload.message });
        return;
      }
      setPlanEn(payload.plan);
      setViewLocale('en');
    } catch {
      setError({ code: 'NETWORK' });
    } finally {
      setTranslating(false);
    }
  }

  async function compact() {
    if (activePlan === null) return;
    setCompacting(true);
    setCompactError(null);
    try {
      const response = await fetch('/api/script/compact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: activePlan, duracionObjetivoS: activePlan.duracionObjetivoS }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        plan?: VideoPlan;
        code?: string;
        message?: string;
      };
      if (!response.ok || payload.plan === undefined) {
        setCompactError(payload.message ?? payload.code ?? dict.common.error);
        return;
      }
      // Las imágenes siguen sirviendo (los prompts no cambian); la voz hay que rehacerla.
      if (viewLocale === 'en') setPlanEn(payload.plan);
      else setPlan(payload.plan);
      if (projectId !== null) {
        void fetch(`/api/projects/${projectId}/versions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan: payload.plan, source: 'compacted' }),
        }).catch(() => undefined);
      }
      setVoice({});
      setVoiceTotal(null);
      setAudioBatch(null);
      setVideoUrl(null);
    } catch {
      setCompactError(dict.common.error);
    } finally {
      setCompacting(false);
    }
  }

  async function renderVideo() {
    if (activePlan === null || imageBatch === null || audioBatch === null) return;
    setLoadingRender(true);
    setRenderError(null);
    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: activePlan, imageBatch, audioBatch, formato }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        code?: string;
        message?: string;
      };
      if (!response.ok || payload.url === undefined) {
        setRenderError(payload.message ?? payload.code ?? dict.common.error);
        return;
      }
      setVideoUrl(payload.url);
    } catch {
      setRenderError(dict.common.error);
    } finally {
      setLoadingRender(false);
    }
  }

  const elapsedImages = useElapsed(loadingImages);
  const elapsedVoice = useElapsed(loadingVoice);
  const elapsedRender = useElapsed(loadingRender);
  const busy = loading || loadingImages || loadingVoice || loadingRender;

  useEffect(() => {
    const written = [brief.que, brief.aQuien, brief.queDebeSentir, brief.queDebeHacer].some(
      (value) => value.trim().length > 3,
    );
    if (plan !== null || !written) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [brief, plan]);

  // El idioma visible decide qué plan se opera: imágenes se comparten, voz no.
  const activePlan = viewLocale === 'en' && planEn !== null ? planEn : plan;
  const total = activePlan?.escenas.reduce((sum, scene) => sum + scene.duracionEstimadaS, 0) ?? 0;

  return (
    <div className="mt-8">
      <form onSubmit={submit} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['que', dict.create.fields.que],
              ['aQuien', dict.create.fields.aQuien],
              ['queDebeSentir', dict.create.fields.queDebeSentir],
              ['queDebeHacer', dict.create.fields.queDebeHacer],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="text-xs font-semibold tracking-[0.15em] text-[var(--muted)] uppercase"
            >
              {label}
              <textarea
                value={brief[key]}
                onChange={(event) => update(key, event.target.value)}
                rows={2}
                className="mt-2 w-full resize-none rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-normal tracking-normal text-[var(--text)] normal-case"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold tracking-[0.15em] text-[var(--muted)] uppercase">
            {dict.create.duration}
            <input
              type="number"
              min={15}
              max={90}
              value={brief.duracionObjetivoS}
              onChange={(event) => update('duracionObjetivoS', Number(event.target.value))}
              className="mt-2 block w-24 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm font-normal text-[var(--text)]"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#04120a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? dict.create.generating : dict.create.submit}
          </button>
        </div>
      </form>

      {error !== null && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error.code === 'KEY_REQUIRED' ? (
            <p>
              {dict.create.keyRequired}{' '}
              <Link href="/settings" className="underline underline-offset-2">
                {dict.create.openSettings}
              </Link>
            </p>
          ) : (
            <div>
              <p className="font-mono text-xs">{error.code}</p>
              {error.message !== undefined && <p className="mt-1 text-xs">{error.message}</p>}
              {error.issues !== undefined && (
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {error.issues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>
                      [{issue.code}] {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {activePlan !== null && (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{activePlan.titulo}</h2>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1 rounded-full border border-[var(--line)] p-0.5 text-[11px]">
                {(['es', 'en'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => void switchLocale(code)}
                    disabled={translating || busy}
                    aria-pressed={viewLocale === code}
                    className={`rounded-full px-2 py-0.5 uppercase transition ${
                      viewLocale === code
                        ? 'bg-[var(--accent)] font-semibold text-[#04120a]'
                        : 'text-[var(--muted)] hover:text-[var(--text)]'
                    } disabled:opacity-40`}
                  >
                    {code}
                  </button>
                ))}
              </div>
              {translating && <span className="text-xs text-[var(--muted)]">{dict.create.translating}</span>}
              <p className="font-mono text-xs text-[var(--muted)]">
                {dict.create.total}: {total.toFixed(1)} s / {activePlan.duracionObjetivoS} s ·{' '}
                {activePlan.escenas.length} {dict.create.scenes}
              </p>
              <button
                type="button"
                onClick={generateImages}
                disabled={busy}
                className="rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[#04120a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingImages ? `${dict.create.generatingImages} ${elapsedImages}s` : dict.create.generateImages}
              </button>
              <select
                value={formato}
                onChange={(event) => setFormato(event.target.value as '9:16' | '1:1' | '16:9')}
                disabled={busy}
                aria-label={dict.create.format}
                className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 font-mono text-[11px] text-[var(--muted)]"
              >
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
              </select>
              <button
                type="button"
                onClick={renderVideo}
                disabled={busy || imageBatch === null || audioBatch === null}
                title={imageBatch === null || audioBatch === null ? dict.create.renderNeedsAssets : undefined}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#04120a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingRender ? `${dict.create.rendering} ${elapsedRender}s` : dict.create.render}
              </button>
              <button
                type="button"
                onClick={generateVoice}
                disabled={busy}
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingVoice ? `${dict.create.generatingVoice} ${elapsedVoice}s` : dict.create.generateVoice}
              </button>
            </div>
          </div>

          {(loadingImages || loadingVoice || loadingRender) && (
            <p className="mt-4 text-xs text-[var(--muted)]">{dict.create.slowHint}</p>
          )}

          {imageError !== null && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
              {imageError}
            </p>
          )}

          {compactError !== null && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
              {compactError}
            </p>
          )}

          {voiceError !== null && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
              {voiceError}
            </p>
          )}

          {renderError !== null && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
              {renderError}
            </p>
          )}

          {projectId !== null && (
            <p className="mt-4 text-xs text-[var(--muted)]">
              {dict.projects.saved} ·{' '}
              <a href={`/projects/${projectId}`} className="text-[var(--accent)] underline underline-offset-2">
                {dict.projects.openProject}
              </a>
            </p>
          )}

          {videoUrl !== null && (
            <video
              controls
              src={videoUrl}
              className="mt-6 w-full max-w-[320px] rounded-xl border border-[var(--line)]"
            />
          )}

          {voiceTotal !== null && (
            <p className="mt-4 font-mono text-xs text-[var(--muted)]">
              {dict.create.voiceTotal}: {(voiceTotal / 1000).toFixed(1)} s
              {voiceTotal > activePlan.duracionObjetivoS * 1000 * 1.15 && (
                <span className="ml-2 text-amber-300">{dict.create.voiceOverBudget}</span>
              )}
              {voiceTotal > activePlan.duracionObjetivoS * 1000 * 1.15 && (
                <button
                  type="button"
                  onClick={compact}
                  disabled={compacting || busy}
                  className="ml-3 rounded-md border border-amber-400/50 px-2 py-1 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-40"
                >
                  {compacting ? dict.create.compacting : dict.create.compact}
                </button>
              )}
            </p>
          )}

          <ol className="mt-5 space-y-3">
            {activePlan.escenas.map((scene, index) => (
              <li
                key={scene.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-mono text-[var(--muted)]">
                    {String(index + 1).padStart(2, '0')} · {scene.id}
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-2 py-0.5 uppercase tracking-wide text-[var(--accent)]">
                    {scene.rol}
                  </span>
                  <span className="font-mono text-[var(--muted)]">
                    {scene.duracionEstimadaS.toFixed(1)} s · {scene.movimiento}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed">{scene.narracion}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {scene.textoPantalla.map((line) => (
                    <span
                      key={line}
                      className="rounded bg-[var(--bg)] px-2 py-1 font-mono text-[11px] tracking-wide text-[var(--muted)]"
                    >
                      {line}
                    </span>
                  ))}
                </div>

                {images[scene.id] !== undefined && (
                  <img
                    src={images[scene.id]}
                    alt={scene.textoPantalla.join(' ')}
                    className="mt-3 w-full max-w-[220px] rounded-lg border border-[var(--line)]"
                  />
                )}

                {voice[scene.id] !== undefined && (
                  <audio controls src={voice[scene.id]} className="mt-3 w-full max-w-[320px]" />
                )}

                <p className="mt-3 border-l-2 border-[var(--line)] pl-3 text-xs leading-relaxed text-[var(--muted)]">
                  {scene.promptImagen}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
      <ConfirmDialog
        open={pendingRegen}
        title={dict.create.regenTitle}
        body={dict.create.regenBody}
        confirmLabel={dict.create.regenConfirm}
        cancelLabel={dict.common.close}
        destructive
        onConfirm={() => {
          setPendingRegen(false);
          void runImages();
        }}
        onCancel={() => setPendingRegen(false)}
      />
    </div>
  );
}
