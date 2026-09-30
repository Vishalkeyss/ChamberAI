/**
 * Dynamic theme and chamber brand color injector
 * Strictly aligns with MASTER_IMPLEMENTATION_PLAYBOOK.md (Prompt 00.1) & Chamber AI reference app
 */

export type Theme = 'light' | 'dark' | 'system';
export { THEME_PALETTE, type ThemePaletteTokens } from './tokens';

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    document.body?.classList.add('dark');
  } else {
    root.classList.remove('dark');
    document.body?.classList.remove('dark');
  }
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

export function injectChamberBranding(primaryColor?: string, accentColor?: string) {
  const root = document.documentElement;
  if (primaryColor) {
    root.style.setProperty('--chamber-primary', primaryColor);
  }
  if (accentColor) {
    root.style.setProperty('--chamber-accent', accentColor);
  }
}
