# Quickstart: Corrections Pré-Production

**Feature**: 002-fix-prod-blockers  
**Date**: 2026-05-15

---

## Ordre d'implémentation recommandé

Les corrections sont indépendantes les unes des autres. L'ordre ci-dessous va du plus critique au moins critique, et minimise les risques de régression.

### 1. Fix couleur (theme.ts) — Impact global, zéro régression

Retirer le champ `success` de `AccentPalettes` dans `constants/theme.ts`. Touche tous les composants utilisant `colors.success` mais uniquement pour corriger une valeur aberrante (bleu/violet) vers la valeur sémantique correcte (vert).

### 2. Fix RestTimer barre progression (RestTimer.tsx)

Ligne 190 du fichier : `backgroundColor: '#F97316'` → passer en style inline dynamique `{ backgroundColor: colors.tint }`. Nécessite de déplacer ce style du `StyleSheet.create` vers le rendu JSX.

### 3. Fix historique — filtre séances terminées (DatabaseService.ts + history.tsx)

Ajouter paramètre `onlyFinished` à `getWorkouts()` et passer `true` depuis `history.tsx`. Test : démarrer une séance sans la terminer → elle ne doit pas apparaître dans Historique.

### 4. Fix gestion erreurs — ErrorView (screens principaux)

Créer `components/shared/ErrorView.tsx` puis l'intégrer dans les 5 écrans principaux (index, history, workout, exercises, stats) en remplaçant `console.error` par `setError(e)`.

### 5. Fix navigation séance — bouton Minimiser (workouts/[workoutId].tsx)

Ajouter le bouton ↓ dans le header de l'écran de séance. Ajouter le listener `beforeRemove` avec l'Alert de confirmation.

### 6. Fix sélecteur type de set en live (workouts/[workoutId].tsx)

Ajouter l'état `liveSetTypePicker`, la modal de sélection, et câbler `onLongPressIndex` sur chaque `SetRow`. Copier le pattern de `template.tsx`.

### 7. Fix toast création exercice (add-exercise.tsx)

Ajouter un composant Toast animé et l'afficher 2s après création réussie.

---

## Tests manuels par correction

| Correction | Test manuel |
|------------|------------|
| Theme fix | Changer l'accent en "Bleu" → les sets complétés restent verts, le timer barre est bleue |
| RestTimer | Avec accent "violet" → la barre de progression est violette |
| Historique | Démarrer une séance sans finir → absente de l'Historique |
| ErrorView | Tester sur un écran en coupant l'accès DB (pas de méthode simple — tester le rendu conditionnel) |
| Bouton minimiser | Appuyer ↓ pendant séance → retour tabs + banner "Reprendre" visible |
| Back guard | Appuyer Retour avec sets complétés → Alert apparaît |
| Set type picker | Appui long sur index de set pendant séance → modal apparaît, type sauvegardé |
| Toast exercice | Créer un exercice → toast vert 2s → redirection |

---

## Fichiers modifiés

```
constants/theme.ts                        # Retirer success de AccentPalettes
components/workout/RestTimer.tsx          # Barre timer → colors.tint
components/shared/ErrorView.tsx           # NOUVEAU composant
services/DatabaseService.ts              # getWorkouts(onlyFinished?)
app/(tabs)/history.tsx                    # getWorkouts(true), ErrorView
app/(tabs)/index.tsx                      # ErrorView
app/(tabs)/workout.tsx                    # ErrorView
app/(tabs)/exercises.tsx                  # ErrorView
app/(tabs)/stats.tsx                      # ErrorView
app/workouts/[workoutId].tsx             # Bouton minimiser, beforeRemove, set type picker live
app/add-exercise.tsx                      # Toast confirmation
```

---

## Aucune migration DB requise

Zéro changement de schéma. Tous les champs nécessaires (`finished_at`, `set_type`) existent déjà.
