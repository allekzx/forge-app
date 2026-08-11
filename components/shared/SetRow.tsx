import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface SetRowProps {
  index: number;
  weight: string;
  reps: string;
  completed: boolean;
  onWeightChange: (text: string) => void;
  onRepsChange: (text: string) => void;
  onToggleComplete: () => void;
  onLongPressIndex?: () => void;
  editable?: boolean;
}

export function SetRow({
  index,
  weight,
  reps,
  completed,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
  onLongPressIndex,
  editable = true,
}: SetRowProps) {
  const colorScheme = useColorScheme();
  const colors = useColors();

  const inputBg = completed
    ? 'transparent'
    : colorScheme === 'dark'
    ? 'rgba(255,255,255,0.06)'
    : 'rgba(0,0,0,0.05)';

  return (
    <View style={[styles.row, completed && styles.completedRow]}>
      <TouchableOpacity
        style={[styles.indexCell]}
        onLongPress={onLongPressIndex}
        delayLongPress={500}
      >
        <Text style={[styles.index, { color: completed ? colors.success : colors.icon }]}>
          {index}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={[styles.input, { flex: 1, backgroundColor: inputBg, color: colors.text, opacity: completed ? 0.6 : 1 }]}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.icon}
        value={weight}
        editable={editable && !completed}
        onEndEditing={e => onWeightChange(e.nativeEvent.text)}
      />

      <TextInput
        style={[styles.input, { flex: 1, backgroundColor: inputBg, color: colors.text, opacity: completed ? 0.6 : 1 }]}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.icon}
        value={reps}
        editable={editable && !completed}
        onEndEditing={e => onRepsChange(e.nativeEvent.text)}
      />

      <TouchableOpacity
        style={[
          styles.checkBtn,
          {
            backgroundColor: completed ? colors.tint : 'transparent',
            borderColor: completed ? colors.tint : colors.icon,
          },
        ]}
        onPress={onToggleComplete}
      >
        <IconSymbol name="checkmark" size={14} color={completed ? '#0F172A' : colors.icon} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  completedRow: {
    backgroundColor: 'rgba(34,197,94,0.05)',
    borderRadius: Radius.sm,
  },
  indexCell: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  index: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts?.mono,
  },
  input: {
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
    minWidth: 0,
    fontFamily: Fonts?.mono,
    fontVariant: ['tabular-nums'],
  },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
