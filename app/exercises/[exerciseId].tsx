import exerciseImageMap from '@/assets/data/exerciseImageMap';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import {
  ExerciseDetail,
  ExercisePR,
  ExerciseProgressPoint,
  addSetToWorkout,
  getActiveWorkout,
  getExerciseById,
  getExercisePR,
  getExerciseProgressHistory,
  initDatabase,
} from '@/services/DatabaseService';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

const P_W = 320;
const P_H = 100;
const PP = { top: 10, right: 12, bottom: 24, left: 38 };
const PL_W = P_W - PP.left - PP.right;
const PL_H = P_H - PP.top - PP.bottom;

function ProgressChart({ data, colors }: { data: ExerciseProgressPoint[]; colors: any }) {
  const values = data.map(d => d.maxWeight);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const toX = (i: number) => PP.left + (i / (data.length - 1)) * PL_W;
  const toY = (v: number) => PP.top + PL_H - ((v - min) / range) * PL_H;
  const polyPoints = data.map((d, i) => `${toX(i)},${toY(d.maxWeight)}`).join(' ');

  const labelIdx = data.length <= 4
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <Svg width="100%" height={P_H} viewBox={`0 0 ${P_W} ${P_H}`}>
      {[0, 0.5, 1].map((t, i) => (
        <Line key={i} x1={PP.left} y1={PP.top + t * PL_H} x2={P_W - PP.right} y2={PP.top + t * PL_H}
          stroke={colors.activity} strokeWidth={1} />
      ))}
      {[0, 0.5, 1].map((t, i) => (
        <SvgText key={i} x={PP.left - 4} y={PP.top + t * PL_H + 4} fontSize={9}
          fill={colors.icon} textAnchor="end">
          {(max - t * range).toFixed(1)}
        </SvgText>
      ))}
      <Polyline points={polyPoints} fill="none" stroke={colors.tint}
        strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.maxWeight)} r={3} fill={colors.tint} />
      ))}
      {labelIdx.map(i => (
        <SvgText key={i} x={toX(i)} y={P_H - 2} fontSize={9}
          fill={colors.icon} textAnchor="middle">
          {new Date(data[i].date).toLocaleDateString('fr', { day: 'numeric', month: 'short' })}
        </SvgText>
      ))}
    </Svg>
  );
}

export default function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = useColors();

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [pr, setPr] = useState<ExercisePR>(null);
  const [progress, setProgress] = useState<ExerciseProgressPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!exerciseId) return;
    const load = async () => {
      try {
        await initDatabase();
        const ex = await getExerciseById(exerciseId);
        const record = await getExercisePR(exerciseId);
        const hist = await getExerciseProgressHistory(exerciseId);
        const workout = await getActiveWorkout();
        setExercise(ex);
        setPr(record);
        setProgress(hist);
        setActiveWorkout(workout);
      } catch (e) {
        console.error('[exerciseId] load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [exerciseId]);

  const handleAddToWorkout = async () => {
    if (!activeWorkout || !exerciseId) return;
    await addSetToWorkout(activeWorkout.id, exerciseId);
    router.back();
  };

  const imgSource = exercise?.image ? exerciseImageMap[exercise.image] : undefined;

  const instructions = exercise?.instructions
    ? exercise.instructions.split('\n').filter(l => l.trim().length > 0)
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading || !exercise ? (
        <View style={styles.center}>
          <Text style={{ color: colors.icon }}>Chargement…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Image */}
          {imgSource ? (
            <Image source={imgSource} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback, { backgroundColor: colors.card }]}>
              <IconSymbol name="dumbbell.fill" size={48} color={colors.icon} />
            </View>
          )}

          {/* Name + badges */}
          <View style={styles.titleBlock}>
            <Text style={[styles.name, { color: colors.text }]}>{exercise.name}</Text>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: colors.card }]}>
                <Text style={[styles.badgeText, { color: colors.tint }]}>{exercise.muscle}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.card }]}>
                <Text style={[styles.badgeText, { color: colors.icon }]}>{exercise.equipment}</Text>
              </View>
            </View>
          </View>

          {/* PR */}
          <View style={[styles.prCard, { backgroundColor: colors.card }]}>
            <View style={styles.prRow}>
              <IconSymbol name="trophy.fill" size={18} color="#FFD700" />
              <Text style={[styles.prLabel, { color: colors.icon }]}>Record personnel</Text>
            </View>
            {pr ? (
              <Text style={[styles.prValue, { color: colors.text }]}>
                {pr.maxWeight} kg
                {pr.reps ? ` × ${pr.reps} reps` : ''}
              </Text>
            ) : (
              <Text style={[styles.prEmpty, { color: colors.icon }]}>Aucun record — complète des sets pour commencer</Text>
            )}
          </View>

          {/* Description */}
          {exercise.description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.icon }]}>Description</Text>
              <Text style={[styles.sectionBody, { color: colors.text }]}>{exercise.description}</Text>
            </View>
          ) : null}

          {/* Instructions */}
          {instructions.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.icon }]}>Instructions</Text>
              {instructions.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: colors.card }]}>
                    <Text style={[styles.stepNumText, { color: colors.tint }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.text }]}>{step.trim()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Progression — SVG non supporté sur web */}
          {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.icon }]}>Progression</Text>
            {progress.length >= 2 ? (
              <ProgressChart data={progress} colors={colors} />
            ) : (
              <Text style={[styles.sectionBody, { color: colors.icon, fontSize: 13 }]}>
                Pas encore assez de données — complète des sets pour voir ta progression.
              </Text>
            )}
          </View>
          )}

          {activeWorkout && (
            <View style={styles.addToWorkoutContainer}>
              <TouchableOpacity
                style={[styles.addToWorkoutBtn, { backgroundColor: colors.tint }]}
                onPress={handleAddToWorkout}
              >
                <IconSymbol name="plus.circle" size={20} color="#0F172A" />
                <Text style={styles.addToWorkoutText}>Ajouter à la séance en cours</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { padding: 4, alignSelf: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: { paddingBottom: 24 },

  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 0,
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  prCard: {
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  prValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  prEmpty: {
    fontSize: 14,
    lineHeight: 20,
  },

  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 22,
  },

  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },

  addToWorkoutContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  addToWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    minHeight: 52,
  },
  addToWorkoutText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
