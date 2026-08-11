import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const colors = useColors();

  const bgColor: Record<ButtonVariant, string> = {
    primary: colors.tint,
    secondary: colors.card,
    outline: 'transparent',
    danger: '#EF4444',
    ghost: 'transparent',
  };

  const textColor: Record<ButtonVariant, string> = {
    primary: colorScheme === 'dark' ? '#0F172A' : '#0F172A',
    secondary: colors.text,
    outline: colors.tint,
    danger: '#FFFFFF',
    ghost: colors.text,
  };

  const heights: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };
  const fontSizes: Record<ButtonSize, number> = { sm: 14, md: 15, lg: 16 };

  // Primary is the Molten signature: a cooling-metal gradient instead of a flat fill.
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled || loading}
        style={[styles.base, { height: heights[size], opacity: disabled ? 0.4 : 1, overflow: 'hidden' }, style]}
        {...rest}
      >
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        {loading ? (
          <ActivityIndicator color={textColor.primary} />
        ) : (
          <Text style={[styles.label, { color: textColor.primary, fontSize: fontSizes[size] }]}>
            {label.toUpperCase()}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: bgColor[variant],
          height: heights[size],
          opacity: disabled ? 0.4 : 1,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: variant === 'outline' ? colors.tint : undefined,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : (
        <Text style={[styles.label, { color: textColor[variant], fontSize: fontSizes[size] }]}>
          {label.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
