# Implementation Plan: Corrections Pré-Production

**Branch**: `002-fix-prod-blockers` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary

Résolution des 7 problèmes identifiés lors de l'audit pré-production de l'app Strong v3 (React Native / Expo). Corrections purement UI et navigation — zéro changement de schéma DB. Priorité : navigation séance → protection données → cohérence visuelle → erreurs → polish.

## Technical Context

**Language/Version**: TypeScript / React Native (Expo SDK 54)  
**Primary Dependencies**: expo-router ~6, expo-sqlite ~16, react-native-reanimated ~4, react-native-safe-area-context ~5  
**Storage**: SQLite local via expo-sqlite (offline-first, no migrations requises)  
**Testing**: Aucun framework de test configuré — validation manuelle par écran  
**Target Platform**: iOS + Android (pas de web en prod)  
**Project Type**: Application mobile de suivi d'entraînement  
**Performance Goals**: 60 fps sur FlatList, animations ≤ 16ms  
**Constraints**: Offline uniquement, modifications non-destructives du schéma existant  
**Scale/Scope**: Application mono-utilisateur, 1592 exercices bundlés

## Constitution Check

*Constitution non configurée pour ce projet — pas de gates bloquants.*

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-prod-blockers/
├── plan.md              ← ce fichier
├── research.md          ← décisions techniques
├── data-model.md        ← interfaces et tokens modifiés
├── quickstart.md        ← ordre d'implémentation + tests manuels
├── contracts/
│   └── screens.md       ← contrats navigation et composants
└── tasks.md             ← généré par /speckit-tasks
```

### Source Code (fichiers concernés)

```text
constants/
└── theme.ts                          # Fix: retirer success de AccentPalettes

components/
├── shared/
│   └── ErrorView.tsx                 # NOUVEAU: composant d'erreur réutilisable
└── workout/
    └── RestTimer.tsx                 # Fix: barre timer → colors.tint

services/
└── DatabaseService.ts               # Fix: getWorkouts(onlyFinished?)

app/
├── (tabs)/
│   ├── history.tsx                   # Fix: filtre + ErrorView
│   ├── index.tsx                     # Fix: ErrorView
│   ├── workout.tsx                   # Fix: ErrorView
│   ├── exercises.tsx                 # Fix: ErrorView
│   └── stats.tsx                     # Fix: ErrorView
├── workouts/
│   └── [workoutId].tsx              # Fix: bouton minimiser + beforeRemove + set type picker
└── add-exercise.tsx                  # Fix: toast de confirmation
```

## Corrections détaillées

### CORRECTION 1 — Couleur `success` cohérente (P1 — impact global)

**Fichier**: `constants/theme.ts`

**Problème**: `AccentPalettes` contient un champ `success` qui écrase le `Colors.success = '#22C55E'` sémantique. Avec l'accent "bleu", `colors.success` devient `#3B82F6` (bleu) → les sets complétés sont bleus, les chips de filtre sont bleus.

**Fix**:
- Supprimer le champ `success` de chaque entrée de `AccentPalettes`
- `getColors()` retournera toujours `success: '#22C55E'` (depuis `Colors[scheme]`)
- Supprimer toute occurrence de `#00F260` dans le code

**Lignes concernées**:  
```
theme.ts:66-70 — AccentPalettes entries
```

---

### CORRECTION 2 — Barre de progression RestTimer (P1 — cohérence accent)

**Fichier**: `components/workout/RestTimer.tsx`

**Problème**: `StyleSheet.create` ligne 190 : `backgroundColor: '#F97316'` hardcodé. La barre du timer est toujours orange même si l'accent est "bleu" ou "vert".

**Fix**:
- Retirer `backgroundColor` du `StyleSheet.create` pour `barFill`
- Passer `{ backgroundColor: colors.tint }` en style inline sur `<Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: colors.tint }]} />`
- `colors` est déjà importé via `useColors()` dans le composant

**Lignes concernées**:  
```
RestTimer.tsx:165 — <Animated.View> barFill
RestTimer.tsx:190 — StyleSheet.barFill
```

---

### CORRECTION 3 — Historique filtre séances terminées (P1 — logique fonctionnelle)

**Fichier 1**: `services/DatabaseService.ts`

**Fix**: Ajouter paramètre `onlyFinished?: boolean` à `getWorkouts()` :
```ts
export const getWorkouts = async (onlyFinished?: boolean): Promise<WorkoutSummary[]> => {
  const database = await openDatabase();
  const rows = await database.getAllAsync<WorkoutSummary>(`
    SELECT w.id, w.name, w.created_at, w.finished_at, COUNT(we.id) as exerciseCount
    FROM workouts w
    LEFT JOIN workout_exercises we ON we.workout_id = w.id
    ${onlyFinished ? 'WHERE w.finished_at IS NOT NULL' : ''}
    GROUP BY w.id
    ORDER BY w.created_at DESC
  `);
  return rows;
};
```

**Lignes concernées**: `DatabaseService.ts:340-350`

**Fichier 2**: `app/(tabs)/history.tsx`

**Fix**:
- Changer `getWorkouts()` → `getWorkouts(true)`
- Mettre à jour le message d'état vide en "Aucune séance terminée."
- Ajouter `<ErrorView />` dans le catch (voir Correction 4)

**Lignes concernées**: `history.tsx:34`

---

### CORRECTION 4 — Composant ErrorView (P1 — qualité prod)

**Fichier**: `components/shared/ErrorView.tsx` (NOUVEAU)

```tsx
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColors } from '@/hooks/use-colors';

interface ErrorViewProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorView({ message = 'Impossible de charger les données.', onRetry }: ErrorViewProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <ThemedText style={[styles.message, { color: colors.icon }]}>{message}</ThemedText>
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.tint }]} onPress={onRetry}>
        <ThemedText style={styles.buttonText}>Réessayer</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  message: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  button: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#0F172A', fontWeight: '600' },
});
```

**Intégration dans chaque écran** (pattern uniforme) :
```tsx
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

const loadData = useCallback(async () => {
  setError(null);
  setLoading(true);
  try {
    await initDatabase();
    // ... fetch data ...
    setLoading(false);
  } catch (e) {
    console.error('[screen] load error:', e);
    setError('Impossible de charger les données.');
    setLoading(false);
  }
}, []);

// Dans le rendu :
if (error) return <ErrorView message={error} onRetry={loadData} />;
```

**Écrans à mettre à jour** : `history.tsx`, `index.tsx`, `workout.tsx`, `exercises.tsx`, `stats.tsx`

---

### CORRECTION 5 — Bouton Minimiser + Confirmation Back (P1 — protection données)

**Fichier**: `app/workouts/[workoutId].tsx`

**5a — Bouton Minimiser**

Ajouter dans le header de l'écran un bouton "↓" (flèche bas ou icône `chevron.down`) :
```tsx
<TouchableOpacity onPress={() => router.back()} style={styles.minimizeBtn}>
  <IconSymbol name="chevron.down" size={24} color={colors.icon} />
</TouchableOpacity>
```

Ce bouton doit être visible en permanence dans le header de la séance. Appuyer dessus = `router.back()` = retour aux tabs. La séance reste active (non terminée), le banner "Reprendre" apparaît.

**5b — Listener beforeRemove**

Ajouter dans `useEffect` après le chargement de la session :
```tsx
import { useNavigation } from '@react-navigation/native';

const navigation = useNavigation();

useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', (e) => {
    const hasCompletedSets = session?.exercises.some(ex =>
      ex.sets.some(s => s.completed_at !== null)
    );
    
    if (!hasCompletedSets) {
      // Séance vide : proposer annulation
      e.preventDefault();
      Alert.alert(
        'Annuler la séance ?',
        'Aucun set complété. Veux-tu annuler cette séance ?',
        [
          { text: 'Continuer', style: 'cancel' },
          { text: 'Annuler la séance', style: 'destructive', onPress: () => {
            // optionnel: supprimer la séance vide
            navigation.dispatch(e.data.action);
          }},
        ]
      );
      return;
    }
    
    e.preventDefault();
    Alert.alert(
      'Mettre en pause ?',
      'Ta séance sera sauvegardée. Tu pourras la reprendre depuis l\'accueil.',
      [
        { text: 'Continuer la séance', style: 'cancel' },
        { text: 'Mettre en pause', onPress: () => navigation.dispatch(e.data.action) },
      ]
    );
  });
  return unsubscribe;
}, [navigation, session]);
```

**Dépendances** : `useNavigation` de `@react-navigation/native` (déjà installé).

---

### CORRECTION 6 — Sélecteur type de set dans séance live (P2)

**Fichier**: `app/workouts/[workoutId].tsx`

**6a — État**
```tsx
const [liveSetTypePicker, setLiveSetTypePicker] = useState<{
  setId: string;
  currentType: string;
} | null>(null);
```

**6b — Handler long-press**
```tsx
const handleSetTypeLongPress = useCallback((setId: string, currentType: string) => {
  setLiveSetTypePicker({ setId, currentType });
}, []);
```

**6c — Passer la prop à SetRow**  
Dans le rendu de chaque `SetRow`, ajouter :
```tsx
onLongPressIndex={() => handleSetTypeLongPress(set.id, set.set_type ?? 'normal')}
```

**6d — Modal de sélection** (copier depuis `template.tsx`)  
Ajouter une `<Modal>` visible quand `liveSetTypePicker !== null`, avec les 4 options (Normal, Échauffement, Drop Set, Échec). On confirmation :
```tsx
await updateWorkoutSet(liveSetTypePicker.setId, { set_type: selectedType });
// Recharger la session pour refléter le changement
setLiveSetTypePicker(null);
```

---

### CORRECTION 7 — Toast confirmation création exercice (P3)

**Fichier**: `app/add-exercise.tsx`

Ajouter un état `showToast` et un composant View animée :
```tsx
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
```

Appeler `showSuccessToast()` à la place de `router.back()` après une création réussie.

## Complexity Tracking

Aucune violation de complexité. Toutes les modifications sont des corrections localisées à des fichiers existants ou l'ajout d'un seul petit composant (`ErrorView`).
