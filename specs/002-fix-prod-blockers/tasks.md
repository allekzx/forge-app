# Tasks: Corrections Pré-Production

**Input**: Design documents from `/specs/002-fix-prod-blockers/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Aucun (pas de framework de test configuré — validation manuelle selon quickstart.md)

**Organisation**: Tâches groupées par user story pour permettre une implémentation et validation indépendantes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallélisable (fichiers différents, pas de dépendance sur tâches incomplètes)
- **[Story]**: User story correspondante (US1–US8)

---

## Phase 1 : Setup

*Aucun setup requis — tous les fichiers sources existent déjà. Pas de migration DB.*

---

## Phase 2 : Fondation (Prérequis bloquants)

**Purpose**: Deux éléments transversaux dont dépendent plusieurs user stories. Doivent être terminés avant de commencer les user stories.

**⚠️ CRITIQUE** : T001 affecte `colors.success` dans TOUS les composants. T002 est utilisé par US3 et US7.

- [x] T001 Supprimer le champ `success` de chaque entrée dans `AccentPalettes` dans `constants/theme.ts` (lignes 66-70 : retirer `success: '#22C55E'`, `success: '#00F260'`, `success: '#3B82F6'`, `success: '#8B5CF6'`) — `colors.success` restera toujours `#22C55E` via `Colors[scheme]`

- [x] T002 [P] Créer le composant `components/shared/ErrorView.tsx` avec props `{ message?: string; onRetry: () => void }`, rendu centré (icône + texte + bouton "Réessayer" avec `colors.tint`), selon le code fourni dans `specs/002-fix-prod-blockers/plan.md` section Correction 4

**Checkpoint** : Foundation prête — les user stories peuvent démarrer.

---

## Phase 3 : User Story 3 — Historique filtré (Priority: P1) 🎯 MVP partiel

**Goal**: L'onglet Historique affiche uniquement les séances terminées (`finished_at IS NOT NULL`).

**Independent Test**: Démarrer une séance sans la finir → aller dans Historique → la séance active n'y apparaît pas. Terminer une séance → elle apparaît dans Historique.

- [x] T003 [US3] Ajouter le paramètre optionnel `onlyFinished?: boolean` à `getWorkouts()` dans `services/DatabaseService.ts` (lignes 340-350) : quand `true`, injecter `WHERE w.finished_at IS NOT NULL` avant le `GROUP BY`

- [x] T004 [US3] Mettre à jour `app/(tabs)/history.tsx` : (1) changer l'appel `getWorkouts()` → `getWorkouts(true)`, (2) ajouter l'état `[error, setError]`, (3) remplacer `console.error` par `setError(...)` dans le catch, (4) afficher `<ErrorView onRetry={reload} />` si `error` non null, (5) mettre à jour le message d'état vide en `"Aucune séance terminée. Démarre ton premier entraînement !"` (dépend de T002)

**Checkpoint** : US3 testable indépendamment — l'historique ne montre plus les séances actives.

---

## Phase 4 : User Stories 1 & 2 — Navigation séance active (Priority: P1)

**Goal**: L'utilisateur peut quitter l'écran de séance sans la perdre (US1 — bouton minimiser) et est protégé contre une sortie accidentelle (US2 — confirmation back).

**Independent Test US1**: Pendant une séance, appuyer sur ↓ → retour aux onglets, banner "Reprendre" visible, séance toujours active en DB.  
**Independent Test US2**: Pendant une séance avec sets complétés, appuyer sur le bouton retour ou swiper → Alert avec "Continuer la séance" et "Mettre en pause".

- [x] T005 [US1] *(Déjà implémenté)* Mini tab bar présente dans `app/workouts/[workoutId].tsx` lignes 673-696 — navigation par `router.replace()` vers les 5 onglets

- [x] T006 [US2] Ajouter l'import `useNavigation` depuis `@react-navigation/native` et un `useEffect` avec `navigation.addListener('beforeRemove', handler)` dans `app/workouts/[workoutId].tsx` : (1) si zéro sets complétés → Alert "Annuler la séance ?" avec options "Continuer" / "Annuler la séance" (destructive), (2) si sets complétés → Alert "Mettre en pause ?" avec options "Continuer la séance" / "Mettre en pause" — utiliser `e.preventDefault()` + `navigation.dispatch(e.data.action)` selon la décision research.md (dépend de T005 pour cohérence UX)

**Checkpoint** : US1 et US2 testables — navigation séance sécurisée.

---

## Phase 5 : User Story 4 — Cohérence couleur timer (Priority: P2)

**Goal**: La barre de progression du timer de repos reflète l'accent choisi par l'utilisateur.

**Independent Test**: Changer l'accent en "Bleu" dans Paramètres → compléter un set → lancer le timer → la barre de progression est bleue (pas orange).

- [x] T007 [US4] Dans `components/workout/RestTimer.tsx` ligne 165, remplacer `<Animated.View style={[styles.barFill, { width: barWidth }]} />` par `<Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: colors.tint }]} />`, puis retirer le champ `backgroundColor` de `styles.barFill` dans le `StyleSheet.create` (ligne 190) (dépend de T001 pour cohérence accent)

**Checkpoint** : US4 testable — barre du timer suit l'accent.

---

## Phase 6 : User Story 6 — Sélecteur type de set en séance live (Priority: P2)

**Goal**: Appui long sur l'index d'un set pendant une séance active ouvre le sélecteur de type (Normal, Échauffement, Drop Set, Échec) et sauvegarde le choix en DB.

**Independent Test**: Pendant une séance active, faire un appui long sur le chiffre "1" d'un set → modal apparaît → choisir "Échauffement" → le set affiche le badge "Échauffement" → vérifier en DB que `set_type = 'warmup'`.

- [x] T008 [US6] Ajouter l'état `const [liveSetTypePicker, setLiveSetTypePicker] = useState<{ setId: string; currentType: string } | null>(null)` dans `app/workouts/[workoutId].tsx`, et le handler `handleSetTypeLongPress(setId, currentType)` qui appelle `setLiveSetTypePicker({ setId, currentType })`

- [x] T009 [US6] Dans `app/workouts/[workoutId].tsx`, (1) passer `onLongPressIndex={() => handleSetTypeLongPress(set.id, set.set_type ?? 'normal')}` à chaque `<SetRow>` dans la liste des sets, (2) ajouter une `<Modal>` visible quand `liveSetTypePicker !== null` affichant les 4 types de set (Normal/Échauffement/Drop Set/Échec) sous forme de liste pressable, (3) à la sélection : appeler `await updateWorkoutSet(liveSetTypePicker.setId, { set_type: selectedType })` puis recharger la session et fermer la modal — copier le style de la modal existante dans `app/workouts/template.tsx` (dépend de T008)

**Checkpoint** : US6 testable — sélecteur de type de set opérationnel en séance live.

---

## Phase 7 : User Story 7 — Gestion des erreurs visible (Priority: P2)

**Goal**: Chaque écran principal affiche un message actionnable si le chargement DB échoue.

**Independent Test**: Rendre `initDatabase()` non fonctionnel temporairement (ou observer le comportement lors d'une vraie erreur) — chaque écran affiche `<ErrorView>` avec bouton "Réessayer" au lieu d'un écran vide.

Les 4 tâches suivantes sont **parallélisables** (fichiers différents, même pattern).

- [x] T010 [P] [US7] Ajouter dans `app/(tabs)/index.tsx` : état `[error, setError]`, wrapper `try/catch` dans le loader `useFocusEffect`, `setError(...)` dans le catch, rendu conditionnel `if (error) return <ErrorView message={error} onRetry={loadData} />` — importer `ErrorView` depuis `@/components/shared/ErrorView` (dépend de T002)

- [x] T011 [P] [US7] Ajouter dans `app/(tabs)/workout.tsx` : même pattern que T010 — état `[error, setError]`, try/catch, `<ErrorView onRetry={loadData} />` (dépend de T002)

- [x] T012 [P] [US7] Ajouter dans `app/(tabs)/exercises.tsx` : même pattern que T010 — remplacer le `catch` existant (ligne 99-106) par `setError('Impossible de charger les exercices.')` et afficher `<ErrorView onRetry={loadData} />` si `error` non null (dépend de T002)

- [x] T013 [P] [US7] Ajouter dans `app/(tabs)/stats.tsx` : même pattern que T010 — état `[error, setError]`, try/catch dans le loader, `<ErrorView onRetry={loadData} />` (dépend de T002)

**Checkpoint** : US7 testable — tous les écrans principaux gèrent les erreurs DB.

---

## Phase 8 : User Story 8 — Toast confirmation exercice (Priority: P3)

**Goal**: La création d'un exercice personnalisé affiche un toast de confirmation avant la redirection.

**Independent Test**: Créer un exercice personnalisé valide → toast vert "Exercice créé ✓" visible 2s → redirection automatique vers l'écran précédent.

- [x] T014 [US8] Dans `app/add-exercise.tsx` : (1) ajouter `const toastOpacity = useRef(new Animated.Value(0)).current` et l'état `[showToast, setShowToast]`, (2) créer `showSuccessToast()` qui anime opacity 0→1 (200ms) + delay 1800ms + opacity 1→0 (200ms) puis appelle `router.back()`, (3) remplacer l'appel direct `router.back()` après création réussie par `showSuccessToast()`, (4) ajouter le composant Toast en overlay absolu : View avec `position: 'absolute'`, `bottom: 40`, centré horizontalement, fond `colors.success`, texte "Exercice créé ✓", animé via `Animated.View` — utiliser `useNativeDriver: true`

**Checkpoint** : US8 testable — feedback visuel présent après création d'exercice.

---

## Phase Finale : Polish & Vérifications transversales

- [x] T015 [P] Rechercher dans toute la codebase les valeurs hardcodées `#F97316` (sauf dans `theme.ts` où c'est légitime) et `#00F260` et remplacer par `colors.tint` ou `colors.success` selon le contexte — utiliser grep sur `app/`, `components/`, `constants/` (hors `theme.ts`)

- [ ] T016 *(Manuel)* Valider le plan quickstart.md : tester manuellement chaque correction selon le tableau "Tests manuels par correction" dans `specs/002-fix-prod-blockers/quickstart.md` — vérifier les 8 scénarios listés

---

## Tâche annulée — US5 déjà implémentée

**US5 (Filtres exercices en français)** : Les filtres affichent déjà `categoryLabels[idx]` (labels traduits via `MUSCLE_LABELS`) dans `app/(tabs)/exercises.tsx` ligne 227. Aucune tâche requise.

---

## Dépendances & Ordre d'exécution

### Dépendances entre phases

- **Phase 2 (Fondation)** : Pas de dépendances — démarrer immédiatement
  - T001 et T002 sont parallélisables entre eux
- **Phase 3 (US3)** : Dépend de T002 (ErrorView) pour T004
- **Phase 4 (US1+2)** : Indépendante de Phase 3 — peut démarrer en même temps
- **Phase 5 (US4)** : Dépend de T001 (theme fix) pour cohérence couleur
- **Phase 6 (US6)** : Indépendante — peut démarrer après Phase 2
- **Phase 7 (US7)** : Dépend de T002 (ErrorView) — T010-T013 tous parallélisables
- **Phase 8 (US8)** : Indépendante — peut démarrer après Phase 2
- **Phase Finale** : Après toutes les phases

### Dépendances entre tâches

```
T001 (theme) ──────────────────────────────────► T007 (RestTimer)
T002 (ErrorView) ──► T004 (history) ─────────────────────────────►
                 ──► T010 / T011 / T012 / T013 (erreurs screens) ►
T003 (DB filter) ──► T004 (history.tsx)
T005 (minimize) ───► T006 (beforeRemove) [même fichier, cohérence UX]
T008 (state) ──────► T009 (modal + wire)
```

### Opportunités parallèles

- **Phase 2** : T001 ‖ T002
- **Phase 7** : T010 ‖ T011 ‖ T012 ‖ T013 (4 fichiers différents)
- **Phases 3+4+6+8** : peuvent démarrer simultanément après Phase 2

---

## Exemple d'exécution parallèle — Phase 7

```
# Lancer les 4 corrections d'écrans en parallèle (fichiers différents) :
Task: "Ajouter ErrorView dans app/(tabs)/index.tsx"
Task: "Ajouter ErrorView dans app/(tabs)/workout.tsx"
Task: "Ajouter ErrorView dans app/(tabs)/exercises.tsx"
Task: "Ajouter ErrorView dans app/(tabs)/stats.tsx"
```

---

## Stratégie d'implémentation

### MVP (corrections P1 uniquement — 6 tâches)

1. Compléter Phase 2 (T001 + T002)
2. Compléter Phase 3 (T003 + T004)
3. Compléter Phase 4 (T005 + T006)
4. **STOP et VALIDER** : historique filtré + navigation séance sécurisée
5. Déployer si satisfaisant

### Livraison complète (toutes corrections)

1. Phase 2 → Foundation prête
2. Phase 3 → US3 ✅
3. Phase 4 → US1+US2 ✅
4. Phase 5 → US4 ✅
5. Phase 6 → US6 ✅
6. Phase 7 (en parallèle) → US7 ✅
7. Phase 8 → US8 ✅
8. Phase finale → Polish + validation

---

## Notes

- Aucune migration DB requise — toutes les corrections sont purement UI/navigation
- `[P]` = fichiers différents, aucune dépendance sur tâches incomplètes
- Chaque user story est indépendamment testable
- Committer après chaque phase ou groupe logique
- Se référer à `specs/002-fix-prod-blockers/quickstart.md` pour les tests manuels
- Se référer à `specs/002-fix-prod-blockers/plan.md` pour le code exact de chaque correction
