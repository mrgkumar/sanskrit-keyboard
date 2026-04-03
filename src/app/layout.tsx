import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const chandas = localFont({
  src: '../../public/fonts/chandas.ttf',
  variable: '--font-chandas',
  display: 'swap',
});

const siddhanta = localFont({
  src: '../../public/fonts/siddhanta.ttf',
  variable: '--font-siddhanta',
  display: 'swap',
});

const sampradaya = localFont({
  src: '../../public/fonts/sampradaya.ttf',
  variable: '--font-sampradaya',
  display: 'swap',
});

const notoSerifTamil = localFont({
  src: '../../public/fonts/NotoSerifTamil-wdth-wght.ttf',
  variable: '--font-noto-serif-tamil',
  display: 'swap',
});

const anekTamil = localFont({
  src: '../../public/fonts/AnekTamil-wdth-wght.ttf',
  variable: '--font-anek-tamil',
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
      className={`h-full antialiased ${chandas.variable} ${siddhanta.variable} ${sampradaya.variable} ${notoSerifTamil.variable} ${anekTamil.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
