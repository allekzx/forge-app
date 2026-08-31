import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { SET_TYPE_LABELS, SET_TYPE_SHORT } from '@/constants/translations';
import { Alert } from '@/utils/alert';
import { useColors } from '@/hooks/use-colors';
import {
  TemplateExerciseSet,
  WorkoutTemplateDetail,
  WorkoutTemplateExercise,
  addTemplateExerciseSet,
  clearTemplateSupersetGroup,
  deleteTemplate,
  deleteTemplateExerciseSet,
  getActiveWorkout,
  getTemplateExerciseSets,
  getWorkoutTemplateDetail,
  initDatabase,
  setTemplateExercisesSupersetGroup,
  startWorkoutFromTemplate,
  updateTemplateExerciseSet,
  updateTemplateExerciseSetType,
  updateTemplateExercisesOrder,
  updateWorkoutTemplateName,
} from '@/services/DatabaseService';

function muscleColor(muscle: string): string {
  const m = (muscle ?? '').toLowerCase();
  if (m.includes('chest')) return '#EF4444';
  if (m.includes('lat') || m.includes('back') || m.includes('trap')) return '#3B82F6';
  if (m.includes('quad') || m.includes('ham') || m.includes('glut') || m.includes('calf') || m.includes('leg')) return '#8B5CF6';
  if (m.includes('bicep') || m.includes('tricep') || m.includes('forearm')) return '#F59E0B';
  if (m.includes('shoulder') || m.includes('delt')) return '#10B981';
  if (m.includes('ab') || m.includes('core')) return '#06B6D4';
  return '#6366F1';
}

const SET_TYPE_COLORS: Record<string, string> = {
  normal: '#22C55E',
  warmup: '#F59E0B',
  dropset: '#8B5CF6',
  failure: '#EF4444',
};

export default function WorkoutTemplateScreen() {
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const router = useRouter();
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();

  const [template, setTemplate] = useState<WorkoutTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [exerciseSets, setExerciseSets] = useState<Record<string, TemplateExerciseSet[]>>({});
  const [setTypePicker, setSetTypePicker] = useState<{ setId: string; currentType: string; exerciseId: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const nameRef = useRef<TextInput>(null);

  const loadTemplate = useCallback(async () => {
    if (!templateId || typeof templateId !== 'string') return;
    setLoading(true);
    try {
      await initDatabase();
      const detail = await getWorkoutTemplateDetail(templateId);
      setTemplate(detail);
      if (detail) {
        const setsMap: Record<string, TemplateExerciseSet[]> = {};
        for (const ex of detail.exercises) {
          setsMap[ex.id] = await getTemplateExerciseSets(ex.id);
        }
        setExerciseSets(setsMap);
      }
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { loadTemplate(); }, [loadTemplate]);

  const handleNameBlur = async () => {
    if (!template?.id) return;
    await updateWorkoutTemplateName(template.id, template.name);
  };

  const handleMoveExercise = async (exerciseId: string, direction: 'up' | 'down') => {
    if (!template) return;
    const exercises = [...template.exercises];
    const idx = exercises.findIndex(e => e.id === exerciseId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= exercises.length) return;
    [exercises[idx], exercises[swapIdx]] = [exercises[swapIdx], exercises[idx]];
    setTemplate(prev => prev ? { ...prev, exercises } : prev);
    await updateTemplateExercisesOrder(exercises.map(e => e.id));
  };

  const handleToggleSuperset = async (index: number) => {
    if (!template) return;
    const exercises = [...template.exercises];
    const a = exercises[index];
    const b = exercises[index + 1];
    if (!a || !b) return;

    if (a.superset_group_id && a.superset_group_id === b.superset_group_id) {
      // Already linked together — dissolve the whole group
      const groupId = a.superset_group_id;
      const updated = exercises.map(e => e.superset_group_id === groupId ? { ...e, superset_group_id: null } : e);
      setTemplate(prev => prev ? { ...prev, exercises: updated } : prev);
      await clearTemplateSupersetGroup(template.id, groupId);
      return;
    }

    // Link a and b — reuse an existing group id when either already has one (merge), else create one
    const groupId = a.superset_group_id ?? b.superset_group_id ?? `spgrp_${Date.now()}`;
    const bOldGroup = b.superset_group_id;
    const updated = exercises.map(e => {
      if (e.id === a.id || e.id === b.id) return { ...e, superset_group_id: groupId };
      if (bOldGroup && e.superset_group_id === bOldGroup) return { ...e, superset_group_id: groupId };
      return e;
    });
    setTemplate(prev => prev ? { ...prev, exercises: updated } : prev);
    const idsInGroup = updated.filter(e => e.superset_group_id === groupId).map(e => e.id);
    await setTemplateExercisesSupersetGroup(idsInGroup, groupId);
  };

  const handleSetTypeChange = async (setId: string, newType: string, exerciseId: string) => {
    setSetTypePicker(null);
    await updateTemplateExerciseSetType(setId, newType);
    setExerciseSets(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId]?.map(s => s.id === setId ? { ...s, set_type: newType } : s) ?? [],
    }));
  };

  const handleAddSet = async (exerciseId: string) => {
    const newSet = await addTemplateExerciseSet(exerciseId);
    if (newSet) {
      setExerciseSets(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] ?? []), newSet] }));
    }
  };

  const handleDeleteSet = async (setId: string, exerciseId: string) => {
    const sets = exerciseSets[exerciseId] ?? [];
    if (sets.length <= 1) return;
    await deleteTemplateExerciseSet(setId);
    setExerciseSets(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId]?.filter(s => s.id !== setId) ?? [],
    }));
  };

  const handleStart = async () => {
    if (!template || starting) return;
    try {
      setStarting(true);
      const existing = await getActiveWorkout();
      if (existing) {
        Alert.alert(
          'Séance en cours',
          `"${existing.name}" est déjà active.`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Reprendre', onPress: () => router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: existing.id } }) },
          ]
        );
        return;
      }
      const id = await startWorkoutFromTemplate(template.id);
      if (id) router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: id } });
    } finally {
      setStarting(false);
    }
  };

  const handleDelete = () => {
    if (!template) return;
    Alert.alert(
      'Supprimer la routine',
      `Supprimer "${template.name}" définitivement ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => { await deleteTemplate(template.id); router.back(); },
        },
      ]
    );
  };

  const hasExercises = (template?.exercises.length ?? 0) > 0;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top bar ── */}
      <View style={[s.topBar, { borderBottomColor: colors.card }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.iconBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Retour"
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>

        <TextInput
          ref={nameRef}
          style={[s.titleInput, { color: colors.text }]}
          value={template?.name ?? ''}
          onChangeText={v => setTemplate(prev => prev ? { ...prev, name: v } : prev)}
          onBlur={handleNameBlur}
          placeholder="Nom de la routine"
          placeholderTextColor={colors.icon}
          returnKeyType="done"
          accessibilityLabel="Nom de la routine"
        />

        {hasExercises && (
          <TouchableOpacity
            onPress={handleStart}
            style={[s.startBtn, { backgroundColor: colors.tint, opacity: starting ? 0.6 : 1 }]}
            disabled={starting}
            activeOpacity={0.8}
            accessibilityLabel="Démarrer la séance"
          >
            <IconSymbol name="play.fill" size={14} color="#0F172A" />
            <Text style={s.startBtnText}>Démarrer</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.centered}>
          <Text style={[s.loadingText, { color: colors.icon }]}>Chargement…</Text>
        </View>
      ) : !template ? null : (
        <FlatList
          data={template.exercises}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            <View style={[s.statsBar, { backgroundColor: colors.card }]}>
              <Text style={[s.statsText, { color: colors.icon }]}>
                {template.exercises.length} exercice{template.exercises.length > 1 ? 's' : ''}
                {template.exercises.length > 0
                  ? ` · ${Object.values(exerciseSets).reduce((t, sets) => t + sets.length, 0)} sets`
                  : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={[s.emptyCard, { backgroundColor: colors.card }]}>
              <IconSymbol name="dumbbell.fill" size={32} color={colors.icon} />
              <Text style={[s.emptyTitle, { color: colors.text }]}>Aucun exercice</Text>
              <Text style={[s.emptySubtitle, { color: colors.icon }]}>
                Ajoute des exercices pour construire ta routine
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={s.footer}>
              {/* Add exercises */}
              <TouchableOpacity
                style={[s.addExBtn, { backgroundColor: colors.tint }]}
                onPress={() => template?.id && router.push({ pathname: '/workouts/exercise-picker', params: { templateId: template.id } })}
                activeOpacity={0.85}
              >
                <IconSymbol name="plus" size={18} color="#0F172A" />
                <Text style={s.addExBtnText}>Ajouter des exercices</Text>
              </TouchableOpacity>

              {/* Danger zone */}
              <View style={[s.dangerZone, { borderColor: '#EF444440' }]}>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={handleDelete}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="trash" size={16} color="#EF4444" />
                  <Text style={s.deleteBtnText}>Supprimer la routine</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={({ item, index }) => {
            const next = template.exercises[index + 1];
            const isLinkedWithNext = !!next && !!item.superset_group_id && item.superset_group_id === next.superset_group_id;
            return (
              <ExerciseCard
                exercise={item}
                sets={exerciseSets[item.id] ?? []}
                isFirst={index === 0}
                isLast={index === template.exercises.length - 1}
                colors={colors}
                screenWidth={screenWidth}
                nextExerciseName={next?.name ?? null}
                isLinkedWithNext={isLinkedWithNext}
                onToggleSuperset={next ? () => handleToggleSuperset(index) : undefined}
                onMoveUp={() => handleMoveExercise(item.id, 'up')}
                onMoveDown={() => handleMoveExercise(item.id, 'down')}
                onAddSet={() => handleAddSet(item.id)}
                onDeleteSet={(setId) => handleDeleteSet(setId, item.id)}
                onSetTypeTap={(setId, currentType) => setSetTypePicker({ setId, currentType, exerciseId: item.id })}
                onRepsChange={(setId, v) => updateTemplateExerciseSet(setId, { target_reps: v })}
                onRestChange={(setId, v) => updateTemplateExerciseSet(setId, { rest_seconds: v })}
              />
            );
          }}
        />
      )}

      {/* ── Set type picker ── */}
      <Modal
        visible={setTypePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSetTypePicker(null)}
      >
        <Pressable style={s.sheetOverlay} onPress={() => setSetTypePicker(null)}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.icon }]}>TYPE DE SET</Text>
            {Object.entries(SET_TYPE_LABELS).map(([key, label]) => {
              const active = setTypePicker?.currentType === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.sheetItem, active && { backgroundColor: colors.background }]}
                  onPress={() => {
                    if (setTypePicker) handleSetTypeChange(setTypePicker.setId, key, setTypePicker.exerciseId);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[s.typeDot, { backgroundColor: SET_TYPE_COLORS[key] ?? colors.icon }]} />
                  <Text style={[s.sheetItemText, { color: active ? SET_TYPE_COLORS[key] ?? colors.tint : colors.text }]}>
                    {label}
                  </Text>
                  {active && <IconSymbol name="checkmark" size={16} color={SET_TYPE_COLORS[key] ?? colors.tint} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Exercise Card ─────────────────────────────────────────────────────────────

type ExerciseCardProps = {
  exercise: WorkoutTemplateExercise;
  sets: TemplateExerciseSet[];
  isFirst: boolean;
  isLast: boolean;
  colors: any;
  screenWidth: number;
  nextExerciseName: string | null;
  isLinkedWithNext: boolean;
  onToggleSuperset?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  onSetTypeTap: (setId: string, currentType: string) => void;
  onRepsChange: (setId: string, value: number) => void;
  onRestChange: (setId: string, value: number) => void;
};

function ExerciseCard({
  exercise, sets, isFirst, isLast, colors, screenWidth, nextExerciseName, isLinkedWithNext, onToggleSuperset,
  onMoveUp, onMoveDown, onAddSet, onDeleteSet, onSetTypeTap, onRepsChange, onRestChange,
}: ExerciseCardProps) {
  // Compute available width for inputs: screen - list padding (32) - card padding (28) - badge (44) - delete (36) - gaps (3×8=24)
  const inputWidth = Math.max(48, Math.floor((screenWidth - 32 - 28 - 44 - 36 - 24) / 2));
  const accent = muscleColor(exercise.muscle);
  const inSuperset = !!exercise.superset_group_id;
  return (
    <View style={[s.card, { backgroundColor: colors.card }, inSuperset && { borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
      {/* Superset badge */}
      {inSuperset && (
        <View style={[s.supersetBadge, { backgroundColor: '#F59E0B20' }]}>
          <IconSymbol name="link" size={11} color="#F59E0B" />
          <Text style={[s.supersetBadgeText, { color: '#F59E0B' }]}>SUPERSET</Text>
        </View>
      )}

      {/* Card header */}
      <View style={s.cardHeader}>
        {/* Badge muscle coloré */}
        <View style={[s.exThumb, s.exThumbFallback, { backgroundColor: accent + '20' }]}>
          <IconSymbol name="dumbbell.fill" size={20} color={accent} />
        </View>
        <View style={s.cardHeaderLeft}>
          <Text style={[s.exerciseName, { color: colors.text }]} numberOfLines={1}>
            {exercise.name}
          </Text>
          <Text style={[s.exerciseMeta, { color: colors.icon }]}>
            {exercise.muscle} · {exercise.equipment}
          </Text>
        </View>
        <View style={s.reorderBtns}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={isFirst}
            style={[s.reorderBtn, isFirst && s.reorderBtnDisabled]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Monter l'exercice"
          >
            <IconSymbol name="chevron.up" size={16} color={isFirst ? colors.icon + '40' : colors.icon} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={isLast}
            style={[s.reorderBtn, isLast && s.reorderBtnDisabled]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Descendre l'exercice"
          >
            <IconSymbol name="chevron.down" size={16} color={isLast ? colors.icon + '40' : colors.icon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Column headers */}
      <View style={s.colHeaders}>
        <Text style={[s.colLabel, { color: colors.icon, width: 44, textAlign: 'center' }]}>TYPE</Text>
        <Text style={[s.colLabel, { color: colors.icon, flex: 1, textAlign: 'center' }]}>REPS</Text>
        <Text style={[s.colLabel, { color: colors.icon, flex: 1, textAlign: 'center' }]}>REPOS(s)</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Set rows */}
      {sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          colors={colors}
          inputWidth={inputWidth}
          onTypeTap={() => onSetTypeTap(set.id, set.set_type)}
          onRepsChange={v => onRepsChange(set.id, v)}
          onRestChange={v => onRestChange(set.id, v)}
          onDelete={() => onDeleteSet(set.id)}
          canDelete={sets.length > 1}
        />
      ))}

      {/* Add set */}
      <TouchableOpacity
        onPress={onAddSet}
        style={[s.addSetRow, { borderColor: colors.tint + '50' }]}
        activeOpacity={0.7}
        accessibilityLabel="Ajouter un set"
      >
        <IconSymbol name="plus.circle" size={16} color={colors.tint} />
        <Text style={[s.addSetText, { color: colors.tint }]}>Ajouter un set</Text>
      </TouchableOpacity>

      {/* Superset toggle — link/unlink this exercise with the next one in the list */}
      {onToggleSuperset && (
        <TouchableOpacity
          onPress={onToggleSuperset}
          style={[
            s.supersetToggle,
            isLinkedWithNext
              ? { backgroundColor: '#F59E0B15', borderColor: '#F59E0B60' }
              : { borderColor: colors.icon + '40' },
          ]}
          activeOpacity={0.7}
          accessibilityLabel={isLinkedWithNext ? 'Dissocier le superset' : 'Créer un superset avec l\'exercice suivant'}
        >
          <IconSymbol
            name="link"
            size={14}
            color={isLinkedWithNext ? '#F59E0B' : colors.icon}
          />
          <Text style={[s.supersetToggleText, { color: isLinkedWithNext ? '#F59E0B' : colors.icon }]} numberOfLines={1}>
            {isLinkedWithNext
              ? `Superset avec ${nextExerciseName} · Dissocier`
              : `Enchaîner en superset avec ${nextExerciseName}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Set Row ───────────────────────────────────────────────────────────────────

type SetRowProps = {
  set: TemplateExerciseSet;
  colors: any;
  canDelete: boolean;
  inputWidth: number;
  onTypeTap: () => void;
  onRepsChange: (v: number) => void;
  onRestChange: (v: number) => void;
  onDelete: () => void;
};

function SetRow({ set, colors, canDelete, inputWidth, onTypeTap, onRepsChange, onRestChange, onDelete }: SetRowProps) {
  const typeColor = SET_TYPE_COLORS[set.set_type] ?? colors.icon;
  return (
    <View style={s.setRow}>
      {/* Type badge — shows N° + type color, tap to change */}
      <TouchableOpacity
        onPress={onTypeTap}
        style={[s.typeBadge, { backgroundColor: typeColor + '15', borderColor: typeColor + '60' }]}
        activeOpacity={0.7}
        accessibilityLabel={`Set ${set.set_index}, ${SET_TYPE_LABELS[set.set_type] ?? ''} — changer le type`}
      >
        <Text style={[s.typeBadgeIndex, { color: typeColor }]}>{set.set_index}</Text>
        <Text style={[s.typeBadgeLabel, { color: typeColor }]}>{SET_TYPE_SHORT[set.set_type] ?? ''}</Text>
      </TouchableOpacity>

      {/* Reps input */}
      <TextInput
        style={[s.numInput, { backgroundColor: colors.background, color: colors.text, width: inputWidth }]}
        defaultValue={String(set.target_reps)}
        keyboardType="number-pad"
        returnKeyType="done"
        onEndEditing={e => {
          const v = parseInt(e.nativeEvent.text, 10);
          if (!isNaN(v) && v > 0) onRepsChange(v);
        }}
        accessibilityLabel="Répétitions"
        selectTextOnFocus
      />

      {/* Rest input */}
      <TextInput
        style={[s.numInput, { backgroundColor: colors.background, color: colors.text, width: inputWidth }]}
        defaultValue={String(set.rest_seconds)}
        keyboardType="number-pad"
        returnKeyType="done"
        onEndEditing={e => {
          const v = parseInt(e.nativeEvent.text, 10);
          if (!isNaN(v) && v > 0) onRestChange(v);
        }}
        accessibilityLabel="Repos en secondes"
        selectTextOnFocus
      />

      {/* Delete */}
      <TouchableOpacity
        onPress={onDelete}
        disabled={!canDelete}
        style={[s.deleteSetBtn, !canDelete && { opacity: 0.25 }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Supprimer le set"
      >
        <IconSymbol name="minus.circle.fill" size={20} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  titleInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 8,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    minHeight: 44,
  },
  startBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },

  // States
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15 },

  // List
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },

  // Stats bar
  statsBar: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  statsText: { fontSize: 13, fontWeight: '500' },

  // Empty state
  emptyCard: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Footer
  footer: { gap: 16, marginTop: 8 },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  addExBtnText: { color: '#0F172A', fontWeight: '700', fontSize: 15 },

  dangerZone: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
  },
  deleteBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },

  // Exercise card
  card: { borderRadius: 14, padding: 14, gap: 0 },
  supersetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  supersetBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  supersetToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  supersetToggleText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  exThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    flexShrink: 0,
  },
  exThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderLeft: { flex: 1 },
  exerciseName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  exerciseMeta: { fontSize: 12 },
  reorderBtns: { flexDirection: 'column', gap: 0 },
  reorderBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  reorderBtnDisabled: {},

  // Column headers
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    paddingHorizontal: 2,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Set row — 4 elements: [type badge] [reps] [rest] [delete]
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    minHeight: 44,
  },
  // Type badge: shows set number + type color, tap to change type
  typeBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeBadgeIndex: { fontSize: 15, fontWeight: '800', lineHeight: 18 },
  typeBadgeLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.2 },

  numInput: {
    height: 44,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  deleteSetBtn: {
    width: 36, height: 44,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  // Add set
  addSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addSetText: { fontSize: 13, fontWeight: '600' },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.4)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 52,
  },
  typeDot: { width: 10, height: 10, borderRadius: 5 },
  sheetItemText: { flex: 1, fontSize: 16, fontWeight: '500' },
});
