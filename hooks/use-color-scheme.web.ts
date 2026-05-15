import { useTheme } from '@/context/ThemeContext';

// On web, use ThemeContext (persisted via AsyncStorage) instead of device OS preference.
// ThemeContext.isReady + AppShell null-guard already prevent flash, no hydration workaround needed.
export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useTheme();
  return colorScheme;
}
