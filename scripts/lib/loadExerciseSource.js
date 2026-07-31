/**
 * Petits helpers partagés pour charger les fichiers de données d'exercices
 * (générés en syntaxe TS mais structurellement des littéraux JS valides).
 *
 * Utilisé par les scripts d'audit / d'import (Phase 0-4 de la migration
 * de source de données d'exercices).
 */

const fs = require('fs');

/**
 * Charge un fichier `assets/data/generatedExercises.ts` en évaluant le
 * fichier ENTIER comme du JS (après avoir retiré la syntaxe TS-only), plutôt
 * que d'extraire uniquement l'expression finale au regex. Nécessaire car
 * les très gros catalogues (2000+ objets) sont générés en plusieurs
 * `const partN: ExerciseSeed[] = [...]` concaténés (voir
 * import-exercises-dataset.js — TypeScript échoue à typer un seul littéral
 * de +2000 objets : "union type too complex"), donc `initialExercises` peut
 * référencer des bindings intermédiaires qu'un simple regex ne verrait pas.
 */
function loadInitialExercises(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const stripped = raw
    .replace(/export type ExerciseSeed = \{[\s\S]*?\};\n/g, '')
    .replace(/:\s*ExerciseSeed\[\]/g, '')
    .replace(/\s+as ExerciseSeed\[\]/g, '')
    .replace(/^export const /gm, 'const ');

  if (!/\binitialExercises\b/.test(stripped)) {
    throw new Error(`Impossible de trouver "initialExercises" dans ${filePath}`);
  }
  const arr = new Function(`${stripped}\nreturn initialExercises;`)();
  if (!Array.isArray(arr)) throw new Error(`Le contenu extrait de ${filePath} n'est pas un tableau`);
  return arr;
}

/** Normalise un nom pour le matching flou (même logique que import-wger-exercises.js) */
function normName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similarité de Jaccard sur les ensembles de mots de deux noms normalisés
 * (taille de l'intersection / taille de l'union). Ne comprend PAS la
 * sémantique des mots — "seated"/"decline"/"standing" comptent comme des
 * mots normaux, pas des variantes à ignorer. À combiner avec un seuil élevé
 * et des critères additionnels (muscle, équipement) pour limiter les faux
 * positifs (voir scripts/consolidate-duplicate-exercises.js).
 */
function jaccardWordSimilarity(nameA, nameB) {
  const wordsA = new Set(normName(nameA).split(' ').filter(Boolean));
  const wordsB = new Set(normName(nameB).split(' ').filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;
  const intersectionSize = [...wordsA].filter(w => wordsB.has(w)).length;
  const unionSize = new Set([...wordsA, ...wordsB]).size;
  return intersectionSize / unionSize;
}

module.exports = { loadInitialExercises, normName, jaccardWordSimilarity };
