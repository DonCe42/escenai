import Link from 'next/link';
import { summarize } from '@escenai/core';
import { SiteHeader } from '@/components/SiteHeader';
import { createContainer } from '@/lib/container';
import { getDictionary } from '@/lib/i18n';
import { getLocale } from '@/lib/locale-server';

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

export default async function ProjectsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const container = createContainer();
  const projects = (await container.projects.list()).map(summarize);

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

        {projects.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-[var(--line)] p-10 text-center">
            <p className="text-sm text-[var(--muted)]">{dict.projects.empty}</p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="block rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:border-[var(--accent)]"
                >
                  <p className="text-base font-semibold">{project.titulo}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {project.nombre} · {formatDate(project.updatedAt)}
                  </p>
                  <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">
                    {project.versions} {dict.projects.versions} · {project.duracionObjetivoS} s
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
