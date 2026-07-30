# Attributions — données et médias d'exercices

Ce document trace la provenance des données d'exercices utilisées par
l'application (catalogue `assets/data/generatedExercises.ts` et images dans
`assets/exercise_images/`), dans le cadre de la migration vers une seconde
source de données.

## Source historique (actuelle)

Le catalogue actuel (936 exercices) provient d'un import fusionnant :
- l'API [wger](https://wger.de/) (`scripts/import-wger-exercises.js`) —
  contenu sous licence libre, voir la documentation wger ;
- un jeu de données d'exercices avec images (communément appelé
  "yuhonas/free-exercise-db" dans l'écosystème) utilisé comme source
  d'images pour `assets/exercise_images/`.

⚠️ La licence précise des images actuellement embarquées n'a pas été
revérifiée dans le cadre de cette migration (elle préexistait au dépôt).
À faire avant toute publication commerciale si ce n'est pas déjà fait :
confirmer les termes de réutilisation de ces images.

## Nouvelle source évaluée : hasaneyldrm/exercises-dataset

Repo : https://github.com/hasaneyldrm/exercises-dataset

| Élément                        | Licence / condition                                   |
|--------------------------------|--------------------------------------------------------|
| Données JSON (`data/exercises.json`) | MIT                                              |
| Images (`images/`) et vidéos/gifs (`videos/`) | © Gym visual — https://gymvisual.com/ — réutilisation autorisée sous réserve de conserver l'attribution et de respecter leurs CGU |

### Décision (Phase 3 de la migration)

**Les médias (images/gifs) de ce nouveau dataset ne sont PAS importés dans
l'application** tant qu'une revue explicite des CGU de Gym visual (usage
commercial, format d'attribution requis dans l'app) n'a pas été faite et
validée.

En conséquence, `scripts/import-exercises-dataset.js` :
- conserve l'image existante pour tout exercice déjà présent dans le
  catalogue (matché par nom) — aucune régression, aucun changement de
  média ;
- laisse `image: null` pour tout exercice nouvellement ajouté depuis ce
  dataset (ids `hgd_*`) ;
- ne copie jamais un champ `image`/`gif_url` du nouveau dataset dans le
  catalogue de l'app ;
- échoue (`leakedMediaPaths` dans le rapport JSON) si un chemin
  `images/…` ou `videos/…` propre à ce dataset apparaissait malgré tout en
  sortie — garde-fou mécanique en cas de modification future du script.

Seuls les champs texte (nom, muscle, équipement, instructions) de ce
dataset sont exploités (voir aussi la Phase 4 : instructions en français
natif).

### Si l'équipe décide plus tard d'importer les médias

1. Valider les CGU de gymvisual.com pour l'usage prévu (app payante/gratuite,
   store, etc.).
2. Ajouter une mention d'attribution visible dans l'app (ex: écran
   "À propos" / Paramètres) : `Images d'exercices © Gym visual — gymvisual.com`.
3. Étendre `scripts/import-exercises-dataset.js` pour télécharger
   `images/`/`videos/` vers `assets/exercise_images/` et mettre à jour
   `assets/data/exerciseImageMap.ts` en conséquence.
4. Retirer/adapter le garde-fou `findLeakedMediaPaths` en accord avec la
   nouvelle politique.
