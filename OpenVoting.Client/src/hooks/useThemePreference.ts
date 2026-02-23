import { useEffect, useMemo, useRef, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'openvoting.theme.mode';
const DARK_MODE_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';
const THEME_TRANSITION_CLASS = 'theme-transition';
const THEME_TRANSITION_MS = 220;

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(storedMode) ? storedMode : 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(DARK_MODE_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function applyTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === 'system') {
    return 'light';
  }

  if (mode === 'light') {
    return 'dark';
  }

  return 'system';
}

export function useThemePreference() {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const hasAppliedThemeRef = useRef(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(DARK_MODE_MEDIA_QUERY);
    const onSystemThemeChange = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    };

    onSystemThemeChange();
    mediaQuery.addEventListener('change', onSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', onSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const resolvedTheme = mode === 'system' ? systemTheme : mode;
    const canAnimate = hasAppliedThemeRef.current;

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const prefersReducedMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;

      if (canAnimate && !prefersReducedMotion) {
        root.classList.add(THEME_TRANSITION_CLASS);

        if (transitionTimeoutRef.current !== null) {
          window.clearTimeout(transitionTimeoutRef.current);
        }

        transitionTimeoutRef.current = window.setTimeout(() => {
          root.classList.remove(THEME_TRANSITION_CLASS);
          transitionTimeoutRef.current = null;
        }, THEME_TRANSITION_MS);
      }
    }

    applyTheme(resolvedTheme);
    hasAppliedThemeRef.current = true;

    return () => {
      if (typeof document === 'undefined') {
        return;
      }

      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }

      document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
    };
  }, [mode, systemTheme]);

  const label = useMemo(() => {
    if (mode === 'system') {
      return 'System';
    }

    return mode === 'light' ? 'Light' : 'Dark';
  }, [mode]);

  const cycleMode = () => {
    setMode((currentMode) => nextThemeMode(currentMode));
  };

  const resolvedTheme: ResolvedTheme = mode === 'system' ? systemTheme : mode;

  return {
    mode,
    label,
    systemTheme,
    resolvedTheme,
    cycleMode,
    setMode,
    nextThemeMode,
  };
}