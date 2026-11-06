import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { getDictionary } from '@/lib/i18n';
import { getLocale } from '@/lib/locale-server';

export default async function HomePage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <main className="min-h-screen">
      <SiteHeader locale={locale} dict={dict} />

      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-20">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {dict.home.kicker}
        </p>

        <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
          {dict.home.title}
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          {dict.home.subtitle}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/settings"
            className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#04120a] transition hover:brightness-110"
          >
            {dict.home.cta}
          </Link>
          <a
            href="https://github.com/DonCe42"
            className="text-sm text-[var(--muted)] underline decoration-[var(--line)] underline-offset-4 transition hover:text-[var(--text)]"
            target="_blank"
            rel="noreferrer"
          >
            GitHub / DonCe42
          </a>
        </div>

        <div className="mt-20 border-t border-[var(--line)] pt-10">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
            {dict.home.stepsTitle}
          </h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {dict.home.steps.map(([title, body], index) => (
              <li key={title} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
                <span className="text-xs text-[var(--accent)]">0{index + 1}</span>
                <h3 className="mt-2 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-14 text-xs text-[var(--muted)]">{dict.home.footnote}</p>
      </section>
    </main>
  );
}
