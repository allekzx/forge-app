import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type Props = {
  workoutName: string;
  onResume: () => void;
  onDismiss: () => void;
};

export function ActiveWorkoutBanner({ workoutName, onResume, onDismiss }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.tint }]}>
      <TouchableOpacity style={styles.main} onPress={onResume} activeOpacity={0.85}>
        <IconSymbol name="dumbbell.fill" size={16} color="#0F172A" />
        <View style={styles.text}>
          <Text style={styles.label}>SÉANCE EN COURS</Text>
          <Text style={styles.name} numberOfLines={1}>{workoutName}</Text>
        </View>
        <Text style={styles.cta}>Reprendre →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismiss} onPress={onDismiss} hitSlop={8}>
        <IconSymbol name="xmark" size={14} color="#0F172A" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    marginBottom: 16,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  text: { flex: 1 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
    opacity: 0.6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  name: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cta: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  dismiss: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
