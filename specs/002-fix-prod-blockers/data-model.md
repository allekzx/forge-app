# Data Model: Corrections Pré-Production

**Feature**: 002-fix-prod-blockers  
**Date**: 2026-05-15

---

## Entités affectées

### Aucun changement de schéma DB

Toutes les corrections sont purement UI/navigation. Le schéma SQLite existant supporte déjà l'ensemble des besoins :

| Table | Champ | Usage | État |
|-------|-------|-------|------|
| `workouts` | `finished_at` | Filtrer séances terminées vs actives | ✅ Existant |
| `workout_sets` | `set_type` | Type de set dans séance live | ✅ Existant |
| `workout_sets` | `actual_weight`, `actual_reps`, `completed_at` | Sauvegarde pendant séance | ✅ Existant |

---

## Interfaces TypeScript modifiées

### `getWorkouts()` — DatabaseService.ts

**Avant**:
```ts
export const getWorkouts = async (): Promise<WorkoutSummary[]>
```

**Après**:
```ts
export const getWorkouts = async (onlyFinished?: boolean): Promise<WorkoutSummary[]>
```

Quand `onlyFinished = true`, ajoute `WHERE w.finished_at IS NOT NULL` à la requête SQL.

---

### Token de couleur `AccentPalettes` — constants/theme.ts

**Avant** :
```ts
export const AccentPalettes = {
  orange: { tint: '#F97316', tabIconSelected: '#F97316', success: '#22C55E' },
  green:  { tint: '#00F260', tabIconSelected: '#00F260', success: '#00F260' },
  blue:   { tint: '#3B82F6', tabIconSelected: '#3B82F6', success: '#3B82F6' },
  purple: { tint: '#8B5CF6', tabIconSelected: '#8B5CF6', success: '#8B5CF6' },
};
```

**Après** :
```ts
export const AccentPalettes = {
  orange: { tint: '#F97316', tabIconSelected: '#F97316' },
  green:  { tint: '#00F260', tabIconSelected: '#00F260' },
  blue:   { tint: '#3B82F6', tabIconSelected: '#3B82F6' },
  purple: { tint: '#8B5CF6', tabIconSelected: '#8B5CF6' },
};
```

`colors.success` est toujours `#22C55E` (depuis `Colors.light.success` / `Colors.dark.success`), indépendamment de l'accent.

---

### Nouveau composant `<ErrorView />` — components/shared/ErrorView.tsx

```ts
type ErrorViewProps = {
  message?: string;  // Message à afficher (défaut: "Impossible de charger les données.")
  onRetry: () => void;
};
```

Composant réutilisable affiché à la place du contenu quand le chargement DB échoue.

---

### État `liveSetTypePicker` — app/workouts/[workoutId].tsx

Nouvel état local ajouté à l'écran de séance pour gérer le sélecteur de type de set :

```ts
const [liveSetTypePicker, setLiveSetTypePicker] = useState<{
  setId: string;
  currentType: string;
} | null>(null);
```

Déclenché par `onLongPressIndex` sur chaque `SetRow`.

---

## Tokens de design — résumé des valeurs cibles

| Token | Valeur | Usage |
|-------|--------|-------|
| `colors.tint` | Accent courant (orange/vert/bleu/violet) | Barre de progression RestTimer, éléments actifs |
| `colors.success` | `#22C55E` (invariant) | Sets complétés, badges de réussite |
| `colors.icon` | Texte secondaire selon thème | Labels, méta-informations |
| `SemanticColors.danger` | `#EF4444` | Bouton "Annuler séance" |
| Badge PR | `#FFD700` (invariant) | Record personnel — couleur sémantique globale |
