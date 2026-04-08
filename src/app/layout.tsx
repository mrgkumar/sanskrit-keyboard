import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { MobileOptimizationNotice } from '@/components/MobileOptimizationNotice';

const chandas = localFont({
  src: '../../public/fonts/chandas.ttf',
  variable: '--font-chandas',
  display: 'swap',
});

const notoSerifTamil = localFont({
  src: '../../public/fonts/NotoSerifTamil-wdth-wght.ttf',
  variable: '--font-noto-serif-tamil',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sanskrit Keyboard',
  description: 'Canonical ITRANS editing workspace with Devanagari preview and lexical autocomplete.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${chandas.variable} ${notoSerifTamil.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <MobileOptimizationNotice />
        {children}
      </body>
    </html>
  );
}
