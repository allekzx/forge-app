# TASKS — Application Salle de Sport
> Mis à jour par l'Orchestrateur le 2026-04-23
> Ce fichier est le tableau de bord partagé entre tous les agents.
> Chaque agent doit le lire en début de session et le mettre à jour à la fin.

---

## 🗄️ AGENT DATABASE
**Fichier : `services/DatabaseService.ts`**

### 🔴 Bug critique — Crash SQLite "Error finalizing statement"
- [x] **`initDatabase()` appelée en parallèle → crash SQLite WASM**
  - Guard singleton `initPromise` ajouté dans `DatabaseService.ts`
  - Corps déplacé dans `_doInit()` (privé) — `initDatabase` retourne toujours la même Promise
  - Les appels parallèles depuis 5+ composants ne déclenchent plus qu'une seule initialisation

### ✅ Bug critique — Mauvaise source de données exercices
- [x] **`initDatabase` seede depuis `initialExercises.ts` au lieu de `generatedExercises.ts`**
  - Import corrigé → `generatedExercises.ts` (873 exercices, images locales)
  - `generatedExercises.ts` : `require(...)` remplacé par filename string (`"3_4_Sit-Up.jpg"`)
  - `assets/data/exerciseImageMap.ts` créé : map statique `Record<string, ImageSourcePropType>` — 873 `require()` résolus au bundle time, lookup O(1) au render
  - `exercises.tsx` : import mis à jour, `imageSource = exerciseImageMap[item.image]`
  - Seed encapsulé dans `withTransactionAsync` (870 INSERTs → 1 transaction)
  - Guard reseed : si `count < 100`, vide + re-seede automatiquement

### ✅ Nouvelle fonction — Détail d'un exercice par ID
- [x] **`getExerciseById(id: string)` ajouté dans `DatabaseService.ts`**
  - Retourne `ExerciseDetail | null` : `{ id, name, muscle, equipment, image, description, instructions }`
  - Requête : `SELECT * FROM exercises WHERE id = ?`

### ✅ Nouvelle fonction — Poids de la dernière séance par exercice
- [x] **`getLastSessionWeightsForExercises(exerciseIds, currentWorkoutId)` ajouté dans `DatabaseService.ts`**
  - Retourne `Map<exerciseId, Map<setIndex, { weight, reps }>>` — prêt pour Agent Workout
  - Pour chaque exercice : trouve le dernier workout terminé (≠ currentWorkoutId, finished_at IS NOT NULL), retourne les sets par set_index

### ✅ Amélioration — Stats : total kg soulevé all-time
- [x] **`getTotalVolumeAllTime()` + `getTotalWorkoutsAllTime()` + `getTotalSetsAllTime()` ajoutés**

### ✅ Terminé (2026-03-20)
- [x] Schéma complet, migrations, seed exercices, CRUD, stats
- [x] `getActiveWorkout()`, `getWorkoutSummary()`, `updateTemplateFromWorkout()`
- [x] Migrations `template_id` sur workouts, `default_weight_kg` sur workout_template_exercises
- [x] Guard singleton `initPromise` — crash "Error finalizing statement" résolu

### ✅ Terminé (2026-03-22)
- [x] Source exercices corrigée → `generatedExercises.ts` (873 exos, images locales)
- [x] `exerciseImageMap.ts` créé — lookup O(1) au render, zéro I/O
- [x] Seed en `withTransactionAsync` + guard reseed `count < 100`
- [x] `getExerciseById(id)` — pour écran détail exercice
- [x] `getLastSessionWeightsForExercises(exerciseIds, currentWorkoutId)` — débloque Agent Workout
- [x] `getTotalVolumeAllTime()` + `getTotalWorkoutsAllTime()` + `getTotalSetsAllTime()`

---

## 💪 AGENT WORKOUT
**Fichiers concernés : `app/workouts/[workoutId].tsx`, `app/(tabs)/workout.tsx`**

### ✅ Terminé (2026-03-22) — session 8
- [x] Bug inputs verrouillés : `editable={!isCompleted}` supprimé sur les deux TextInput weight/reps — les champs restent éditables après validation d'un set
- [x] Bug valeurs perdues au Finish : inputs passés en mode contrôlé (`value` + `onChangeText`), state `pendingValues: Map<setId, {weight, reps}>` initialisé depuis session et maintenu à jour ; flush explicite dans `handleFinish` via `Promise.all` avant `finishWorkout()` ; `handleAddSet` et `handleDeleteSet` maintiennent `pendingValues` en sync

### ✅ Terminé (2026-03-22) — session 7
- [x] Bug redirection exercise-picker : `goBack()` supprimé de `handleSelect`, `addedIds: Set<string>` pour tracker les ajouts, `checkmark.circle.fill` permanent pour exos ajoutés, bouton "Terminé (X)" dans le header
- [x] Son/haptique fin de chrono : `Haptics.notificationAsync(Success)` via `expo-haptics` déclenché quand `remaining === 0` dans le useEffect du rest timer
- [x] Photos exercise-picker : miniatures 48×48 via `exerciseImageMap[id+'.jpg']`, fallback initiale du muscle ; type `Exercise` étendu avec `image?`
- [x] Poids séance précédente : `getLastSessionWeightsForExercises` chargé après `getWorkoutSessionDetail`, annotation `↑ 80` / `↑ 8` grisée sous chaque input weight/reps via `prevSets` state ; rien affiché si aucune donnée

### ✅ Terminé (2026-03-22)
- [x] Séance unique active : guard dans `handleQuickStart` (`workout.tsx`) + bouton "Start workout" (`template.tsx`) → Alert "Séance en cours" avec "Reprendre"/"Annuler" ; `QuickStartWidget` masqué quand `activeWorkout !== null`
- [x] Temps de repos visible + modifiable : icône timer + durée formatée dans `exerciseCardHeader`, tap → `TextInput` inline, confirmation → `updateWorkoutSet(rest_seconds)` sur tous les sets + `restOverrides` ; `rest_seconds` ajouté à `updateWorkoutSet` dans `DatabaseService.ts`
- [x] Timer de repos configurable par saisie directe (tap → TextInput inline, min 5s/max 600s, mémorisation par exercice via Map)
- [x] Bouton poubelle visible par set (opacity:0 si complété, long-press conservé, header spacer 52→88, icône `trash` ajoutée dans icon-symbol.tsx)

### ✅ Terminé (2026-03-20)
- [x] Ajouter un exercice pendant une séance active (`exercise-picker.tsx` + bouton Add Exercise)
- [x] Bouton "+ Set" par exercice dans la séance active
- [x] Bannière "Séance en cours / Reprendre →" sur `workout.tsx` avec `useFocusEffect`
- [x] Suppression du message d'état vide trompeur
- [x] Timer de repos inline entre les sets (Fragment + adjustRest ±30s + Skip)
- [x] Fix navigation `exercise-picker.tsx` : `router.navigate` avec workoutId explicite (header + sélection)
- [x] Flux Finish Workout complet :
  - `Keyboard.dismiss()` avant sauvegarde pour forcer `onEndEditing`
  - `finishWorkout()` + `getWorkoutSummary()` → Modal slide-up avec durée, volume, sets, liste exercices ✅/⚠️
  - Prompt "Update template?" si séance depuis un template (`template_id` stocké en DB)
  - `updateTemplateFromWorkout()` met à jour `reps` + `default_weight_kg` avec moyennes réelles
  - Bouton "Done" → `router.replace('/(tabs)/workout')` (pas de retour possible vers la séance terminée)
- [x] DB : migrations `template_id` sur workouts, `default_weight_kg` sur template_exercises, `getWorkoutSummary`, `updateTemplateFromWorkout`

---

## 🏠 AGENT ACCUEIL
**Statut : ✅ TERMINÉ**

### ✅ Terminé (2026-03-20)
- [x] Avatar réseau supprimé → initiale stylisée offline-safe
- [x] CTA "Démarrer une séance" (56px)
- [x] Streak hebdomadaire affiché en badge header
- [x] Templates rapides (3 premiers) avec bouton "Démarrer"
- [x] `useFocusEffect` sur WeeklyActivityWidget et LastSessionWidget (refresh post-séance)
- [x] LastSessionWidget : `timeAgo(finished_at)` avec fallback "In progress"

---

## 🎨 AGENT DESIGN
**Fichiers concernés : `components/ui/icon-symbol.tsx`, `app/workouts/[workoutId].tsx`**

### 🔴 Bug critique — Icônes invisibles
- [x] **Icônes manquantes dans le MAPPING** (`components/ui/icon-symbol.tsx`)
  - Ajouté : `person.fill`, `clock.fill`, `list.bullet`, `timer`, `dumbbell.fill`, `checkmark`, `xmark.circle.fill`, `plus.circle`

### 🔴 Bug critique — Workout non responsive sur mobile
- [x] **Désalignement et overflow dans `[workoutId].tsx`**
  - Spacer header `width: 72` → `width: 52` (aligné avec `doneButton` 36px + gap 8px + padding 8px)
  - `exerciseCard` `padding: 14` → `padding: 12`
  - `setInput` : ajout de `minWidth: 0` pour compression correcte sur petits écrans

### 🔴 Bug — Warnings `shadow*` sur web
- [x] **`shadowColor/shadowOffset/shadowOpacity/shadowRadius` dépréciés sur web**
  - `app/(tabs)/exercises.tsx` et `components/QuickStartWidget.tsx` : Platform.select + boxShadow sur web ✅

### 🟡 Nouvelle — Écran de détail d'un exercice
- [x] **`app/exercises/[exerciseId].tsx` créé**
  - Image hero 220px + fallback icon dumbbell
  - Nom + badge muscle (tint) + badge équipement
  - Carte PR via `getExercisePR(exerciseId)` (ajouté dans DatabaseService)
  - Section Description + Instructions numérotées (split sur `\n`)
  - Navigation : tap depuis `exercises.tsx` (mode browse) / long press depuis `exercise-picker.tsx`
  - `getExerciseById()` + `getExercisePR()` ajoutés dans `DatabaseService.ts`

### 🟡 Stats — afficher le total kg soulevé all-time
- [x] **Stats cumulatives ajoutées dans `app/(tabs)/stats.tsx`**
  - `getTotalVolumeAllTime()` existait déjà ✅
  - `getTotalWorkoutsAllTime()` + `getTotalSetsAllTime()` ajoutés dans `DatabaseService.ts`
  - Carte "ALL TIME" affichée en haut de l'écran : kg soulevés / séances / sets
  - Rafraîchissement automatique via `useFocusEffect`

### 🟡 Important
- [x] **Taille de texte minimum** — Tous les textes < 14px corrigés dans `[workoutId].tsx`, `index.tsx`, `workout.tsx`
- [x] **Composants partagés** — `Button`, `Card`, `SetRow` créés dans `components/shared/` (prêts à l'emploi pour tout nouvel écran)
- [x] **Responsive global** — `Spacing`, `Radius`, `TouchTarget`, `SemanticColors` ajoutés dans `constants/theme.ts`

---

---

## 🗄️ AGENT DATABASE — Nouvelles tâches (session 11)

### ✅ P0 — Bug web : `NoModificationAllowedError` sur `createSyncAccessHandle` (SQLite OPFS)
- [x] **Crash SQLite web corrigé dans `services/DatabaseService.ts`**
  - `openDatabase()` : retry 5× avec backoff exponentiel (100ms→200ms→400ms→800ms→1600ms) sur `NoModificationAllowedError`
  - `_doInit()` : `window.addEventListener('beforeunload', () => db.closeAsync(), { once: true })` sur web — ferme proprement le handle OPFS avant hot-reload / fermeture d'onglet
  - `Platform` importé depuis `react-native` pour la garde web

  3. **Importer `Platform` depuis `react-native`** si pas déjà présent dans `DatabaseService.ts`

  **Résultat attendu :** l'app web survit aux hot-reloads et aux multi-onglets sans crash SQLite.

## 🗄️ AGENT DATABASE — Nouvelles tâches (session 10)

### ✅ P1 — `getTemplateWithExercises(templateId)` pour l'aperçu accueil
- [x] **Fonction + type ajoutés dans `services/DatabaseService.ts`**
  - `TemplateDetail` exporté : `{ id, name, exercises: Array<{ exerciseId, name, sets, reps, weight_kg }> }`
  - Requête : JOIN `workout_template_exercises` + `exercises` ORDER BY `order_index`
  - `default_weight_kg` mappé vers `weight_kg` dans le résultat
  - **Débloque** : Agent Accueil peut importer `TemplateDetail` + `getTemplateWithExercises` ✅

## 🗄️ AGENT DATABASE — Nouvelles tâches (session 9)

### ✅ P1 — Corriger le calcul du volume total
- [x] **`getTotalVolumeAllTime()` : formule vérifiée — déjà correcte (`SUM(actual_weight * actual_reps)`)**
  - Audit du code confirmé : la requête faisait déjà le bon calcul, aucune correction nécessaire
  - Impacte directement la carte "ALL TIME" dans `stats.tsx` ✅

### ✅ P3 — Migration `set_type` pour les types de sets
- [x] **Colonne `set_type TEXT DEFAULT 'normal'` ajoutée sur `workout_sets`**
  - Migration v5 dans `_doInit` : `ALTER TABLE workout_sets ADD COLUMN set_type TEXT DEFAULT 'normal'`
  - Valeurs supportées : `'normal'` / `'warmup'` / `'dropset'` / `'failure'`
  - `WorkoutSetRow` : champ `set_type: string` ajouté
  - `getWorkoutSessionDetail` : `COALESCE(ws.set_type, 'normal')` inclus dans le SELECT
  - `updateWorkoutSet` : accepte `set_type?: string` dans les champs
  - `addSetToWorkout` : retourne `set_type: 'normal'` dans l'objet résultat
  - **Débloque** : Agent Workout (UI types de sets W/D/F) peut maintenant persister le type

---

## 💪 AGENT WORKOUT — Nouvelles tâches (session 10)

### ✅ P1 — Chrono de repos : animation barre + notification son — Terminé (2026-04-23)
- [x] **Barre de progression animée dans `components/workout/RestTimer.tsx`**
  - `react-native-reanimated` v4 : `useSharedValue` + `withTiming` (Easing.linear) → animation fluide 100% → 0%
  - `cancelAnimation` + relance lors des ajustements (continue depuis la position courante) ou saisie directe (reset à 100%)
  - `Animated.View` de reanimated remplace le `View` statique pour la barre

- [x] **Notification locale avec son**
  - `expo-notifications` installé (v0.32.16)
  - `app.json` mis à jour avec plugin `expo-notifications` + son `assets/sounds/timer_end.wav`
  - `assets/sounds/timer_end.wav` généré (bip 880 Hz, 0.35s, fade-out)
  - Au démarrage du timer : `scheduleNotificationAsync({ trigger: { type: TIME_INTERVAL, seconds } })` — id stocké dans `useRef`
  - Skip / ajustement / édit : `cancelScheduledNotificationAsync(id)` puis re-planification si besoin
  - Démontage du composant : `cancelNotif()` en cleanup du useEffect
  - Permission `requestPermissionsAsync()` appelée une fois au mount de `[workoutId].tsx`
  - `expo-haptics` conservé pour la vibration immédiate

## 💪 AGENT WORKOUT — Nouvelles tâches (session 9)

### ✅ Terminé (2026-04-23) — session 9

- [x] **P1 — Isoler `<RestTimer />` (perf)**
  - `components/workout/RestTimer.tsx` créé : state local, countdown + haptics dans l'enfant
  - Parent ne re-rend plus à chaque tick — useEffect countdown supprimé du parent
  - Props : `initialDuration`, `onFinish`, `onSkip`, `onAdjust(newTotal)`

- [x] **P1 — Mode lecture seule pour séances terminées**
  - Navigation `history.tsx` → `[workoutId]` déjà en place
  - `isFinished === true` : TextInput remplacés par Text statiques (valeurs réelles)

- [x] **P2 — Menu contextuel "..." sur les templates**
  - `workout.tsx` : Modal bottom sheet Démarrer / Modifier / Supprimer
  - `deleteTemplate()` ajouté dans `DatabaseService.ts`
  - Icônes `play.fill`, `pencil`, `trophy.fill` ajoutées dans `icon-symbol.tsx`

- [x] **P2 — Boutons Enregistrer / Supprimer dans `template.tsx`**
  - Bouton "Enregistrer" : sauvegarde explicite du nom
  - Bouton "Supprimer la routine" (rouge) : Alert confirmation → `deleteTemplate()` → retour

- [x] **P2 — CTA "Ajouter à la séance" dans `[exerciseId].tsx`**
  - `getActiveWorkout()` vérifié au mount
  - Si séance active : bouton "Ajouter à la séance en cours" → `addSetToWorkout(workoutId, exerciseId)` → `router.back()`

### ✅ P3 — Types de sets (W / D / F) — Terminé (2026-04-23)
- [x] **Toggle pill dans `[workoutId].tsx`**
  - Cellule set index élargie (44px) : numéro en haut + pill coloré N/W/D/F en bas
  - Tap → cycle normal→warmup→dropset→failure→normal
  - Couleurs : W = orange, D = bleu, F = rouge, N = invisible (pas de badge en mode séance active)
  - Persisté via `updateWorkoutSet(setId, { set_type })` — migration v5 déjà en place
  - En mode lecture seule (séance terminée) : pill affiché pour tous les types

### ✅ P3 — Note textuelle sur la séance active — Terminé (2026-04-23)
- [x] **Champ notes collapsible dans `[workoutId].tsx`**
  - Migration v6 : colonne `notes TEXT` ajoutée sur `workouts`
  - `updateWorkoutNotes(workoutId, notes)` ajouté dans `DatabaseService.ts`
  - `WorkoutSessionDetail` mis à jour avec `notes: string | null`
  - `getWorkoutSessionDetail` : `SELECT notes` + retour dans le type
  - UI : carte icône crayon + label → tap expand → `TextInput` multiline, `onBlur` sauvegarde auto
  - Mode lecture seule (isFinished) : texte statique si notes présentes

### ✅ P3 — Harmonisation FR (fichiers Workout) — Terminé (2026-04-23)
- [x] `[workoutId].tsx` : "Add Exercise" → "Ajouter un exercice", "Finish Workout" → "Terminer la séance", "Workout Complete!" → "Séance terminée !", "Duration" → "Durée", "Done" → "Terminer", modal template FR complet
- [x] `RestTimer.tsx` : "Rest" → "Repos", "Skip" → "Passer"

---

## 🏠 AGENT ACCUEIL — Nouvelles tâches (session 10)

### ✅ P1 — Tous les templates sur l'accueil avec aperçu cliquable
- [x] **Liste complète + accordéon implémentés dans `app/(tabs)/index.tsx`**
  - `.slice(0, 3)` supprimé — tous les templates affichés, avec `useFocusEffect` pour le refresh
  - Tap sur une carte → accordéon inline (chevron animé 200ms), lazy-loading du détail
  - Détail affiché : liste exercices (index, nom, sets × reps — poids si disponible)
  - Bouton "Démarrer" (44px, full-width) + bouton "Modifier" dans la zone expansée
  - Cache en mémoire (`Map`) — un seul fetch par template par session
  - Section renommée "MES ROUTINES"
  - `getTemplateWithExercises` + `TemplateDetail` importés depuis `DatabaseService.ts`
  - Chaînes FR : "Bienvenue," / "exercices" / "Chargement…" / "Modifier"

## 🏠 AGENT ACCUEIL — Nouvelles tâches (session 9)

### ✅ P1 — Réparer la navigation tab bar
- [x] **S'assurer que la bottom nav est accessible depuis toutes les pages**
  - `app/_layout.tsx` : tous les écrans `workouts/` et `exercises/` enregistrés explicitement dans le Stack root
  - `workouts/[workoutId]` → `presentation: 'fullScreenModal'` (séance active = écran dédié, swipe down pour revenir)
  - `workouts/exercise-picker` + `exercises/[exerciseId]` → `presentation: 'modal'`
  - `workouts/template`, `workouts/new-template`, `add-exercise`, `settings` → stack standard avec back button

### ✅ P2 — Page Paramètres
- [x] **`app/settings.tsx` créé et relié depuis le header de l'accueil**
  - Section Profil : nom d'utilisateur (TextInput, sauvegarde `on blur` via `user_settings` table SQLite)
  - Section Préférences : toggle kg/lbs + toggle Clair/Sombre (utilise `ThemeContext.setColorScheme` existant)
  - Section Données : bouton rouge "Réinitialiser toutes les données" avec double Alert de confirmation
  - `user_settings` table ajoutée dans `DatabaseService._doInit()` (clé-valeur générique)
  - `getUserSetting()`, `saveUserSetting()`, `resetAllWorkoutData()` ajoutés dans `DatabaseService.ts`
  - Icône cloche → icône gear dans le header de `index.tsx`, navigue vers `/settings`

### ✅ P3 — Dossiers / groupes de routines
- [x] **Icône dossier supprimée de `app/(tabs)/workout.tsx`**
  - Bouton sans `onPress` retiré (feature non planifiée pour ce sprint)
  - Style `headerIcons` supprimé — le bouton `+` reste seul dans le header ROUTINES

---

## 🎨 AGENT DESIGN — Nouvelles tâches (session 9)

### 🔴 P1 — Virtualiser la liste des exercices (perf)
- [x] **Optimisation FlatList dans `app/(tabs)/exercises.tsx`**
  - `ITEM_HEIGHT = 81`, `getItemLayout` pour scroll instantané sur 873 exercices
  - Item extrait en `ExerciseItem` avec `React.memo`
  - `useCallback` sur `renderItem`, `keyExtractor`, `getItemLayout`, `handleItemPress`, `toggleSelection`
  - `useMemo` sur `filteredExercises`

### 🔴 P1 — Persister le thème dark (no flash)
- [x] **`AsyncStorage` + `ThemeContext` dans `context/ThemeContext.tsx`**
  - `@react-native-async-storage/async-storage@2.2.0` installé
  - `ThemeProvider` + `useTheme()` : lit AsyncStorage au mount, fallback `useSystemColorScheme`
  - `hooks/use-color-scheme.ts` mis à jour → lit depuis `ThemeContext`
  - `app/_layout.tsx` : `ThemeProvider` wrapping + `AppShell` bloque le rendu jusqu'à `isReady`
  - **Note Agent Accueil** : pour le toggle dans Paramètres, appeler `setColorScheme('light'|'dark')` depuis `useTheme()`

### 🟡 P2 — Graphique évolution poids corporel
- [x] **Graphique linéaire SVG dans `app/(tabs)/stats.tsx`**
  - `WeightChart` réécrit avec `react-native-svg` : Polyline, Circle, Line, SvgText
  - Grille 3 niveaux, labels Y (kg), labels X (date courte fr), 10 derniers points max
  - Affiché uniquement si ≥ 2 mesures

### 🟡 P3 — Graphique progression par exercice
- [x] **Section "Progression" dans `app/exercises/[exerciseId].tsx`**
  - `getExerciseProgressHistory(exerciseId)` ajouté dans `DatabaseService.ts` (MAX weight par date séance)
  - `ProgressChart` SVG intégré : même pattern que WeightChart, couleur `tint`
  - Placeholder fr si < 2 points de données

---

## 🌐 TRANSVERSAL — Session 9

### ✅ P3 — Harmoniser la langue (FR) — Terminé (2026-04-24)
- [x] **Audit et uniformisation de toutes les chaînes UI en français**
  - Règle : **tout en français**, sauf les termes techniques universels (kg, lbs, PR, sets, reps)
  - Agent Workout (session 12) : `exercise-picker.tsx` ("Add Exercise"→"Ajouter un exercice", "Search exercises..."→"Rechercher un exercice...", "Loading…"→"Chargement…"), `template.tsx` ("Workout Template"→"Modèle de routine", "Name"→"Nom", "New Workout"→"Nouvelle routine", "Exercises"→"Exercices", "Add exercises"→"Ajouter des exercices", "Start workout"→"Démarrer la séance", message vide FR, "Rest (s)"→"Repos (s)"), `history.tsx` ("History"→"Historique", "exercise"→"exercice"), `workout.tsx` ("Workout"→"Séances", "template"→"routine"), `[workoutId].tsx` (alerte suppression set + fallback nom)
  - Agent Design (session 12) : `exercises.tsx` ("Exercise Library"→"Bibliothèque d'exercices", "POPULAR EXERCISES"→"EXERCICES POPULAIRES", "SELECTION"→"SÉLECTION", "Add to Workout"→"Ajouter à la séance", "Add to Template"→"Ajouter à la routine", "Saving..."→"Enregistrement…"), `stats.tsx` ("Progress"→"Progression", "week(s)"→"semaine(s)", "Sessions"→"Séances", "Time"→"Temps", "Volume / Week"→"Volume / Semaine", "Personal Records"→"Records Personnels", "Body Weight"→"Poids Corporel", placeholder + Alert + date locale → FR)

---

## 🟢 Terminé
- [x] **Database** — Schéma, migrations, seed, CRUD, stats (2026-03-20)
- [x] **Accueil** — Tous widgets, avatar offline, CTA, streak, templates rapides, refresh focus (2026-03-20)
- [x] **Stats** — Écran complet : volume/semaine, PRs, Body Weight tracker

---

## 📅 Journal des sessions

### 2026-04-24 — Agent Design (session 12)
- P3 ✅ Harmonisation FR (fichiers Design) :
  - `exercises.tsx` : titre, placeholder, étiquettes sélection, boutons d'action → FR
  - `stats.tsx` : "Progress"→"Progression", "week(s)"→"semaine(s)", "Sessions"/"Time"/"Personal Records"/"Body Weight" → FR, placeholder/Alert/date locale → FR

### 2026-04-24 — Agent Workout (session 12)
- P3 ✅ Harmonisation FR complète (fichiers Workout restants) :
  - `exercise-picker.tsx` : "Add Exercise" / "Search exercises..." / "Loading…" → FR
  - `template.tsx` : "Workout Template" / "Name" / "New Workout" / "Exercises" / "Add exercises" / "Start workout" / message vide / "Rest (s)" → FR
  - `history.tsx` : "History" → "Historique", "exercise" → "exercice"
  - `workout.tsx` : "Workout" → "Séances", "template" → "routine"
  - `[workoutId].tsx` : alerte suppression set + fallback nom "Workout" → FR

### 2026-04-23 — Agent Accueil (session 10)
- P1 Templates expansibles : `.slice(0,3)` supprimé, accordéon inline (Animated.Value, 200ms), lazy-load détail par template, cache Map, boutons Démarrer/Modifier dans zone expansée ✅
- DB cross-agent : `getTemplateWithExercises` + `TemplateDetail` implémentés dans `DatabaseService.ts` (tâche DB bloquante) ✅
- Chaînes FR : "Bienvenue," / "exercices" / "Chargement…" / "MES ROUTINES" dans `index.tsx` ✅

### 2026-04-23 — Agent Database (session 11)
- P0 Bug web OPFS `NoModificationAllowedError` : retry ×5 backoff exponentiel dans `openDatabase()` + `beforeunload` close dans `_doInit()` ✅

### 2026-04-23 — Agent Database (session 10)
- P1 `getTemplateWithExercises(templateId)` : type `TemplateDetail` + fonction ajoutés dans `DatabaseService.ts` → Agent Accueil débloqué ✅

### 2026-04-23 — Agent Database (session 9)
- P1 `getTotalVolumeAllTime()` : formule auditée — déjà correcte (`SUM(actual_weight * actual_reps)`), aucune correction nécessaire ✅
- P3 Migration `set_type` : colonne ajoutée via migration v5, `WorkoutSetRow` mis à jour, `updateWorkoutSet` + `getWorkoutSessionDetail` + `addSetToWorkout` modifiés → Agent Workout débloqué ✅

### 2026-04-23 — Agent Design (session 9)
- P1 ✅ FlatList optimisée : `React.memo` + `useMemo` + `useCallback` + `getItemLayout=81px` dans `exercises.tsx`
- P1 ✅ Thème persisté : `context/ThemeContext.tsx` + AsyncStorage + no-flash dans `_layout.tsx`; `hooks/use-color-scheme.ts` redirigé vers le contexte
- P2 ✅ Graphique poids corporel SVG (ligne) dans `stats.tsx` — remplace les barres
- P3 ✅ Graphique progression exercice SVG dans `exercises/[exerciseId].tsx` + `getExerciseProgressHistory()` dans `DatabaseService.ts`
- Dépendance ouverte pour Agent Accueil : toggle thème dans Paramètres → utiliser `setColorScheme` de `useTheme()`

### 2026-04-23 — Orchestrateur (session 11)
- Bug `NoModificationAllowedError` sur `createSyncAccessHandle` : SQLite OPFS web, handle non libéré entre hot-reloads/onglets → Agent Database P0 (retry + beforeunload close)

### 2026-04-23 — Orchestrateur (session 10)
- Bug `construct 'Text'` corrigé : `"reactCompiler": false` dans `app.json` (React Compiler expérimental incompatible React Native Web + React 19) ✅
- 3 nouvelles tâches planifiées :
  1. **Agent Database P1** — `getTemplateWithExercises(templateId)` pour débrouiller Agent Accueil
  2. **Agent Workout P1** — Animation barre de progression RestTimer (reanimated) + notification locale avec son (`expo-notifications`)
  3. **Agent Accueil P1** — Tous les templates sur l'accueil avec aperçu expansible (attend Agent Database)
- Ordre d'exécution : Database en premier (débloque Accueil), Workout en parallèle

### 2026-04-23 — Orchestrateur (session 9)
- Lecture du compte rendu agent web (CR-agent-web.md) : 16 tâches identifiées sur 3 niveaux de priorité
- Nouvelles tâches assignées :
  1. **Agent Database P1** — Corriger calcul `getTotalVolumeAllTime()` (weight × reps)
  2. **Agent Database P3** — Migration `set_type` pour warmup/dropset/failure
  3. **Agent Workout P1** — Isoler `<RestTimer />` (re-renders toutes les secondes)
  4. **Agent Workout P1** — Cartes historique cliquables (navigation lecture seule)
  5. **Agent Workout P2** — Menu "..." templates (Start/Edit/Delete)
  6. **Agent Workout P2** — Boutons Save/Delete explicites sur écran template
  7. **Agent Workout P2** — CTA "Ajouter à la séance" depuis fiche exercice
  8. **Agent Workout P3** — Toggle type de set (W/D/F)
  9. **Agent Workout P3** — Note textuelle sur séance active
  10. **Agent Accueil P1** — Tab bar accessible depuis toutes les pages
  11. **Agent Accueil P2** — Page Paramètres (profil, unité, thème, reset)
  12. **Agent Accueil P3** — Décision icône dossier (supprimer recommandé)
  13. **Agent Design P1** — Virtualiser liste exercices (FlatList + memo + useCallback)
  14. **Agent Design P1** — Persister thème dark (AsyncStorage + no flash)
  15. **Agent Design P2** — Graphique évolution poids corporel
  16. **Agent Design P3** — Graphique progression par exercice
- Pas de nouvel agent nécessaire — toutes les tâches rentrent dans les 4 agents existants
- Dépendance croisée : types de sets (Workout P3) attend la migration (Database P3)
- Dépendance croisée : toggle thème (Accueil P2) doit coordonner avec la persistance (Design P1)

### 2026-03-22 — Agent Design (session 2)
- Fix import `exerciseImageMap` dans `exercise-picker.tsx` : named → default export ✅
- Long press sur chaque ligne du picker → `router.push('/exercises/[exerciseId]')` ✅
- `getExerciseById()` + `getExercisePR()` ajoutés dans `DatabaseService.ts` ✅
- Écran `app/exercises/[exerciseId].tsx` créé : hero image, badges, PR, description, instructions numérotées ✅
- `exercises.tsx` : tap en mode browse → navigation vers le détail (tap en mode template-picker → sélection) ✅

### 2026-04-23 — Agent Accueil (session 9)
- P1 Navigation tab bar : `_layout.tsx` mis à jour — tous les écrans `workouts/` enregistrés (fullScreenModal / modal / stack) ✅
- P2 Page Paramètres : `app/settings.tsx` créé (profil, toggle kg/lbs, toggle thème, reset données) ✅
  - `user_settings` table + `getUserSetting` / `saveUserSetting` / `resetAllWorkoutData` dans `DatabaseService.ts` ✅
  - Icône gear dans header `index.tsx` → navigation `/settings` ✅
- P3 Icône dossier : supprimée de `workout.tsx` (feature reportée en session 10+) ✅

### 2026-03-20 — Orchestrateur (session 1)
- Audit complet : TASKS.md obsolète, Database déjà complet
- Identification des vrais blocages Workout et Accueil

### 2026-03-20 — Agents Workout / Accueil / Database
- Add Exercise + Add Set en séance active ✅
- Bannière séance en cours, useFocusEffect ✅
- Avatar réseau supprimé, CTA home, streak, templates rapides ✅
- WeeklyActivityWidget + LastSessionWidget : useFocusEffect + finished_at ✅

### 2026-03-20 — Orchestrateur (session 4)
- 3 nouveaux bugs reportés par l'utilisateur après test réel :
  1. **Responsive** : colonne header width:72 vs doneButton width:36 → désaligné ; padding cumulé trop grand ; setInput sans minWidth:0
  2. **Navigation exercise-picker** : `router.back()` retourne à l'accueil au lieu de `[workoutId]` → fix : `router.navigate` avec params explicites
  3. **Finish Workout** : flux entier à reconstruire — enregistrement + récap + mise à jour template optionnelle + navigation `router.replace`
- Icônes manquantes : 2 nouvelles entrées identifiées (`xmark.circle.fill`, `plus.circle`) dans `exercise-picker.tsx`

### 2026-03-20 — Orchestrateur (session 5)
- 4 nouvelles tâches identifiées après test utilisateur :
  1. **CRITIQUE — Mauvaise source exercices** : DB seedée depuis `initialExercises` (~10 exos, images réseau) au lieu de `generatedExercises` (~870 exos, images locales) → Agent Database
  2. **Stats total kg** : pas de `getTotalVolumeAllTime` en DB ni d'affichage all-time → Agent Database + Agent Design
  3. **Timer configurable** : saisie directe de la durée (tap sur le chiffre) + mémorisation par exercice → Agent Workout
  4. **Suppression set visible** : `handleDeleteSet` existe mais caché derrière long-press, ajouter bouton poubelle → Agent Workout

### 2026-03-22 — Orchestrateur (session 8)
- 2 bugs identifiés dans `[workoutId].tsx` après test utilisateur :
  1. **Inputs verrouillés** : `editable={!isCompleted}` empêche toute modification après validation d'un set → retirer la condition → Agent Workout
  2. **Perte de données au Finish** : inputs en mode `defaultValue` non-contrôlé, `Keyboard.dismiss()` ne flush pas tous les champs → passer en mode contrôlé (`value`+`onChangeText`+`pendingValues` Map) et flush explicite dans `handleFinish` → Agent Workout

### 2026-03-22 — Orchestrateur (session 7)
- 4 nouvelles tâches identifiées :
  1. **Écran détail exercice** : nouvelle route `app/exercises/[exerciseId].tsx` — image, description, instructions, PR → Agent Design + Agent Database (`getExerciseById`)
  2. **Rester sur exercise-picker** : supprimer `goBack()` après ajout, tracker `addedIds`, bouton "Terminé (X)" dans le header → Agent Workout
  3. **Son/haptique fin de chrono** : déclencher `expo-haptics` (+ son optionnel) quand `remaining === 0` → Agent Workout
  4. **Photos dans exercise-picker** : miniatures 48×48 via `exerciseImageMap[id+'.jpg']`, fallback initiale → Agent Design
- Dépendance : écran détail attend `getExerciseById` (Agent Database)

### 2026-03-22 — Orchestrateur (session 6)
- 4 nouvelles tâches identifiées après demande utilisateur :
  1. **Séance unique** : bloquer création si une séance est déjà active, adapter l'affichage (pas de QuickStart, CTA "Reprendre") → Agent Workout
  2. **Temps de repos visible + modifiable** : afficher `rest_seconds` dans le header de chaque exercice, tapable pour édition inline (en dehors du décompte) → Agent Workout
  3. **Poids dernière séance** : annoter chaque set avec les valeurs réelles de la séance précédente → Agent Workout + Agent Database
  4. **Source exercices** (rappel) : `generatedExercises.ts` (870 exos + 873 images locales dans `assets/exercise_images/`) doit remplacer `initialExercises.ts` (10 exos + URLs Unsplash réseau) → Agent Database

### 2026-03-22 — Agent Design
- Fix warnings `shadow*` sur web : `exercises.tsx` + `QuickStartWidget.tsx` → `Platform.OS === 'web'` + `boxShadow` ✅
- Composants partagés créés : `components/shared/Button.tsx`, `Card.tsx`, `SetRow.tsx` (variantes, thème auto, zones tactiles ≥36dp) ✅
- Tokens design ajoutés dans `constants/theme.ts` : `Spacing`, `Radius`, `TouchTarget`, `SemanticColors` ✅
- Stats all-time (`getTotalVolumeAllTime`) : bloqué sur Agent Database ⏳

### 2026-03-20 — Orchestrateur (session 4)
- Analyse des erreurs de compilation reportées :
  1. **CRITIQUE — `Error: Error finalizing statement`** : `initDatabase()` appelée en parallèle depuis 5+ composants sur la même connexion SQLite WASM → crash. Fix : guard singleton `initPromise` dans DatabaseService.ts → Agent Database
  2. **Warning `shadow*`** : `exercises.tsx` + `QuickStartWidget.tsx` utilisent props dépréciées sur web → `Platform.select` avec `boxShadow` → Agent Design
  3. **Warning `pointerEvents`** : vient de node_modules react-navigation → non actionnable
