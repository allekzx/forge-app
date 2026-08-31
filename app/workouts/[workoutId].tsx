import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { RestTimer } from '@/components/workout/RestTimer';

// Conditional require : éliminé du bundle web par Metro au build time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications = Platform.OS !== 'web' ? (require('expo-notifications') as typeof import('expo-notifications')) : null;

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import {
  LastSetData,
  WorkoutSessionDetail,
  WorkoutSetRow,
  WorkoutSummaryData,
  addSetToWorkout,
  deleteWorkoutSet,
  finishWorkout,
  getLastSessionWeightsForExercises,
  getPRForExercise,
  getWorkoutSessionDetail,
  getWorkoutSummary,
  getUserSetting,
  initDatabase,
  removeExerciseFromWorkout,
  updateTemplateFromWorkout,
  updateWorkoutExerciseOrder,
  updateWorkoutNotes,
  updateWorkoutSet,
} from '@/services/DatabaseService';
import { WeightUnit, kgToDisplay, displayToKg } from '@/constants/units';
import { SET_TYPE_LABELS, translateEquipment, translateMuscle } from '@/constants/translations';
import { PRBadge } from '@/components/workout/PRBadge';

type GroupedExercise = {
  exerciseId: string;
  name: string;
  muscle: string;
  equipment: string;
  supersetGroupId: string | null;
  sets: WorkoutSetRow[];
};

type PendingSetValue = { weight: string; reps: string };

function buildPendingValues(
  sets: WorkoutSetRow[],
  unit: WeightUnit = 'kg',
  prevSets?: Map<string, Map<number, LastSetData>>
): Map<string, PendingSetValue> {
  const map = new Map<string, PendingSetValue>();
  for (const s of sets) {
    const prev = prevSets?.get(s.exercise_id)?.get(s.set_index);
    // Priority: actual (this session) > prev session > template target
    let kgVal: number | null = null;
    if (s.actual_weight != null) {
      kgVal = s.actual_weight;
    } else if (prev?.weight != null && prev.weight > 0) {
      kgVal = prev.weight;
    } else if (s.target_weight != null && s.target_weight > 0) {
      kgVal = s.target_weight;
    }
    let repVal: number | null = null;
    if (s.actual_reps != null) {
      repVal = s.actual_reps;
    } else if (prev?.reps != null) {
      repVal = prev.reps;
    } else if (s.target_reps) {
      repVal = s.target_reps;
    }
    map.set(s.id, {
      weight: kgVal != null ? kgToDisplay(kgVal, unit) : '',
      reps: repVal != null ? String(repVal) : '',
    });
  }
  return map;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutInProgressScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const router = useRouter();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const colorScheme = useColorScheme();
  const colors = useColors();

  const [session, setSession] = useState<WorkoutSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRest, setActiveRest] = useState<{
    setId: string;
    exerciseId: string;
    initialDuration: number;
  } | null>(null);
  const [pendingValues, setPendingValues] = useState<Map<string, PendingSetValue>>(new Map());
  const [prevSets, setPrevSets] = useState<Map<string, Map<number, LastSetData>>>(new Map());
  const [restOverrides, setRestOverrides] = useState<Map<string, number>>(new Map());
  const [restHeaderEdit, setRestHeaderEdit] = useState<{ exerciseId: string; value: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const isFinished = !!session?.finished_at;

  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<WorkoutSummaryData | null>(null);
  const [exercisesToRemove, setExercisesToRemove] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [exercisePRs, setExercisePRs] = useState<Map<string, number | null>>(new Map());
  const [newPRSetId, setNewPRSetId] = useState<string | null>(null);
  const [liveSetTypePicker, setLiveSetTypePicker] = useState<{ setId: string; currentType: string } | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [exerciseOrder, setExerciseOrder] = useState<string[] | null>(null);

  // Intercepte le retour arrière pour protéger la séance en cours
  useEffect(() => {
    if (isFinished) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      const hasCompletedSets = session?.sets.some(s => s.completed_at !== null);
      e.preventDefault();
      if (!hasCompletedSets) {
        Alert.alert(
          'Annuler la séance ?',
          'Aucun set complété. Veux-tu annuler cette séance ?',
          [
            { text: 'Continuer', style: 'cancel' },
            { text: 'Abandonner', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
          ]
        );
      } else {
        Alert.alert(
          'Mettre en pause ?',
          "Ta séance sera sauvegardée. Tu pourras la reprendre depuis l'accueil.",
          [
            { text: 'Continuer la séance', style: 'cancel' },
            { text: 'Mettre en pause', onPress: () => navigation.dispatch(e.data.action) },
          ]
        );
      }
    });
    return unsubscribe;
  }, [navigation, session, isFinished]);

  // Workout duration timer
  useEffect(() => {
    if (isFinished) return;
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isFinished]);

  // Demande permission notifications une seule fois par séance active (native uniquement)
  useEffect(() => {
    Notifications?.requestPermissionsAsync().catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!workoutId || typeof workoutId !== 'string') return;
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          await initDatabase();
          const detail = await getWorkoutSessionDetail(workoutId);
          if (!detail) { if (!cancelled) setLoading(false); return; }
          if (cancelled) return;
          setSession(detail);
          if (detail?.created_at && !detail.finished_at) {
            startTimeRef.current = new Date(detail.created_at).getTime();
            setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
          }
          const unit = await getUserSetting('weight_unit', 'kg');
          if (!cancelled) setWeightUnit(unit as WeightUnit);

          // Load prev session weights before building pending values so inputs are pre-filled
          let prevSessionData = new Map<string, Map<number, LastSetData>>();
          if (!detail.finished_at) {
            const exerciseIds = [...new Set(detail.sets.map(s => s.exercise_id))];
            if (exerciseIds.length) {
              prevSessionData = await getLastSessionWeightsForExercises(exerciseIds, workoutId);
              if (!cancelled) setPrevSets(prevSessionData);
              const prMap = new Map<string, number | null>();
              for (const exId of exerciseIds) {
                prMap.set(exId, await getPRForExercise(exId, workoutId));
              }
              if (!cancelled) setExercisePRs(prMap);
            }
          }

          if (!cancelled) {
            setPendingValues(buildPendingValues(detail.sets, unit as WeightUnit, prevSessionData));
            setNotes(detail.notes ?? '');
          }
        } catch (e) {
          console.error('[workoutId] load error:', e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [workoutId])
  );

  const grouped = useMemo<GroupedExercise[]>(() => {
    if (!session) return [];
    const map = new Map<string, GroupedExercise>();
    for (const s of session.sets) {
      if (!map.has(s.exercise_id)) {
        map.set(s.exercise_id, {
          exerciseId: s.exercise_id,
          name: s.name,
          muscle: s.muscle,
          equipment: s.equipment,
          supersetGroupId: s.superset_group_id,
          sets: [],
        });
      }
      map.get(s.exercise_id)!.sets.push(s);
    }
    const items = Array.from(map.values());
    if (exerciseOrder) {
      const orderMap = new Map(exerciseOrder.map((id, i) => [id, i]));
      items.sort((a, b) => (orderMap.get(a.exerciseId) ?? 999) - (orderMap.get(b.exerciseId) ?? 999));
    }
    return items;
  }, [session, exerciseOrder]);

  const completedSets = session?.sets.filter(s => !!s.completed_at).length ?? 0;
  const totalSets = session?.sets.length ?? 0;

  const handleUpdateSet = async (
    set: WorkoutSetRow,
    field: 'actual_reps' | 'actual_weight' | 'toggleComplete',
    value?: string
  ) => {
    const payload: { actual_reps?: number; actual_weight?: number; toggleComplete?: boolean } = {};
    if (field === 'actual_reps' && value != null) {
      const n = parseInt(value, 10);
      if (Number.isNaN(n) || n < 0) return;
      payload.actual_reps = n;
    }
    if (field === 'actual_weight' && value != null) {
      const n = displayToKg(value, weightUnit);
      if (Number.isNaN(n) || n < 0) return;
      payload.actual_weight = n;
    }
    if (field === 'toggleComplete') {
      payload.toggleComplete = true;
    }

    await updateWorkoutSet(set.id, payload);

    setSession(prev =>
      prev
        ? {
            ...prev,
            sets: prev.sets.map(s =>
              s.id === set.id
                ? {
                    ...s,
                    actual_reps: payload.actual_reps !== undefined ? payload.actual_reps : s.actual_reps,
                    actual_weight: payload.actual_weight !== undefined ? payload.actual_weight : s.actual_weight,
                    completed_at: payload.toggleComplete
                      ? s.completed_at ? null : new Date().toISOString()
                      : s.completed_at,
                  }
                : s
            ),
          }
        : prev
    );

    if (field === 'toggleComplete' && !set.completed_at) {
      const rest = restOverrides.get(set.exercise_id) ?? set.rest_seconds ?? 0;
      if (rest > 0) {
        setActiveRest({ setId: set.id, exerciseId: set.exercise_id, initialDuration: rest });
      }
      // Check for PR
      const currentWeight = pendingValues.get(set.id)?.weight
        ? displayToKg(pendingValues.get(set.id)!.weight, weightUnit)
        : (set.actual_weight ?? 0);
      const pr = exercisePRs.get(set.exercise_id);
      if (currentWeight > 0 && (pr == null || currentWeight > pr)) {
        setNewPRSetId(set.id);
        setTimeout(() => setNewPRSetId(null), 3500);
        setExercisePRs(prev => new Map(prev).set(set.exercise_id, currentWeight));
      }
    }
  };

  const handleDeleteSet = async (set: WorkoutSetRow) => {
    Alert.alert('Supprimer le set ?', `Retirer le set ${set.set_index} de ${set.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkoutSet(set.id);
          setSession(prev =>
            prev ? { ...prev, sets: prev.sets.filter(s => s.id !== set.id) } : prev
          );
          setPendingValues(prev => { const next = new Map(prev); next.delete(set.id); return next; });
        },
      },
    ]);
  };

  const handleFinish = async () => {
    if (!workoutId || typeof workoutId !== 'string') return;
    Keyboard.dismiss();
    // Flush any pending values not yet persisted via onEndEditing
    if (session) {
      // Flush séquentiel : évite la concurrence sur le worker SQLite WASM
      for (const s of session.sets) {
        const pending = pendingValues.get(s.id);
        if (!pending) continue;
        const pWeight = displayToKg(pending.weight, weightUnit);
        const pReps = parseInt(pending.reps, 10);
        const payload: { actual_weight?: number; actual_reps?: number } = {};
        if (!isNaN(pWeight) && pWeight >= 0 && pWeight !== s.actual_weight) payload.actual_weight = pWeight;
        if (!isNaN(pReps) && pReps >= 0 && pReps !== s.actual_reps) payload.actual_reps = pReps;
        if (Object.keys(payload).length) await updateWorkoutSet(s.id, payload);
      }
    }
    await finishWorkout(workoutId);
    setSession(prev => prev ? { ...prev, finished_at: new Date().toISOString() } : prev);
    const summary = await getWorkoutSummary(workoutId);
    setSummaryData(summary);
    if (summary?.templateId) {
      await updateTemplateFromWorkout(workoutId, summary.templateId);
    }
    setExercisesToRemove(new Set());
    setShowSummary(true);
  };

  const handleSummaryDone = async () => {
    for (const exerciseId of exercisesToRemove) {
      await removeExerciseFromWorkout(workoutId as string, exerciseId);
    }
    router.replace({ pathname: '/(tabs)/workout' });
  };

  const handleAddSet = async (exerciseId: string) => {
    if (!workoutId || typeof workoutId !== 'string') return;
    const newSet = await addSetToWorkout(workoutId, exerciseId);
    if (!newSet) return;
    setSession(prev => prev ? { ...prev, sets: [...prev.sets, newSet] } : prev);
    setPendingValues(prev => {
      const next = new Map(prev);
      next.set(newSet.id, {
        weight: newSet.target_weight > 0 ? kgToDisplay(newSet.target_weight, weightUnit) : '',
        reps: newSet.target_reps > 0 ? String(newSet.target_reps) : '',
      });
      return next;
    });
  };

  const handleToggleSetType = async (set: WorkoutSetRow) => {
    if (isFinished) return;
    const cycle: Record<string, string> = { normal: 'warmup', warmup: 'dropset', dropset: 'failure', failure: 'normal' };
    const newType = cycle[set.set_type ?? 'normal'] ?? 'normal';
    await updateWorkoutSet(set.id, { set_type: newType });
    setSession(prev =>
      prev ? { ...prev, sets: prev.sets.map(s => s.id === set.id ? { ...s, set_type: newType } : s) } : prev
    );
  };

  const handleRestFinish = useCallback(() => setActiveRest(null), []);
  const handleRestSkip  = useCallback(() => setActiveRest(null), []);
  const handleRestAdjust = useCallback((newTotal: number) => {
    setActiveRest(prev => {
      if (prev) setRestOverrides(r => new Map(r).set(prev.exerciseId, newTotal));
      return prev;
    });
  }, []);

  const enterReorderMode = () => {
    setExerciseOrder(grouped.map(g => g.exerciseId));
    setReorderMode(true);
  };

  const exitReorderMode = async () => {
    if (exerciseOrder && workoutId && typeof workoutId === 'string') {
      await updateWorkoutExerciseOrder(workoutId, exerciseOrder);
    }
    setReorderMode(false);
  };

  const handleMoveExercise = (exerciseId: string, direction: 'up' | 'down') => {
    setExerciseOrder(prev => {
      if (!prev) return prev;
      const idx = prev.indexOf(exerciseId);
      if (idx === -1) return prev;
      const next = [...prev];
      if (direction === 'up' && idx > 0) {
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      } else if (direction === 'down' && idx < next.length - 1) {
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      }
      return next;
    });
  };

  const confirmRestHeaderEdit = async (exerciseId: string) => {
    if (!restHeaderEdit) return;
    const val = parseInt(restHeaderEdit.value, 10);
    if (!isNaN(val)) {
      const clamped = Math.min(600, Math.max(5, val));
      setRestOverrides(prev => new Map(prev).set(exerciseId, clamped));
      setSession(prev =>
        prev ? { ...prev, sets: prev.sets.map(s => s.exercise_id === exerciseId ? { ...s, rest_seconds: clamped } : s) } : prev
      );
      const setsToUpdate = session?.sets.filter(s => s.exercise_id === exerciseId) ?? [];
      for (const s of setsToUpdate) {
        await updateWorkoutSet(s.id, { rest_seconds: clamped });
      }
    }
    setRestHeaderEdit(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ThemedView style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          {reorderMode ? (
            <TouchableOpacity onPress={exitReorderMode} style={styles.backBtn}>
              <Text style={[styles.reorderDoneText, { color: colors.tint }]}>Terminé</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <IconSymbol name="chevron.down" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <View style={styles.headerCenter}>
            <ThemedText type="defaultSemiBold" style={styles.headerTitle} numberOfLines={1}>
              {reorderMode ? 'Réorganiser' : (session?.name ?? 'Séance')}
            </ThemedText>
            {!isFinished && !reorderMode && (
              <Text style={[styles.timerText, { color: colors.tint }]}>
                {formatDuration(elapsedSeconds)}
              </Text>
            )}
            {reorderMode && (
              <Text style={[styles.timerText, { color: colors.icon }]}>Glisse ↑↓ pour réordonner</Text>
            )}
          </View>
          {!isFinished && !reorderMode && grouped.length >= 2 ? (
            <TouchableOpacity onPress={enterReorderMode} style={styles.reorderBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <IconSymbol name="list.bullet" size={20} color={colors.icon} />
            </TouchableOpacity>
          ) : (
            <View style={styles.progressPill}>
              {!reorderMode && (
                <Text style={[styles.progressText, { color: colors.icon }]}>
                  {completedSets}/{totalSets}
                </Text>
              )}
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ThemedText>Chargement…</ThemedText>
          </View>
        )}

        {!loading && session && (
          <>
            {grouped.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol name="dumbbell.fill" size={48} color={colors.icon} />
                <ThemedText style={styles.emptyTitle}>Séance vide</ThemedText>
                {!isFinished && (
                  <TouchableOpacity
                    style={[styles.addExerciseButton, { backgroundColor: colors.tint }]}
                    onPress={() =>
                      router.push({ pathname: '/workouts/exercise-picker', params: { workoutId } })
                    }
                  >
                    <IconSymbol name="plus" size={18} color="#0F172A" />
                    <Text style={styles.addExerciseButtonText}>Ajouter un exercice</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={grouped}
                keyExtractor={item => item.exerciseId}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  <View style={styles.footerContainer}>
                    {!isFinished && (
                      <TouchableOpacity
                        style={[styles.addExerciseButton, { backgroundColor: colors.tint, marginTop: 4 }]}
                        onPress={() =>
                          router.push({ pathname: '/workouts/exercise-picker', params: { workoutId } })
                        }
                      >
                        <IconSymbol name="plus" size={18} color="#0F172A" />
                        <Text style={styles.addExerciseButtonText}>Ajouter un exercice</Text>
                      </TouchableOpacity>
                    )}

                    {/* Notes de séance */}
                    <View style={[styles.notesCard, { backgroundColor: colors.card }]}>
                      <TouchableOpacity
                        style={styles.notesHeader}
                        onPress={() => setNotesExpanded(v => !v)}
                        disabled={isFinished && !notes}
                      >
                        <IconSymbol name="pencil" size={14} color={colors.icon} />
                        <Text style={[styles.notesLabel, { color: notes ? colors.text : colors.icon }]}>
                          {notes ? 'Notes' : 'Ajouter une note…'}
                        </Text>
                        {!isFinished && (
                          <IconSymbol
                            name={notesExpanded ? 'chevron.left' : 'chevron.right'}
                            size={14}
                            color={colors.icon}
                          />
                        )}
                      </TouchableOpacity>
                      {!!(notesExpanded || (isFinished && notes)) && (
                        isFinished ? (
                          <Text style={[styles.notesReadOnly, { color: colors.text }]}>{notes}</Text>
                        ) : (
                          <TextInput
                            style={[styles.notesInput, { color: colors.text }]}
                            multiline
                            value={notes}
                            onChangeText={setNotes}
                            onBlur={() => {
                              if (workoutId && typeof workoutId === 'string') {
                                updateWorkoutNotes(workoutId, notes).catch(() => {});
                              }
                            }}
                            placeholder="Ressenti, conditions, objectifs…"
                            placeholderTextColor={colors.icon}
                            textAlignVertical="top"
                          />
                        )
                      )}
                    </View>
                  </View>
                }
                renderItem={({ item, index }) => {
                  const isInSuperset = !!item.supersetGroupId;
                  const linkedWithNext = isInSuperset && grouped[index + 1]?.supersetGroupId === item.supersetGroupId;
                  return (
                  <View style={[
                    styles.exerciseCard,
                    { backgroundColor: colors.card },
                    reorderMode && { borderWidth: 1, borderColor: colors.tint + '40' },
                    isInSuperset && { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
                  ]}>
                    {isInSuperset && (
                      <View style={[styles.supersetBadge, { backgroundColor: '#F59E0B20' }]}>
                        <IconSymbol name="link" size={11} color="#F59E0B" />
                        <Text style={[styles.supersetBadgeText, { color: '#F59E0B' }]}>
                          {linkedWithNext ? `SUPERSET — enchaîne avec ${grouped[index + 1].name}` : 'SUPERSET'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.exerciseCardHeader}>
                      {reorderMode && (
                        <IconSymbol name="line.3.horizontal" size={18} color={colors.icon} style={{ marginRight: 8, opacity: 0.5 }} />
                      )}
                      <View style={styles.exerciseTitleGroup}>
                        <ThemedText type="defaultSemiBold" style={styles.exerciseName}>
                          {item.name}
                        </ThemedText>
                        <ThemedText style={styles.exerciseMeta}>
                          {`${translateMuscle(item.muscle)} · ${translateEquipment(item.equipment)}`}
                        </ThemedText>
                      </View>
                      {reorderMode ? (
                        <View style={styles.reorderArrows}>
                          <TouchableOpacity
                            style={[styles.reorderArrowBtn, { backgroundColor: colors.background }]}
                            onPress={() => handleMoveExercise(item.exerciseId, 'up')}
                            disabled={grouped.indexOf(item) === 0}
                          >
                            <IconSymbol name="chevron.up" size={16} color={grouped.indexOf(item) === 0 ? colors.icon + '40' : colors.text} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.reorderArrowBtn, { backgroundColor: colors.background }]}
                            onPress={() => handleMoveExercise(item.exerciseId, 'down')}
                            disabled={grouped.indexOf(item) === grouped.length - 1}
                          >
                            <IconSymbol name="chevron.down" size={16} color={grouped.indexOf(item) === grouped.length - 1 ? colors.icon + '40' : colors.text} />
                          </TouchableOpacity>
                        </View>
                      ) : !isFinished && (
                        <TouchableOpacity
                          style={styles.restHeaderRow}
                          onPress={() => {
                            const current = restOverrides.get(item.exerciseId) ?? item.sets[0]?.rest_seconds ?? 90;
                            setRestHeaderEdit({ exerciseId: item.exerciseId, value: String(current) });
                          }}
                        >
                          <IconSymbol name="timer" size={13} color={colors.icon} />
                          {restHeaderEdit?.exerciseId === item.exerciseId ? (
                            <TextInput
                              style={[styles.restHeaderInput, { color: colors.tint }]}
                              keyboardType="number-pad"
                              value={restHeaderEdit.value}
                              onChangeText={v => setRestHeaderEdit(prev => prev ? { ...prev, value: v } : prev)}
                              onSubmitEditing={() => confirmRestHeaderEdit(item.exerciseId)}
                              onBlur={() => confirmRestHeaderEdit(item.exerciseId)}
                              autoFocus
                              maxLength={3}
                              selectTextOnFocus
                            />
                          ) : (
                            <Text style={[styles.restHeaderLabel, { color: colors.icon }]}>
                              {formatDuration(restOverrides.get(item.exerciseId) ?? item.sets[0]?.rest_seconds ?? 90)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Set summary in reorder mode — no interaction */}
                    {reorderMode && (
                      <Text style={[styles.reorderSetSummary, { color: colors.icon }]}>
                        {item.sets.length} set{item.sets.length > 1 ? 's' : ''}
                        {' · '}{item.sets.filter(s => s.completed_at).length} complété{item.sets.filter(s => s.completed_at).length > 1 ? 's' : ''}
                      </Text>
                    )}

                    {/* Sets — masqués en mode réorganisation */}
                    {!reorderMode && <>
                    <View style={styles.setHeaderRow}>
                      <Text style={[styles.setHeaderCell, { color: colors.icon, width: 44 }]}>SET</Text>
                      <Text style={[styles.setHeaderCell, { color: colors.icon, flex: 1 }]}>{`POIDS (${weightUnit})`}</Text>
                      <Text style={[styles.setHeaderCell, { color: colors.icon, flex: 1 }]}>REPS</Text>
                      <View style={{ width: 88 }} />
                    </View>

                    {item.sets.map((set) => {
                      const isCompleted = !!set.completed_at;
                      const showRestTimer = activeRest?.setId === set.id;
                      return (
                        <Fragment key={set.id}>
                          <View
                            style={[
                              styles.setRow,
                              isCompleted && { backgroundColor: colors.success + '0D', borderRadius: 8 },
                            ]}
                          >
                            <TouchableOpacity
                              style={[styles.setIndexCell, { width: 44 }]}
                              onPress={() => !isFinished && setLiveSetTypePicker({ setId: set.id, currentType: set.set_type ?? 'normal' })}
                              onLongPress={() => handleDeleteSet(set)}
                              delayLongPress={500}
                            >
                              <Text style={[styles.setIndexNum, { color: isCompleted ? colors.success : colors.icon }]}>
                                {set.set_index}
                              </Text>
                              {(() => {
                                const t = set.set_type ?? 'normal';
                                const abbrev: Record<string, string> = { normal: 'N', warmup: 'E', dropset: 'D', failure: 'F' };
                                const tColor: Record<string, string> = { normal: colors.icon, warmup: '#FF9500', dropset: '#007AFF', failure: '#FF3B30' };
                                if (t === 'normal' && !isFinished) return null;
                                return (
                                  <View style={[styles.setTypePill, { backgroundColor: tColor[t] ?? colors.icon }]}>
                                    <Text style={styles.setTypePillText}>{abbrev[t] ?? 'N'}</Text>
                                  </View>
                                );
                              })()}
                            </TouchableOpacity>

                            {(() => {
                              const prev = prevSets.get(set.exercise_id)?.get(set.set_index);
                              const inputBg = isCompleted ? 'transparent' : colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                              const weightVal = pendingValues.get(set.id)?.weight ?? (set.actual_weight != null ? String(set.actual_weight) : '');
                              const repsVal = pendingValues.get(set.id)?.reps ?? (set.actual_reps != null ? String(set.actual_reps) : '');
                              return (
                                <>
                                  <View style={styles.setInputCol}>
                                    {isFinished ? (
                                      <View style={[styles.setInput, { backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Text style={[styles.setInputReadOnly, { color: colors.text }]}>
                                          {weightVal || (set.target_weight ? String(set.target_weight) : '—')}
                                        </Text>
                                      </View>
                                    ) : (
                                      <TextInput
                                        style={[styles.setInput, { backgroundColor: inputBg, color: colors.text, opacity: isCompleted ? 0.6 : 1 }]}
                                        keyboardType="decimal-pad"
                                        placeholder={set.target_weight ? String(set.target_weight) : '0'}
                                        placeholderTextColor={colors.icon}
                                        value={weightVal}
                                        selectTextOnFocus
                                        onChangeText={v => setPendingValues(prev => {
                                          const next = new Map(prev);
                                          const cur = next.get(set.id) ?? { weight: '', reps: '' };
                                          next.set(set.id, { ...cur, weight: v });
                                          return next;
                                        })}
                                        onEndEditing={e => handleUpdateSet(set, 'actual_weight', e.nativeEvent.text)}
                                      />
                                    )}
                                    {prev?.weight != null && (
                                      <Text style={[styles.prevHint, { color: colors.icon }]}>{`↑ ${kgToDisplay(prev.weight, weightUnit)}`}</Text>
                                    )}
                                  </View>

                                  <View style={styles.setInputCol}>
                                    {isFinished ? (
                                      <View style={[styles.setInput, { backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Text style={[styles.setInputReadOnly, { color: colors.text }]}>
                                          {repsVal || String(set.target_reps)}
                                        </Text>
                                      </View>
                                    ) : (
                                      <TextInput
                                        style={[styles.setInput, { backgroundColor: inputBg, color: colors.text, opacity: isCompleted ? 0.6 : 1 }]}
                                        keyboardType="number-pad"
                                        placeholder={String(set.target_reps)}
                                        placeholderTextColor={colors.icon}
                                        value={repsVal}
                                        selectTextOnFocus
                                        onChangeText={v => setPendingValues(prev => {
                                          const next = new Map(prev);
                                          const cur = next.get(set.id) ?? { weight: '', reps: '' };
                                          next.set(set.id, { ...cur, reps: v });
                                          return next;
                                        })}
                                        onEndEditing={e => handleUpdateSet(set, 'actual_reps', e.nativeEvent.text)}
                                      />
                                    )}
                                    {prev?.reps != null && (
                                      <Text style={[styles.prevHint, { color: colors.icon }]}>{`↑ ${prev.reps}`}</Text>
                                    )}
                                  </View>
                                </>
                              );
                            })()}

                            <TouchableOpacity
                              style={[
                                styles.doneButton,
                                {
                                  backgroundColor: isCompleted ? colors.tint : 'transparent',
                                  borderColor: isCompleted ? colors.tint : colors.icon,
                                },
                              ]}
                              onPress={() => handleUpdateSet(set, 'toggleComplete')}
                            >
                              <IconSymbol
                                name={isCompleted ? 'checkmark' : 'checkmark'}
                                size={14}
                                color={isCompleted ? '#0F172A' : colors.icon}
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.trashButton, isCompleted && { opacity: 0 }]}
                              onPress={() => handleDeleteSet(set)}
                              disabled={isCompleted}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                            >
                              <IconSymbol name="trash" size={16} color={colors.icon} />
                            </TouchableOpacity>
                          </View>

                          {newPRSetId === set.id && (
                            <PRBadge
                              visible={newPRSetId === set.id}
                              weight={displayToKg(pendingValues.get(set.id)?.weight ?? String(set.actual_weight ?? 0), weightUnit)}
                              unit={weightUnit}
                            />
                          )}

                          {showRestTimer && activeRest && (
                            <RestTimer
                              initialDuration={activeRest.initialDuration}
                              onFinish={handleRestFinish}
                              onSkip={handleRestSkip}
                              onAdjust={handleRestAdjust}
                            />
                          )}
                        </Fragment>
                      );
                    })}

                    {!isFinished && (
                      <TouchableOpacity
                        style={[styles.addSetButton, { borderColor: colors.tint }]}
                        onPress={() => handleAddSet(item.exerciseId)}
                      >
                        <IconSymbol name="plus" size={14} color={colors.tint} />
                        <Text style={[styles.addSetText, { color: colors.tint }]}>+ Set</Text>
                      </TouchableOpacity>
                    )}
                    </>}
                  </View>
                  );
                }}
              />
            )}

            {!isFinished && !reorderMode && (
              <TouchableOpacity
                style={[styles.finishButton, { backgroundColor: colors.tint }]}
                onPress={handleFinish}
              >
                <IconSymbol name="checkmark.circle.fill" size={20} color="#0F172A" />
                <Text style={styles.finishText}>Terminer la séance</Text>
              </TouchableOpacity>
            )}

            {isFinished && (
              <View style={[styles.finishedBanner, { backgroundColor: colors.card }]}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                <Text style={[styles.finishedText, { color: colors.success }]}>Séance terminée !</Text>
              </View>
            )}

            {/* Barre d'onglets compacte — accessible même en fullScreenModal */}
            {!isFinished && !reorderMode && (
              <View style={[styles.miniTabBar, { backgroundColor: colors.card }]}>
                {(
                  [
                    { icon: 'house.fill' as const, label: 'Accueil', route: '/(tabs)/' },
                    { icon: 'dumbbell.fill' as const, label: 'Séances', route: '/(tabs)/workout' },
                    { icon: 'list.bullet' as const, label: 'Exercices', route: '/(tabs)/exercises' },
                    { icon: 'clock.fill' as const, label: 'Historique', route: '/(tabs)/history' },
                    { icon: 'chart.bar.fill' as const, label: 'Progression', route: '/(tabs)/stats' },
                  ] as const
                ).map((tab) => (
                  <TouchableOpacity
                    key={tab.route}
                    style={styles.miniTabItem}
                    onPress={() => router.replace(tab.route as any)}
                    activeOpacity={0.7}
                  >
                    <IconSymbol name={tab.icon} size={20} color={colors.icon} />
                    <Text style={[styles.miniTabLabel, { color: colors.icon }]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ThemedView>

      {/* ── Set Type Picker Modal ── */}
      {liveSetTypePicker && (
        <Modal visible animationType="fade" transparent>
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setLiveSetTypePicker(null)}
          >
            <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Type de set</Text>
              {([
                { key: 'normal',  label: 'Normal',        color: colors.icon },
                { key: 'warmup',  label: 'Échauffement',  color: '#FF9500' },
                { key: 'dropset', label: 'Drop Set',       color: '#007AFF' },
                { key: 'failure', label: 'Échec',          color: '#FF3B30' },
              ] as const).map(({ key, label, color }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.pickerOption, liveSetTypePicker.currentType === key && { backgroundColor: color + '22' }]}
                  onPress={async () => {
                    await updateWorkoutSet(liveSetTypePicker.setId, { set_type: key });
                    setSession(prev =>
                      prev ? { ...prev, sets: prev.sets.map(s => s.id === liveSetTypePicker.setId ? { ...s, set_type: key } : s) } : prev
                    );
                    setLiveSetTypePicker(null);
                  }}
                >
                  <View style={[styles.pickerDot, { backgroundColor: color }]} />
                  <Text style={[styles.pickerOptionText, { color: colors.text }]}>{label}</Text>
                  {liveSetTypePicker.currentType === key && (
                    <IconSymbol name="checkmark" size={16} color={color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Workout Summary Modal ── */}
      {/* Guard : react-native-web rend les enfants du Modal même quand visible=false via un portal.
          Le rendu de <Text>{undefined}</Text> (summaryData null) crashe sur web avec React 19.
          En conditionnant le montage sur showSummary, on évite tout rendu anticipé. */}
      {showSummary && <Modal visible={showSummary} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.summaryHeader}>
              <IconSymbol name="checkmark.circle.fill" size={56} color={colors.success} />
              <Text style={[styles.summaryTitle, { color: colors.text }]}>Séance terminée !</Text>
              <Text style={[styles.summaryWorkoutName, { color: colors.icon }]}>{summaryData?.name}</Text>
            </View>

            {/* Stats */}
            {summaryData && (
              <View style={styles.summaryStats}>
                <View style={[styles.statPill, { backgroundColor: colors.card }]}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{formatDuration(summaryData.durationSeconds)}</Text>
                  <Text style={[styles.statLabel, { color: colors.icon }]}>Durée</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: colors.card }]}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{`${kgToDisplay(summaryData.totalVolume, weightUnit)} ${weightUnit}`}</Text>
                  <Text style={[styles.statLabel, { color: colors.icon }]}>Volume</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: colors.card }]}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{`${summaryData.completedSets}/${summaryData.totalSets}`}</Text>
                  <Text style={[styles.statLabel, { color: colors.icon }]}>Sets</Text>
                </View>
              </View>
            )}

            {/* Exercise list */}
            {summaryData && summaryData.exercises.length > 0 && (
              <View style={[styles.summaryExList, { backgroundColor: colors.card }]}>
                {summaryData.exercises.map((ex, idx) => {
                  const allDone = ex.completedSets === ex.totalSets;
                  return (
                    <View
                      key={ex.exerciseId}
                      style={[
                        styles.summaryExRow,
                        idx > 0 && { borderTopWidth: 1, borderTopColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.summaryExName, { color: colors.text }]}>{ex.name}</Text>
                        {ex.avgActualWeight != null && ex.avgActualReps != null && (
                          <Text style={[styles.summaryExMeta, { color: colors.icon }]}>
                            {`avg ${kgToDisplay(ex.avgActualWeight, weightUnit)} ${weightUnit} × ${ex.avgActualReps} reps`}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.summaryExSets, { color: allDone ? colors.success : colors.icon }]}>
                        {`${ex.completedSets}/${ex.totalSets} ${allDone ? '✅' : '⚠️'}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Exercices skippés */}
            {summaryData && (() => {
              const skipped = summaryData.exercises.filter(ex => ex.completedSets === 0);
              if (!skipped.length) return null;
              return (
                <View style={[styles.skippedCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.skippedTitle, { color: colors.text }]}>
                    {`${skipped.length} exercice${skipped.length > 1 ? 's' : ''} non réalisé${skipped.length > 1 ? 's' : ''}`}
                  </Text>
                  <Text style={[styles.skippedSub, { color: colors.icon }]}>
                    Appuie pour retirer de l'historique
                  </Text>
                  {skipped.map(ex => {
                    const willRemove = exercisesToRemove.has(ex.exerciseId);
                    return (
                      <TouchableOpacity
                        key={ex.exerciseId}
                        style={styles.skippedRow}
                        onPress={() => setExercisesToRemove(prev => {
                          const next = new Set(prev);
                          willRemove ? next.delete(ex.exerciseId) : next.add(ex.exerciseId);
                          return next;
                        })}
                      >
                        <Text style={[
                          styles.skippedExName,
                          { color: willRemove ? colors.icon : colors.text },
                          willRemove && { textDecorationLine: 'line-through' as const },
                        ]}>
                          {ex.name}
                        </Text>
                        <IconSymbol
                          name={willRemove ? 'xmark.circle.fill' : 'circle'}
                          size={20}
                          color={willRemove ? '#FF3B30' : colors.icon}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}

          </ScrollView>

          <TouchableOpacity
            style={[styles.summaryDoneButton, { backgroundColor: colors.tint }]}
            onPress={handleSummaryDone}
          >
            <Text style={styles.summaryDoneText}>Terminer</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16 },
  timerText: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  progressPill: { paddingHorizontal: 8, paddingVertical: 4 },
  progressText: { fontSize: 14, fontWeight: '600' },


  listContent: { paddingBottom: 160, gap: 12 },

  exerciseCard: { borderRadius: 14, padding: 12 },
  supersetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  supersetBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  exerciseCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  exerciseTitleGroup: { flex: 1 },
  restHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
  restHeaderLabel: { fontSize: 13 },
  restHeaderInput: { fontSize: 13, fontWeight: '600', minWidth: 36, padding: 0 },
  exerciseName: { fontSize: 15, marginBottom: 2 },
  exerciseMeta: { fontSize: 14, opacity: 0.6 },

  setHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingHorizontal: 2 },
  setHeaderCell: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, marginRight: 8 },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, paddingHorizontal: 2, paddingVertical: 4 },
  setIndexCell: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  setIndexNum: { fontSize: 13, fontWeight: '700' },
  setTypePill: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  setTypePillText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  setInputCol: { flex: 1 },
  setInput: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
    minWidth: 0,
  },
  setInputReadOnly: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  prevHint: { fontSize: 11, textAlign: 'center', marginTop: 2, opacity: 0.55 },
  doneButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashButton: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold' },

  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    minHeight: 48,
  },
  addExerciseButtonText: { color: '#0F172A', fontWeight: 'bold', fontSize: 15 },

  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 4,
    minHeight: 36,
  },
  addSetText: { fontSize: 14, fontWeight: '600' },

  footerContainer: { gap: 12, marginTop: 4 },

  notesCard: { borderRadius: 12, padding: 12, gap: 8 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  notesLabel: { flex: 1, fontSize: 14 },
  notesInput: { fontSize: 14, lineHeight: 20, minHeight: 72, paddingTop: 4 },
  notesReadOnly: { fontSize: 14, lineHeight: 20, paddingTop: 4, opacity: 0.85 },

  finishButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 76,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  finishText: { color: '#0F172A', fontWeight: 'bold', fontSize: 16 },

  finishedBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  finishedText: { fontWeight: 'bold', fontSize: 16 },

  // ── Summary Modal ──────────────────────────────────────────────────────────
  summaryContent: { padding: 24, paddingBottom: 120, gap: 20 },
  summaryHeader: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  summaryTitle: { fontSize: 22, fontWeight: 'bold' },
  summaryWorkoutName: { fontSize: 14 },

  summaryStats: { flexDirection: 'row', gap: 10 },
  statPill: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: 'bold' },
  statLabel: { fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.4 },

  summaryExList: { borderRadius: 14, overflow: 'hidden' },
  summaryExRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  summaryExName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  summaryExMeta: { fontSize: 14 },
  summaryExSets: { fontSize: 14, fontWeight: '600' },

  skippedCard: { borderRadius: 14, padding: 16, gap: 4 },
  skippedTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  skippedSub: { fontSize: 13, marginBottom: 8 },
  skippedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 12 },
  skippedExName: { flex: 1, fontSize: 14, fontWeight: '500' },

  summaryDoneButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  summaryDoneText: { color: '#0F172A', fontWeight: 'bold', fontSize: 16 },

  miniTabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingBottom: 20,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  miniTabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  pickerCard: { width: '100%', borderRadius: 16, padding: 16, gap: 4 },
  pickerTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, paddingHorizontal: 4 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  pickerDot: { width: 10, height: 10, borderRadius: 5 },
  pickerOptionText: { flex: 1, fontSize: 15 },

  miniTabLabel: {
    fontSize: 9,
    fontWeight: '500',
  },

  reorderBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderDoneText: {
    fontSize: 15,
    fontWeight: '700',
  },
  reorderArrows: {
    flexDirection: 'column',
    gap: 4,
  },
  reorderArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderSetSummary: {
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
});
