import { Platform } from 'react-native';

/** Dark text placed on top of any tinted/colored button — works on orange, green, blue, purple */
export const ON_PRIMARY = '#0F172A';

const tintColorLight = '#F97316'; // orange-500
const tintColorDark  = '#F97316';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F1F5F9',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
    card: '#FFFFFF',
    activity: '#E2E8F0',
    success: '#22C55E',
  },
  dark: {
    text: '#F8FAFC',
    background: '#1F2937',
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
    card: '#2D3748',
    activity: '#374151',
    success: '#22C55E',
  },
};

/** Spacing scale (4-base) */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Minimum touch target size (WCAG / Android guidelines) */
export const TouchTarget = 48;

/** Border radii */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  full: 999,
} as const;

/** Semantic colors (invariant across themes) */
export const SemanticColors = {
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
} as const;

export const AccentPalettes = {
  orange: { tint: '#F97316', tabIconSelected: '#F97316' },
  green:  { tint: '#00F260', tabIconSelected: '#00F260' },
  blue:   { tint: '#3B82F6', tabIconSelected: '#3B82F6' },
  purple: { tint: '#8B5CF6', tabIconSelected: '#8B5CF6' },
} as const;

export type AccentKey = keyof typeof AccentPalettes;

export function getColors(scheme: 'light' | 'dark', accent: AccentKey = 'orange') {
  return { ...Colors[scheme], ...AccentPalettes[accent] };
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
