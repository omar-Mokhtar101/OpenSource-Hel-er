'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { DEFAULT_THEME, THEMES } from '@/lib/theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME}
      enableSystem
      themes={[...THEMES]}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
