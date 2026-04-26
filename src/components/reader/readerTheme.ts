import type { ReaderTheme } from '@/lib/veda-book/types';

export const readerThemeTextClass = (
  theme: ReaderTheme,
  lightClass: string,
  darkClass: string = 'text-white',
) => (theme === 'dark' ? darkClass : lightClass);

export const readerThemeClass = (
  theme: ReaderTheme,
  lightClass: string,
  darkClass: string,
) => (theme === 'dark' ? darkClass : lightClass);
