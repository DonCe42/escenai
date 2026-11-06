'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProviderId, SecretSummary } from '@escenai/core';
import type { Dictionary } from '@/lib/i18n';
import type { Locale } from '@/lib/locale';

interface SettingsClientProps {
  readonly locale: Locale;
  readonly dict: Dictionary;
  readonly initialSecrets: readonly SecretSummary[];
  readonly mode: 'demo' | 'supabase';
  readonly masterKeyMissing: boolean;
}

const PROVIDERS: readonly { id: ProviderId; name: string; role: string }[] = [
  { id: 'google', name: 'Google', role: 'Gemini · imágenes y texto' },
  { id: 'minimax', name: 'MiniMax', role: 'voz y música' },
];

function formatStamp(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

export function SettingsClient({
  locale,
  dict,
  initialSecrets,
  mode,
  masterKeyMissing,
}: SettingsClientProps) {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderId>('google');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (payload.error === 'MASTER_KEY_MISSING') {
          setError(dict.settings.missingMasterKey);
        } else {
          setError(payload.error ?? dict.common.error);
        }
        return;
      }

      setApiKey('');
      setMessage(dict.settings.saved);
      router.refresh();
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(target: ProviderId) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/keys?provider=${target}`, { method: 'DELETE' });
      if (!response.ok) {
        setError(dict.common.error);
        return;
      }
      router.refresh();
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {mode === 'demo' && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
          {dict.settings.demoBanner}
        </p>
      )}

      {masterKeyMissing && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-xs leading-relaxed text-red-200">
          {dict.settings.missingMasterKey}
        </p>
      )}

      <form
        onSubmit={save}
        className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5"
      >
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <label className="text-xs font-semibold tracking-[0.15em] text-[var(--muted)] uppercase">
            {dict.settings.provider}
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as ProviderId)}
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-normal tracking-normal text-[var(--text)] normal-case"
            >
              {PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-[10px] font-normal tracking-normal text-[var(--muted)] normal-case">
              {PROVIDERS.find((item) => item.id === provider)?.role}
            </span>
          </label>

          <label className="text-xs font-semibold tracking-[0.15em] text-[var(--muted)] uppercase">
            {dict.settings.apiKey}
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={dict.settings.placeholder}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm font-normal tracking-normal text-[var(--text)] normal-case"
            />
            <span className="mt-2 block text-[10px] font-normal tracking-normal text-[var(--muted)] normal-case">
              {dict.settings.maskedNote}
            </span>
          </label>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            type="submit"
            disabled={busy || apiKey.trim().length === 0 || masterKeyMissing}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#04120a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? dict.settings.saving : dict.settings.save}
          </button>
          {message !== null && <span className="text-xs text-[var(--accent)]">{message}</span>}
          {error !== null && <span className="text-xs text-red-300">{error}</span>}
        </div>
      </form>

      <section>
        <h2 className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
          {locale === 'es' ? 'Keys guardadas' : 'Saved keys'}
        </h2>

        {initialSecrets.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">{dict.settings.empty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {initialSecrets.map((secret) => (
              <li key={secret.provider} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize">{secret.provider}</p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                    {secret.masked} · {formatStamp(secret.updatedAt)} ·{' '}
                    {secret.verified ? dict.settings.saved : dict.settings.notVerified}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(secret.provider)}
                  disabled={busy}
                  className="text-xs text-[var(--muted)] transition hover:text-red-300 disabled:opacity-40"
                >
                  {dict.settings.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
