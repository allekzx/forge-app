export { useTheme as useColorSchemeContext } from '@/context/ThemeContext';

import { useTheme } from '@/context/ThemeContext';

export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useTheme();
  return colorScheme;
}
