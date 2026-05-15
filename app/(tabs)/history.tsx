import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorView } from '@/components/shared/ErrorView';
import { ThemedText } from '@/components/themed-text';
import { useColors } from '@/hooks/use-colors';
import { WorkoutSummary, getWorkouts, initDatabase } from '@/services/DatabaseService';
import { useFocusEffect, useRouter } from 'expo-router';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDuration(created: string, finished: string | null): string | null {
  if (!finished) return null;
  const mins = Math.round((new Date(finished).getTime() - new Date(created).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function HistoryScreen() {
  const colors = useColors();
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await initDatabase();
      const data = await getWorkouts(true);
      setWorkouts(data);
    } catch (e) {
      console.error('[history] load error:', e);
      setError('Impossible de charger l\'historique.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadData().catch(() => {});
      return () => { cancelled = true; };
    }, [loadData])
  );

  const renderItem = useCallback(({ item }: { item: WorkoutSummary }) => {
    const duration = formatDuration(item.created_at, item.finished_at);
    const isFinished = !!item.finished_at;
    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/history/[workoutId]', params: { workoutId: item.id } })}
        activeOpacity={0.7}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardLeft}>
            <ThemedText style={styles.cardTitle} numberOfLines={1}>{item.name}</ThemedText>
            <ThemedText style={[styles.cardMeta, { color: colors.icon }]}>
              {formatDate(item.created_at)}
              {item.exerciseCount > 0 ? ` · ${item.exerciseCount} exercice${item.exerciseCount > 1 ? 's' : ''}` : ''}
              {duration ? ` · ${duration}` : ''}
            </ThemedText>
          </View>
          {!isFinished && (
            <View style={[styles.badge, { backgroundColor: colors.tint + '20' }]}>
              <ThemedText style={[styles.badgeText, { color: colors.tint }]}>En cours</ThemedText>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [router, colors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.inner}>
        <ThemedText type="title" style={styles.title}>Historique</ThemedText>

        {loading && <ThemedText style={{ color: colors.icon }}>Chargement…</ThemedText>}

        {!loading && error && <ErrorView message={error} onRetry={loadData} />}

        {!loading && !error && workouts.length === 0 && (
          <ThemedText style={[styles.empty, { color: colors.icon }]}>
            Aucune séance terminée. Démarre ton premier entraînement !
          </ThemedText>
        )}

        {!loading && !error && workouts.length > 0 && (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={renderItem}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 20 },
  title: { marginBottom: 16 },
  empty: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  listContent: { paddingBottom: 24, gap: 10 },
  card: {
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  cardMeta: { fontSize: 12 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
