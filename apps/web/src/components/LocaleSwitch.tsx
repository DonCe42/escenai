'use client';

import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE } from '@/lib/locale';
import type { Locale } from '@/lib/locale';

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();

  function change(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--line)] p-0.5 text-xs">
      {(['es', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => change(code)}
          aria-pressed={locale === code}
          className={`rounded-full px-2.5 py-1 uppercase tracking-wide transition ${
            locale === code
              ? 'bg-[var(--accent)] text-[#04120a]'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
