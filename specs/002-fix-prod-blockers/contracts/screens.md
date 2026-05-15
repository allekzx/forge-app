# Screen & Component Contracts: Corrections Pré-Production

**Feature**: 002-fix-prod-blockers  
**Date**: 2026-05-15

---

## Navigation Contract

### `workouts/[workoutId]` — Active Workout Screen

**Présentation**: `fullScreenModal` (inchangée)

**Changements de contrat** :
- Nouveau bouton "Minimiser" (↓) dans le header → appelle `router.back()`
- Event listener `beforeRemove` ajouté pour intercepter toute navigation hors écran
- Le listener affiche une Alert avec deux options :
  - "Continuer la séance" → `e.preventDefault()` (annule la navigation)
  - "Mettre en pause" → `navigation.dispatch(e.data.action)` (laisse passer)
- Si zéro sets complétés : option "Annuler la séance" avec confirmation supplémentaire

**Comportement garanti post-fix** :
- Naviguer vers un autre onglet (via retour) ne termine pas la séance
- La séance reste dans l'état `finished_at = null` (active) après retour aux tabs
- Le banner `ActiveWorkoutBanner` apparaît sur tous les onglets

---

### `(tabs)/history` — History Tab

**Changements de contrat** :
- Appelle `getWorkouts(true)` au lieu de `getWorkouts()`
- Seules les séances avec `finished_at IS NOT NULL` sont affichées
- Nouvel état vide : "Aucune séance terminée. Démarre ton premier entraînement !"

---

## Component Contracts

### `<ErrorView />` — NOUVEAU

**Fichier**: `components/shared/ErrorView.tsx`

```ts
interface ErrorViewProps {
  message?: string;
  onRetry: () => void;
}
```

**Rendu** : Icône d'erreur + message centré + bouton "Réessayer".  
**Utilisé dans** : tous les écrans principaux (Accueil, Historique, Séance, Stats, Exercices).

---

### `<RestTimer />` — Contrat inchangé, implémentation modifiée

**Props** : inchangées  
**Changement** : `StyleSheet.barFill.backgroundColor` remplacé par style dynamique `{ backgroundColor: colors.tint }`  
**Résultat** : la barre de progression reflète l'accent choisi (orange/vert/bleu/violet)

---

### `<SetRow />` — Contrat inchangé

**Props** : inchangées (y compris `onLongPressIndex?`)  
**Changement** : dans `[workoutId].tsx`, la prop `onLongPressIndex` est maintenant renseignée  
**Résultat** : appui long sur l'index d'un set → modal de sélection de type

---

### `<Toast />` — NOUVEAU (local à add-exercise.tsx)

Composant inline (pas dans `shared/`, usage unique) :
- Animé via `Animated.Value` opacity
- Visible 2s après création réussie d'exercice
- Message : "Exercice créé avec succès ✓"
- Se ferme avant la navigation

---

## Contrat de couleurs

| Composant | Token avant fix | Token après fix |
|-----------|----------------|----------------|
| RestTimer barre progression | `'#F97316'` (hardcodé) | `colors.tint` |
| RestTimer texte temps | `colors.success` | `colors.success` (inchangé, mais valeur fixe après fix theme) |
| SetRow set complété | `colors.success` | `colors.success` (valeur fixe `#22C55E`) |
| Filtre chips exercices | `colors.success` (accent-dependent) | `colors.success` (fixe `#22C55E`) |
| AccentPalettes | contient `success` (bug) | ne contient plus `success` |
