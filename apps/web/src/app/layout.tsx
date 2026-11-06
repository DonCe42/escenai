import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { getLocale } from '@/lib/locale-server';

export const metadata: Metadata = {
  title: 'Escenai',
  description:
    'Convierte un brief en video vertical con voz, texto animado y subtítulos, usando tus propias API keys.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
