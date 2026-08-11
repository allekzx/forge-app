import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveWorkoutBanner } from '@/components/shared/ActiveWorkoutBanner';
import { ErrorView } from '@/components/shared/ErrorView';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WeekProgramWidget } from '@/components/WeekProgramWidget';
import { Fonts, Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import {
  TemplateDetail,
  WeeklyStats,
  WorkoutTemplateSummary,
  getActiveWorkout,
  getTemplateWithExercises,
  getUserSetting,
  getWeeklyStats,
  getWorkoutStreak,
  getWorkoutTemplates,
  initDatabase,
  startWorkoutFromTemplate,
} from '@/services/DatabaseService';
import {
  getActiveProgram,
  getCustomSchedule,
  saveCustomSchedule,
} from '@/services/ProgramService';
import { Program, ProgramDay } from '@/constants/programs';
import { useFocusEffect, useRouter } from 'expo-router';

function formatLastPerformed(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  const d = new Date(isoDate);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();

  const [streak, setStreak] = useState(0);
  const [templates, setTemplates] = useState<WorkoutTemplateSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Map<string, TemplateDetail>>(new Map());
  const [userName, setUserName] = useState('');
  const [activeWorkout, setActiveWorkout] = useState<{ id: string; name: string } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStats, setWeekStats] = useState<WeeklyStats | null>(null);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [activeSchedule, setActiveSchedule] = useState<(ProgramDay | null)[]>(Array(7).fill(null));

  const loadData = useCallback(async () => {
    setError(null);
    try {
      await initDatabase();
      const [streakData, templatesData, nameData, activeData, programData, statsData] = await Promise.all([
        getWorkoutStreak(),
        getWorkoutTemplates(),
        getUserSetting('user_name', ''),
        getActiveWorkout(),
        getActiveProgram(),
        getWeeklyStats(),
      ]);
      const customSchedule = programData ? await getCustomSchedule(programData.id) : null;
      setStreak(streakData);
      setTemplates(templatesData);
      setUserName(nameData);
      setActiveWorkout(activeData);
      setWeekStats(statsData);
      setActiveProgram(programData);
      setActiveSchedule(customSchedule ?? programData?.weekSchedule ?? Array(7).fill(null));
      setBannerDismissed(false);
    } catch (e) {
      console.error('[home] loadData error:', e);
      setError('Impossible de charger les données.');
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleToggleExpand = useCallback(async (tpl: WorkoutTemplateSummary) => {
    const nextId = expandedId === tpl.id ? null : tpl.id;
    setExpandedId(nextId);

    if (nextId && !detailsCache.has(nextId)) {
      const detail = await getTemplateWithExercises(nextId);
      if (detail) {
        setDetailsCache(prev => new Map(prev).set(nextId, detail));
      }
    }
  }, [expandedId, detailsCache]);

  const handleStartFromTemplate = useCallback(async (templateId: string) => {
    try {
      const existing = await getActiveWorkout();
      if (existing) {
        Alert.alert(
          'Séance en cours',
          `"${existing.name}" est déjà active.`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Reprendre',
              onPress: () => router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: existing.id } }),
            },
          ]
        );
        return;
      }
      const workoutId = await startWorkoutFromTemplate(templateId);
      if (workoutId) {
        router.push({ pathname: '/workouts/[workoutId]', params: { workoutId } });
      }
    } catch (e) {
      console.error(e);
    }
  }, [router]);

  const handleScheduleChange = useCallback(async (newSchedule: (ProgramDay | null)[]) => {
    if (!activeProgram) return;
    setActiveSchedule(newSchedule);
    await saveCustomSchedule(activeProgram.id, newSchedule);
  }, [activeProgram]);

  // When a program is active: show only its routines with program labels, ordered from today
  const { orderedTemplates, programLabels } = (() => {
    const fallback = { orderedTemplates: templates, programLabels: new Map<string, string>() };
    if (!activeProgram) return fallback;
    const todayIdx = (new Date().getDay() + 6) % 7;
    const seen = new Set<string>();
    const programDays: ProgramDay[] = [];
    for (let i = 0; i < 7; i++) {
      const day = activeSchedule[(todayIdx + i) % 7];
      if (day && !seen.has(day.templateId)) {
        seen.add(day.templateId);
        programDays.push(day);
      }
    }
    const resolved: { tpl: WorkoutTemplateSummary; label: string }[] = [];
    for (const day of programDays) {
      const tpl = templates.find(t => t.id === day.templateId) ??
                  templates.find(t => t.name === day.label) ??
                  templates.find(t => day.label.toLowerCase().startsWith(t.name.toLowerCase()));
      if (tpl && !resolved.find(r => r.tpl.id === tpl.id)) {
        resolved.push({ tpl, label: day.label });
      }
    }
    if (resolved.length === 0) return fallback;
    return {
      orderedTemplates: resolved.map(r => r.tpl),
      programLabels: new Map(resolved.map(r => [r.tpl.id, r.label])),
    };
  })();

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ErrorView message={error} onRetry={loadData} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
              <ThemedText style={styles.avatarInitial}>{(userName || 'A').charAt(0).toUpperCase()}</ThemedText>
            </View>
            <View>
              <ThemedText style={[styles.greeting, { color: colors.icon }]}>Bienvenue,</ThemedText>
              <ThemedText style={styles.userName}>{userName || 'Athlète'}</ThemedText>
            </View>
          </View>
          <View style={styles.headerRight}>
            {streak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
                <IconSymbol name="flame.fill" size={14} color={colors.tint} />
                <ThemedText style={styles.streakText}>{streak}</ThemedText>
              </View>
            )}
            <TouchableOpacity
              style={[styles.settingsBtn, { backgroundColor: colors.card }]}
              onPress={() => router.push('/settings' as any)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol name="gear" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bannière séance active */}
        {activeWorkout && !bannerDismissed && (
          <ActiveWorkoutBanner
            workoutName={activeWorkout.name}
            onResume={() =>
              router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: activeWorkout.id } })
            }
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        {/* Semaine + programme */}
        <WeekProgramWidget
          stats={weekStats}
          program={activeProgram}
          schedule={activeSchedule}
          templates={templates}
          onOpenSelect={() => router.push('/program-select' as any)}
          onStartTemplate={handleStartFromTemplate}
          onScheduleChange={handleScheduleChange}
        />

        {/* Mes routines */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.icon }]}>MES ROUTINES</ThemedText>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/workout' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ThemedText style={[styles.sectionLink, { color: colors.tint }]}>Gérer</ThemedText>
            </TouchableOpacity>
          </View>

          {orderedTemplates.length === 0 ? (
            <TouchableOpacity
              style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.tint + '40' }]}
              onPress={() => router.push('/workouts/new-template' as any)}
              activeOpacity={0.7}
            >
              <IconSymbol name="plus.circle" size={28} color={colors.tint} />
              <ThemedText style={[styles.emptyText, { color: colors.icon }]}>Créer ma première routine</ThemedText>
            </TouchableOpacity>
          ) : (
            orderedTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                displayName={programLabels.get(tpl.id) ?? tpl.name}
                expanded={expandedId === tpl.id}
                detail={detailsCache.get(tpl.id) ?? null}
                colors={colors}
                onToggle={() => handleToggleExpand(tpl)}
                onStart={() => handleStartFromTemplate(tpl.id)}
                onEdit={() => router.push({ pathname: '/workouts/template', params: { templateId: tpl.id } })}
              />
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function TemplateCard({
  tpl, displayName, expanded, detail, colors, onToggle, onStart, onEdit,
}: {
  tpl: WorkoutTemplateSummary;
  displayName: string;
  expanded: boolean;
  detail: TemplateDetail | null;
  colors: any;
  onToggle: () => void;
  onStart: () => void;
  onEdit: () => void;
}) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [expanded, rotateAnim]);

  const chevronRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.templateHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.templateInfo}>
          <ThemedText type="defaultSemiBold" style={styles.templateName}>{displayName}</ThemedText>
          <View style={styles.templateMetaRow}>
            <ThemedText style={[styles.templateMeta, { color: colors.icon }]}>
              {tpl.exerciseCount} exercice{tpl.exerciseCount > 1 ? 's' : ''}
            </ThemedText>
            {tpl.lastPerformedAt ? (
              <>
                <ThemedText style={[styles.templateMetaDot, { color: colors.icon }]}> · </ThemedText>
                <ThemedText style={[styles.templateMeta, { color: colors.icon }]}>
                  {formatLastPerformed(tpl.lastPerformedAt)}
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText style={[styles.templateMetaDot, { color: colors.icon }]}> · </ThemedText>
                <ThemedText style={[styles.templateMeta, { color: colors.icon }]}>Pas encore effectuée</ThemedText>
              </>
            )}
          </View>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <IconSymbol name="chevron.right" size={18} color={colors.icon} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: colors.background }]}>
          {detail ? (
            <>
              {detail.exercises.map((ex, i) => (
                <View key={`${i}_${ex.exerciseId}`} style={styles.exerciseRow}>
                  <ThemedText style={[styles.exerciseIndex, { color: colors.icon }]}>{i + 1}</ThemedText>
                  <ThemedText style={styles.exerciseName} numberOfLines={1}>{ex.name}</ThemedText>
                  <ThemedText style={[styles.exerciseConfig, { color: colors.icon }]}>
                    {ex.sets} × {ex.reps}{ex.weight_kg ? ` — ${ex.weight_kg} kg` : ''}
                  </ThemedText>
                </View>
              ))}
            </>
          ) : (
            <ThemedText style={[styles.templateMeta, { color: colors.icon, padding: 12 }]}>
              Chargement…
            </ThemedText>
          )}

          <View style={styles.expandedActions}>
            <TouchableOpacity
              style={[styles.startBtnFull, { backgroundColor: colors.tint }]}
              onPress={onStart}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.startBtnText}>Démarrer</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: colors.icon + '40' }]}
              onPress={onEdit}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.editBtnText, { color: colors.text }]}>Modifier</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  greeting: { fontSize: 13 },
  userName: { fontSize: 18, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm },
  streakText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts?.mono },
  settingsBtn: {
    width: 40, height: 40, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },

  section: { marginTop: 4, gap: 10 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1,
  },
  sectionLink: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, fontWeight: '500' },

  templateCard: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  templateHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  templateInfo: { flex: 1, marginRight: 8 },
  templateName: { fontSize: 15 },
  templateMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' },
  templateMeta: { fontSize: 13 },
  templateMetaDot: { fontSize: 13 },

  expandedContent: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7, gap: 8,
  },
  exerciseIndex: { fontSize: 13, fontWeight: '600', width: 18, textAlign: 'center', fontFamily: Fonts?.mono },
  exerciseName: { flex: 1, fontSize: 14 },
  exerciseConfig: { fontSize: 13, fontFamily: Fonts?.mono, fontVariant: ['tabular-nums'] },

  expandedActions: { flexDirection: 'row', gap: 8, padding: 12, paddingTop: 8 },
  startBtnFull: {
    flex: 1, height: 44, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  startBtnText: { fontSize: 13, fontWeight: '700', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 },
  editBtn: {
    height: 44, paddingHorizontal: 16, borderRadius: Radius.sm,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
