import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SET_TYPE_LABELS, translateEquipment, translateMuscle } from '@/constants/translations';
import { WeightUnit, kgToDisplay } from '@/constants/units';
import { useColors } from '@/hooks/use-colors';
import {
  WorkoutSessionDetail,
  WorkoutSummaryData,
  getUserSetting,
  getWorkoutSessionDetail,
  getWorkoutSummary,
  initDatabase,
} from '@/services/DatabaseService';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export default function HistoryDetailScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const router = useRouter();
  const colors = useColors();

  const [session, setSession] = useState<WorkoutSessionDetail | null>(null);
  const [summary, setSummary] = useState<WorkoutSummaryData | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workoutId || typeof workoutId !== 'string') return;
    const load = async () => {
      try {
        await initDatabase();
        const detail = await getWorkoutSessionDetail(workoutId);
        const sum = await getWorkoutSummary(workoutId);
        const unit = await getUserSetting('weight_unit', 'kg');
        setSession(detail);
        setSummary(sum);
        setWeightUnit(unit as WeightUnit);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workoutId]);

  const grouped = (() => {
    if (!session) return [];
    const map = new Map<string, { exerciseId: string; name: string; muscle: string; equipment: string; sets: typeof session.sets }>();
    for (const s of session.sets) {
      if (!map.has(s.exercise_id)) {
        map.set(s.exercise_id, { exerciseId: s.exercise_id, name: s.name, muscle: s.muscle, equipment: s.equipment, sets: [] });
      }
      map.get(s.exercise_id)!.sets.push(s);
    }
    return Array.from(map.values());
  })();

  const date = session?.created_at
    ? new Date(session.created_at).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.tint} />
        </TouchableOpacity>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle} numberOfLines={1}>
          {session?.name ?? 'Séance'}
        </ThemedText>
        <View style={styles.backBtn} />
      </View>

      {loading && (
        <View style={styles.center}>
          <ThemedText>Chargement…</ThemedText>
        </View>
      )}

      {!loading && session && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Date */}
          <ThemedText style={[styles.date, { color: colors.icon }]}>{date}</ThemedText>

          {/* Stats summary */}
          {summary && (
            <View style={styles.statsRow}>
              <View style={[styles.statPill, { backgroundColor: colors.card }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatDuration(summary.durationSeconds)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.icon }]}>Durée</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: colors.card }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {kgToDisplay(summary.totalVolume, weightUnit)} {weightUnit}
                </Text>
                <Text style={[styles.statLabel, { color: colors.icon }]}>Volume</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: colors.card }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {summary.completedSets}/{summary.totalSets}
                </Text>
                <Text style={[styles.statLabel, { color: colors.icon }]}>Sets</Text>
              </View>
            </View>
          )}

          {/* Exercises */}
          {grouped.map((ex) => (
            <View key={ex.exerciseId} style={[styles.exerciseCard, { backgroundColor: colors.card }]}>
              <ThemedText type="defaultSemiBold" style={styles.exerciseName}>{ex.name}</ThemedText>
              <ThemedText style={[styles.exerciseMeta, { color: colors.icon }]}>
                {`${translateMuscle(ex.muscle)} · ${translateEquipment(ex.equipment)}`}
              </ThemedText>

              {/* Set header */}
              <View style={styles.setHeaderRow}>
                <Text style={[styles.setHeaderCell, { color: colors.icon, width: 36 }]}>SET</Text>
                <Text style={[styles.setHeaderCell, { color: colors.icon, width: 60 }]}>TYPE</Text>
                <Text style={[styles.setHeaderCell, { color: colors.icon, flex: 1 }]}>POIDS</Text>
                <Text style={[styles.setHeaderCell, { color: colors.icon, flex: 1 }]}>REPS</Text>
                <View style={{ width: 24 }} />
              </View>

              {ex.sets.map((s) => {
                const isCompleted = !!s.completed_at;
                return (
                  <View key={s.id} style={[styles.setRow, isCompleted && styles.setRowCompleted]}>
                    <Text style={[styles.setIndex, { color: isCompleted ? colors.success : colors.icon }]}>
                      {s.set_index}
                    </Text>
                    <Text style={[styles.setType, { color: colors.icon, width: 60 }]} numberOfLines={1}>
                      {SET_TYPE_LABELS[s.set_type ?? 'normal'] ?? 'Normal'}
                    </Text>
                    <Text style={[styles.setValue, { color: colors.text, flex: 1 }]}>
                      {s.actual_weight != null ? `${kgToDisplay(s.actual_weight, weightUnit)} ${weightUnit}` : '—'}
                    </Text>
                    <Text style={[styles.setValue, { color: colors.text, flex: 1 }]}>
                      {s.actual_reps != null ? `${s.actual_reps}` : '—'}
                    </Text>
                    <IconSymbol
                      name={isCompleted ? 'checkmark.circle.fill' : 'circle'}
                      size={16}
                      color={isCompleted ? colors.success : colors.icon}
                    />
                  </View>
                );
              })}
            </View>
          ))}

          {/* Notes */}
          {session.notes ? (
            <View style={[styles.notesCard, { backgroundColor: colors.card }]}>
              <ThemedText style={[styles.notesLabel, { color: colors.icon }]}>Notes</ThemedText>
              <ThemedText style={styles.notesText}>{session.notes}</ThemedText>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 17, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  date: { fontSize: 13, marginBottom: 4, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  exerciseCard: { borderRadius: 14, padding: 14 },
  exerciseName: { fontSize: 15, marginBottom: 2 },
  exerciseMeta: { fontSize: 12, marginBottom: 10 },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  setHeaderCell: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  setRowCompleted: { opacity: 0.9 },
  setIndex: { width: 36, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  setType: { fontSize: 11 },
  setValue: { fontSize: 14, fontWeight: '500' },
  notesCard: { borderRadius: 14, padding: 14, gap: 6 },
  notesLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  notesText: { fontSize: 14, lineHeight: 20 },
});
