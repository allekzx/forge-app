# Quickstart: Développement et Test

**Branch**: `001-workout-session-crud` | **Date**: 2026-05-10

## Lancer l'application

```bash
# Mobile (iOS simulator ou Android)
npx expo start --ios
npx expo start --android

# Web
npx expo start --web
```

L'app est en Expo Go / Dev Client. Toute modification de fichier source déclenche un rechargement chaud (Fast Refresh).

## Réinitialiser la base SQLite

En cas de problème de schéma ou pour tester les migrations depuis zéro :
1. Sur simulateur iOS : supprimer l'app et la réinstaller
2. Sur web : ouvrir DevTools → Application → IndexedDB → supprimer `strong_v3.db`
3. Via l'app : Paramètres → Réinitialiser toutes les données

## Tests manuels par fonctionnalité

### FR-001 — Volume correct
1. Créer une séance, ajouter "Bench Press"
2. Saisir 3 sets : 100 kg × 10 reps chacun → cocher les 3
3. Terminer la séance
4. Aller dans Stats → "All Time" → volume attendu : **3 000 kg**

### FR-002 / SC-003 — Thème sans flash
1. Aller dans Paramètres → sélectionner "Sombre"
2. Fermer complètement l'app (swipe up + kill sur iOS)
3. Rouvrir → l'app doit s'afficher en **sombre sans aucun flash clair**

### FR-003 / SC-004 — Tab bar toujours accessible
1. Démarrer une séance (Quick Start)
2. Dans l'écran séance active → appuyer sur l'onglet "Stats" dans la barre du bas
3. Doit naviguer vers Stats **sans appuyer sur Retour**

### FR-004 — Types de sets dans les templates
1. Créer une nouvelle routine "Test Push"
2. Ajouter "Bench Press" avec 4 sets
3. Appuyer sur le numéro du set 1 → sélecteur de type → choisir "Échauffement"
4. Enregistrer → Démarrer la séance → le set 1 doit afficher le badge "W"

### FR-005 / FR-006 — Réorganisation par glisser-déposer
1. Créer une routine avec 3 exercices (A, B, C dans cet ordre)
2. Appuyer longtemps sur le handle de l'exercice B → le glisser au-dessus de A
3. L'ordre doit devenir : B, A, C
4. Fermer et rouvrir la routine → l'ordre doit être persisté

### FR-007 / SC-006 — Conversion lbs
1. Paramètres → Unité : **lbs**
2. Démarrer une séance → saisir "225" pour un bench press
3. En coulisses : stocké comme 225 / 2.20462 ≈ 102.06 kg
4. Fermer et revenir → doit afficher "225.0 lbs", pas 102 kg

### FR-008 / SC-007 — Notification PR
1. S'assurer d'avoir une séance précédente avec 80 kg au Bench Press
2. Démarrer une nouvelle séance → Bench Press → saisir **85 kg** → cocher le set
3. Un badge PR animé doit apparaître dans les 2 secondes

### FR-010 / FR-011 — Historique détail lecture seule
1. Aller dans l'onglet Historique
2. Appuyer sur une séance terminée
3. L'écran doit montrer : nom, date, durée, volume, liste des sets
4. **Aucun bouton d'édition, aucun TextInput** ne doit être visible

### FR-015 / SC-008 — Reprise après crash
1. Démarrer une séance, saisir quelques sets
2. Forcer la fermeture de l'app (kill)
3. Rouvrir → sur l'écran d'accueil, une bannière "Reprendre → [nom séance]" doit apparaître
4. Appuyer sur la bannière → retour dans la séance avec toutes les données présentes

### FR-012 — Labels en français
1. Aller dans la Bibliothèque d'exercices
2. Les chips de filtre doivent afficher : **Tous / Pectoraux / Dos / Jambes / Bras / Épaules / Abdos**
3. (Plus "Chest", "Back", "Arms", etc.)

### FR-014 — Graphique poids corporel sur web
1. Lancer `npx expo start --web`
2. Aller dans Stats → section "Poids Corporel"
3. Ajouter 2 mesures (ex: 80 kg, 81 kg)
4. Le graphique SVG doit s'afficher sur web (auparavant désactivé)

## Structure des données de test recommandée

Pour tester rapidement toutes les fonctionnalités, créer :
- 1 routine "Push A" : Bench Press (4 sets : 1W + 3N), Overhead Press (3 sets N)
- 1 routine "Pull A" : Deadlift (3 sets), Rowing barre (4 sets)
- 3 séances terminées avec des poids croissants (pour tester les PRs)
- 1 mesure de poids corporel par semaine sur 4 semaines
