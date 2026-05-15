# Feature Specification: Corrections Pré-Production

**Feature Branch**: `002-fix-prod-blockers`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "Résoud tous les problèmes que tu viens de me citer"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Navigation sans perte de contexte pendant une séance (Priority: P1)

Un utilisateur est en pleine séance de musculation. Il souhaite consulter son historique ou ses statistiques sans interrompre sa séance. Actuellement, l'écran de séance est en `fullScreenModal` ce qui masque la tab bar — l'utilisateur est bloqué et doit quitter l'écran pour naviguer.

**Why this priority**: Bloquer la navigation pendant la feature centrale de l'app (la séance) est une friction majeure qui nuit directement à l'expérience utilisateur. C'est la raison n°1 de frustration sur ce type d'app.

**Independent Test**: Ouvrir une séance active, puis vérifier que les 5 onglets (Accueil, Historique, Séance, Exercices, Mesures) restent accessibles et fonctionnels sans quitter l'écran de séance.

**Acceptance Scenarios**:

1. **Given** une séance active est ouverte, **When** l'utilisateur tape sur l'onglet "Historique", **Then** l'historique s'affiche sans fermer la séance et un banner "Reprendre" est visible
2. **Given** une séance active est ouverte, **When** l'utilisateur navigue vers Stats puis revient sur Séance, **Then** la séance reprend exactement dans l'état où elle avait été laissée (timer, sets, notes)
3. **Given** l'utilisateur est sur un autre onglet avec une séance en cours, **When** il tape "Reprendre" dans le banner, **Then** il est redirigé vers la séance active

---

### User Story 2 — Protection contre la fermeture accidentelle de séance (Priority: P1)

L'utilisateur appuie accidentellement sur le bouton retour pendant une séance non terminée. Sans confirmation, la séance reste "active" mais l'utilisateur ne sait pas où elle a disparu.

**Why this priority**: La perte de données d'entraînement est inacceptable pour un utilisateur régulier. Une séance perdue = confiance perdue dans l'app.

**Independent Test**: Depuis une séance en cours avec au moins un set complété, appuyer sur le bouton retour et vérifier qu'une boîte de dialogue de confirmation apparaît.

**Acceptance Scenarios**:

1. **Given** une séance avec des sets complétés, **When** l'utilisateur appuie sur le bouton retour, **Then** une boîte de dialogue demande "Mettre en pause ?" avec les options "Continuer la séance" et "Mettre en pause"
2. **Given** la boîte de dialogue est affichée, **When** l'utilisateur choisit "Continuer la séance", **Then** il reste sur l'écran de séance
3. **Given** la boîte de dialogue est affichée, **When** l'utilisateur choisit "Mettre en pause", **Then** la séance est sauvegardée et le banner "Reprendre" apparaît sur l'accueil
4. **Given** une séance sans aucun set complété, **When** l'utilisateur appuie sur le retour, **Then** une boîte de dialogue propose "Annuler la séance" avec confirmation

---

### User Story 3 — Historique ne montrant que les séances terminées (Priority: P1)

Un utilisateur consulte son historique et voit une séance "en cours" (non terminée) mélangée à ses séances passées. Cela crée de la confusion.

**Why this priority**: L'historique est par définition le passé. Afficher des séances actives dans l'historique est une incohérence fonctionnelle directe.

**Independent Test**: Démarrer une séance sans la terminer, aller dans l'onglet Historique, et vérifier que la séance active n'apparaît pas dans la liste.

**Acceptance Scenarios**:

1. **Given** une séance active non terminée, **When** l'utilisateur ouvre l'onglet Historique, **Then** la séance active n'apparaît pas dans la liste
2. **Given** une séance terminée (finished_at non null), **When** l'utilisateur ouvre l'Historique, **Then** la séance apparaît avec sa date et durée
3. **Given** aucune séance terminée, **When** l'utilisateur ouvre l'Historique, **Then** un message "Aucune séance terminée" s'affiche

---

### User Story 4 — Cohérence visuelle des couleurs avec le thème choisi (Priority: P2)

L'utilisateur a sélectionné l'accent "bleu" dans les paramètres. Pendant sa séance, la barre de progression du timer reste orange et certains éléments restent verts (#00F260) quelle que soit son sélection. L'app semble incohérente.

**Why this priority**: La cohérence visuelle est une promesse faite à l'utilisateur quand on lui propose de choisir sa couleur d'accent. La briser dégrade la qualité perçue.

**Independent Test**: Changer l'accent en "vert", puis ouvrir une séance, compléter un set et lancer le timer — vérifier que la barre du timer, les badges de set et les éléments d'état utilisent tous la couleur d'accent sélectionnée.

**Acceptance Scenarios**:

1. **Given** accent = "orange", **When** le timer de repos s'affiche, **Then** la barre de progression est orange
2. **Given** accent = "bleu", **When** le timer de repos s'affiche, **Then** la barre de progression est bleue
3. **Given** n'importe quel thème, **When** un set est marqué complété, **Then** le fond du set utilise une seule et unique couleur "succès" cohérente
4. **Given** un nouveau record personnel est détecté, **When** le badge PR s'affiche, **Then** il utilise la couleur dorée fixe (non liée à l'accent, car c'est une couleur sémantique)

---

### User Story 5 — Interface entièrement en français (Priority: P2)

L'utilisateur filtre les exercices par groupe musculaire et voit les boutons "Chest", "Back", "Legs" en anglais alors que le reste de l'app est en français.

**Why this priority**: L'incohérence linguistique dans l'interface nuit à la crédibilité et à la qualité perçue de l'app.

**Independent Test**: Aller dans l'onglet Exercices et vérifier que tous les filtres de catégorie sont en français.

**Acceptance Scenarios**:

1. **Given** l'onglet Exercices est ouvert, **When** l'utilisateur regarde les filtres, **Then** les libellés sont "Tout", "Pectoraux", "Dos", "Jambes", "Bras", "Épaules", "Abdos"
2. **Given** l'utilisateur appuie sur "Pectoraux", **When** la liste se filtre, **Then** seuls les exercices ciblant les pectoraux sont affichés

---

### User Story 6 — Sélecteur de type de set dans la séance live (Priority: P2)

Dans l'éditeur de template, l'utilisateur peut assigner un type à chaque set (Normal, Échauffement, Drop Set, Échec). Mais pendant la séance active, cette fonctionnalité n'est pas disponible — l'appui long sur l'index du set ne déclenche rien.

**Why this priority**: La cohérence entre la configuration du template et la séance live est attendue. C'est une fonctionnalité à moitié implémentée.

**Independent Test**: Pendant une séance active, faire un appui long sur l'index d'un set et vérifier qu'un sélecteur de type apparaît.

**Acceptance Scenarios**:

1. **Given** une séance active, **When** l'utilisateur fait un appui long sur l'index d'un set, **Then** un sélecteur de type de set s'affiche (Normal, Échauffement, Drop Set, Échec)
2. **Given** le sélecteur est ouvert, **When** l'utilisateur choisit "Échauffement", **Then** le set affiche le badge de type correspondant et la modification est sauvegardée
3. **Given** un set de type "Drop Set", **When** l'utilisateur regarde l'historique de cette séance, **Then** le type "Drop Set" est affiché dans le détail

---

### User Story 7 — Gestion des erreurs visibles (Priority: P2)

Si la base de données rencontre une erreur lors du chargement d'un écran, l'utilisateur voit un écran vide sans explication. Il ne sait pas si l'app a planté ou si ses données ont disparu.

**Why this priority**: Un écran vide silencieux est pire qu'un message d'erreur clair. C'est une régression de qualité perçue critique.

**Independent Test**: Simuler une erreur de chargement (base corrompue ou migration manquante) et vérifier qu'un message d'erreur clair s'affiche avec une option de récupération.

**Acceptance Scenarios**:

1. **Given** une erreur de chargement sur l'écran d'accueil, **When** le chargement échoue, **Then** un message "Impossible de charger les données. Réessayer." s'affiche à la place de l'écran vide
2. **Given** le message d'erreur est affiché, **When** l'utilisateur appuie sur "Réessayer", **Then** le chargement est relancé
3. **Given** une erreur pendant la sauvegarde d'un set, **When** l'écriture échoue, **Then** l'utilisateur reçoit un message d'alerte discret (toast) sans perdre sa saisie

---

### User Story 8 — Création d'exercice confirmée visuellement (Priority: P3)

L'utilisateur crée un exercice personnalisé et appuie sur "Enregistrer". L'app redirige sans aucun feedback. Il ne sait pas si l'exercice a bien été créé.

**Why this priority**: Feedback utilisateur basique attendu dans toute app mobile moderne.

**Independent Test**: Créer un exercice personnalisé et vérifier qu'un message de confirmation apparaît brièvement.

**Acceptance Scenarios**:

1. **Given** le formulaire de création d'exercice est valide, **When** l'utilisateur appuie sur "Enregistrer", **Then** un toast "Exercice créé avec succès" s'affiche pendant 2 secondes avant la redirection
2. **Given** le formulaire est invalide (nom vide), **When** l'utilisateur appuie sur "Enregistrer", **Then** un message d'erreur inline indique le champ manquant

---

### Edge Cases

- Que se passe-t-il si l'utilisateur tente de quitter une séance pendant que le timer de repos tourne ?
- Que se passe-t-il si la même séance est ouverte depuis le banner "Reprendre" alors qu'elle est déjà affichée ?
- Que se passe-t-il si l'utilisateur change d'accent en cours de séance — les couleurs se mettent-elles à jour immédiatement ?
- Que se passe-t-il si l'historique est consulté sans aucune séance terminée ?
- Que se passe-t-il si l'erreur de DB est persistante (pas seulement transitoire) — faut-il proposer un reset ?

## Requirements *(mandatory)*

### Functional Requirements

**Navigation**
- **FR-001**: L'écran de séance active DOIT être accessible depuis la tab bar sans la masquer, permettant à l'utilisateur de naviguer vers les autres onglets
- **FR-002**: Le banner "Séance en cours — Reprendre" DOIT être visible sur tous les onglets tant qu'une séance est active
- **FR-003**: Naviguer vers un autre onglet pendant une séance NE DOIT PAS interrompre ni terminer la séance

**Protection des données**
- **FR-004**: Appuyer sur le bouton retour depuis une séance avec des sets complétés DOIT déclencher une boîte de dialogue de confirmation
- **FR-005**: La boîte de dialogue DOIT proposer "Continuer la séance" (annuler l'action) et "Mettre en pause" (retourner à l'accueil avec banner)
- **FR-006**: Une séance sans aucun set complété DOIT proposer "Annuler la séance" avec une confirmation distincte

**Historique**
- **FR-007**: L'onglet Historique DOIT afficher uniquement les séances ayant un `finished_at` non null
- **FR-008**: L'onglet Historique DOIT afficher un état vide explicite si aucune séance n'est terminée

**Cohérence visuelle**
- **FR-009**: La barre de progression du timer de repos DOIT utiliser la couleur d'accent sélectionnée par l'utilisateur
- **FR-010**: La couleur de fond des sets complétés DOIT utiliser un unique token de couleur "succès" (une seule valeur dans tout le code)
- **FR-011**: Le badge PR (record personnel) PEUT conserver une couleur dorée fixe, car elle est sémantique et non liée à l'accent

**Localisation**
- **FR-012**: Les libellés des filtres de catégorie dans l'écran Exercices DOIVENT être en français : "Tout", "Pectoraux", "Dos", "Jambes", "Bras", "Épaules", "Abdos"

**Types de sets**
- **FR-013**: Dans une séance active, un appui long sur l'index d'un set DOIT ouvrir le sélecteur de type de set
- **FR-014**: Le type de set sélectionné pendant une séance DOIT être sauvegardé immédiatement dans la base de données
- **FR-015**: Le type de set DOIT être visible dans le détail de l'historique de la séance

**Gestion des erreurs**
- **FR-016**: Chaque écran principal DOIT afficher un message d'erreur actionnable si le chargement des données échoue
- **FR-017**: Les erreurs de chargement DOIVENT proposer une action "Réessayer"
- **FR-018**: Les erreurs de sauvegarde silencieuse (set non écrit) DOIVENT notifier l'utilisateur sans bloquer l'interface

**Feedback création d'exercice**
- **FR-019**: La création d'un exercice personnalisé réussie DOIT déclencher un toast de confirmation avant la redirection
- **FR-020**: La soumission d'un formulaire d'exercice invalide DOIT afficher une erreur inline sur le champ concerné

### Key Entities

- **Séance active (Workout)** : séance avec `finished_at = null` — ne doit jamais apparaître dans l'historique
- **Séance terminée (Workout)** : séance avec `finished_at` non null — seule catégorie affichée dans l'historique
- **Set** : unité de travail avec `set_type` (normal/warmup/dropset/failure), `actual_weight`, `actual_reps`, `completed_at`
- **Accent color** : préférence utilisateur (orange/vert/bleu/violet) — token de design appliqué aux éléments dynamiques de l'interface
- **Couleur succès** : couleur unique (#22C55E) pour tous les états "set complété" dans l'app

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: L'utilisateur peut naviguer vers n'importe quel onglet depuis l'écran de séance en moins de 1 seconde, sans perdre l'état de sa séance
- **SC-002**: 100% des séances actives sont absentes de l'onglet Historique
- **SC-003**: Appuyer sur le bouton retour depuis une séance avec sets complétés déclenche une confirmation dans 100% des cas
- **SC-004**: La couleur d'accent sélectionnée est visible dans la barre du timer de repos pour les 4 accents disponibles (orange, vert, bleu, violet)
- **SC-005**: Tous les libellés de l'interface sont en français, y compris les 7 filtres de catégorie d'exercices
- **SC-006**: L'appui long sur l'index d'un set dans une séance ouvre le sélecteur de type en moins de 300ms
- **SC-007**: Un écran d'erreur explicit (avec bouton "Réessayer") s'affiche dans 100% des cas de défaillance de chargement DB
- **SC-008**: Un toast de confirmation apparaît dans les 500ms suivant la création d'un exercice personnalisé réussi
- **SC-009**: Un seul et unique code hexadécimal de couleur "succès" existe dans la base de code (token centralisé)

## Assumptions

- L'app cible iOS et Android via Expo ; les corrections doivent fonctionner sur les deux plateformes
- La tab bar doit rester visible sur les deux plateformes pendant une séance (pas seulement iOS)
- Le banner "Séance en cours" sur l'accueil est déjà implémenté ; il s'agit de le rendre accessible depuis tous les onglets
- Le toast de confirmation sera un composant simple (Alert ou View animée) sans dépendance externe supplémentaire
- La couleur dorée du badge PR (#FFD700) est intentionnellement fixe (couleur universellement associée aux records/trophées)
- La gestion d'erreur ne doit pas proposer de "reset des données" automatique — uniquement "Réessayer" pour les erreurs transitoires
- Les erreurs de DB critiques (migration manquante) restent loguées en console mais n'exposent pas les détails techniques à l'utilisateur
