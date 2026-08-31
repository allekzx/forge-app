import { IconSymbol } from '@/components/ui/icon-symbol';

import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/constants/translations';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { addExercise } from '@/services/DatabaseService';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '@/utils/alert';

export default function AddExerciseScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = useColors();

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showSuccessToast = () => {
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setShowToast(false);
      router.back();
    });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name || !muscle || !equipment) {
      Alert.alert('Champs manquants', 'Merci de renseigner le nom, le groupe musculaire et l\'équipement.');
      return;
    }

    setLoading(true);
    try {
      await addExercise({
        name,
        muscle,
        equipment,
        description,
        image: image ?? undefined,
      });
      showSuccessToast();
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'exercice. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  const muscles = ['Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core', 'Cardio', 'Full Body'];
  const equipments = ['Barbell', 'Dumbbell', 'Machine', 'Body Only', 'Cable', 'Kettlebell', 'Other'];
  const muscleLabel = (m: string) => MUSCLE_LABELS[m] ?? m;
  const equipLabel = (e: string) => EQUIPMENT_LABELS[e] ?? e;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <IconSymbol name="chevron.left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Nouvel exercice</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
          <Text style={[styles.saveText, { color: colors.tint }]}>Enregistrer</Text>
        </TouchableOpacity>
      </View>

      {showToast && (
        <Animated.View style={[styles.toast, { backgroundColor: colors.tint, opacity: toastOpacity }]}>
          <Text style={styles.toastText}>Exercice créé ✓</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* Image Picker */}
        <TouchableOpacity onPress={pickImage} style={[styles.imagePicker, { backgroundColor: colors.card, borderColor: colors.icon }]}>
          {image ? (
            <Image source={{ uri: image }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <IconSymbol name="camera.fill" size={32} color={colors.icon} />
              <Text style={[styles.imageText, { color: colors.icon }]}>Ajouter une photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Nom</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
            placeholder="ex. Développé couché"
            placeholderTextColor={colors.icon}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Muscle Selector (Simple Chips) */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Groupe musculaire</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {muscles.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, { backgroundColor: muscle === m ? colors.tint : colors.card }]}
                onPress={() => setMuscle(m)}
              >
                <Text style={[styles.chipText, { color: muscle === m ? '#0F172A' : colors.text }]}>{muscleLabel(m)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Equipment Selector */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Équipement</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {equipments.map(e => (
              <TouchableOpacity
                key={e}
                style={[styles.chip, { backgroundColor: equipment === e ? colors.tint : colors.card }]}
                onPress={() => setEquipment(e)}
              >
                <Text style={[styles.chipText, { color: equipment === e ? '#0F172A' : colors.text }]}>{equipLabel(e)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Description (optionnel)</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.text }]}
            placeholder="Notes ou instructions…"
            placeholderTextColor={colors.icon}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconBtn: {
    padding: 8,
  },
  saveBtn: {
    padding: 8,
  },
  saveText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  imagePicker: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageText: {
    fontSize: 12,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    height: 36,
    justifyContent: 'center',
  },
  chipText: {
    fontWeight: '600',
    fontSize: 14,
  },
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 100,
  },
  toastText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
});
