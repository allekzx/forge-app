import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { WeeklyStats, getWeeklyStats, initDatabase } from '@/services/DatabaseService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

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

export function WeeklyActivityWidget() {
  const colorScheme = useColorScheme();
  const colors = useColors();
  const [stats, setStats] = useState<WeeklyStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          await initDatabase();
          const data = await getWeeklyStats();
          if (!cancelled) setStats(data);
        } catch (e) {
          console.error('[WeeklyActivityWidget] load error:', e);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const activeDays = stats?.days.map(d => d.hasWorkout) ?? Array(7).fill(false);
  const activeCount = activeDays.filter(Boolean).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Activité de la semaine</Text>
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: colors.tint }]}>{activeCount}/7 jours</Text>
        </View>
      </View>

      <View style={styles.daysContainer}>
        {DAY_LABELS.map((day, index) => (
          <View key={index} style={styles.dayColumn}>
            <View
              style={[
                styles.dayCircle,
                {
                  borderColor: activeDays[index] ? colors.success : 'transparent',
                  borderWidth: 1,
                  backgroundColor: activeDays[index] ? 'rgba(34,197,94,0.08)' : 'transparent',
                },
              ]}
            >
              <Text style={[styles.dayText, { color: colors.text }]}>{day}</Text>
            </View>
            <View style={{ marginTop: 4 }}>
              {activeDays[index] ? (
                <IconSymbol name="checkmark.circle.fill" size={12} color={colors.success} />
              ) : (
                <View style={[styles.dot, { backgroundColor: colors.icon }]} />
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.statsContainer, { borderTopColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <View>
          <Text style={[styles.statLabel, { color: colors.icon }]}>Volume</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats ? formatVolume(stats.totalVolume) : '—'}
          </Text>
        </View>
        <View>
          <Text style={[styles.statLabel, { color: colors.icon }]}>Durée</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats ? formatDuration(stats.totalDurationMinutes) : '—'}
          </Text>
        </View>
        <View>
          <Text style={[styles.statLabel, { color: colors.icon }]}>Séances</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats?.workoutCount ?? '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: 'rgba(0, 242, 96, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dayColumn: {
    alignItems: 'center',
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 16,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
