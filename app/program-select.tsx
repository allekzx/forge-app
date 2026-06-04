import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  DAY_LABELS_SHORT,
  PROGRAMS,
  Program,
  todayScheduleIndex,
} from '@/constants/programs';
import { useColors } from '@/hooks/use-colors';
import { getActiveProgram, setActiveProgram } from '@/services/ProgramService';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAY_GROUPS = [2, 3, 4, 5, 6];

export default function ProgramSelectScreen() {
  const colors = useColors();
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    getActiveProgram().then(p => setActiveId(p?.id ?? null));
  }, []);

  const handleSelect = async (program: Program) => {
    setSelecting(program.id);
    await setActiveProgram(program);
    setActiveId(program.id);
    setSelecting(null);
    router.back();
  };

  const handleDeselect = async () => {
    await setActiveProgram(null);
    setActiveId(null);
    router.back();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.card }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Choisir un programme</ThemedText>
        {activeId ? (
          <TouchableOpacity
            onPress={handleDeselect}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.clearBtn, { color: colors.icon }]}>Effacer</ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={[styles.intro, { color: colors.icon }]}>
          Tous les programmes utilisent tes routines Push, Pull, Legs, Upper et Lower.
        </ThemedText>

        {DAY_GROUPS.map(days => {
          const group = PROGRAMS.filter(p => p.daysPerWeek === days);
          if (!group.length) return null;
          return (
            <View key={days} style={styles.group}>
              <ThemedText style={[styles.groupTitle, { color: colors.icon }]}>
                {days} jours / semaine
              </ThemedText>
              {group.map(program => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  isActive={activeId === program.id}
                  loading={selecting === program.id}
                  colors={colors}
                  onSelect={() => handleSelect(program)}
                />
              ))}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgramCard({
  program, isActive, loading, colors, onSelect,
}: {
  program: Program;
  isActive: boolean;
  loading: boolean;
  colors: any;
  onSelect: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const todayIdx = todayScheduleIndex();

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card },
          isActive && { borderColor: colors.tint, borderWidth: 1.5 },
        ]}
      >
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <ThemedText style={[styles.cardName, { color: colors.text }]}>{program.name}</ThemedText>
            {program.recommended && (
              <View style={[styles.recommendedBadge, { backgroundColor: colors.tint + '20' }]}>
                <ThemedText style={[styles.recommendedText, { color: colors.tint }]}>✦ Recommandé</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={[styles.cardTagline, { color: colors.icon }]}>{program.tagline}</ThemedText>
        </View>

        {/* Mini week grid */}
        <View style={styles.miniWeek}>
          {program.weekSchedule.map((day, i) => {
            const isToday = i === todayIdx;
            const hasWorkout = !!day;
            return (
              <View key={i} style={styles.miniDayCol}>
                <View
                  style={[
                    styles.miniDayPill,
                    hasWorkout
                      ? { backgroundColor: isActive ? colors.tint + '30' : colors.tint + '18' }
                      : { backgroundColor: 'transparent' },
                    isToday && hasWorkout && isActive && { backgroundColor: colors.tint + '50' },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.miniDayText,
                      {
                        color: hasWorkout ? colors.tint : colors.icon + '40',
                        fontWeight: hasWorkout ? '700' : '400',
                      },
                    ]}
                  >
                    {day ? day.label.charAt(0) : DAY_LABELS_SHORT[i]}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.miniDayLabel, { color: isToday ? colors.text : colors.icon + '80' }]}>
                  {DAY_LABELS_SHORT[i]}
                </ThemedText>
              </View>
            );
          })}
        </View>

        {/* Muscles info */}
        <View style={[styles.musclesRow, { borderTopColor: colors.background }]}>
          <IconSymbol name="bolt.fill" size={11} color={colors.icon} />
          <ThemedText style={[styles.musclesText, { color: colors.icon }]}>{program.muscles}</ThemedText>
        </View>

        {/* Description */}
        <ThemedText style={[styles.cardDesc, { color: colors.icon }]}>{program.description}</ThemedText>

        {/* Action */}
        <TouchableOpacity
          style={[
            styles.selectBtn,
            {
              backgroundColor: isActive ? colors.tint : colors.tint + '15',
            },
          ]}
          onPress={onSelect}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.85}
          disabled={loading}
        >
          {isActive ? (
            <>
              <IconSymbol name="checkmark" size={14} color="#0F172A" />
              <ThemedText style={[styles.selectBtnText, { color: '#0F172A' }]}>Programme actif</ThemedText>
            </>
          ) : (
            <ThemedText style={[styles.selectBtnText, { color: colors.tint }]}>
              {loading ? 'Chargement…' : 'Sélectionner'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  clearBtn: { fontSize: 14, fontWeight: '500', width: 50, textAlign: 'right' },

  content: { padding: 16, gap: 4 },
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 8 },

  group: { marginBottom: 8 },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 2,
  },

  card: {
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardHeader: { padding: 14, paddingBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 15, fontWeight: '700' },
  recommendedBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  recommendedText: { fontSize: 11, fontWeight: '700' },
  cardTagline: { fontSize: 12, marginTop: 3 },

  miniWeek: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  miniDayCol: { alignItems: 'center', flex: 1, gap: 3 },
  miniDayPill: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  miniDayText: { fontSize: 9 },
  miniDayLabel: { fontSize: 9 },

  musclesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  musclesText: { fontSize: 11 },

  cardDesc: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },

  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 14,
    height: 40,
    borderRadius: 10,
  },
  selectBtnText: { fontSize: 14, fontWeight: '700' },
});
