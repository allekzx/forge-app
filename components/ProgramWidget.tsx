import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { DAY_LABELS_SHORT, Program, nextWorkoutDay, todayScheduleIndex } from '@/constants/programs';
import { useColors } from '@/hooks/use-colors';
import { getActiveProgram } from '@/services/ProgramService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  onOpenSelect: () => void;
  onStartTemplate: (templateId: string) => void;
}

export function ProgramWidget({ onOpenSelect, onStartTemplate }: Props) {
  const colors = useColors();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      getActiveProgram().then(setProgram);
    }, [])
  );

  if (program === undefined) return null;

  if (!program) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.tint + '30' }]}
        onPress={onOpenSelect}
        activeOpacity={0.7}
      >
        <View style={[styles.emptyIcon, { backgroundColor: colors.tint + '15' }]}>
          <IconSymbol name="calendar" size={22} color={colors.tint} />
        </View>
        <View style={styles.emptyText}>
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>Choisir un programme</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.icon }]}>
            Planifie ta semaine et ne rate aucune séance
          </ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.icon} />
      </TouchableOpacity>
    );
  }

  const todayIdx = todayScheduleIndex();
  const next = nextWorkoutDay(program);
  const todayWorkout = program.weekSchedule[todayIdx];

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>MON PROGRAMME</ThemedText>
          <ThemedText style={[styles.programName, { color: colors.text }]}>{program.name}</ThemedText>
        </View>
        <TouchableOpacity
          style={[styles.changeBtn, { backgroundColor: colors.background }]}
          onPress={onOpenSelect}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ThemedText style={[styles.changeBtnText, { color: colors.tint }]}>Modifier</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Week grid */}
      <View style={styles.weekRow}>
        {DAY_LABELS_SHORT.map((label, i) => {
          const day = program.weekSchedule[i];
          const isToday = i === todayIdx;
          const hasWorkout = !!day;

          return (
            <View key={i} style={styles.dayCol}>
              <View
                style={[
                  styles.dayPill,
                  hasWorkout && { backgroundColor: isToday ? colors.tint : colors.tint + '20' },
                  !hasWorkout && { backgroundColor: 'transparent' },
                ]}
              >
                <ThemedText
                  style={[
                    styles.dayPillLabel,
                    { color: hasWorkout ? (isToday ? '#0F172A' : colors.tint) : colors.icon + '60' },
                    isToday && !hasWorkout && { color: colors.text, fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {day ? day.label.slice(0, 2) : label}
                </ThemedText>
              </View>
              <ThemedText style={[styles.dayLabel, { color: isToday ? colors.text : colors.icon }]}>
                {label}
              </ThemedText>
              {isToday && (
                <View style={[styles.todayDot, { backgroundColor: colors.tint }]} />
              )}
            </View>
          );
        })}
      </View>

      {/* Today / Next workout banner */}
      {next && (
        <View style={[styles.nextBanner, { borderTopColor: colors.background }]}>
          <View style={styles.nextInfo}>
            <View style={[styles.nextDot, { backgroundColor: next.dayIndex === todayIdx ? colors.tint : colors.icon }]} />
            <ThemedText style={[styles.nextLabel, { color: colors.icon }]}>
              {next.dayIndex === todayIdx ? "Aujourd'hui · " : 'Prochain · '}
              <ThemedText style={[styles.nextWorkoutName, { color: colors.text }]}>
                {next.day.label}
              </ThemedText>
            </ThemedText>
          </View>
          {next.dayIndex === todayIdx && todayWorkout && (
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: colors.tint }]}
              onPress={() => onStartTemplate(todayWorkout.templateId)}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.startBtnText}>Démarrer</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 12,
  },
  emptyIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { flex: 1 },
  emptyTitle: { fontSize: 14, fontWeight: '600' },
  emptySubtitle: { fontSize: 12, marginTop: 2 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  programName: { fontSize: 16, fontWeight: '700' },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeBtnText: { fontSize: 13, fontWeight: '600' },

  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  dayCol: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  dayPill: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dayPillLabel: { fontSize: 10, fontWeight: '700' },
  dayLabel: { fontSize: 10, fontWeight: '500' },
  todayDot: {
    width: 4, height: 4, borderRadius: 2,
  },

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
  startBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8,
  },
  startBtnText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
});
