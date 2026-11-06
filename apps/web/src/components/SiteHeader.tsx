import Link from 'next/link';
import type { Dictionary, Locale } from '@/lib/i18n';
import { LocaleSwitch } from './LocaleSwitch';

export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
        <span className="text-sm font-semibold tracking-[0.2em] uppercase">Escenai</span>
      </Link>
      <nav className="flex items-center gap-5 text-sm text-[var(--muted)]">
        <Link href="/new" className="transition hover:text-[var(--text)]">
          {dict.nav.create}
        </Link>
        <Link href="/settings" className="transition hover:text-[var(--text)]">
          {dict.nav.settings}
        </Link>
        <LocaleSwitch locale={locale} />
      </nav>
    </header>
  );
}
