import { cookies } from 'next/headers';
import { LOCALE_COOKIE } from './locale';
import type { Locale } from './locale';

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === 'en' ? 'en' : 'es';
}
