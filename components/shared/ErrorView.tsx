import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColors } from '@/hooks/use-colors';

interface ErrorViewProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorView({ message = 'Impossible de charger les données.', onRetry }: ErrorViewProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <ThemedText style={[styles.message, { color: colors.icon }]}>{message}</ThemedText>
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.tint }]} onPress={onRetry}>
        <ThemedText style={styles.buttonText}>Réessayer</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  message: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  button: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#0F172A', fontWeight: '600' },
});
