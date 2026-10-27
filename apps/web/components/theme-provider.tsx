'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export const THEMES = ['light', 'dark', 'github'] as const;
export type ThemeName = (typeof THEMES)[number];

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={[...THEMES]}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
