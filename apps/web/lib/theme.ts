export const THEMES = ['light', 'dark', 'github'] as const;
export type ThemeName = (typeof THEMES)[number];

/** The palette a brand-new visitor gets. GitHub Dark is the product default. */
export const DEFAULT_THEME: ThemeName = 'github';

/**
 * `next-themes` reports `theme` (what the user picked, possibly `system`) and
 * `resolvedTheme` (what is actually rendered). The toggle only cycles concrete
 * palettes, so resolve `system` first.
 */
export function resolveThemeName(
  theme: string | undefined,
  resolvedTheme: string | undefined,
): ThemeName {
  if (theme === 'github' || theme === 'dark' || theme === 'light') return theme;
  return resolvedTheme === 'dark' ? 'dark' : 'light';
}

/** github -> dark -> light -> github. */
export function nextTheme(current: ThemeName): ThemeName {
  if (current === 'github') return 'dark';
  if (current === 'dark') return 'light';
  return 'github';
}
