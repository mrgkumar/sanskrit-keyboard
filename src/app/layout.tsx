import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
