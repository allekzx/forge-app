import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import exerciseImageMap from '@/assets/data/exerciseImageMap';

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { translateEquipment, translateMuscle } from '@/constants/translations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { addExercisesToTemplate, addSetToWorkout, getExercises, initDatabase } from '@/services/DatabaseService';

const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#EF4444', Lats: '#3B82F6', 'Middle back': '#3B82F6', 'Lower back': '#3B82F6',
  Traps: '#3B82F6', Quadriceps: '#8B5CF6', Hamstrings: '#8B5CF6', Glutes: '#8B5CF6',
  Calves: '#8B5CF6', Adductors: '#8B5CF6', Abductors: '#8B5CF6',
  Biceps: '#F59E0B', Triceps: '#F59E0B', Forearms: '#F59E0B',
  Shoulders: '#10B981', Neck: '#10B981', Abdominals: '#06B6D4',
};

type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  image: string | null;
};

export default function ExercisePickerScreen() {
  const { workoutId, templateId } = useLocalSearchParams<{ workoutId?: string; templateId?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = useColors();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      await initDatabase();
      const data = (await getExercises()) as Exercise[];
      setExercises(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = exercises.filter(ex => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      ex.name.toLowerCase().includes(q) ||
      ex.muscle.toLowerCase().includes(q) ||
      ex.equipment.toLowerCase().includes(q)
    );
  });

  const goBack = useCallback(() => {
    if (workoutId) {
      router.navigate({ pathname: '/workouts/[workoutId]', params: { workoutId } });
    } else if (templateId) {
      router.navigate({ pathname: '/workouts/template', params: { templateId } });
    } else {
      router.back();
    }
  }, [workoutId, templateId, router]);

  const handleSelect = useCallback(
    async (exerciseId: string) => {
      if (adding || addedIds.has(exerciseId)) return;
      if (!workoutId && !templateId) return;
      setAdding(exerciseId);
      try {
        if (workoutId) {
          await addSetToWorkout(workoutId, exerciseId);
        } else if (templateId) {
          await addExercisesToTemplate(templateId, [exerciseId]);
        }
        setAddedIds(prev => new Set(prev).add(exerciseId));
      } finally {
        setAdding(null);
      }
    },
    [workoutId, templateId, adding, addedIds]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          Ajouter un exercice
        </ThemedText>
        {addedIds.size > 0 ? (
          <TouchableOpacity onPress={goBack} style={styles.doneBtn}>
            <Text style={[styles.doneBtnText, { color: colors.tint }]}>
              Terminé ({addedIds.size})
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
        <IconSymbol name="magnifyingglass" size={16} color={colors.icon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher un exercice..."
          placeholderTextColor={colors.icon}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <IconSymbol name="xmark.circle.fill" size={16} color={colors.icon} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ThemedText>Chargement…</ThemedText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isAdding = adding === item.id;
            const isAdded = addedIds.has(item.id);
            const bundled = item.image ? exerciseImageMap[item.image] : null;
            const accentColor = MUSCLE_COLORS[item.muscle] ?? colors.tint;
            return (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: colors.card }]}
                onPress={() => handleSelect(item.id)}
                onLongPress={() => router.push({ pathname: '/exercises/[exerciseId]', params: { exerciseId: item.id } })}
                delayLongPress={400}
                disabled={!!adding || isAdded}
                activeOpacity={0.7}
              >
                {bundled ? (
                  <Image source={bundled} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: accentColor + '22', justifyContent: 'center', alignItems: 'center', borderRadius: 8 }]}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: accentColor }}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.icon }]}>
                    {`${translateMuscle(item.muscle)} · ${translateEquipment(item.equipment)}`}
                  </Text>
                </View>
                {isAdding || isAdded ? (
                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                ) : (
                  <IconSymbol name="plus.circle" size={20} color={colors.tint} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16 },
  doneBtn: { paddingHorizontal: 8, paddingVertical: 4, minWidth: 40, alignItems: 'flex-end' },
  doneBtnText: { fontSize: 14, fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)' },
  thumbFallbackText: { fontSize: 18, fontWeight: 'bold' },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowMeta: { fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
