// Theme context for dark/light mode support
// Sprint 15: Light Mode Toggle

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeColors {
  primaryBackground: string;
  cardBackground: string;
  elevated: string;
  text: string;
  secondaryText: string;
  accent: string;
  accentText: string;
  success: string;
  successText: string;
  warning: string;
  danger: string;
  dangerText: string;
  divider: string;
  inputBackground: string;
  cardBorder: string;
  tabBarBackground: string;
  statusBarStyle: 'light-content' | 'dark-content';
}

const DARK_COLORS: ThemeColors = {
  primaryBackground: '#0D0F1A',
  cardBackground: '#1A1D2E',
  elevated: '#222639',
  text: '#FFFFFF',
  secondaryText: '#B8B8B8',
  accent: '#D4A843',
  accentText: '#E8C468',
  success: '#4CAF50',
  successText: '#66BB6A',
  warning: '#D4A843',
  danger: '#E57373',
  dangerText: '#FF9C9C',
  divider: 'rgba(255, 255, 255, 0.08)',
  inputBackground: '#1A1D2E',
  cardBorder: 'rgba(212, 168, 67, 0.08)',
  tabBarBackground: '#0D0F1A',
  statusBarStyle: 'light-content',
};

const LIGHT_COLORS: ThemeColors = {
  primaryBackground: '#F5F5F7',
  cardBackground: '#FFFFFF',
  elevated: '#EAEAEF',
  text: '#1E2761',
  secondaryText: '#666666',
  accent: '#D4A843',
  accentText: '#B8922F',
  success: '#4CAF50',
  successText: '#2E7D32',
  warning: '#D4A843',
  danger: '#E57373',
  dangerText: '#C62828',
  divider: 'rgba(0, 0, 0, 0.08)',
  inputBackground: '#F0F0F5',
  cardBorder: 'rgba(0, 0, 0, 0.06)',
  tabBarBackground: '#FFFFFF',
  statusBarStyle: 'dark-content',
};

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = 'dub.settings.theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  isDark: true,
  colors: DARK_COLORS,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    storageGet<ThemeMode>(THEME_STORAGE_KEY).then((saved) => {
      if (saved) setModeState(saved);
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    storageSet(THEME_STORAGE_KEY, newMode);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme !== 'light');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const value = useMemo(
    () => ({ mode, isDark, colors, setMode }),
    [mode, isDark, colors, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
