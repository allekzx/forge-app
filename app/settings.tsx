import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AccentKey, AccentPalettes } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/use-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getUserSetting,
  initDatabase,
  resetAllWorkoutData,
  saveUserSetting,
} from '@/services/DatabaseService';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = useColors();
  const { setColorScheme, accentColor, setAccentColor } = useTheme();
  const router = useRouter();

  const [userName, setUserName] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  // Animation pour le toggle Clair/Sombre — 0 = Clair, 1 = Sombre
  const themeAnim = useRef(new Animated.Value(colorScheme === 'dark' ? 1 : 0)).current;

  useEffect(() => {
    const load = async () => {
      try {
        await initDatabase();
        const [name, unit] = await Promise.all([
          getUserSetting('user_name', ''),
          getUserSetting('weight_unit', 'kg'),
        ]);
        setUserName(name);
        setWeightUnit(unit as 'kg' | 'lbs');
      } catch (e) {
        console.error('[settings] load error:', e);
      }
    };
    load();
  }, []);

  const handleSaveName = useCallback(async () => {
    await saveUserSetting('user_name', userName.trim());
  }, [userName]);

  const handleWeightUnit = useCallback(async (unit: 'kg' | 'lbs') => {
    setWeightUnit(unit);
    await saveUserSetting('weight_unit', unit);
  }, []);

  useEffect(() => {
    Animated.spring(themeAnim, {
      toValue: colorScheme === 'dark' ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 7,
    }).start();
  }, [colorScheme, themeAnim]);

  const handleTheme = useCallback((scheme: 'light' | 'dark') => {
    setColorScheme(scheme);
  }, [setColorScheme]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser les données',
      'Tout l\'historique de séances, les routines et les mesures seront supprimés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmer la suppression',
              'Es-tu certain ? Toutes tes données seront effacées.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer',
                  style: 'destructive',
                  onPress: async () => {
                    await resetAllWorkoutData();
                    router.replace('/(tabs)');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <IconSymbol name="chevron.left" size={24} color={colors.tint} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>Paramètres</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Profil */}
        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>MON PROFIL</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.rowLabel}>Prénom</ThemedText>
          <TextInput
            style={[styles.textInput, { color: colors.text, borderColor: colors.icon + '40' }]}
            value={userName}
            onChangeText={setUserName}
            onBlur={handleSaveName}
            placeholder="Ton prénom"
            placeholderTextColor={colors.icon}
            returnKeyType="done"
            onSubmitEditing={handleSaveName}
          />
        </View>

        {/* Préférences */}
        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>PRÉFÉRENCES</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <ThemedText style={styles.rowLabel}>Unité de poids</ThemedText>
            <View style={[styles.toggleGroup, { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[styles.toggleBtn, weightUnit === 'kg' && { backgroundColor: colors.tint }]}
                onPress={() => handleWeightUnit('kg')}
                activeOpacity={0.8}
              >
                <ThemedText style={[styles.toggleText, weightUnit === 'kg' && styles.toggleTextActive]}>
                  kg
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, weightUnit === 'lbs' && { backgroundColor: colors.tint }]}
                onPress={() => handleWeightUnit('lbs')}
                activeOpacity={0.8}
              >
                <ThemedText style={[styles.toggleText, weightUnit === 'lbs' && styles.toggleTextActive]}>
                  lbs
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.background }]} />

          <View style={styles.row}>
            <ThemedText style={styles.rowLabel}>Couleur</ThemedText>
            <View style={styles.accentRow}>
              {(Object.entries(AccentPalettes) as [AccentKey, typeof AccentPalettes[AccentKey]][]).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setAccentColor(key)}
                  style={[
                    styles.accentSwatch,
                    { backgroundColor: val.tint },
                    accentColor === key && styles.accentSwatchActive,
                  ]}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                />
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.background }]} />

          <View style={styles.row}>
            <ThemedText style={styles.rowLabel}>Thème</ThemedText>
            <View style={[styles.toggleGroup, { backgroundColor: colors.background }]}>
              {/* Indicateur glissant animé */}
              <Animated.View
                style={[
                  styles.toggleIndicator,
                  {
                    backgroundColor: colors.tint,
                    transform: [{
                      translateX: themeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 58],
                      }),
                    }],
                  },
                ]}
              />
              <TouchableOpacity style={[styles.toggleBtnFlat, styles.toggleBtnFlatRow]} onPress={() => handleTheme('light')} activeOpacity={0.7}>
                <IconSymbol name="sun.max.fill" size={13} color={colorScheme === 'light' ? '#0F172A' : colors.icon} />
                <ThemedText style={[styles.toggleText, colorScheme === 'light' && styles.toggleTextActive]}>
                  Clair
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtnFlat, styles.toggleBtnFlatRow]} onPress={() => handleTheme('dark')} activeOpacity={0.7}>
                <IconSymbol name="moon.fill" size={13} color={colorScheme === 'dark' ? '#0F172A' : colors.icon} />
                <ThemedText style={[styles.toggleText, colorScheme === 'dark' && styles.toggleTextActive]}>
                  Sombre
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Données */}
        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>DONNÉES</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.dangerRow} onPress={handleReset} activeOpacity={0.7}>
            <ThemedText style={styles.dangerText}>Réinitialiser toutes les données</ThemedText>
          </TouchableOpacity>
        </View>

        {/* À propos */}
        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>À PROPOS</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <ThemedText style={[styles.attributionText, { color: colors.icon }]}>
              Images et animations d&apos;exercices © Gym visual — gymvisual.com
            </ThemedText>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  attributionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  textInput: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleGroup: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    position: 'relative',
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 52,
    minHeight: 38,
    alignItems: 'center' as const,
    justifyContent: 'center',
  },
  toggleIndicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 58,
    bottom: 3,
    borderRadius: 8,
  },
  toggleBtnFlatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleBtnFlat: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    width: 58,
    alignItems: 'center',
    zIndex: 1,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#0F172A',
  },
  accentRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  accentSwatch: { width: 32, height: 32, borderRadius: 16 },
  accentSwatchActive: { borderWidth: 3, borderColor: 'white' },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  dangerRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF453A',
  },
});
