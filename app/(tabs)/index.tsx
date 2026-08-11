import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { ActiveWorkoutBanner } from '@/components/shared/ActiveWorkoutBanner';
import { Button } from '@/components/shared/Button';
import { ErrorView } from '@/components/shared/ErrorView';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WeekProgramWidget } from '@/components/WeekProgramWidget';
import { Fonts, Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import {
  PersonalRecord,
  WeeklyStats,
  WorkoutTemplateSummary,
  getActiveWorkout,
  getPersonalRecords,
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
  const [userName, setUserName] = useState('');
  const [activeWorkout, setActiveWorkout] = useState<{ id: string; name: string } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStats, setWeekStats] = useState<WeeklyStats | null>(null);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [activeSchedule, setActiveSchedule] = useState<(ProgramDay | null)[]>(Array(7).fill(null));
  const [isLoading, setIsLoading] = useState(true);
  const [recentPR, setRecentPR] = useState<PersonalRecord | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      await initDatabase();
      const [streakData, templatesData, nameData, activeData, programData, statsData, records] = await Promise.all([
        getWorkoutStreak(),
        getWorkoutTemplates(),
        getUserSetting('user_name', ''),
        getActiveWorkout(),
        getActiveProgram(),
        getWeeklyStats(),
        getPersonalRecords(50),
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

      // Only celebrate a record set in the last week — an old PR resurfaced isn't "new"
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const mostRecent = [...records].sort(
        (a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime()
      )[0];
      setRecentPR(mostRecent && Date.now() - new Date(mostRecent.achieved_at).getTime() < ONE_WEEK_MS ? mostRecent : null);
    } catch (e) {
      console.error('[home] loadData error:', e);
      setError('Impossible de charger les données.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
  const { orderedTemplates, programLabels, heroIsToday } = (() => {
    const fallback = { orderedTemplates: templates, programLabels: new Map<string, string>(), heroIsToday: false };
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
      heroIsToday: !!activeSchedule[todayIdx],
    };
  })();

  const heroTemplate = orderedTemplates[0] ?? null;
  const heroLabel = heroTemplate ? (activeProgram ? (heroIsToday ? "Aujourd'hui" : 'Prochaine séance') : 'Suggestion') : null;
  const activeDaysCount = weekStats?.days.filter(d => d.hasWorkout).length ?? 0;
  const intensityPct = Math.round((activeDaysCount / 7) * 100);

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ErrorView message={error} onRetry={loadData} />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.tint} />
        </View>
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

        {/* Prochaine séance — bloc unique dominant */}
        {heroTemplate && (
          <View style={[styles.hero, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <ThemedText style={[styles.heroLabel, { color: colors.tint }]}>{heroLabel}</ThemedText>
            <ThemedText style={styles.heroName}>{heroTemplate.name}</ThemedText>
            <ThemedText style={[styles.heroMeta, { color: colors.icon }]}>
              {heroTemplate.exerciseCount} exercice{heroTemplate.exerciseCount > 1 ? 's' : ''}
            </ThemedText>

            <View style={styles.intensityRow}>
              <ThemedText style={[styles.intensityLabel, { color: colors.icon }]}>INTENSITÉ 7 JOURS</ThemedText>
              <ThemedText style={[styles.intensityValue, { color: colors.icon }]}>{intensityPct}%</ThemedText>
            </View>
            <View style={[styles.intensityBarBg, { backgroundColor: colors.background }]}>
              <View style={[styles.intensityBarFill, { width: `${Math.max(intensityPct, 4)}%`, overflow: 'hidden' }]}>
                <LinearGradient
                  colors={colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            </View>

            <Button
              label="Démarrer la séance"
              onPress={() => handleStartFromTemplate(heroTemplate.id)}
              style={styles.heroCta}
            />
          </View>
        )}

        {/* Record récent — n'apparaît que si un vrai record a été battu cette semaine */}
        {recentPR && (
          <View style={[styles.prCard, { borderColor: colors.tint, backgroundColor: colors.card }]}>
            <ThemedText style={[styles.prCap, { color: colors.tint }]}>🔥 Nouveau record</ThemedText>
            <ThemedText style={styles.prBig}>{recentPR.maxWeight} kg</ThemedText>
            <ThemedText style={[styles.prSub, { color: colors.icon }]}>
              {recentPR.name}{recentPR.reps ? ` · ${recentPR.reps} reps` : ''}
            </ThemedText>
          </View>
        )}

        {/* Semaine — ligne compacte + stats */}
        <WeekProgramWidget
          stats={weekStats}
          program={activeProgram}
          schedule={activeSchedule}
          templates={templates}
          onOpenSelect={() => router.push('/program-select' as any)}
          onScheduleChange={handleScheduleChange}
        />

        {/* Mes routines */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.icon }]}>MES ROUTINES — DÉMARRAGE RAPIDE</ThemedText>
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
            <View style={[styles.ledger, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {orderedTemplates.map((tpl, i) => (
                <TemplateCard
                  key={tpl.id}
                  tpl={tpl}
                  displayName={programLabels.get(tpl.id) ?? tpl.name}
                  colors={colors}
                  isFirst={i === 0}
                  onPress={() => router.push({ pathname: '/workouts/template', params: { templateId: tpl.id } })}
                  onQuickStart={() => handleStartFromTemplate(tpl.id)}
                />
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function TemplateCard({
  tpl, displayName, colors, isFirst, onPress, onQuickStart,
}: {
  tpl: WorkoutTemplateSummary;
  displayName: string;
  colors: any;
  isFirst: boolean;
  onPress: () => void;
  onQuickStart: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.templateCard, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.templateHeader}>
        <View style={[styles.templateStamp, { borderColor: colors.tint }]}>
          <ThemedText style={[styles.templateStampText, { color: colors.tint }]}>{tpl.exerciseCount}</ThemedText>
        </View>
        <View style={styles.templateInfo}>
          <ThemedText type="defaultSemiBold" style={styles.templateName}>{displayName}</ThemedText>
          <View style={styles.templateMetaRow}>
            <ThemedText style={[styles.templateMeta, { color: colors.icon }]}>
              {tpl.lastPerformedAt ? formatLastPerformed(tpl.lastPerformedAt) : 'Pas encore effectuée'}
            </ThemedText>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.quickStartBtn, { borderColor: colors.tint }]}
          onPress={(e) => { e.stopPropagation(); onQuickStart(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="play.fill" size={12} color={colors.tint} />
        </TouchableOpacity>
        <IconSymbol name="chevron.right" size={18} color={colors.icon} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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

  ledger: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  templateCard: {},
  templateHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    justifyContent: 'space-between', padding: 14,
  },
  templateStamp: {
    width: 34, height: 34, borderRadius: Radius.sm, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, flexGrow: 0,
  },
  templateStampText: { fontSize: 14, fontWeight: '800', fontFamily: Fonts?.mono },
  templateInfo: { flex: 1, marginRight: 8 },
  templateName: { fontSize: 15 },
  templateMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' },
  templateMeta: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  quickStartBtn: {
    width: 30, height: 30, borderRadius: Radius.full, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  hero: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md,
    padding: 20, marginBottom: 16, gap: 6,
  },
  heroLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  heroName: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  heroMeta: { fontSize: 13, marginBottom: 4 },
  intensityRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  intensityLabel: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  intensityValue: { fontSize: 9.5, fontWeight: '700', fontFamily: Fonts?.mono },
  intensityBarBg: { height: 6, borderRadius: Radius.full, overflow: 'hidden', marginTop: 5 },
  intensityBarFill: { height: '100%', borderRadius: Radius.full },
  heroCta: { marginTop: 10 },

  prCard: {
    borderWidth: 1, borderRadius: Radius.md, padding: 16,
    alignItems: 'center', marginBottom: 16, gap: 3,
  },
  prCap: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  prBig: { fontSize: 26, fontWeight: '900', fontFamily: Fonts?.mono, letterSpacing: -0.5 },
  prSub: { fontSize: 12 },
});
