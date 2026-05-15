import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function RoutinesWidget() {
  const colorScheme = useColorScheme();
  const colors = useColors();

  const routines = [
    { id: 1, title: 'Push Day', description: '6 Exercises • Chest, Triceps', image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop' },
    { id: 2, title: 'Pull Day', description: '5 Exercises • Back, Biceps', image: 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?q=80&w=2069&auto=format&fit=crop' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Routines</Text>
        <Text style={{ color: colors.success, fontSize: 12, fontWeight: 'bold' }}>View All</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {routines.map((routine) => (
          <View key={routine.id} style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.imageContainer}>
              <Image source={{ uri: routine.image }} style={styles.image} />
              {/* Placeholder for icon overlay if needed */}
            </View>
            <View style={styles.content}>
              <Text style={[styles.title, { color: colors.text }]}>{routine.title}</Text>
              <Text style={[styles.subtitle, { color: colors.icon }]}>{routine.description}</Text>
              <TouchableOpacity style={[styles.button, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.buttonText, { color: '#fff' }]}>Start Routine</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  card: {
    width: 160,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
  },
  imageContainer: {
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 8,
    height: 28, // Fixed height for 2 lines alignment
  },
  button: {
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
