# Research: Corrections Pré-Production

**Feature**: 002-fix-prod-blockers  
**Date**: 2026-05-15

---

## Decision 1 — Navigation pendant une séance active

**Question**: Comment rendre la tab bar accessible depuis l'écran `workouts/[workoutId]` qui est actuellement un `fullScreenModal` au niveau du Stack racine ?

**Decision**: Ajouter un bouton "Minimiser" (↓) dans le header de l'écran de séance qui appelle `router.back()`. L'écran garde sa présentation `fullScreenModal` — c'est intentionnel (focus total pendant la séance). Le banner `ActiveWorkoutBanner` déjà présent sur les onglets couvre le "retour" vers la séance.

**Rationale**:  
- Changer `fullScreenModal` en `card` ou `modal` n'expose pas la tab bar : l'écran est dans le Stack racine, au-dessus des tabs.  
- Déplacer `workouts/[workoutId]` à l'intérieur du groupe `(tabs)` serait une refonte architecturale majeure.  
- Le pattern "minimiser" (bouton ↓ → retour aux tabs, banner "Reprendre") est le standard des apps de tracking (Strong, Spotify, Nike Training).  
- Zero risque de régression : `router.back()` est déjà le comportement du bouton back natif.

**Alternatives considered**:  
- Modifier la présentation : inefficace (Stack racine toujours au-dessus des tabs)  
- Déplacer dans les tabs : trop de refactoring, hors scope  
- Tab bar flottante custom dans la séance : redondance visuelle, complexity non justifiée

---

## Decision 2 — Confirmation avant de quitter la séance

**Question**: Quelle API utiliser pour intercepter le bouton retour sur Expo Router v6 ?

**Decision**: Utiliser l'event listener `navigation.addListener('beforeRemove', handler)` via `useNavigation()` depuis `@react-navigation/native`. La navigation Expo Router v6 expose l'objet `navigation` standard de React Navigation.

**Rationale**:  
- `usePreventRemove` n'existe pas dans React Navigation v7 (hook supprimé).  
- `beforeRemove` est l'API stable depuis RN v5 et compatible Expo Router v6.  
- `e.preventDefault()` bloque la navigation, `navigation.dispatch(e.data.action)` la laisse passer après confirmation.

**Alternatives considered**:  
- `usePreventRemove` hook : non disponible dans la version installée  
- Intercepter le bouton physique Android avec `BackHandler` : ne couvre pas le bouton header ni le swipe iOS  
- Masquer le bouton retour : mauvaise UX

---

## Decision 3 — Filtrage de l'historique

**Question**: Modifier `getWorkouts()` existante ou créer une nouvelle fonction ?

**Decision**: Ajouter un paramètre optionnel `onlyFinished?: boolean` à `getWorkouts()`. Si `true`, ajoute `WHERE w.finished_at IS NOT NULL` à la requête.

**Rationale**:  
- Un seul point de changement dans `DatabaseService.ts`  
- Pas de duplication de la logique SQL  
- `history.tsx` passe `true`, les autres appelants de `getWorkouts()` non affectés (comportement par défaut inchangé)

**Alternatives considered**:  
- Nouvelle fonction `getFinishedWorkouts()` : duplication SQL inutile  
- Filtrer côté JS après fetch : inefficace, charge toutes les séances y compris actives

---

## Decision 4 — Couleur `success` dans le thème

**Question**: Pourquoi `colors.success` change selon l'accent (vert → `#00F260`, bleu → `#3B82F6`) ?

**Finding**: `getColors()` fusionne `Colors[scheme]` et `AccentPalettes[accent]`. `AccentPalettes` contient un champ `success` qui écrase le `success: '#22C55E'` de `Colors`. C'est un bug de conception : `success` est une couleur sémantique (invariante) et ne devrait pas faire partie des palettes d'accent.

**Decision**: Supprimer le champ `success` de tous les objets dans `AccentPalettes`. Seuls `tint` et `tabIconSelected` varient avec l'accent. `SemanticColors.success = '#22C55E'` et `Colors.light.success = Colors.dark.success = '#22C55E'` restent la source unique.

**Impact**:  
- `colors.success` retournera toujours `#22C55E` quelle que soit la palette  
- La barre de progression du timer doit utiliser `colors.tint` (pas `colors.success`) pour refléter l'accent choisi  
- `#00F260` disparaît complètement du code

---

## Decision 5 — Sélecteur de type de set dans la séance live

**Question**: Le `SetRow` a déjà `onLongPressIndex` — pourquoi n'est-il pas câblé dans `[workoutId].tsx` ?

**Finding**: Dans `template.tsx`, le handler `onLongPressIndex` ouvre une modal via un état `setTypePicker`. Dans `[workoutId].tsx`, `onLongPressIndex` n'est pas passé aux `SetRow` (prop ignorée). La DB supporte déjà `set_type` via `updateWorkoutSet()`.

**Decision**: Copier le pattern de `template.tsx` dans `[workoutId].tsx` : ajouter un état `liveSetTypePicker`, une modal de sélection, et appeler `updateWorkoutSet({ set_type })` sur confirmation.

**Rationale**:  
- Zéro migration DB nécessaire (`set_type` existe déjà dans `workout_sets`)  
- Pattern identique à l'éditeur de template (cohérence)  
- `updateWorkoutSet()` accepte déjà `set_type` en paramètre

---

## Decision 6 — Gestion des erreurs visible

**Question**: Error boundary React ou état local d'erreur par écran ?

**Decision**: État local d'erreur (`[error, setError]`) dans chaque écran principal, avec un composant `<ErrorView onRetry={reload} />` inline. Pas de Error Boundary React global (les erreurs sont de chargement DB, pas de render crash).

**Rationale**:  
- Les erreurs sont asynchrones (fetch SQLite), pas des render errors — les Error Boundaries ne les capturent pas  
- Un état local par écran est plus granulaire et permet le "Réessayer"  
- Un `<ErrorView />` réutilisable dans `components/shared/` évite la duplication

**Alternatives considered**:  
- Error Boundary global : ne capture pas les erreurs async  
- Toast d'erreur global : trop discret pour une erreur de chargement bloquante

---

## Decision 7 — Toast de confirmation pour création d'exercice

**Decision**: Utiliser un composant `<Toast />` local animé (Animated.Value opacity) dans `add-exercise.tsx`, affiché 2s avant la redirection. Pas de dépendance externe.

**Rationale**:  
- Zéro nouvelle dépendance (Animated est déjà utilisé dans l'app)  
- Simple, rapide à implémenter  
- Pattern cohérent avec `PRBadge` (même technique d'animation)

---

## Correction de la spec FR-012

**Finding post-code-review**: Les filtres de catégorie d'exercices affichent déjà des labels en français (`categoryLabels[idx]` à la ligne 227 de `exercises.tsx`). Le `MUSCLE_LABELS` traduit correctement 'All'→'Tous', 'Chest'→'Pectoraux', etc. **FR-012 est déjà implémenté, aucune action requise.**
