Liste de tâches pour l'agent orchestrateur 📋
Priorité 1 — Critique (bloque l'utilisation)

Optimiser les performances : virtualiser la liste des exercices (FlatList / VirtualizedList), mémoïser les composants avec React.memo et useMemo, stabiliser les callbacks avec useCallback, et éviter les re-renders du timer sur tout l'arbre de composants (isoler le composant timer).
Corriger le thème : persister le thème dark dans AsyncStorage/localStorage et l'appliquer dès le premier rendu pour éviter le flash de thème clair.
Rendre les cartes de l'historique cliquables : ajouter role="button", cursor: pointer et un gestionnaire onPress sur les items de la liste History.

Priorité 2 — Fonctionnel manquant (impact fort)

Implémenter le menu contextuel "..." des routines : afficher un bottom sheet ou popover avec les actions Start, Edit, Delete.
Page paramètres : relier le bouton settings/avatar à une page de configuration (unité kg/lbs, thème dark/light, nom d'utilisateur, reset données).
Graphique évolution du poids corporel : afficher un graphique linéaire de l'historique du Body Weight après ajout d'une mesure.
Corriger le total "kg soulevés" dans Stats : vérifier le calcul de l'agrégat volume (weight × reps par set).
Bouton Save/Delete explicite sur la page template : ajouter un bouton "Enregistrer" et un bouton "Supprimer la routine" (avec confirmation).
Bouton "Ajouter à la séance" depuis la fiche exercice : si une séance est en cours, afficher un bouton d'ajout direct.

Priorité 3 — Améliorations UX

Harmoniser la langue : choisir FR ou EN et uniformiser toutes les chaînes de l'interface.
Réparer la navigation tab bar : s'assurer que la bottom nav fonctionne depuis toutes les pages (notamment template et workout en cours), probablement en gérant correctement le stack de navigation.
Graphique de progression par exercice : ajouter un onglet ou une section "Progress" sur la fiche exercice avec l'historique des records (courbe max weight over time).
Types de sets : ajouter la possibilité de marquer un set comme Warmup (W), Drop Set (D), Failure (F).
Note textuelle sur la séance : ajouter un champ notes optionnel sur l'écran de workout actif.
Corriger l'affichage initial de la liste d'exercices : s'assurer que le premier rendu de la page Exercises affiche bien la liste sans nécessiter un re-render.
Icône dossier : implémenter la fonctionnalité de dossiers/groupes de routines, ou supprimer l'icône si non prévue.