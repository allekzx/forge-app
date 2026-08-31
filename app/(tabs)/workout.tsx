import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '@/utils/alert';

import { ErrorView } from '@/components/shared/ErrorView';
import { QuickStartWidget } from '@/components/QuickStartWidget';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import {
  WorkoutTemplateSummary,
  createEmptyWorkout,
  deleteTemplate,
  getActiveWorkout,
  getWorkoutTemplates,
  initDatabase,
  startWorkoutFromTemplate,
} from '@/services/DatabaseService';
import { useFocusEffect, useRouter } from 'expo-router';

export default function WorkoutScreen() {
  const colorScheme = useColorScheme();
  const colors = useColors();
  const [templates, setTemplates] = useState<WorkoutTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<{ id: string; name: string } | null>(null);
  const [menuTemplate, setMenuTemplate] = useState<WorkoutTemplateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await initDatabase();
      const templatesData = await getWorkoutTemplates();
      const aw = await getActiveWorkout();
      setTemplates(templatesData);
      setActiveWorkout(aw);
    } catch (e) {
      console.error('[workout] load error:', e);
      setError('Impossible de charger les routines.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload templates + active workout on every focus (handles create/edit/delete)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleMenuStart = async (item: WorkoutTemplateSummary) => {
    setMenuTemplate(null);
    try {
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
      const id = await startWorkoutFromTemplate(item.id);
      if (id) router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: id } });
    } catch (e) {
      console.error('[workout] handleMenuStart error:', e);
    }
  };

  const handleMenuEdit = (item: WorkoutTemplateSummary) => {
    setMenuTemplate(null);
    router.push({ pathname: '/workouts/template', params: { templateId: item.id } });
  };

  const handleMenuDelete = (item: WorkoutTemplateSummary) => {
    setMenuTemplate(null);
    Alert.alert(
      'Supprimer la routine',
      `Supprimer "${item.name}" définitivement ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteTemplate(item.id);
            setTemplates(prev => prev.filter(t => t.id !== item.id));
          },
        },
      ]
    );
  };

  const handleQuickStart = async () => {
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
      const workoutId = await createEmptyWorkout();
      router.push({ pathname: '/workouts/[workoutId]', params: { workoutId } });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {error ? (
        <ErrorView message={error} onRetry={loadData} />
      ) : (
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>Séances</ThemedText>

        {activeWorkout && (
          <TouchableOpacity
            style={[styles.activeBanner, { backgroundColor: colors.tint }]}
            onPress={() =>
              router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: activeWorkout.id } })
            }
            activeOpacity={0.85}
          >
            <View style={styles.activeBannerLeft}>
              <Text style={styles.activeBannerLabel}>Séance en cours</Text>
              <Text style={styles.activeBannerName} numberOfLines={1}>{activeWorkout.name}</Text>
            </View>
            <Text style={styles.activeBannerCta}>Reprendre →</Text>
          </TouchableOpacity>
        )}

        {!activeWorkout && <QuickStartWidget onPress={handleQuickStart} />}

        <ThemedView style={styles.routinesHeader}>
          <ThemedText style={styles.sectionTitle}>ROUTINES</ThemedText>
          <TouchableOpacity onPress={() => router.push('/workouts/new-template')} style={styles.iconButton}>
            <IconSymbol name="plus" size={24} color={colors.tint} />
          </TouchableOpacity>
        </ThemedView>

        {loading && (
          <ThemedText>Chargement...</ThemedText>
        )}

        {!loading && templates.length === 0 && (
          <ThemedText style={{ marginTop: 8 }}>
            Aucune routine pour l’instant. Crée une routine pour commencer.
          </ThemedText>
        )}

        {!loading && templates.length > 0 && (
          <View style={styles.listContent}>
            {templates.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() =>
                  router.push({ pathname: '/workouts/template', params: { templateId: item.id } })
                }
                activeOpacity={0.7}
              >
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                  <View style={styles.cardHeader}>
                    <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                      {item.name}
                    </ThemedText>
                    <TouchableOpacity
                      style={styles.ellipsisBtn}
                      onPress={() => setMenuTemplate(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <IconSymbol name="ellipsis" size={20} color={colors.icon} />
                    </TouchableOpacity>
                  </View>
                  <ThemedText type="default" style={[styles.cardMeta, { color: colors.icon }]}>
                    {item.exerciseCount} exercice{item.exerciseCount > 1 ? 's' : ''}
                    {item.lastPerformedAt
                      ? ` · ${new Date(item.lastPerformedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                      : ''}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      )}

      {/* Menu contextuel template */}
      <Modal
        visible={menuTemplate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTemplate(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuTemplate(null)}>
          <View style={[styles.menuSheet, { backgroundColor: colors.card }]}>
            {menuTemplate && (
              <>
                <Text style={[styles.menuTitle, { color: colors.text }]} numberOfLines={1}>
                  {menuTemplate.name}
                </Text>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuStart(menuTemplate)}
                >
                  <IconSymbol name="play.fill" size={18} color={colors.tint} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Démarrer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuEdit(menuTemplate)}
                >
                  <IconSymbol name="pencil" size={18} color={colors.tint} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Modifier</Text>
                </TouchableOpacity>
                <View style={[styles.menuDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuDelete(menuTemplate)}
                >
                  <IconSymbol name="trash" size={18} color="#FF3B30" />
                  <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Supprimer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 24,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    minHeight: 56,
  },
  activeBannerLeft: { flex: 1 },
  activeBannerLabel: { fontSize: 14, fontWeight: '700', opacity: 0.7, color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 },
  activeBannerName: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
  activeBannerCta: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', marginLeft: 12 },

  routinesHeader: {
    marginTop: 24,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  iconButton: {
    padding: 8,
  },
  listContent: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    flex: 1,
  },
  ellipsisBtn: {
    paddingLeft: 12,
    paddingBottom: 8,
  },
  cardMeta: {
    fontSize: 14,
    opacity: 0.8,
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    marginVertical: 4,
  },
});
