'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PlanIssue, VideoPlan } from '@escenai/core';
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

export function BriefForm({ locale, dict }: BriefFormProps) {
  const [brief, setBrief] = useState<BriefState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  function update<K extends keyof BriefState>(key: K, value: BriefState[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPlan(null);

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
      if (payload.plan) setPlan(payload.plan);
    } catch {
      setError({ code: 'NETWORK' });
    } finally {
      setLoading(false);
    }
  }

  const total = plan?.escenas.reduce((sum, scene) => sum + scene.duracionEstimadaS, 0) ?? 0;

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

      {plan !== null && (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{plan.titulo}</h2>
            <p className="font-mono text-xs text-[var(--muted)]">
              {dict.create.total}: {total.toFixed(1)} s / {plan.duracionObjetivoS} s ·{' '}
              {plan.escenas.length} {dict.create.scenes}
            </p>
          </div>

          <ol className="mt-5 space-y-3">
            {plan.escenas.map((scene, index) => (
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

                <p className="mt-3 border-l-2 border-[var(--line)] pl-3 text-xs leading-relaxed text-[var(--muted)]">
                  {scene.promptImagen}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
