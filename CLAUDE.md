# 🎯 ORCHESTRATEUR — Application Salle de Sport

## Rôle
Tu es le chef de projet de cette application React/React Native de salle de sport.
Tu coordonnes 3 agents spécialisés et tu t'assures de la cohérence globale du projet.

## Contexte projet
- Application de salle de sport inspirée de Strong
- Fonctionne **hors ligne** (pas de réseau en salle) — SQLite local obligatoire
- Stack : React / React Native
- Base SQLite existante liée au projet
- Répertoire d'exercices avec images disponible

## Tes responsabilités
- Lire et comprendre l'état global du projet avant toute action
- Définir les tâches à déléguer à chaque agent
- Maintenir la cohérence entre les 3 modules (workout, design, accueil)
- Vérifier que les interfaces partagées (types, composants communs) sont respectées
- Gérer les conflits entre agents (ex: un composant utilisé par plusieurs modules)
- Mettre à jour ce fichier après chaque session pour laisser un état clair

## Agents disponibles
| Agent | Fichier | Responsabilité |
|-------|---------|----------------|
| Workout | `CLAUDE.agent-workout.md` | Création et gestion des séances |
| Design | `CLAUDE.agent-design.md` | UI/UX, styles, responsive mobile |
| Accueil | `CLAUDE.agent-accueil.md` | Page d'accueil, dashboard, navigation |

## Protocole de coordination
1. Toujours commencer par `find . -type f` pour lire l'état du projet
2. Identifier quel agent est concerné par la demande
3. Ne jamais modifier les fichiers sous responsabilité d'un autre agent sans le noter ici
4. Les types TypeScript partagés vont dans `src/types/index.ts`
5. Les composants réutilisables vont dans `src/components/shared/`

## Fichiers partagés (ne pas modifier sans coordination)
- `src/types/index.ts` — interfaces communes (Workout, Exercise, Set, etc.)
- `src/db/database.ts` — couche SQLite
- `src/components/shared/` — composants UI réutilisables
- `src/theme/` — tokens de design (couleurs, typo, spacing)

## État du projet
> 📝 Mis à jour le 2026-07-16

- **Dernière session** : Session 14 — suppression des anciennes routines Push/Pull/Legs/Upper/Lower (confirmé par l'utilisateur) :
  - ✅ **Nettoyage post-migration programme coach** — retire les 6 anciens templates (dont "Upper B", jamais montré à l'utilisateur) de `DEFAULT_TEMPLATES`, ajoute `cleanupLegacyTemplates()` qui supprime leur définition + exercices/sets liés au prochain lancement (`SEED_VERSION` 6→7). Historique des séances déjà réalisées non affecté. Il ne reste que les 4 templates du programme coach (Haut A/B, Bas A/B).
- **Session précédente (13)** : programme coach 4 jours/semaine ajouté comme routines par défaut :
  - ✅ **Haut du corps A/B + Bas du corps A/B** — 4 nouveaux templates dans `DEFAULT_TEMPLATES` (`services/DatabaseService.ts`), split Haut/Bas répété pour travailler chaque groupe musculaire 2×/semaine, conçu à partir des exercices réels de l'utilisateur (captures de l'app Strong). Réutilise uniquement des exercices déjà présents/renommés en FR (vérifié programmatiquement : 0 exId cassé sur les 60 références de `DEFAULT_TEMPLATES`). `SEED_VERSION` 5→6, `EXERCISE_NAME_VERSION` 2→3.
- **Session précédente (12)** : feature "déplacer un set" + export/import de sauvegarde :
  - ✅ **Déplacer un set en séance active** — `reorderWorkoutSets()` dans `services/DatabaseService.ts` + section "Position" (Monter/Descendre) ajoutée à la modal de type de set déjà existante dans `app/workouts/[workoutId].tsx`. Permet d'ajouter un set puis de le remonter en tête pour en faire une série d'échauffement, sans perdre poids/reps déjà saisis.
  - ✅ **Export/import de sauvegarde** — l'app est 100% hors ligne (pas de sync cloud), donc jusqu'ici un changement de téléphone effaçait tout l'historique. Ajout de `exportAllData()`/`restoreAllData()` (dump/restore JSON générique whitelisté contre le schéma SQLite réel) + `services/BackupService.ts` (write + `expo-sharing` pour l'export, `expo-document-picker` pour l'import) + section DONNÉES dans `app/settings.tsx`. Nouvelles deps : `expo-file-system`, `expo-sharing`, `expo-document-picker`. Corrige au passage `resetAllWorkoutData()` qui n'effaçait pas `template_exercise_sets`.
- **Session précédente (11)** : audit logique complet (navigation, calendrier, chrono) + 4 corrections :
  - ✅ **Bug calendrier** — `getWeeklyStats()`, `getVolumeByWeek()`, `getExerciseProgressHistory()` dans `services/DatabaseService.ts` comparaient des dates UTC (`toISOString()`) à des dates SQLite non converties (`DATE(created_at)`), décalant d'un jour les séances faites tôt le matin/tard le soir en heure locale (France). Fix : helper `localDateStr()` + modifieur SQLite `'localtime'` partout où une date est extraite d'un timestamp stocké.
  - ✅ **Boucle de navigation "retour"** — `app/workouts/[workoutId].tsx` : le listener `beforeRemove` interceptait aussi bien le geste de fermeture accidentel que les actions volontaires (bouton minimiser, mini tab bar), forçant une confirmation "Mettre en pause ?" à chaque changement d'onglet. Fix : ref `skipGuardRef` pour laisser passer les navigations délibérées sans confirmation, en gardant la protection sur les vraies fermetures (swipe/back matériel).
  - ✅ **Flèche retour fantôme** — `app/(tabs)/exercises.tsx` affichait un chevron "retour" même en accès direct depuis la tab bar (seul onglet des 5 dans ce cas), sans destination cohérente. Masqué hors du mode picker de template.
  - ✅ **Bannière "Reprendre" absente de 3 onglets sur 5** — `ActiveWorkoutBanner` (FR-002 de `specs/002-fix-prod-blockers`) n'était monté que sur Accueil et Séance ; un utilisateur minimisant vers Historique/Exercices/Mesures n'avait aucun chemin de retour vers sa séance active. Ajouté aux 3 écrans manquants.
  - ℹ️ Chrono de repos (RestTimer) déjà fiable en veille depuis la session précédente (commit `d07764d`) — vérifié, pas de régression.
- **Sessions précédentes** : Orchestrateur session 10 — bug React Compiler corrigé + 3 nouvelles tâches ; toutes les tâches sessions 1-8 sont ✅ terminées
- **En cours (session 9)** :
  - 🔴 Agent Database — Corriger calcul `getTotalVolumeAllTime()` (weight × reps)
  - 🔴 Agent Workout — Isoler `<RestTimer />` (re-renders perf)
  - 🔴 Agent Workout — Cartes historique cliquables
  - 🔴 Agent Accueil — Tab bar accessible depuis toutes les pages
  - 🔴 Agent Design — Virtualiser liste exercices (FlatList + memo)
  - 🔴 Agent Design — Persister thème dark (AsyncStorage + no flash)
  - 🟡 Agent Workout — Menu "..." templates + Save/Delete template + CTA "Ajouter à la séance"
  - 🟡 Agent Accueil — Page Paramètres (profil, unité, thème, reset)
  - 🟡 Agent Design — Graphique évolution poids corporel
  - 🟡 Agent Database — Migration `set_type` (P3, attend avant types de sets Workout)
  - 🟡 Transversal — Harmoniser la langue FR
- **Bloquants** :
  - Types de sets UI (Workout P3) → attend migration `set_type` (Database P3)
  - Toggle thème (Accueil P2) → doit coordonner avec persistance AsyncStorage (Design P1)

<!-- SPECKIT START -->
Active implementation plan: specs/002-fix-prod-blockers/plan.md
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
