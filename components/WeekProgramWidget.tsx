import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { DAY_LABELS_SHORT, ProgramDay, Program } from '@/constants/programs';
import { Fonts, Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { WeeklyStats, WorkoutTemplateSummary } from '@/services/DatabaseService';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const DAY_LABELS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg} kg`;
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

interface Props {
  stats: WeeklyStats | null;
  program: Program | null;
  schedule: (ProgramDay | null)[];
  templates: WorkoutTemplateSummary[];
  onOpenSelect: () => void;
  onScheduleChange: (newSchedule: (ProgramDay | null)[]) => void;
}

export function WeekProgramWidget({
  stats, program, schedule, templates,
  onOpenSelect, onScheduleChange,
}: Props) {
  const colors = useColors();
  const [editMode, setEditMode] = useState(false);
  const [editDayIndex, setEditDayIndex] = useState<number | null>(null);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const activeDays = stats?.days.map(d => d.hasWorkout) ?? Array(7).fill(false);
  const activeCount = activeDays.filter(Boolean).length;

  // Compute which templates belong to the active program (3-level fallback matching)
  const programTemplateIds = useMemo(() => {
    if (!program) return new Set<string>();
    const ids = new Set<string>();
    for (const day of program.weekSchedule) {
      if (!day) continue;
      const tpl = templates.find(t => t.id === day.templateId) ??
                  templates.find(t => t.name === day.label) ??
                  templates.find(t => day.label.toLowerCase().startsWith(t.name.toLowerCase()));
      if (tpl) ids.add(tpl.id);
    }
    return ids;
  }, [program, templates]);

  const programTpls = useMemo(() => templates.filter(t => programTemplateIds.has(t.id)), [templates, programTemplateIds]);
  const otherTpls   = useMemo(() => templates.filter(t => !programTemplateIds.has(t.id)), [templates, programTemplateIds]);

  const handlePickTemplate = (dayIndex: number, templateId: string | null) => {
    const next = [...schedule];
    if (templateId === null) {
      next[dayIndex] = null;
    } else {
      const tpl = templates.find(t => t.id === templateId);
      next[dayIndex] = tpl ? { templateId: tpl.id, label: tpl.name } : null;
    }
    onScheduleChange(next);
    setEditDayIndex(null);
  };

  const toggleEdit = () => {
    setEditMode(v => !v);
    setEditDayIndex(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {program ? (
            <ThemedText style={[styles.programName, { color: colors.text }]}>{program.name}</ThemedText>
          ) : (
            <ThemedText style={[styles.title, { color: colors.text }]}>Activité de la semaine</ThemedText>
          )}
        </View>
        <View style={styles.headerRight}>
          <ThemedText style={[styles.badgeText, { color: colors.icon }]}>{activeCount}/7 séances</ThemedText>
          {program && (
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: editMode ? colors.tint : colors.card, borderColor: colors.border }]}
              onPress={toggleEdit}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol name="pencil" size={13} color={editMode ? '#0F172A' : colors.icon} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {editMode && (
        <ThemedText style={[styles.editHint, { color: colors.icon }]}>
          Appuie sur un jour pour modifier sa séance
        </ThemedText>
      )}

      {/* Week grid */}
      <View style={styles.daysRow}>
        {DAY_LABELS_SHORT.map((label, i) => {
          const isToday = i === todayIdx;
          const done = activeDays[i];
          const planned = schedule[i];
          const barBorderColor = isToday ? colors.tint : colors.border;

          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayCol, editMode && { opacity: editDayIndex === null || editDayIndex === i ? 1 : 0.45 }]}
              onPress={() => editMode && setEditDayIndex(i)}
              activeOpacity={editMode ? 0.7 : 1}
              disabled={!editMode}
            >
              <ThemedText style={[styles.dayTag, { color: colors.tint }]} numberOfLines={1}>
                {planned ? planned.label.slice(0, 2).toUpperCase() : ''}
              </ThemedText>

              <View style={[styles.dayBar, { borderColor: barBorderColor, borderWidth: isToday ? 1.5 : 1 }]}>
                {done && <View style={[styles.dayBarFill, { backgroundColor: colors.success, height: '100%' }]} />}
                {!done && planned && (
                  <View style={[styles.dayBarFill, { height: '45%', overflow: 'hidden' }]}>
                    <LinearGradient
                      colors={colors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </View>
                )}
              </View>

              <ThemedText style={[styles.dayLabel, { color: isToday ? colors.text : colors.icon + '80' }]}>
                {label}
              </ThemedText>

              {isToday && <View style={[styles.todayDot, { backgroundColor: colors.tint }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statLabel, { color: colors.icon }]}>Volume</ThemedText>
          <ThemedText style={[styles.statValue, { color: colors.text }]}>
            {stats ? formatVolume(stats.totalVolume) : '—'}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statLabel, { color: colors.icon }]}>Durée</ThemedText>
          <ThemedText style={[styles.statValue, { color: colors.text }]}>
            {stats ? formatDuration(stats.totalDurationMinutes) : '—'}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statLabel, { color: colors.icon }]}>Séances</ThemedText>
          <ThemedText style={[styles.statValue, { color: colors.text }]}>
            {stats?.workoutCount ?? '—'}
          </ThemedText>
        </View>
      </View>

      {/* Bottom action row */}
      {!editMode && (
        <TouchableOpacity
          style={[styles.ctaRow, { borderTopColor: colors.border }]}
          onPress={onOpenSelect}
          activeOpacity={0.7}
        >
          {!program ? (
            <>
              <IconSymbol name="calendar" size={13} color={colors.tint} />
              <ThemedText style={[styles.ctaText, { color: colors.tint }]}>Choisir un programme</ThemedText>
              <IconSymbol name="chevron.right" size={11} color={colors.tint} />
            </>
          ) : (
            <>
              <ThemedText style={[styles.ctaText, { color: colors.icon }]}>Changer de programme</ThemedText>
              <IconSymbol name="chevron.right" size={11} color={colors.icon} />
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Day picker bottom sheet */}
      <Modal
        visible={editDayIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditDayIndex(null)}
      >
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setEditDayIndex(null)}
          activeOpacity={1}
        >
          <TouchableOpacity
            style={[styles.sheet, { backgroundColor: colors.card }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <ThemedText style={[styles.sheetTitle, { color: colors.text }]}>
              {editDayIndex !== null ? DAY_LABELS_FULL[editDayIndex] : ''}
            </ThemedText>

            <TouchableOpacity
              style={[
                styles.sheetOption,
                { borderBottomColor: colors.background },
                editDayIndex !== null && schedule[editDayIndex] === null
                  ? { backgroundColor: colors.tint + '15' } : {},
              ]}
              onPress={() => handlePickTemplate(editDayIndex!, null)}
            >
              <ThemedText style={[styles.sheetOptionText, { color: colors.text }]}>Repos</ThemedText>
              {editDayIndex !== null && schedule[editDayIndex] === null && (
                <IconSymbol name="checkmark" size={15} color={colors.tint} />
              )}
            </TouchableOpacity>

            {/* Routines du programme actif en premier */}
            {programTpls.length > 0 && (
              <>
                <ThemedText style={[styles.sheetGroupLabel, { color: colors.icon }]}>
                  {program?.name ?? 'Programme'}
                </ThemedText>
                {programTpls.map(tpl => {
                  const isSelected = editDayIndex !== null && schedule[editDayIndex]?.templateId === tpl.id;
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      style={[
                        styles.sheetOption,
                        { borderBottomColor: colors.background },
                        isSelected ? { backgroundColor: colors.tint + '15' } : {},
                      ]}
                      onPress={() => handlePickTemplate(editDayIndex!, tpl.id)}
                    >
                      <ThemedText style={[styles.sheetOptionText, { color: colors.text }]}>{tpl.name}</ThemedText>
                      {isSelected && <IconSymbol name="checkmark" size={15} color={colors.tint} />}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Autres routines */}
            {otherTpls.length > 0 && (
              <>
                {programTpls.length > 0 && (
                  <ThemedText style={[styles.sheetGroupLabel, { color: colors.icon }]}>
                    Autres routines
                  </ThemedText>
                )}
                {otherTpls.map(tpl => {
                  const isSelected = editDayIndex !== null && schedule[editDayIndex]?.templateId === tpl.id;
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      style={[
                        styles.sheetOption,
                        { borderBottomColor: colors.background },
                        isSelected ? { backgroundColor: colors.tint + '15' } : {},
                      ]}
                      onPress={() => handlePickTemplate(editDayIndex!, tpl.id)}
                    >
                      <ThemedText style={[styles.sheetOptionText, { color: colors.text }]}>{tpl.name}</ThemedText>
                      {isSelected && <IconSymbol name="checkmark" size={15} color={colors.tint} />}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <TouchableOpacity
              style={[styles.sheetCancel, { borderTopColor: colors.icon + '20' }]}
              onPress={() => setEditDayIndex(null)}
            >
              <ThemedText style={[styles.sheetCancelText, { color: colors.icon }]}>Annuler</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 12,
    gap: 8,
  },
  programName: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  editBtn: {
    width: 28, height: 28, borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },

  editHint: {
    fontSize: 12, paddingBottom: 8,
  },

  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 12,
  },
  dayCol: { alignItems: 'center', flex: 1, gap: 4 },
  dayTag: { fontSize: 7.5, fontWeight: '800', letterSpacing: 0.2, height: 10 },
  dayBar: {
    width: 18, height: 28, borderRadius: Radius.sm,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  dayBarFill: { width: '100%' },
  dayLabel: { fontSize: 9, fontWeight: '500' },
  todayDot: { width: 4, height: 4, borderRadius: 2 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 12,
  },
  statItem: {},
  statLabel: { fontSize: 11, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.6 },
  statValue: { fontSize: 16, fontWeight: '700', fontFamily: Fonts?.mono, fontVariant: ['tabular-nums'] },

  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  ctaText: { fontSize: 13, fontWeight: '600' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 14,
  },
  sheetGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetOptionText: { fontSize: 15 },
  sheetCancel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  sheetCancelText: { fontSize: 15, fontWeight: '500' },
});
