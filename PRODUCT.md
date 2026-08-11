# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Le développeur et un petit groupe de proches (partenaires d'entraînement), chacun avec sa propre séance et son propre historique stocké localement sur son téléphone — pas de compte partagé, pas de synchronisation entre utilisateurs. Francophones, ils s'entraînent en salle de sport où le réseau est absent ou peu fiable.

## Product Purpose

Suivre des séances de musculation entièrement hors ligne : enregistrer séries/répétitions/poids par exercice pendant l'entraînement, piocher dans une bibliothèque de ~1592 exercices illustrés, créer et suivre des templates/programmes, consulter l'historique et la progression (volume, records personnels). Succès = pouvoir ouvrir l'app en salle sans réseau et logger une séance plus vite qu'en tapant sur papier.

## Positioning

Contrairement à Strong et aux trackers équivalents, Forge fonctionne 100% hors ligne via SQLite local, sans compte, sans abonnement ni palier payant, et entièrement en français — conçu pour des salles où la connexion est absente, pas comme feature secondaire d'une app en ligne.

## Operating Context

Usage principal : pendant la séance, en salle, souvent d'une main entre deux séries, sans réseau, parfois les mains moites. Usage secondaire : à la maison pour planifier la prochaine séance/le programme actif et consulter la progression. Les proches utilisent la même app installée sur leur propre téléphone, données strictement locales à chacun.

## Capabilities and Constraints

- Hors ligne uniquement, aucune dépendance réseau en prod (pas de cible web en production)
- Stockage SQLite local (`services/DatabaseService.ts`), aucune synchronisation ni compte entre les proches qui partagent l'app
- React Native / Expo Router, cibles iOS + Android
- ~1592 exercices bundlés avec images (`assets/data/`)
- Thème clair/sombre + 4 accents sélectionnables (orange, vert, bleu, violet) — à préserver comme préférence utilisateur, pas à coder en dur
- Cible tactile minimum 48px déjà définie (`TouchTarget`) — contrainte à conserver

## Brand Commitments

Nom : **Forge** (`com.forge.app`). Interface et copy entièrement en français (chantier en cours pour harmoniser la langue). Pas d'identité de marque figée au-delà de l'icône actuelle — ouvert à la refonte visuelle.

## Evidence on Hand

Écrans et composants réels dans `app/` et `components/`. Tokens actuels dans `constants/theme.ts`. Composants partagés existants : `Card`, `Button`, `SetRow`, `ErrorView`. Historique de corrections UX déjà livrées dans `specs/002-fix-prod-blockers/`. Pas de retours utilisateurs formels au-delà du développeur et de ses proches — projet solo validé par l'usage réel en salle.

## Product Principles

1. Zéro réseau requis, toujours — aucune décision de design ne doit supposer une connexion.
2. Rapide à logger en pleine série — l'écran de séance s'utilise d'une main, entre deux efforts ; minimiser taps et lecture.
3. Les données restent locales et privées — l'historique de chacun reste sur son propre téléphone.
4. Français natif, pas traduit — la copy s'écrit directement en français.
5. Gratuit, sans palier — aucune fonctionnalité utile aux proches n'est verrouillée derrière un paiement.

## Accessibility & Inclusion

Cible tactile minimum 48px (norme WCAG/Android) déjà en place — à préserver dans toute refonte.
