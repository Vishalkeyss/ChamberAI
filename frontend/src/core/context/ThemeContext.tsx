import React, { createContext, useContext, useEffect, useState } from 'react';
import { applyTheme, type Theme } from '../theme/injector';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'zh' | 'vi' | 'ko';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '121meet_theme';
const LANG_STORAGE_KEY = '121meet_lang';

/**
 * Returns root domain for cookie sharing across subdomains
 * Supports *.localhost for local development and *.121meet.ai in production
 */
function getSharedCookieDomain(): string {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return 'localhost';
  }
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.');
  }
  return '';
}

function setSharedCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  const maxAge = 365 * 24 * 60 * 60; // 1 year
  const domain = getSharedCookieDomain();

  if (domain) {
    try {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; domain=${domain}; SameSite=Lax`;
    } catch {}
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getSharedCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
    if (!saved) {
      saved = getSharedCookie(THEME_STORAGE_KEY);
    }
    return saved && ['light', 'dark', 'system'].includes(saved) ? (saved as Theme) : 'system';
  });

  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANG_STORAGE_KEY);
    } catch {}
    if (!saved) {
      saved = getSharedCookie(LANG_STORAGE_KEY);
    }
    return saved && ['en', 'es', 'fr', 'zh', 'vi', 'ko'].includes(saved)
      ? (saved as SupportedLanguage)
      : 'en';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}
    setSharedCookie(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);

    // Sync to user profile if user is authenticated
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        fetch('/api/v1/auth/me/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferredTheme: newTheme }),
        }).catch(() => {});
      }
    } catch {}
  };

  const setLanguage = (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch {}
    setSharedCookie(LANG_STORAGE_KEY, newLang);
    document.documentElement.lang = newLang;

    // Sync to user profile if user is authenticated
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        fetch('/api/v1/auth/me/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferredLanguage: newLang }),
        }).catch(() => {});
      }
    } catch {}
  };

  // Cross-tab & cross-window synchronization via StorageEvent
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        if (['light', 'dark', 'system'].includes(e.newValue)) {
          setThemeState(e.newValue as Theme);
          applyTheme(e.newValue as Theme);
        }
      }
      if (e.key === LANG_STORAGE_KEY && e.newValue) {
        if (['en', 'es', 'fr', 'zh', 'vi', 'ko'].includes(e.newValue)) {
          setLanguageState(e.newValue as SupportedLanguage);
          document.documentElement.lang = e.newValue;
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Initialize theme and attach system listener
  useEffect(() => {
    applyTheme(theme);
    document.documentElement.lang = language;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [theme, language]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, language, setLanguage }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
