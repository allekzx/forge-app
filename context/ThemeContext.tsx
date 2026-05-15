import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ColorSchemeName, useColorScheme as useSystemColorScheme } from 'react-native';
import { AccentKey } from '@/constants/theme';

const THEME_KEY = '@app_theme';
const ACCENT_KEY = '@app_accent';

type ThemeContextValue = {
  colorScheme: 'light' | 'dark';
  setColorScheme: (scheme: 'light' | 'dark') => void;
  accentColor: AccentKey;
  setAccentColor: (accent: AccentKey) => void;
  isReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: 'dark',
  setColorScheme: () => {},
  accentColor: 'orange',
  setAccentColor: () => {},
  isReady: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [colorScheme, setColorSchemeState] = useState<'light' | 'dark'>('dark');
  const [accentColor, setAccentColorState] = useState<AccentKey>('orange');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(ACCENT_KEY),
    ]).then(([savedTheme, savedAccent]) => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setColorSchemeState(savedTheme);
      } else {
        setColorSchemeState((systemScheme as ColorSchemeName) === 'light' ? 'light' : 'dark');
      }
      if (savedAccent === 'green' || savedAccent === 'blue' || savedAccent === 'orange' || savedAccent === 'purple') {
        setAccentColorState(savedAccent);
      }
      setIsReady(true);
    });
  }, []);

  const setColorScheme = useCallback(async (scheme: 'light' | 'dark') => {
    setColorSchemeState(scheme);
    await AsyncStorage.setItem(THEME_KEY, scheme);
  }, []);

  const setAccentColor = useCallback(async (accent: AccentKey) => {
    setAccentColorState(accent);
    await AsyncStorage.setItem(ACCENT_KEY, accent);
  }, []);

  return (
    <ThemeContext.Provider value={{ colorScheme, setColorScheme, accentColor, setAccentColor, isReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
