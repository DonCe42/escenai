import { BriefForm } from '@/components/BriefForm';
import { SiteHeader } from '@/components/SiteHeader';
import { getDictionary } from '@/lib/i18n';
import { getLocale } from '@/lib/locale-server';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <main className="min-h-screen">
      <SiteHeader locale={locale} dict={dict} />
      <div className="mx-auto w-full max-w-4xl px-6 pt-10 pb-24">
        <h1 className="text-3xl font-semibold tracking-tight">{dict.create.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          {dict.create.subtitle}
        </p>
        <BriefForm locale={locale} dict={dict} />
      </div>
    </main>
  );
}
