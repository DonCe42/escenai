import Link from 'next/link';
import type { Dictionary, Locale } from '@/lib/i18n';
import { LocaleSwitch } from './LocaleSwitch';

/**
 * Cabecera de las pantallas que no son el estudio ni la landing.
 * Usa el mismo wordmark que la landing para que el producto se sienta uno solo.
 */
export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="mx-auto w-full max-w-5xl px-6">
      <div className="flex items-center justify-between border-b border-[var(--line)] py-5">
        <Link href="/" className="wordmark">
          ESCEN<b>A</b>I
        </Link>
        <nav className="flex items-center gap-5 text-[13px] text-[var(--muted)]">
          <Link href="/new" className="transition hover:text-[var(--text)]">
            {dict.nav.create}
          </Link>
          <Link href="/projects" className="transition hover:text-[var(--text)]">
            {dict.nav.projects}
          </Link>
          <Link href="/settings" className="transition hover:text-[var(--text)]">
            {dict.nav.settings}
          </Link>
          <a
            href="https://github.com/DonCe42/escenai"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-[var(--text)]"
          >
            {dict.nav.github}
          </a>
          <LocaleSwitch locale={locale} />
        </nav>
      </div>
    </header>
  );
}
