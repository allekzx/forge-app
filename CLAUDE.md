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
> 📝 Mis à jour le 2026-08-31

- **Dernière session** : Orchestrateur session 11 — nouveau programme Upper/Lower A-B (seed_version 6) + feature superset
  - Agent Database — `DEFAULT_TEMPLATES` (seed_upper/seed_upper_b/seed_lower/seed_legs) réécrits pour coller au nouveau
    programme (mollets debout/assis ajoutés, Bulgarian split squat, ratio biceps/triceps équilibré, abdos en Lower B,
    abducteur/adducteur réduits à 1×/semaine). `Lower A` est désormais squat-focus et `Lower B` deadlift-focus
    (inversé vs avant — `constants/programs.ts` mis à jour en conséquence). Anciennes migrations `seedExMigrations`
    stales pour seed_upper/seed_lower/seed_legs supprimées (elles auraient écrasé le nouveau contenu).
  - Nouvelle colonne `superset_group_id` (nullable) sur `workout_template_exercises` et `workout_exercises` —
    permet de grouper 2+ exercices en superset (ex: Upper A, triceps pushdown + overhead poulie basse enchaînés).
    Fonctions `setTemplateExercisesSupersetGroup` / `clearTemplateSupersetGroup` dans `services/DatabaseService.ts`.
  - Agent Workout — UI de liaison/dissociation de superset dans `app/workouts/template.tsx` (bouton "Enchaîner en
    superset" sous chaque carte exercice) + affichage visuel du superset (bordure + badge ambre) dans le template
    editor et dans la séance live `app/workouts/[workoutId].tsx`. `app/history/[workoutId].tsx` (vue lecture seule)
    n'a pas été mis à jour avec le badge — à faire si besoin.
  - Nouvelle icône `link` ajoutée au mapping `components/ui/icon-symbol.tsx`.
- **Sessions précédentes** : toutes les tâches sessions 1-9 sont ✅ terminées (bug React Compiler corrigé session 10)
- **En cours** :
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
