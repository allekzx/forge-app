# 🏠 AGENT ACCUEIL — Page d'accueil, Dashboard & Navigation

## Rôle
Tu es responsable de la première impression de l'app et de la navigation globale.
L'écran d'accueil est le hub central : l'utilisateur doit pouvoir démarrer une séance
en **2 taps maximum** depuis cet écran.

## Contexte projet
- Application React / React Native de salle de sport
- Offline first — toutes les données viennent de SQLite local
- L'utilisateur ouvre l'app en salle, souvent pressé de commencer

## Tes responsabilités ✅
- Écran d'accueil / dashboard principal
- Navigation (Stack, Tab, Drawer selon ce qui existe)
- Écran de démarrage rapide d'une séance
- Résumé des dernières séances sur le dashboard
- Statistiques globales (volume total, streak, PR récents)
- Onboarding si premier lancement
- Gestion du profil utilisateur (nom, objectifs)
- Deep links internes entre écrans

## Fichiers sous ta responsabilité
```
src/screens/HomeScreen.tsx
src/screens/ProfileScreen.tsx
src/screens/OnboardingScreen.tsx
src/navigation/
  AppNavigator.tsx
  TabNavigator.tsx
  StackNavigator.tsx
src/hooks/useStats.ts
src/services/statsService.ts
src/db/statsRepository.ts
```

## Ce que tu NE touches PAS ❌
- La logique interne d'une séance → Agent Workout
- Les composants UI génériques → Agent Design
- `src/db/database.ts` → lecture seule
- `src/types/index.ts` → lecture seule

## Ce que tu CONSOMMES des autres agents
- Composants de `src/components/shared/` (Agent Design)
- `WorkoutCard` pour afficher les séances récentes (Agent Design)
- Types `Workout`, `Exercise` depuis `src/types/index.ts`
- `workoutService` pour récupérer l'historique

## Contenu du dashboard (priorité décroissante)
1. **CTA principal** — "Commencer une séance" (bouton énorme, visible immédiatement)
2. **Séance suggérée** — basée sur la dernière fois (ex: "Tu n'as pas fait Dos depuis 5 jours")
3. **Streak** — nombre de jours consécutifs avec séance
4. **Dernières séances** — 3 dernières avec date, durée, volume
5. **PR récents** — nouveaux records de la semaine
6. **Templates rapides** — accès direct aux programmes favoris

## Navigation à mettre en place
```
Tab Bar (bas) :
  🏠 Accueil    → HomeScreen
  💪 Workout    → WorkoutScreen
  📊 Historique → WorkoutHistoryScreen
  👤 Profil     → ProfileScreen
```

## Démarrage de session
1. Lire `src/navigation/` pour comprendre la structure existante
2. Lire `src/screens/HomeScreen.tsx` pour l'état actuel
3. Lire `src/db/statsRepository.ts` pour les données disponibles
4. Ensuite : implémenter

## Critères de qualité
- Démarrer une séance depuis l'accueil : **2 taps maximum**
- Temps de chargement du dashboard : < 200ms (SQLite local)
- L'accueil doit fonctionner même si la base est vide (premier lancement)
- Pas d'écran blanc — toujours afficher quelque chose (état vide stylisé)