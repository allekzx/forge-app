import { useColors } from '@/hooks/use-colors';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function QuickStartWidget({ onPress }: { onPress?: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.tint }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel="Démarrer une séance vide"
    >
      <Text style={styles.label}>Séance libre</Text>
      <Text style={styles.sub}>Commence sans routine prédéfinie</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  sub: {
    fontSize: 13,
    color: '#0F172A',
    opacity: 0.65,
  },
});
