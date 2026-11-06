import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteProjectButton } from '@/components/DeleteProjectButton';
import { ProjectVersions } from '@/components/ProjectVersions';
import { SiteHeader } from '@/components/SiteHeader';
import { createContainer } from '@/lib/container';
import { getDictionary } from '@/lib/i18n';
import { getLocale } from '@/lib/locale-server';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const container = createContainer();
  const project = await container.projects.find(id);
  if (project === null) notFound();

  const active = project.versions.find((version) => version.id === project.activeVersionId);

  return (
    <main className="min-h-screen">
      <SiteHeader locale={locale} dict={dict} />
      <div className="mx-auto w-full max-w-4xl px-6 pt-10 pb-24">
        <Link href="/projects" className="text-xs text-[var(--muted)] hover:text-[var(--text)]">
          ← {dict.projects.title}
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{project.nombre}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-[var(--muted)]">
            {project.versions.length} {dict.projects.versions} · {active?.plan.titulo ?? ''}
          </p>
          <DeleteProjectButton projectId={project.id} dict={dict} />
        </div>

        <ProjectVersions
          projectId={project.id}
          versions={project.versions.map((version) => ({
            id: version.id,
            version: version.version,
            source: version.source,
            createdAt: version.createdAt,
            words: version.words,
            titulo: version.plan.titulo,
            escenas: version.plan.escenas.length,
          }))}
          activeVersionId={project.activeVersionId}
          dict={dict}
        />

        {active !== undefined && (
          <section className="mt-10">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
              {dict.projects.activePlan}
            </h2>
            <ol className="mt-4 space-y-2">
              {active.plan.escenas.map((scene, index) => (
                <li key={scene.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
                  <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                    <span className="font-mono">{String(index + 1).padStart(2, '0')}</span>
                    <span className="rounded-full border border-[var(--line)] px-2 py-0.5 uppercase text-[var(--accent)]">
                      {scene.rol}
                    </span>
                    <span className="font-mono">{scene.duracionEstimadaS} s</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{scene.narracion}</p>
                  <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                    {scene.textoPantalla.join(' · ')}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
