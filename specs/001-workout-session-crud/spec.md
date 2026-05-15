# Feature Specification: Application Fitness — Finalisation Strong-like

**Feature Branch**: `001-workout-session-crud`  
**Created**: 2026-05-10  
**Status**: Draft  
**Input**: Analyse l'état actuel du projet et définit les fonctionnalités qui ne fonctionnent pas encore, l'objectif est de faire une application qui ressemble beaucoup à Strong, une application qui sert à entrer les données des séances de la salle, on peut créer des séances, les démarrer, les modifier et le supprimer si besoin.

---

## État actuel du projet — Analyse

### Fonctionnalités déjà en place ✅

| Module | Fonctionnalité |
|--------|----------------|
| Routines | Créer, modifier, supprimer des routines (templates) |
| Routines | Configurer sets, reps, temps de repos par exercice |
| Routines | Démarrer une séance depuis une routine |
| Séance active | Démarrer une séance vide (Quick Start) |
| Séance active | Entrer poids et répétitions par set |
| Séance active | Cocher un set comme terminé |
| Séance active | Timer de repos automatique après chaque set |
| Séance active | Types de sets : Normal, Échauffement (W), Drop Set (D), Échec (F) |
| Séance active | Ajouter / supprimer des sets en cours de séance |
| Séance active | Ajouter des exercices en cours de séance |
| Séance active | Notes de séance |
| Séance active | Terminer la séance + résumé (durée, volume, sets) |
| Séance active | Proposition de mise à jour de la routine après séance |
| Séance active | Affichage des données de la session précédente (poids/reps suggérés) |
| Historique | Liste des séances passées avec date et nombre d'exercices |
| Historique | Accès en lecture seule au détail d'une séance passée |
| Exercices | Bibliothèque avec recherche et filtre par groupe musculaire |
| Exercices | Création d'exercices personnalisés |
| Stats | Volume par semaine (graphique barres) |
| Stats | Records Personnels par exercice |
| Stats | Suivi poids corporel + graphique courbe |
| Stats | Statistiques globales (volume total, séances, sets) |
| Accueil | Dashboard : streak, stats semaine, routines |
| Paramètres | Prénom, unité (kg/lbs), thème clair/sombre, couleur d'accent, reset |

### Fonctionnalités manquantes ou cassées ❌

| Priorité | Problème / Fonctionnalité manquante |
|----------|--------------------------------------|
| P1 (Bug) | Calcul du volume total incorrect dans `getTotalVolumeAllTime()` — devrait être poids × reps × sets |
| P1 (Bug) | Le thème clair/sombre ne persiste pas au redémarrage de l'app (flash au boot) |
| P1 (UX) | La barre de navigation (tab bar) n'est pas accessible depuis les écrans de séance et paramètres |
| P2 | Les types de sets (W/D/F) ne peuvent pas être configurés dans les templates (routines) |
| P2 | Impossible de réordonner les exercices dans un template ou une séance active |
| P2 | La conversion d'unité (kg ↔ lbs) n'est pas appliquée de façon cohérente dans toute l'app |
| P3 | Pas de notification de Record Personnel (PR) lorsqu'un PR est battu pendant une séance |
| P3 | Le graphique poids corporel est désactivé sur la version web |
| P3 | Mélange français/anglais dans les labels (ex: "Warmup", "Drop Set", "All") |

---

## User Scenarios & Testing

### User Story 1 — Corriger les bugs critiques bloquants (Priority: P1)

Un utilisateur qui utilise l'app régulièrement voit son volume total affiché faux dans les stats, et l'app repasse en thème clair à chaque redémarrage même s'il avait choisi le sombre.

**Why this priority**: Ces bugs touchent directement la fiabilité et l'expérience quotidienne. Un volume incorrect fausse le suivi de progression — raison première d'utiliser l'app. Le flash de thème est perçu comme une régression à chaque ouverture.

**Independent Test**: Ouvrir l'app après avoir paramétré le thème sombre → le thème sombre s'affiche immédiatement. Vérifier les stats "All Time" après une séance de 3 séries de 100 kg × 10 reps → le volume affiché est 3 000 kg.

**Acceptance Scenarios**:

1. **Given** l'utilisateur a effectué 3 séries de 100 kg × 10 reps dans une séance terminée, **When** il consulte les stats "All Time", **Then** le volume total affiche 3 000 kg (et non 1 000 kg ou toute autre valeur erronée).
2. **Given** l'utilisateur a sélectionné le thème sombre dans les paramètres, **When** il ferme complètement l'app et la rouvre, **Then** l'app démarre directement en thème sombre sans flash clair au démarrage.
3. **Given** l'utilisateur est sur un écran de séance active, **When** il tape l'icône d'un autre onglet de la barre de navigation, **Then** il accède à cet onglet sans avoir à appuyer sur "Retour".

---

### User Story 2 — Créer et configurer une routine complète (Priority: P1)

Un utilisateur veut créer une routine "Push Day" avec des exercices configurés (sets, reps, repos, type de set), pour démarrer rapidement ses séances sans tout re-saisir à chaque fois.

**Why this priority**: C'est la fonctionnalité cœur de Strong : la routine comme modèle réutilisable. Si elle est incomplète (pas de types de sets, pas de réorganisation), l'utilisateur préfèrera saisir tout manuellement.

**Independent Test**: Créer une routine avec 3 exercices dans un ordre précis, définir le 1er set de chaque exercice comme "Échauffement", puis démarrer la séance et vérifier que l'ordre et les types sont respectés.

**Acceptance Scenarios**:

1. **Given** l'utilisateur ouvre un template existant, **When** il appuie longtemps sur un exercice, **Then** il peut le glisser-déposer pour le réorganiser dans la liste.
2. **Given** l'utilisateur est dans l'éditeur de template, **When** il appuie sur le numéro d'un set, **Then** un sélecteur apparaît pour choisir le type (Normal / Échauffement / Drop Set / Échec).
3. **Given** l'utilisateur a configuré une routine avec des types de sets, **When** il démarre la séance depuis cette routine, **Then** les types définis dans la routine sont pré-remplis dans les sets de la séance.

---

### User Story 3 — Démarrer, dérouler et terminer une séance (Priority: P1)

Un athlète arrive en salle, démarre sa routine "Push Day", entre ses poids/reps au fur et à mesure, respecte les temps de repos, et termine la séance avec un résumé.

**Why this priority**: C'est le flux principal de l'application. Il fonctionne déjà en grande partie, mais quelques friction restent (conversion d'unité incohérente, manque de retour PR).

**Independent Test**: Démarrer une séance depuis une routine, cocher tous les sets avec des poids, terminer → le résumé s'affiche avec durée, volume correct et liste des exercices.

**Acceptance Scenarios**:

1. **Given** l'utilisateur a sélectionné "lbs" comme unité dans les paramètres, **When** il consulte l'écran de séance active, **Then** les champs poids affichent "lbs" et la valeur est convertie depuis les données stockées en kg.
2. **Given** l'utilisateur coche un set avec un poids supérieur à son record, **When** le set est marqué terminé, **Then** une notification visuelle (badge ou animation) signale qu'un Record Personnel vient d'être battu.
3. **Given** l'utilisateur appuie sur "Terminer la séance", **When** la séance se termine, **Then** un écran de résumé s'affiche avec durée totale, volume total exact (poids × reps × sets), nombre de sets complétés et liste des exercices.

---

### User Story 4 — Consulter l'historique des séances (Priority: P2)

Un utilisateur veut revoir une séance passée pour comparer ses performances d'il y a 2 semaines avec aujourd'hui.

**Why this priority**: L'historique est une fonctionnalité majeure de Strong. Actuellement il fonctionne, mais l'UX est confuse car le même écran sert pour les séances actives et l'historique.

**Independent Test**: Depuis l'onglet Historique, appuyer sur une séance passée → un écran de détail en lecture seule s'affiche avec tous les exercices, sets, poids et reps.

**Acceptance Scenarios**:

1. **Given** l'onglet Historique affiche une liste de séances, **When** l'utilisateur appuie sur une séance terminée, **Then** un écran de détail en lecture seule s'affiche clairement (sans boutons d'action de séance active).
2. **Given** l'écran de détail d'une séance passée est ouvert, **When** l'utilisateur consulte les données, **Then** il voit : nom de la séance, date, durée, volume total, et pour chaque exercice la liste des sets avec poids, reps et type.

---

### User Story 5 — Gérer les exercices personnalisés (Priority: P2)

Un utilisateur veut ajouter un exercice qui n'est pas dans la bibliothèque par défaut.

**Why this priority**: Fort différenciateur — Strong permet les exercices custom. La fonctionnalité de création existe mais manque de cohérence (les catégories sont en anglais dans la lib).

**Independent Test**: Créer un exercice "Curl marteau" avec muscle "Arms" et équipement "Dumbbell" → il apparaît dans la liste et peut être ajouté à une routine.

**Acceptance Scenarios**:

1. **Given** l'utilisateur est dans la bibliothèque, **When** il appuie sur "+" et remplit le formulaire en français, **Then** l'exercice est créé et apparaît immédiatement dans la liste filtrée par son groupe musculaire.
2. **Given** les catégories de muscle de la bibliothèque affichent "Chest", "Back", etc., **When** la fonctionnalité est corrigée, **Then** toutes les étiquettes (groupes musculaires, types d'équipement, filtres) sont en français.

---

### Edge Cases

- Que se passe-t-il si l'utilisateur tente de démarrer une séance alors qu'une autre est déjà active ?
- Que se passe-t-il si un exercice est supprimé de la bibliothèque alors qu'il est dans un template actif ?
- Que se passe-t-il si l'utilisateur entre un poids de 0 kg ou un nombre de reps de 0 ?
- Si l'app est fermée ou crashe pendant une séance active, toutes les données saisies sont préservées et l'app propose de reprendre la séance au prochain lancement.
- Que se passe-t-il si l'utilisateur supprime tous les sets d'un exercice dans une séance active ?

---

## Requirements

### Functional Requirements

**Corrections de bugs (P1)**

- **FR-001**: Le système DOIT calculer le volume d'une séance selon la formule : `Σ (poids × reps)` par set complété.
- **FR-002**: Le système DOIT persister le choix de thème (clair/sombre) entre les sessions via stockage local, sans flash visible au démarrage.
- **FR-003**: La barre de navigation par onglets DOIT rester accessible depuis tous les écrans de l'application, y compris les écrans de séance active et de paramètres.

**Gestion des routines / templates (P1-P2)**

- **FR-004**: L'utilisateur DOIT pouvoir définir le type de chaque set (Normal, Échauffement, Drop Set, Échec) dans l'éditeur de template.
- **FR-005**: L'utilisateur DOIT pouvoir réordonner les exercices d'un template par glisser-déposer.
- **FR-006**: L'utilisateur DOIT pouvoir réordonner les exercices dans une séance active en cours.

**Séance active (P1-P2)**

- **FR-007**: Le système DOIT convertir et afficher les poids dans l'unité choisie par l'utilisateur (kg ou lbs) de façon cohérente dans tous les écrans.
- **FR-008**: Le système DOIT détecter un Record Personnel au moment où un set est coché comme complété et afficher une notification visuelle immédiate. Un PR est défini comme le poids absolu le plus élevé jamais enregistré pour cet exercice, quel que soit le nombre de répétitions.
- **FR-009**: L'écran "Séance en cours" DOIT afficher une alerte de confirmation si l'utilisateur appuie sur "Retour" sans avoir terminé la séance.

**Historique (P2)**

- **FR-010**: L'écran de détail d'une séance passée (historique) DOIT être clairement distinct de l'écran de séance active, en lecture seule uniquement.
- **FR-011**: Le détail d'une séance passée DOIT afficher : nom, date, durée, volume total, et pour chaque exercice : sets avec poids réel, reps réelles et type de set.

**Exercices et bibliothèque (P2-P3)**

- **FR-012**: Tous les labels de l'interface (groupes musculaires, équipements, filtres, types de set) DOIVENT être en français.
- **FR-013**: L'utilisateur DOIT pouvoir créer un exercice personnalisé avec : nom, groupe musculaire, équipement, et optionnellement une image.

**Résilience et récupération (P1)**

- **FR-015**: En cas de fermeture inattendue (crash, kill de l'app) pendant une séance active, le système DOIT conserver l'état complet de la séance et proposer automatiquement de la reprendre au prochain lancement de l'application.

**Stats (P3)**

- **FR-014**: Le graphique d'évolution du poids corporel DOIT être accessible et fonctionnel sur toutes les plateformes (mobile et web).

### Key Entities

- **Workout (Séance)**: Représente une session d'entraînement. Peut être active (en cours) ou terminée. Contient une liste d'exercices et leurs sets. Peut être associée à un template d'origine.
- **Template (Routine)**: Modèle réutilisable de séance. Contient des exercices avec configuration par défaut (sets cibles, reps cibles, repos, type de set).
- **WorkoutSet**: Un set individuel dans une séance. Contient : poids cible et réel, reps cibles et réelles, type (normal/warmup/dropset/failure), statut (complété ou non), temps de repos.
- **Exercise**: Un exercice de la bibliothèque. Propriétés : nom, groupe musculaire, équipement, image. Peut être standard ou personnalisé.
- **PersonalRecord**: Le poids absolu maximum soulevé pour un exercice donné, quel que soit le nombre de reps. Stocke : exercice, poids max, date du record, nombre de reps effectuées ce jour-là. Mis à jour automatiquement lors des séances.
- **BodyMeasurement**: Mesure corporelle enregistrée manuellement (poids en kg), avec date.
- **UserSetting**: Préférences utilisateur persistées localement (prénom, unité de poids, thème, couleur d'accent).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Un utilisateur peut créer une routine, démarrer une séance depuis cette routine, enregistrer tous ses sets et terminer la séance en moins de 5 minutes de manipulation totale pour une séance de 4 exercices × 4 sets.
- **SC-002**: Le volume total affiché dans les stats correspond exactement à la somme des (poids × reps) de tous les sets complétés — vérifiable par calcul manuel sur 3 séances test.
- **SC-003**: Le thème sombre persiste au redémarrage de l'app dans 100% des cas, sans aucun flash de thème clair visible.
- **SC-004**: L'utilisateur peut naviguer vers n'importe quel onglet depuis n'importe quel écran de l'app en 1 interaction (appui sur l'onglet), sans avoir à appuyer sur "Retour".
- **SC-005**: Les labels d'interface sont 100% en français sur tous les écrans (aucun mot anglais non intentionnel).
- **SC-006**: La conversion kg ↔ lbs est appliquée de façon cohérente : un poids saisi en lbs est stocké en kg et réaffiché en lbs dans tous les écrans, sans perte de précision.
- **SC-007**: Lors d'un Record Personnel battu pendant une séance, une notification visuelle apparaît dans les 2 secondes suivant le cochage du set.
- **SC-008**: Si l'app est fermée ou crashe pendant une séance active, 100% des données de sets déjà saisies sont retrouvées au redémarrage et l'utilisateur peut reprendre la séance sans perte.

---

## Clarifications

### Session 2026-05-10

- Q: Lors d'un crash ou fermeture de l'app en pleine séance, que doit-il se passer au prochain lancement ? → A: La séance est auto-sauvée en continu ; à la réouverture, l'app propose de reprendre la séance active (comportement Strong).
- Q: Quelle est la définition d'un Record Personnel (PR) pour déclencher la notification pendant une séance ? → A: Poids absolu maximum pour cet exercice, quel que soit le nombre de reps — si le poids dépasse le meilleur historique, c'est un PR.

---

## Assumptions

- L'application fonctionne hors ligne à 100% — aucune fonctionnalité ne requiert une connexion réseau.
- Les données sont stockées localement dans une base SQLite, sans synchronisation cloud (hors scope).
- La plateforme cible principale est mobile (iOS/Android via Expo), la version web est un "bonus" mais doit fonctionner.
- Les exercices de la bibliothèque par défaut sont déjà présents dans la base (générés via `generatedExercises`).
- La réorganisation des exercices (drag & drop) n'inclut pas la réorganisation des sets au sein d'un exercice — uniquement l'ordre des exercices.
- L'export des données (CSV, partage) est hors scope pour cette itération.
- Les supersets (exercices liés) sont hors scope pour cette itération.
- Le calcul du volume ne tient compte que des sets complétés (cochés), pas des sets cibles non effectués.
- La conversion lbs ↔ kg utilise le facteur standard : 1 lbs = 0,453592 kg, stockage interne toujours en kg.
