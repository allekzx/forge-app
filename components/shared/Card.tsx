import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { StyleSheet, View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  padding?: number;
}

export function Card({ style, padding = 16, children, ...rest }: CardProps) {
  const colorScheme = useColorScheme();
  const colors = useColors();

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, padding }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
  },
});
