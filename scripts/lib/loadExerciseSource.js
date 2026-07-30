/**
 * Petits helpers partagés pour charger les fichiers de données d'exercices
 * (générés en syntaxe TS mais structurellement des littéraux JS valides).
 *
 * Utilisé par les scripts d'audit / d'import (Phase 0-4 de la migration
 * de source de données d'exercices).
 */

const fs = require('fs');

/**
 * Charge un fichier `export const initialExercises = [...]` en évaluant
 * le littéral tableau directement (plus robuste qu'un regex sur des
 * champs multi-lignes contenant guillemets échappés).
 */
function loadInitialExercises(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/export const initialExercises\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!match) {
    throw new Error(`Impossible de trouver "export const initialExercises = [...]" dans ${filePath}`);
  }
  const arr = new Function(`return (${match[1]});`)();
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

module.exports = { loadInitialExercises, normName };
