/**
 * Canonical Theme Color Tokens
 * Single source of truth for all theme color values.
 * Mirror of CSS variables declared in src/index.css.
 * 
 * Edit colors here or in src/index.css to change theme styling uniformly.
 */

export interface ThemePaletteTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  headerUtility: string;
  headerNav: string;
  hero: string;
  sectionNews: string;
  sectionAlt: string;
  sidebar: string;
  sidebarForeground: string;
  primary: string;
  secondary: string;
  muted: string;
  accent: string;
}

export const THEME_PALETTE: {
  light: ThemePaletteTokens;
  dark: ThemePaletteTokens;
} = {
  light: {
    background: '#FFFFFF',
    foreground: '#0A0F1C',
    card: '#FFFFFF',
    cardForeground: '#0A0F1C',
    border: '#E5E7EB',
    headerUtility: 'rgba(0, 0, 0, 0.15)',
    headerNav: '#0B2447',
    hero: '#0B2447',
    sectionNews: '#F8FAFC',
    sectionAlt: '#FFFFFF',
    sidebar: '#0B2447',
    sidebarForeground: '#FFFFFF',
    primary: '#0B2447',
    secondary: '#F3F4F6',
    muted: '#F6F7F9',
    accent: '#F3F4F6',
  },
  dark: {
    background: '#0F1A2E',
    foreground: '#F1F5F9',
    card: '#172741',
    cardForeground: '#F1F5F9',
    border: '#26406A',
    headerUtility: '#091322',
    headerNav: '#0A1628',
    hero: '#0C2649',
    sectionNews: '#0F1A2E',
    sectionAlt: '#0A203E',
    sidebar: '#0A1628',
    sidebarForeground: '#F1F5F9',
    primary: '#38BDF8',
    secondary: '#1E3352',
    muted: '#1E3352',
    accent: '#1E3352',
  },
} as const;
