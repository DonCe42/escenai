import { SiteHeader } from '@/components/SiteHeader';
import { SettingsClient } from '@/components/SettingsClient';
import type { SecretSummary } from '@escenai/core';
import { createContainer } from '@/lib/container';
import { getDictionary } from '@/lib/i18n';
import { getLocale } from '@/lib/locale-server';
import { getWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const container = createContainer();
  const workspace = await getWorkspace();

  let secrets: readonly SecretSummary[] = [];
  if (container.secrets !== null) {
    secrets = await container.secrets.list(workspace.id);
  }

  return (
    <main className="min-h-screen">
      <SiteHeader locale={locale} dict={dict} />
      <div className="mx-auto w-full max-w-3xl px-6 pt-10 pb-24">
        <h1 className="text-3xl font-semibold tracking-tight">{dict.settings.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{dict.settings.subtitle}</p>

        <SettingsClient
          locale={locale}
          dict={dict}
          initialSecrets={secrets}
          mode={workspace.mode}
          masterKeyMissing={container.masterKeyMissing}
        />
      </div>
    </main>
  );
}
