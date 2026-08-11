import { Platform } from 'react-native';

/** Dark text placed on top of any tinted/colored button — works on orange, green, blue, purple */
export const ON_PRIMARY = '#0F172A';

const tintColorLight = '#F97316'; // orange-500
const tintColorDark  = '#F97316';

/**
 * "La Fonte" direction: stamped iron plates and brushed steel — a graphite ground
 * with visibly lifted plate-like panels (not hairline-only), hard edges, and the
 * ember accent reserved for primary actions + state.
 */
export const Colors = {
  light: {
    text: '#141312',
    background: '#EDECE7',
    tint: tintColorLight,
    icon: '#6E6A62',
    tabIconDefault: '#B0ACA1',
    tabIconSelected: tintColorLight,
    card: '#F8F7F4',
    border: '#D8D5CC',
    activity: '#E2DFD6',
    success: '#22C55E',
  },
  dark: {
    text: '#F2EFE9',
    background: '#0B0C0D',
    tint: tintColorDark,
    icon: '#8B877E',
    tabIconDefault: '#57544D',
    tabIconSelected: tintColorDark,
    card: '#17191B',
    border: '#2A2D30',
    activity: '#202225',
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

/** Border radii — flat, catalog-sleeve edges, not app-store rounded */
export const Radius = {
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
  full: 999,
} as const;

/** Letter-spacing for tracked catalog-style caps labels (SÉANCE Nº 042, MES ROUTINES…) */
export const Tracking = {
  label: 0.8,
  eyebrow: 1.2,
} as const;

/** Semantic colors (invariant across themes) */
export const SemanticColors = {
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
} as const;

export const AccentPalettes = {
  orange: { tint: '#F97316', tabIconSelected: '#F97316' },
  green:  { tint: '#22C55E', tabIconSelected: '#22C55E' },
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
