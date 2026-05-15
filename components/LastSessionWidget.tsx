import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { LastWorkoutInfo, getLastWorkout, initDatabase } from '@/services/DatabaseService';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days >= 2) return `Il y a ${days} jours`;
  if (days === 1) return 'Hier';
  if (hours >= 1) return `Il y a ${hours}h`;
  if (mins >= 1) return `Il y a ${mins} min`;
  return "À l'instant";
}

export function LastSessionWidget() {
  const colorScheme = useColorScheme();
  const colors = useColors();
  const router = useRouter();
  const [workout, setWorkout] = useState<LastWorkoutInfo>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await initDatabase();
        const data = await getLastWorkout();
        if (!cancelled) setWorkout(data);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  if (!workout) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Dernière séance</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(34,197,94,0.08)' }]}>
            <IconSymbol name="clock.arrow.circlepath" size={24} color={colors.icon} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.title, { color: colors.icon }]}>Aucune séance pour l'instant</Text>
            <Text style={[styles.subtitle, { color: colors.icon }]}>Lance ton premier entraînement !</Text>
          </View>
        </View>
      </View>
    );
  }

  const durationText = workout.durationMinutes
    ? workout.durationMinutes >= 60
      ? `${Math.floor(workout.durationMinutes / 60)}h ${workout.durationMinutes % 60}m`
      : `${workout.durationMinutes}m`
    : null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Dernière séance</Text>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: workout.id } })}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(34,197,94,0.08)' }]}>
            <IconSymbol name="clock.arrow.circlepath" size={24} color={colors.success} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {workout.name}
            </Text>
            <Text style={[styles.subtitle, { color: colors.icon }]}>
              {workout.finished_at ? timeAgo(workout.finished_at) : 'En cours'}
              {durationText ? ` • ${durationText}` : ''}
              {workout.exerciseCount > 0 ? ` • ${workout.exerciseCount} exercise${workout.exerciseCount > 1 ? 's' : ''}` : ''}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={20} color={colors.icon} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
