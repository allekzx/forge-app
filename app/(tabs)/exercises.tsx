import exerciseImageMap from '@/assets/data/exerciseImageMap';
import { ErrorView } from '@/components/shared/ErrorView';
import { initialExercises } from '@/assets/data/generatedExercises';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { MUSCLE_LABELS, translateEquipment, translateMuscle } from '@/constants/translations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { addExercisesToTemplate, createWorkoutWithExercises, getExercises, initDatabase } from '@/services/DatabaseService';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ITEM_HEIGHT = 81;

// Maps broad filter labels to exact muscle values in the DB
const CATEGORY_MUSCLES: Record<string, string[]> = {
  All:       [],
  Chest:     ['Chest'],
  Back:      ['Lats', 'Middle back', 'Lower back', 'Traps'],
  Legs:      ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors'],
  Arms:      ['Biceps', 'Triceps', 'Forearms'],
  Shoulders: ['Shoulders', 'Neck'],
  Core:      ['Abdominals'],
};

type ExerciseItemProps = {
  item: any;
  isSelected: boolean;
  colors: any;
  onPress: (id: string) => void;
};

// Color per muscle group for placeholder tiles
const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#EF4444', Lats: '#3B82F6', 'Middle back': '#3B82F6', 'Lower back': '#3B82F6',
  Traps: '#3B82F6', Quadriceps: '#8B5CF6', Hamstrings: '#8B5CF6', Glutes: '#8B5CF6',
  Calves: '#8B5CF6', Adductors: '#8B5CF6', Abductors: '#8B5CF6',
  Biceps: '#F59E0B', Triceps: '#F59E0B', Forearms: '#F59E0B',
  Shoulders: '#10B981', Neck: '#10B981', Abdominals: '#06B6D4',
};

const ExerciseItem = React.memo(({ item, isSelected, colors, onPress }: ExerciseItemProps) => {
  const accentColor = MUSCLE_COLORS[item.muscle] ?? colors.tint;
  return (
    <TouchableOpacity
      onPress={() => onPress(item.id)}
      style={[styles.itemContainer, { borderBottomColor: colors.card }]}
    >
      <View style={[styles.itemImage, { backgroundColor: accentColor + '20', justifyContent: 'center', alignItems: 'center', borderRadius: 10 }]}>
        <IconSymbol name="dumbbell.fill" size={22} color={accentColor} />
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.itemSubtitle, { color: colors.icon }]}>{`${translateMuscle(item.muscle)} • ${translateEquipment(item.equipment)}`}</Text>
      </View>
      <View style={[styles.addBtn, { backgroundColor: isSelected ? colors.tint : 'transparent', borderColor: colors.icon }]}>
        <IconSymbol
          name={isSelected ? "checkmark.circle.fill" : "plus.circle.fill"}
          size={28}
          color={isSelected ? '#0F172A' : colors.tint}
        />
      </View>
    </TouchableOpacity>
  );
});

export default function ExerciseLibraryScreen() {
  const router = useRouter();
  const { mode, templateId } = useLocalSearchParams<{ mode?: string; templateId?: string }>();
  const isTemplatePicker = mode === 'template' && typeof templateId === 'string';
  const colorScheme = useColorScheme();
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await initDatabase();
        const data = await getExercises();
        if (data && data.length > 0) {
          setExercises(data);
        } else {
          // Fallback sur les données locales si la base est vide
          setExercises(initialExercises);
        }
      } catch (e) {
        console.error("Failed to load exercises", e);
        setExercises(initialExercises);
        setLoadError("Impossible de charger la base locale. Les exercices affichés sont en lecture seule.");
      }
    };
    loadData();
  }, []);

  // Filter Data
  const categories = ['All', 'Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core'];
  const categoryLabels = categories.map(c => MUSCLE_LABELS[c] ?? c);

  const filteredExercises = useMemo(() =>
    exercises.filter(
      ex => (selectedCategory === 'All' || (CATEGORY_MUSCLES[selectedCategory] ?? []).includes(ex.muscle)) &&
        ex.name.toLowerCase().includes(search.toLowerCase())
    ),
    [exercises, selectedCategory, search]
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedExercises(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const keyExtractor = useCallback((item: any) => item.id, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const handleItemPress = useCallback((id: string) => {
    if (isTemplatePicker) {
      toggleSelection(id);
    } else {
      router.push({ pathname: '/exercises/[exerciseId]', params: { exerciseId: id } });
    }
  }, [isTemplatePicker, toggleSelection, router]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <ExerciseItem
      item={item}
      isSelected={selectedExercises.includes(item.id)}
      colors={colors}
      onPress={handleItemPress}
    />
  ), [selectedExercises, colors, handleItemPress]);

  const primaryActionLabel = isCreating
    ? 'Enregistrement…'
    : isTemplatePicker
      ? 'Ajouter à la routine'
      : 'Ajouter à la séance';

  const handlePrimaryAction = async () => {
    if (selectedExercises.length === 0 || isCreating) return;

    try {
      setIsCreating(true);

      if (isTemplatePicker && typeof templateId === 'string') {
        await addExercisesToTemplate(templateId, selectedExercises);
        setSelectedExercises([]);
        router.back();
      } else {
        const workoutId = await createWorkoutWithExercises(selectedExercises);
        setSelectedExercises([]);
        if (workoutId) {
          router.push('/(tabs)/workout');
        }
      }
    } catch (e) {
      console.error('Failed to apply selection', e);
      alert("Une erreur est survenue. Réessaie plus tard.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <IconSymbol name="chevron.left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isTemplatePicker ? 'Ajouter des exercices' : 'Bibliothèque d\'exercices'}
        </Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/add-exercise')}>
          <IconSymbol name="plus" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.icon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher un exercice"
          placeholderTextColor={colors.icon}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
          {categories.map((cat, idx) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                { backgroundColor: selectedCategory === cat ? colors.tint : colors.card }
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[
                styles.filterText,
                { color: selectedCategory === cat ? '#0F172A' : colors.text }
              ]}>{categoryLabels[idx]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Exercise List */}
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderTitle, { color: colors.tint }]}>EXERCICES POPULAIRES</Text>
      </View>

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={[styles.errorText, { color: colors.text }]}>{loadError}</Text>
        </View>
      )}

      <FlatList
        data={filteredExercises}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingBottom: 100 }}
        getItemLayout={getItemLayout}
        renderItem={renderItem}
      />

      {/* Selection Bar */}
      {selectedExercises.length > 0 && (
        <View style={[styles.selectionBar, { backgroundColor: colors.card, borderTopColor: colors.tint }]}>
          <View>
            <Text style={[styles.selectionText, { color: colors.text }]}>SÉLECTION</Text>
            <Text style={[styles.selectionCount, { color: colors.text }]}>
              {selectedExercises.length} exercice{selectedExercises.length > 1 ? 's' : ''} sélectionné{selectedExercises.length > 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addToWorkoutBtn, { backgroundColor: colors.tint, opacity: isCreating ? 0.6 : 1 }]}
            disabled={isCreating}
            onPress={handlePrimaryAction}
          >
            <Text style={styles.addToWorkoutText}>{primaryActionLabel}</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconBtn: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 8,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  filtersWrapper: {
    height: 50,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    minHeight: 44,
    justifyContent: 'center',
  },
  filterText: {
    fontWeight: '600',
    fontSize: 14,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 8,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,165,0,0.15)',
  },
  errorText: {
    fontSize: 12,
  },
  listHeaderTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#333',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 12,
  },
  addBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  selectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 32, // Safe area
    borderTopWidth: 1,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -4px 8px rgba(0,0,0,0.3)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.30, shadowRadius: 4.65, elevation: 8 }
    ),
  },
  selectionText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 2,
    opacity: 0.7,
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addToWorkoutBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addToWorkoutText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
