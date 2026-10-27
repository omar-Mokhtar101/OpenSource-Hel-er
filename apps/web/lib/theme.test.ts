import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, nextTheme, resolveThemeName } from './theme';

describe('theme', () => {
  it('defaults to the GitHub Dark palette', () => {
    expect(DEFAULT_THEME).toBe('github');
  });

  it('cycles github -> dark -> light -> github', () => {
    expect(nextTheme('github')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('github');
  });

  it('resolves the system theme to the palette that is actually rendered', () => {
    expect(resolveThemeName('system', 'dark')).toBe('dark');
    expect(resolveThemeName('system', 'light')).toBe('light');
    expect(resolveThemeName('github', 'light')).toBe('github');
    expect(resolveThemeName(undefined, undefined)).toBe('light');
  });
});
