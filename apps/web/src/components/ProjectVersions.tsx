'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n';

interface VersionRow {
  readonly id: string;
  readonly version: number;
  readonly source: string;
  readonly createdAt: string;
  readonly words: number;
  readonly titulo: string;
  readonly escenas: number;
}

interface ProjectVersionsProps {
  readonly projectId: string;
  readonly versions: readonly VersionRow[];
  readonly activeVersionId: string;
  readonly dict: Dictionary;
}

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

export function ProjectVersions({ projectId, versions, activeVersionId, dict }: ProjectVersionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate(versionId: string) {
    setBusy(versionId);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ activeVersionId: versionId }),
      });
      if (!response.ok) {
        setError(dict.projects.activateFailed);
        return;
      }
      router.refresh();
    } catch {
      setError(dict.projects.activateFailed);
    } finally {
      setBusy(null);
    }
  }

  const ordered = [...versions].sort((a, b) => b.version - a.version);

  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
        {dict.projects.versions}
      </h2>

      {error !== null && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <ul className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
        {ordered.map((version) => {
          const isActive = version.id === activeVersionId;
          return (
            <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  v{version.version} · {version.titulo}
                  {isActive && (
                    <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[#04120a] uppercase">
                      {dict.projects.active}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                  {formatDate(version.createdAt)} · {version.words} {dict.projects.words} ·{' '}
                  {version.escenas} {dict.projects.scenes} · {version.source}
                </p>
              </div>
              {!isActive && (
                <button
                  type="button"
                  onClick={() => activate(version.id)}
                  disabled={busy !== null}
                  className="rounded-md border border-[var(--line)] px-3 py-1 text-[11px] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
                >
                  {busy === version.id ? dict.projects.activating : dict.projects.activate}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
