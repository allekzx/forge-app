# Tasks: Application Fitness — Finalisation Strong-like

**Input**: Design documents from `specs/001-workout-session-crud/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/screens.md ✅

**Tests**: No test framework configured — validation via manual quickstart.md checklist.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story label (US1–US5) matching spec.md priorities
- Exact file paths in every description

---

## Phase 1: Setup (Vérification environnement)

**Purpose**: Confirm the existing project builds and the dev environment is functional before any changes.

- [x] T001 Launch `npx expo start --web` and verify home screen loads without errors in the browser console

---

## Phase 2: Foundational (Utilitaires partagés)

**Purpose**: Shared constants and helpers used by multiple user stories. Must be complete before US3 and US5.

**⚠️ CRITICAL**: T002 and T003 are prerequisites for US3 (lbs conversion) and US5 (FR labels).

- [x] T002 [P] Create `constants/translations.ts` — export MUSCLE_LABELS, EQUIPMENT_LABELS, SET_TYPE_LABELS Record<string, string> maps (FR translations from data-model.md)
- [x] T003 [P] Create `constants/units.ts` — export `kgToDisplay(kg, unit)` and `displayToKg(val, unit)` helpers with 1 decimal precision (spec: 1 lbs = 0.453592 kg)

**Checkpoint**: Foundation ready — US1, US2, US3, US4, US5 can now begin in any order.

---

## Phase 3: User Story 1 — Bugs critiques (Priority: P1) 🎯 MVP

**Goal**: Corriger les 3 bugs bloquants : volume incorrect, flash de thème, tab bar inaccessible depuis la séance active, et résumé crash.

**Independent Test**: 
1. Thème sombre paramétré → kill app → reopen → pas de flash ✅  
2. Séance active ouverte → taper l'onglet Stats → navigation directe ✅  
3. 3 sets 100 kg × 10 reps → Stats All Time → 3 000 kg ✅  
4. Kill app en séance → reopen home → bannière "Reprendre" visible ✅

### Implémentation US1

- [x] T004 [US1] Ajouter filtres NULL explicites dans `getTotalVolumeAllTime()` dans `services/DatabaseService.ts` — `AND actual_weight IS NOT NULL AND actual_reps IS NOT NULL` (FR-001)
- [x] T005 [P] [US1] Ajouter `SplashScreen.preventAutoHideAsync()` au niveau module dans `app/_layout.tsx` et appeler `SplashScreen.hideAsync()` dans `AppShell` quand `isReady` passe à `true` (FR-002 / SC-003)
- [x] T006 [P] [US1] Créer `components/shared/ActiveWorkoutBanner.tsx` — bannière dismissible affichant le nom de la séance active avec bouton "Reprendre →" (props: workoutId, workoutName, onResume, onDismiss) (FR-015)
- [x] T007 [US1] Monter `<ActiveWorkoutBanner />` dans `app/(tabs)/index.tsx` via `useFocusEffect` + `getActiveWorkout()` — afficher si séance active détectée (FR-015 / SC-008)
- [x] T008 [US1] Ajouter une barre d'onglets compacte en bas de `app/workouts/[workoutId].tsx` (visible uniquement quand `!isFinished`) — 5 icônes d'onglet + navigation via `router.replace('/(tabs)/...')` (FR-003 / SC-004)

**Checkpoint**: Les 4 bugs P1 sont corrigés. US1 entièrement testable indépendamment.

---

## Phase 4: User Story 2 — Routines configurables (Priority: P1)

**Goal**: Permettre la configuration du type de chaque set dans un template et la réorganisation des exercices par drag-and-drop.

**Independent Test**: Créer une routine avec set 1 en "Échauffement" et 3 sets "Normal" → démarrer séance → les types s'appliquent. Glisser exercice B au-dessus de A → ordre persisté après fermeture.

### Implémentation US2

- [x] T009 [US2] Ajouter migration `template_exercise_sets` dans `services/DatabaseService.ts` `_doInit()` — CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE de backfill depuis `workout_template_exercises` (data-model.md)
- [x] T010 [US2] Ajouter `getTemplateExerciseSets(templateExerciseId)` dans `services/DatabaseService.ts` — retourne les sets avec set_type, target_reps, rest_seconds
- [x] T011 [US2] Ajouter `updateTemplateExerciseSetType(setId, setType)` dans `services/DatabaseService.ts` — UPDATE template_exercise_sets SET set_type = ?
- [x] T012 [US2] Ajouter `updateTemplateExercisesOrder(orderedIds: string[])` dans `services/DatabaseService.ts` — UPDATE workout_template_exercises SET order_index = ? pour chaque exercice
- [x] T013 [US2] Implémenter drag-to-reorder dans `app/workouts/template.tsx` — remplacer `FlatList` par un ScrollView avec `PanGestureHandler` + `Reanimated.useSharedValue` pour le positionnement; persister l'ordre via `updateTemplateExercisesOrder()` au drop (FR-005)
- [x] T014 [US2] Ajouter UI de sélection du type de set dans `app/workouts/template.tsx` — afficher les sets individuels (depuis `template_exercise_sets`) avec un sélecteur pressable pour le type (Normal / Échauffement / Drop Set / Échec) sur chaque ligne (FR-004)

**Checkpoint**: Routines configurables avec types par set et réorganisation drag-and-drop.

---

## Phase 5: User Story 3 — Séance active optimisée (Priority: P1)

**Goal**: Conversion lbs/kg cohérente dans l'écran de séance active et notification visuelle lors d'un Record Personnel.

**Independent Test**: Unité = lbs → séance → poids affiché en lbs. PR existant à 80 kg → saisir 85 kg → badge PR visible dans les 2 secondes après cochage.

### Implémentation US3

- [x] T015 [US3] Ajouter `getPRForExercise(exerciseId, excludeWorkoutId)` dans `services/DatabaseService.ts` — SELECT MAX(actual_weight) pour l'exercice hors séance courante (research.md Décision 5)
- [x] T016 [P] [US3] Créer `components/workout/PRBadge.tsx` — overlay animé (Animated.spring + Animated.timing) visible 3 secondes; props: visible: boolean, weight: number, unit: 'kg'|'lbs' (FR-008 / SC-007)
- [x] T017 [US3] Appliquer la conversion lbs dans `app/workouts/[workoutId].tsx` — utiliser `kgToDisplay()` / `displayToKg()` (T003) pour les colonnes poids et les hints "session précédente"; lire l'unité depuis `getUserSetting('weight_unit')` au mount (FR-007 / SC-006)
- [x] T018 [US3] Intégrer la détection PR dans `app/workouts/[workoutId].tsx` — charger les PRs par exercice au mount via `getPRForExercise()`; déclencher `<PRBadge />` dans `handleUpdateSet()` quand `toggleComplete` et `actual_weight > pr` (FR-008)
- [x] T019 [US3] Appliquer `kgToDisplay()` dans le résumé de fin de séance (modal WorkoutSummary) dans `app/workouts/[workoutId].tsx` — colonne "avg kg" et total volume (FR-007)

**Checkpoint**: Séance active avec conversion unité correcte et badge PR fonctionnel.

---

## Phase 6: User Story 4 — Historique en lecture seule (Priority: P2)

**Goal**: Écran de détail de séance passée clairement distinct de l'écran séance active, en lecture seule.

**Independent Test**: Depuis l'onglet Historique → appuyer sur une séance → écran sans TextInput ni boutons d'action; affiche nom, date, durée, volume, liste des sets avec poids/reps/type.

### Implémentation US4

- [x] T020 [P] [US4] Créer `app/history/[workoutId].tsx` — écran lecture seule: header (nom, date, durée, volume), liste des exercices avec leurs sets (poids réel, reps réelles, set_type via SET_TYPE_LABELS), aucun input éditable (FR-010 / FR-011)
- [x] T021 [P] [US4] Enregistrer la route `history/[workoutId]` dans `app/_layout.tsx` — ajouter `<Stack.Screen name="history/[workoutId]" options={{ headerShown: false }} />` (contracts/screens.md)
- [x] T022 [US4] Modifier `app/(tabs)/history.tsx` — changer `router.push` vers `/history/[workoutId]` à la place de `/workouts/[workoutId]` pour les séances terminées (contracts/screens.md)

**Checkpoint**: Historique avec écran détail dédié, sans confusion avec la séance active.

---

## Phase 7: User Story 5 — Labels FR et bibliothèque d'exercices (Priority: P2)

**Goal**: Tous les labels d'interface en français; graphique poids corporel fonctionnel sur web.

**Independent Test**: Bibliothèque → chips affichent "Pectoraux / Dos / Jambes / Bras / Épaules / Abdos / Tous". Onglet Stats sur web → graphique courbe poids corporel visible.

### Implémentation US5

- [x] T023 [US5] Appliquer `MUSCLE_LABELS` aux chips de filtre et aux sous-titres d'exercice dans `app/(tabs)/exercises.tsx` — remplacer le tableau `categories` et les `.muscle`/`.equipment` affichés (FR-012)
- [x] T024 [P] [US5] Appliquer `MUSCLE_LABELS` + `EQUIPMENT_LABELS` dans la ligne méta exercice (muscle · équipement) dans `app/workouts/[workoutId].tsx` (FR-012)
- [x] T025 [P] [US5] Appliquer `MUSCLE_LABELS` + `EQUIPMENT_LABELS` dans `app/workouts/exercise-picker.tsx` — sous-titre de chaque item (FR-012)
- [x] T026 [US5] Appliquer les labels FR dans `app/add-exercise.tsx` — options du picker muscle/équipement (FR-013)
- [x] T027 [US5] Supprimer la garde `Platform.OS !== 'web'` autour de `<WeightChart />` dans `app/(tabs)/stats.tsx` — le composant SVG fonctionne sur web (FR-014)
- [x] T028 [P] [US5] Appliquer `kgToDisplay()` dans `app/workouts/template.tsx` — affichage du poids par défaut (default_weight_kg) (FR-007)
- [x] T029 [P] [US5] Appliquer `kgToDisplay()` dans `app/history/[workoutId].tsx` — affichage des poids réels (FR-007)

**Checkpoint**: Toute l'interface affiche des labels français. Graphique web actif.

---

## Phase 8: Polish & Transversal

**Purpose**: Corrections mineures multi-stories et validation finale.

- [x] T030 [P] Corriger la locale des labels de semaine dans `services/DatabaseService.ts` `getVolumeByWeek()` — remplacer `'en'` par `'fr'` dans `toLocaleDateString` (FR-012)
- [x] T031 [P] Appliquer `SET_TYPE_LABELS` dans `app/workouts/template.tsx` — badges de type de set (afficher "Échauffement" au lieu de "warmup") (FR-012)
- [x] T032 [P] Appliquer `SET_TYPE_LABELS` dans `app/workouts/[workoutId].tsx` — tooltips et labels de type de set (FR-012)
- [ ] T033 Exécuter la checklist de validation manuelle de `specs/001-workout-session-crud/quickstart.md` — vérifier FR-001 à FR-015 et SC-001 à SC-008

---

## Dépendances & Ordre d'exécution

### Dépendances entre phases

- **Phase 1 (Setup)**: Pas de dépendance — commencer immédiatement
- **Phase 2 (Foundational)**: Dépend de Phase 1 — bloque US3 (T017, T019) et US5 (T023–T029)
- **Phase 3 (US1)**: Peut commencer après Phase 1 — indépendant de Phase 2
- **Phase 4 (US2)**: Peut commencer après Phase 1 — indépendant de Phase 2 et US1
- **Phase 5 (US3)**: Dépend de Phase 2 (T002, T003) pour la conversion lbs
- **Phase 6 (US4)**: Peut commencer après Phase 1 — indépendant de tout
- **Phase 7 (US5)**: Dépend de Phase 2 (T002, T003) pour les labels et la conversion
- **Phase 8 (Polish)**: Dépend de toutes les phases précédentes

### Dépendances intra-stories

**US2**: T009 → T010, T011, T012 → T013, T014  
**US3**: T015 → T018 (T016 parallèle, T017 dépend T003)  
**US4**: T020 et T021 parallèles → T022  
**US5**: T027 indépendant; T023–T026 parallèles entre eux; T028–T029 dépendent T003

---

## Opportunités de parallélisme

### Phase 2 (Foundational)
```
T002 (translations.ts) ║ T003 (units.ts)
```

### Phase 3 (US1)
```
T004 (volume query) ║ T005 (splash screen) ║ T006 (ActiveWorkoutBanner component)
      ↓                        ↓                         ↓
T007 (mount banner)      T008 (compact tabbar)
```

### Phases 3, 4, 5, 6 peuvent se faire en parallèle (équipe multiple)
```
Developer A: US1 (Phase 3) → US2 (Phase 4)
Developer B: Foundational (Phase 2) → US3 (Phase 5)
Developer C: US4 (Phase 6) → US5 (Phase 7)
```

---

## Stratégie d'implémentation

### MVP First (US1 uniquement)

1. Phase 1: Setup — vérifier l'env (T001)
2. Phase 3: US1 — corriger les 3 bugs critiques (T004–T008)
3. **ARRÊT et VALIDATION** : Tester US1 via quickstart.md (FR-001, FR-002, FR-003, FR-015)
4. Déployer si prêt

### Livraison incrémentale

1. Setup + Foundational → fondations prêtes
2. US1 → tester → valider (MVP ✅)
3. US2 → tester → valider (routines configurables)
4. US3 → tester → valider (séance optimisée)
5. US4 → tester → valider (historique propre)
6. US5 → tester → valider (100% FR)
7. Polish → validation finale

---

## Notes

- `[P]` = fichiers différents, aucune dépendance partagée incomplète
- `[Story]` = traçabilité vers les user stories du spec.md
- Chaque US est testable indépendamment via `quickstart.md`
- Aucune nouvelle dépendance npm requise (Reanimated + GestureHandler déjà installés)
- SQLite migrations = `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` dans `_doInit()` (pattern existant)
- Ne pas modifier les données SQLite stockées — conversion lbs est display-only
