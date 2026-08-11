import { Platform } from 'react-native';

/** Dark text placed on top of any tinted/colored button — works on orange, green, blue, purple */
export const ON_PRIMARY = '#0F172A';

const tintColorLight = '#F97316'; // orange-500
const tintColorDark  = '#F97316';

/**
 * "Molten" direction: a forge-dark ground with the accent expressed as a cooling-metal
 * gradient (ember → hot orange → white-hot) reserved for CTAs, effort/intensity meters,
 * and PR moments — everywhere else stays a flat, quiet ground so the gradient still reads
 * as a signal, not decoration.
 */
export const Colors = {
  light: {
    text: '#1A1512',
    background: '#F3EEE6',
    tint: tintColorLight,
    icon: '#8A7F6E',
    tabIconDefault: '#C2B8A6',
    tabIconSelected: tintColorLight,
    card: '#FBF7F1',
    border: '#E4DBCB',
    activity: '#EAE2D3',
    success: '#22C55E',
  },
  dark: {
    text: '#F5EFE6',
    background: '#0A0908',
    tint: tintColorDark,
    icon: '#93887A',
    tabIconDefault: '#544C40',
    tabIconSelected: tintColorDark,
    card: '#171310',
    border: '#2E2620',
    activity: '#211B15',
    success: '#22C55E',
  },
};

/**
 * Cooling-metal gradient per accent — the Molten signature. Used via expo-linear-gradient
 * on primary CTAs, the rest-timer intensity bar, and PR/record moments. Never a surface fill.
 */
export const MoltenGradients = {
  orange: ['#7A1E00', '#FF6B00', '#FFD166'],
  green:  ['#0F3D24', '#22C55E', '#A7F3D0'],
  blue:   ['#0B2E5C', '#3B82F6', '#BFDBFE'],
  purple: ['#3B1264', '#8B5CF6', '#E9D5FF'],
} as const;

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

/** Border radii — softer than a stamped plate, still contained; premium not bouncy */
export const Radius = {
  sm: 4,
  md: 8,
  lg: 10,
  xl: 14,
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
  return { ...Colors[scheme], ...AccentPalettes[accent], gradient: MoltenGradients[accent] };
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
