import { getColors } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export function useColors() {
  const { colorScheme, accentColor } = useTheme();
  return getColors(colorScheme, accentColor);
}
