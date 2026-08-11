import { Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { StyleSheet, View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  padding?: number;
}

export function Card({ style, padding = 16, children, ...rest }: CardProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, padding },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
