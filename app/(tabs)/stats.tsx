import { ActiveWorkoutBanner } from '@/components/shared/ActiveWorkoutBanner';
import { ErrorView } from '@/components/shared/ErrorView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import {
  BodyMeasurement,
  PersonalRecord,
  VolumeByWeek,
  WeeklyStats,
  getActiveWorkout,
  getBodyMeasurements,
  getPersonalRecords,
  getTotalSetsAllTime,
  getTotalVolumeAllTime,
  getTotalWorkoutsAllTime,
  getVolumeByWeek,
  getWeeklyStats,
  getWorkoutStreak,
  initDatabase,
  saveBodyMeasurement,
} from '@/services/DatabaseService';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Volume Bar Chart ─────────────────────────────────────────────────────────

function VolumeChart({ data, colors }: { data: VolumeByWeek[]; colors: ReturnType<typeof useColors> }) {
  const maxVol = Math.max(...data.map(d => d.volume), 1);
  const BAR_MAX = 90;

  return (
    <View style={chartStyles.container}>
      {data.map((item, i) => {
        const barH = Math.max((item.volume / maxVol) * BAR_MAX, item.volume > 0 ? 4 : 2);
        const isLast = i === data.length - 1;
        return (
          <View key={i} style={chartStyles.column}>
            <Text style={[chartStyles.volLabel, { color: colors.icon }]}>
              {item.volume > 0 ? (item.volume >= 1000 ? `${(item.volume / 1000).toFixed(1)}t` : `${item.volume}`) : ''}
            </Text>
            <View style={chartStyles.barWrap}>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: barH,
                    backgroundColor: isLast ? colors.tint : colors.tint + '4D',
                  },
                ]}
              />
            </View>
            <Text style={[chartStyles.weekLabel, { color: isLast ? colors.tint : colors.icon }]}>
              {item.weekLabel.split(' ')[1]}
            </Text>
            <Text style={[chartStyles.monthLabel, { color: colors.icon }]}>
              {item.weekLabel.split(' ')[0]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    paddingTop: 16,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '70%',
  },
  bar: {
    borderRadius: 4,
    width: '100%',
  },
  volLabel: {
    fontSize: 8,
    marginBottom: 2,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  monthLabel: {
    fontSize: 9,
    marginTop: 1,
  },
});

// ─── Body Weight Line Chart (SVG) ────────────────────────────────────────────

const CHART_W = 320;
const CHART_H = 110;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function WeightChart({ data, colors }: { data: BodyMeasurement[]; colors: ReturnType<typeof useColors> }) {
  if (data.length < 2) return null;

  const points = [...data].reverse().slice(-10);
  const values = points.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const toX = (i: number) => PAD.left + (i / (points.length - 1)) * PLOT_W;
  const toY = (v: number) => PAD.top + PLOT_H - ((v - min) / range) * PLOT_H;

  const polylinePoints = points.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');

  const labelIndices = points.length <= 5
    ? points.map((_, i) => i)
    : [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ marginVertical: 8 }}>
      {/* Horizontal grid lines */}
      {[0, 0.5, 1].map((t, i) => {
        const y = PAD.top + t * PLOT_H;
        return (
          <Line key={i} x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y}
            stroke={colors.activity} strokeWidth={1} />
        );
      })}

      {/* Y axis labels */}
      {[0, 0.5, 1].map((t, i) => {
        const y = PAD.top + t * PLOT_H;
        const val = (max - t * range).toFixed(1);
        return (
          <SvgText key={i} x={PAD.left - 4} y={y + 4} fontSize={9}
            fill={colors.icon} textAnchor="end">{val}</SvgText>
        );
      })}

      {/* Line */}
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={colors.tint}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {points.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.value)} r={3}
          fill={colors.tint} />
      ))}

      {/* X axis date labels */}
      {labelIndices.map(i => {
        const d = points[i];
        const label = new Date(d.recorded_at).toLocaleDateString('fr', { day: 'numeric', month: 'short' });
        return (
          <SvgText key={i} x={toX(i)} y={CHART_H - 4} fontSize={9}
            fill={colors.icon} textAnchor="middle">{label}</SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Muscle Group Icon ────────────────────────────────────────────────────────

function muscleBadgeColor(muscle: string): string {
  const m = muscle.toLowerCase();
  if (m.includes('chest')) return '#FF6B6B';
  if (m.includes('back')) return '#4ECDC4';
  if (m.includes('leg') || m.includes('quad') || m.includes('ham')) return '#45B7D1';
  if (m.includes('shoulder')) return '#96CEB4';
  if (m.includes('arm') || m.includes('bicep') || m.includes('tricep')) return '#FFEAA7';
  if (m.includes('core') || m.includes('ab')) return '#DDA0DD';
  return '#9BA1A6';
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const colorScheme = useColorScheme();
  const colors = useColors();
  const router = useRouter();

  const [activeWorkout, setActiveWorkout] = useState<{ id: string; name: string } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [volumeByWeek, setVolumeByWeek] = useState<VolumeByWeek[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyMeasurement[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalVolume, setTotalVolume] = useState<number | null>(null);
  const [totalWorkouts, setTotalWorkouts] = useState<number | null>(null);
  const [totalSets, setTotalSets] = useState<number | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Sequential to avoid concurrent SQLite WASM statement conflicts
  const loadData = useCallback(async () => {
    setError(null);
    try {
      await initDatabase();
      const ws = await getWeeklyStats();
      const records = await getPersonalRecords(8);
      const vol = await getVolumeByWeek(8);
      const weights = await getBodyMeasurements('weight', 30);
      const s = await getWorkoutStreak();
      const allVol = await getTotalVolumeAllTime();
      const allWorkouts = await getTotalWorkoutsAllTime();
      const allSets = await getTotalSetsAllTime();
      const active = await getActiveWorkout();
      setActiveWorkout(active);
      setBannerDismissed(false);
      setWeeklyStats(ws);
      setPrs(records);
      setVolumeByWeek(vol);
      setBodyWeights(weights);
      setStreak(s);
      setTotalVolume(allVol);
      setTotalWorkouts(allWorkouts);
      setTotalSets(allSets);
    } catch (e) {
      console.error('[stats] load error:', e);
      setError('Impossible de charger les statistiques.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleLogWeight = async () => {
    const val = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(val) || val <= 0 || val > 500) {
      Alert.alert('Valeur invalide', 'Saisis un poids valide en kg.');
      return;
    }
    await saveBodyMeasurement('weight', val, 'kg');
    setWeightInput('');
    Keyboard.dismiss();
    const updated = await getBodyMeasurements('weight', 30);
    setBodyWeights(updated);
  };

  const latestWeight = bodyWeights[0];

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <ErrorView message={error} onRetry={loadData} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Progression</Text>
            <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
              <IconSymbol name="flame.fill" size={16} color={colors.tint} />
              <Text style={[styles.streakText, { color: colors.text }]}>{streak} semaine{streak !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {activeWorkout && !bannerDismissed && (
            <ActiveWorkoutBanner
              workoutName={activeWorkout.name}
              onResume={() =>
                router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: activeWorkout.id } })
              }
              onDismiss={() => setBannerDismissed(true)}
            />
          )}

          {/* All-Time Summary */}
          <View style={[styles.allTimeCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.allTimeTitle, { color: colors.icon }]}>ALL TIME</Text>
            <View style={styles.allTimeRow}>
              <View style={styles.allTimeItem}>
                <Text style={[styles.allTimeValue, { color: colors.text }]}>
                  {totalVolume === null
                    ? '—'
                    : totalVolume >= 1000000
                    ? `${(totalVolume / 1000000).toFixed(1)}M`
                    : totalVolume >= 1000
                    ? `${(totalVolume / 1000).toFixed(1)}t`
                    : `${totalVolume}`}
                </Text>
                <Text style={[styles.allTimeUnit, { color: colors.icon }]}>kg soulevés</Text>
              </View>
              <View style={[styles.allTimeDivider, { backgroundColor: colors.activity }]} />
              <View style={styles.allTimeItem}>
                <Text style={[styles.allTimeValue, { color: colors.text }]}>
                  {totalWorkouts === null ? '—' : totalWorkouts}
                </Text>
                <Text style={[styles.allTimeUnit, { color: colors.icon }]}>séances</Text>
              </View>
              <View style={[styles.allTimeDivider, { backgroundColor: colors.activity }]} />
              <View style={styles.allTimeItem}>
                <Text style={[styles.allTimeValue, { color: colors.text }]}>
                  {totalSets === null ? '—' : totalSets}
                </Text>
                <Text style={[styles.allTimeUnit, { color: colors.icon }]}>sets</Text>
              </View>
            </View>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <IconSymbol name="flame.fill" size={20} color="#FF6B6B" />
              <Text style={[styles.summaryValue, { color: colors.text }]}>{weeklyStats?.workoutCount ?? '—'}</Text>
              <Text style={[styles.summaryLabel, { color: colors.icon }]}>Séances</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <IconSymbol name="scalemass.fill" size={20} color={colors.tint} />
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {weeklyStats
                  ? weeklyStats.totalVolume >= 1000
                    ? `${(weeklyStats.totalVolume / 1000).toFixed(1)}t`
                    : `${weeklyStats.totalVolume}kg`
                  : '—'}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.icon }]}>Volume</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <IconSymbol name="clock.fill" size={20} color="#45B7D1" />
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {weeklyStats
                  ? weeklyStats.totalDurationMinutes >= 60
                    ? `${Math.floor(weeklyStats.totalDurationMinutes / 60)}h${weeklyStats.totalDurationMinutes % 60}m`
                    : `${weeklyStats.totalDurationMinutes}m`
                  : '—'}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.icon }]}>Temps</Text>
            </View>
          </View>

          {/* Volume Chart */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Volume / Semaine</Text>
              <Text style={[styles.cardSub, { color: colors.icon }]}>kg soulevés</Text>
            </View>
            {volumeByWeek.length > 0 ? (
              <VolumeChart data={volumeByWeek} colors={colors} />
            ) : (
              <Text style={[styles.emptyText, { color: colors.icon }]}>Pas encore de données — complète des séances pour voir ta progression.</Text>
            )}
          </View>

          {/* Personal Records */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Records Personnels</Text>
              <IconSymbol name="trophy.fill" size={16} color="#FFD700" />
            </View>
            {loading ? (
              <Text style={[styles.emptyText, { color: colors.icon }]}>Loading…</Text>
            ) : prs.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.icon }]}>
                Complète des sets avec du poids pour voir tes records ici.
              </Text>
            ) : (
              prs.map((pr, i) => (
                <View key={pr.exercise_id} style={[styles.prRow, { borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                  <View style={[styles.prRank, { backgroundColor: i < 3 ? colors.tint + '1F' : 'transparent' }]}>
                    <Text style={[styles.prRankText, { color: i < 3 ? colors.tint : colors.icon }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <View style={styles.prInfo}>
                    <Text style={[styles.prName, { color: colors.text }]} numberOfLines={1}>{pr.name}</Text>
                    <View style={styles.prMeta}>
                      <View style={[styles.musclePill, { backgroundColor: muscleBadgeColor(pr.muscle) + '22' }]}>
                        <Text style={[styles.musclePillText, { color: muscleBadgeColor(pr.muscle) }]}>
                          {pr.muscle}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.prWeight}>
                    <Text style={[styles.prWeightValue, { color: colors.tint }]}>{pr.maxWeight}</Text>
                    <Text style={[styles.prWeightUnit, { color: colors.icon }]}>kg</Text>
                    {pr.reps && (
                      <Text style={[styles.prReps, { color: colors.icon }]}>× {pr.reps}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Body Weight */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Poids Corporel</Text>
              {latestWeight && (
                <Text style={[styles.currentWeight, { color: colors.tint }]}>
                  {latestWeight.value} kg
                </Text>
              )}
            </View>

            <WeightChart data={bodyWeights} colors={colors} />

            <View style={styles.weightInputRow}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.weightInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  },
                ]}
                placeholder="Saisir le poids (kg)"
                placeholderTextColor={colors.icon}
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
                returnKeyType="done"
                onSubmitEditing={handleLogWeight}
              />
              <TouchableOpacity
                style={[styles.logButton, { backgroundColor: colors.tint, opacity: weightInput ? 1 : 0.4 }]}
                onPress={handleLogWeight}
                disabled={!weightInput}
              >
                <Text style={styles.logButtonText}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {bodyWeights.length > 0 && (
              <View style={styles.weightHistory}>
                {bodyWeights.slice(0, 5).map(m => (
                  <View key={m.id} style={[styles.histRow, { borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                    <Text style={[styles.histDate, { color: colors.icon }]}>
                      {new Date(m.recorded_at).toLocaleDateString('fr', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={[styles.histValue, { color: colors.text }]}>{`${m.value} kg`}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakText: { fontSize: 14, fontWeight: '600' },

  allTimeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  allTimeTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  allTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allTimeItem: {
    flex: 1,
    alignItems: 'center',
  },
  allTimeValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  allTimeUnit: {
    fontSize: 12,
  },
  allTimeDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 8,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 11,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardSub: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
    lineHeight: 20,
  },

  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  prRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  prRankText: { fontSize: 12, fontWeight: 'bold' },
  prInfo: { flex: 1 },
  prName: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  prMeta: { flexDirection: 'row' },
  musclePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  musclePillText: { fontSize: 10, fontWeight: '600' },
  prWeight: { alignItems: 'flex-end' },
  prWeightValue: { fontSize: 18, fontWeight: 'bold' },
  prWeightUnit: { fontSize: 11 },
  prReps: { fontSize: 11, marginTop: 2 },

  currentWeight: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  weightInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  weightInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
  },
  logButton: {
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 15,
  },
  weightHistory: { marginTop: 12 },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histDate: { fontSize: 13 },
  histValue: { fontSize: 13, fontWeight: '600' },
});
