import { Platform } from 'react-native';

/** Dark text placed on top of any tinted/colored button — works on orange, green, blue, purple */
export const ON_PRIMARY = '#0F172A';

const tintColorLight = '#F97316'; // orange-500
const tintColorDark  = '#F97316';

/**
 * "Le Tableau" → "Factory Records" direction: a matte, near-monochrome catalog
 * ground (vast unprinted black / paper white) with hairline dividers instead of
 * filled cards, and the accent reserved for primary actions + state — never surface fill.
 */
export const Colors = {
  light: {
    text: '#0A0A0A',
    background: '#F4F4F2',
    tint: tintColorLight,
    icon: '#68655F',
    tabIconDefault: '#A5A19A',
    tabIconSelected: tintColorLight,
    card: '#FFFFFF',
    border: '#DEDCD5',
    activity: '#E4E2DB',
    success: '#22C55E',
  },
  dark: {
    text: '#F1F0EC',
    background: '#0A0A09',
    tint: tintColorDark,
    icon: '#8C887F',
    tabIconDefault: '#59564F',
    tabIconSelected: tintColorDark,
    card: '#131311',
    border: '#242320',
    activity: '#1C1B18',
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
