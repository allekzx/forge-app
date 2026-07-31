# Attributions — données et médias d'exercices

Ce document trace la provenance des données d'exercices utilisées par
l'application (catalogue `assets/data/generatedExercises.ts`, images dans
`assets/exercise_images/`, gifs dans `assets/exercise_gifs/`), après la
migration fusionnant une seconde source de données (catalogue final :
2129 exercices — 936 historiques + 1193 nouveaux).

## Source historique

Le catalogue historique (936 exercices, avant fusion) provenait d'un import
fusionnant :
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

### Décision (mise à jour — médias importés)

**Décision produit validée avec l'utilisateur** : les médias (images fixes +
gifs animés) du nouveau dataset sont téléchargés et embarqués localement
dans l'app, pour rester utilisables hors ligne (contrainte cœur du projet —
pas de réseau disponible en salle de sport). Impact bundle : ~60 Mo
d'images (`assets/exercise_images/`, 2067 fichiers) + ~126 Mo de gifs
(`assets/exercise_gifs/`, 1324 fichiers).

En contrepartie de la clause d'attribution de la licence Gym visual, une
mention est affichée dans l'app : Paramètres → À propos →
« Images et animations d'exercices © Gym visual — gymvisual.com ».

`scripts/import-exercises-dataset.js --download-media` :
- télécharge le jpg (si l'exercice n'en a pas déjà un hérité) et le gif de
  chaque exercice ayant une fiche source dans le nouveau dataset (matché ou
  nouveau), sous un nom de fichier local dérivé de l'id APP (jamais de
  l'id de la source) ;
- régénère `assets/data/exerciseImageMap.ts` et `assets/data/exerciseGifMap.ts`
  (maps `require()` scannées depuis le contenu réel des dossiers d'assets) ;
- ne laisse jamais passer une valeur `image`/`gif` qui ressemble encore à un
  chemin ou une URL distante (`findLeakedMediaPaths`) — signe d'un
  téléchargement manqué, plutôt qu'un choix éditorial de ne pas embarquer.

Rendu dans l'app :
- `app/exercises/[exerciseId].tsx` : le gif remplace l'icône placeholder
  dans le hero header de la fiche exercice quand disponible.
- `app/(tabs)/exercises.tsx` et `app/workouts/exercise-picker.tsx` : la
  vignette jpg (statique, pas le gif — évite d'animer des dizaines
  d'entrées simultanément dans une liste) remplace l'icône placeholder.

### Points de vigilance restants

- La licence précise des ~60 Mo d'images historiques (source "yuhonas",
  voir plus haut) n'a toujours pas été revérifiée formellement.
- Avant une publication sur les stores, revalider que la mention
  d'attribution dans Paramètres satisfait les CGU actuelles de
  gymvisual.com (elles peuvent évoluer).
