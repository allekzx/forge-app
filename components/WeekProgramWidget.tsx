import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { DAY_LABELS_SHORT, ProgramDay, Program } from '@/constants/programs';
import { Fonts, Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { WeeklyStats, WorkoutTemplateSummary } from '@/services/DatabaseService';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

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
  onStartTemplate: (templateId: string) => void;
  onScheduleChange: (newSchedule: (ProgramDay | null)[]) => void;
}

export function WeekProgramWidget({
  stats, program, schedule, templates,
  onOpenSelect, onStartTemplate, onScheduleChange,
}: Props) {
  const colors = useColors();
  const [editMode, setEditMode] = useState(false);
  const [editDayIndex, setEditDayIndex] = useState<number | null>(null);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const activeDays = stats?.days.map(d => d.hasWorkout) ?? Array(7).fill(false);
  const activeCount = activeDays.filter(Boolean).length;

  const nextWorkout = (() => {
    for (let i = 0; i < 7; i++) {
      const idx = (todayIdx + i) % 7;
      if (schedule[idx]) return { dayIndex: idx, day: schedule[idx]! };
    }
    return null;
  })();

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
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {program ? (
            <>
              <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>CETTE SEMAINE</ThemedText>
              <ThemedText style={[styles.programName, { color: colors.text }]}>{program.name}</ThemedText>
            </>
          ) : (
            <ThemedText style={[styles.title, { color: colors.text }]}>Activité de la semaine</ThemedText>
          )}
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.badge, { backgroundColor: colors.tint + '20' }]}>
            <ThemedText style={[styles.badgeText, { color: colors.tint }]}>{activeCount}/7</ThemedText>
          </View>
          {program && (
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: editMode ? colors.tint : colors.background }]}
              onPress={toggleEdit}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol name="pencil" size={14} color={editMode ? '#0F172A' : colors.icon} />
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

          let pillBg: string | undefined;
          if (planned) {
            pillBg = isToday ? colors.tint + '50' : colors.tint + '20';
          } else if (done) {
            pillBg = colors.success + '18';
          }

          const pillTextColor = planned
            ? colors.tint
            : done ? colors.success : isToday ? colors.text : colors.icon + '70';

          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayCol, editMode && { opacity: editDayIndex === null || editDayIndex === i ? 1 : 0.45 }]}
              onPress={() => editMode && setEditDayIndex(i)}
              activeOpacity={editMode ? 0.7 : 1}
              disabled={!editMode}
            >
              <View style={[
                styles.dayPill,
                pillBg ? { backgroundColor: pillBg } : {},
                done && !planned ? { borderColor: colors.success + '70', borderWidth: 1 } : {},
                isToday && !planned && !done ? { borderColor: colors.text + '50', borderWidth: 1 } : {},
              ]}>
                <ThemedText
                  style={[styles.dayPillText, {
                    color: pillTextColor,
                    fontWeight: planned ? '700' : '500',
                    fontSize: planned ? 9 : 10,
                  }]}
                  numberOfLines={1}
                >
                  {planned ? planned.label.slice(0, 2) : label}
                </ThemedText>
              </View>

              <View style={styles.indicator}>
                {done
                  ? <IconSymbol name="checkmark.circle.fill" size={11} color={colors.success} />
                  : <View style={[styles.dot, { backgroundColor: isToday ? colors.tint : colors.icon + '30' }]} />
                }
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
      <View style={[styles.statsRow, { borderTopColor: colors.background }]}>
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

      {/* Next workout banner (program active + not editing) */}
      {!editMode && nextWorkout && program && (
        <View style={[styles.nextBanner, { borderTopColor: colors.background }]}>
          <View style={styles.nextInfo}>
            <View style={[styles.nextDot, {
              backgroundColor: nextWorkout.dayIndex === todayIdx ? colors.tint : colors.icon,
            }]} />
            <ThemedText style={[styles.nextLabel, { color: colors.icon }]}>
              {nextWorkout.dayIndex === todayIdx ? "Aujourd'hui · " : 'Prochain · '}
              <ThemedText style={[styles.nextWorkoutName, { color: colors.text }]}>
                {nextWorkout.day.label}
              </ThemedText>
            </ThemedText>
          </View>
          {nextWorkout.dayIndex === todayIdx && (
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: colors.tint }]}
              onPress={() => {
                const tpl =
                  templates.find(t => t.id === nextWorkout.day.templateId) ??
                  templates.find(t => t.name === nextWorkout.day.label);
                if (tpl) onStartTemplate(tpl.id);
              }}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.startBtnText}>Démarrer</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Bottom action row */}
      {!editMode && (
        <TouchableOpacity
          style={[styles.ctaRow, { borderTopColor: colors.background }]}
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
  container: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: 20, overflow: 'hidden' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 2,
  },
  programName: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm },
  badgeText: { fontSize: 12, fontWeight: '700', fontFamily: Fonts?.mono },
  editBtn: {
    width: 30, height: 30, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },

  editHint: {
    fontSize: 12, paddingHorizontal: 16, paddingBottom: 8,
  },

  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  dayCol: { alignItems: 'center', flex: 1, gap: 3 },
  dayPill: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  dayPillText: { textAlign: 'center', fontFamily: Fonts?.mono },
  indicator: { height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dayLabel: { fontSize: 9, fontWeight: '500' },
  todayDot: { width: 4, height: 4, borderRadius: 2 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  statItem: {},
  statLabel: { fontSize: 11, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.6 },
  statValue: { fontSize: 16, fontWeight: '700', fontFamily: Fonts?.mono, fontVariant: ['tabular-nums'] },

  nextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  nextInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  nextDot: { width: 6, height: 6, borderRadius: 3 },
  nextLabel: { fontSize: 13 },
  nextWorkoutName: { fontWeight: '700' },
  startBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.sm },
  startBtnText: { fontSize: 12, fontWeight: '700', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 },

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
