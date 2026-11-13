import Link from 'next/link';
import { Suspense } from 'react';
import { summarize } from '@escenai/core';
import { SiteHeader } from '@/components/SiteHeader';
import { createContainer } from '@/lib/container';
import { getDictionary } from '@/lib/i18n';
import type { Dictionary } from '@/lib/i18n';
import { getLocale } from '@/lib/locale-server';

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

/** Esqueleto con la misma rejilla que la lista real: evita el salto al cargar. */
function ProjectsSkeleton() {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2" aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <li
          key={index}
          className="h-[118px] animate-pulse rounded-xl border border-[var(--line)] bg-[var(--panel)]"
        />
      ))}
    </ul>
  );
}

async function ProjectsList({ dict, locale }: { readonly dict: Dictionary; readonly locale: 'es' | 'en' }) {
  const container = createContainer();
  // Miniatura de la primera imagen lista: la lista se reconoce de un vistazo.
  const projects = await Promise.all(
    (await container.projects.list()).map(async (project) => {
      const image = (project.assets ?? []).find(
        (asset) => asset.kind === 'image' && asset.status === 'ready' && asset.ref !== null,
      );
      const thumb =
        image?.ref === null || image?.ref === undefined
          ? null
          : await container.storage.signedUrl(
              { key: image.ref, mimeType: image.mimeType ?? 'image/png', bytes: 0 },
              3600,
            );
      return { ...summarize(project), thumb };
    }),
  );

  if (projects.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-[var(--line)] p-10 text-center">
        <p className="text-sm text-[var(--muted)]">{dict.projects.empty}</p>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {projects.map((project) => (
        <li
          key={project.id}
          className="flex gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent)]"
        >
          {project.thumb !== null ? (
            <img
              src={project.thumb}
              alt=""
              className="h-[86px] w-[64px] rounded-md border border-[var(--line)] object-cover"
            />
          ) : (
            <span className="grid h-[86px] w-[64px] place-items-center rounded-md border border-[var(--line)] font-mono text-[10px] text-[var(--dim)]"
              style={{ background: 'repeating-linear-gradient(45deg,#171310,#171310 4px,#1c1714 4px,#1c1714 8px)' }}
            >
              SIN IMG
            </span>
          )}
          <div className="min-w-0 flex-1">
          <Link href={`/studio/${project.id}`} className="block">
            <p className="text-base font-semibold">{project.titulo}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {project.nombre} · {formatDate(project.updatedAt)}
            </p>
          </Link>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] text-[var(--muted)]">
              {project.versions}{' '}
              {project.versions === 1
                ? locale === 'es'
                  ? 'versión'
                  : 'version'
                : dict.projects.versions}{' '}
              · {project.duracionObjetivoS} s
            </p>
            <Link
              href={`/projects/${project.id}`}
              className="text-xs text-[var(--muted)] underline decoration-[var(--line)] underline-offset-4 transition hover:text-[var(--text)]"
            >
              {locale === 'es' ? 'Versiones' : 'Versions'}
            </Link>
          </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ProjectsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <main className="min-h-screen">
      <SiteHeader locale={locale} dict={dict} />
      <div className="mx-auto w-full max-w-4xl px-6 pt-10 pb-24">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{dict.projects.title}</h1>
          <Link
            href="/new"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#04120a] transition hover:brightness-110"
          >
            {dict.projects.new}
          </Link>
        </div>

        <Suspense fallback={<ProjectsSkeleton />}>
          <ProjectsList dict={dict} locale={locale} />
        </Suspense>
      </div>
    </main>
  );
}
