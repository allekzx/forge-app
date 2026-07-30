/**
 * Phase 0 — Audit des ids d'exercices "protégés".
 *
 * Contexte : `exercises.id` est utilisé tel quel comme clé étrangère dans
 * workout_exercises / workout_sets / workout_template_exercises /
 * template_exercise_sets (voir services/DatabaseService.ts). On ne peut
 * pas savoir, depuis ce dépôt, quels exercices un utilisateur donné a
 * réellement utilisés dans ses séances (base SQLite locale sur son
 * appareil). Le seul choix sûr est donc de considérer TOUT id présent
 * dans le catalogue actuel comme potentiellement référencé et de
 * l'inclure dans le set "protégé" : tout script de migration/import doit
 * garantir qu'aucun de ces ids ne disparaît (soit il survit tel quel,
 * soit il est explicitement mappé vers lui-même après enrichissement).
 *
 * Run: node scripts/audit-exercise-ids.js
 */

const fs = require('fs');
const path = require('path');
const { loadInitialExercises } = require('./lib/loadExerciseSource');

const GENERATED_PATH = path.join(__dirname, '../assets/data/generatedExercises.ts');
const DB_SERVICE_PATH = path.join(__dirname, '../services/DatabaseService.ts');
const OUT_PATH = path.join(__dirname, '../.data-migration/exercise-audit.json');

function extractCustomSeedIds(dbServiceSource) {
  // Trouve tous les appels `runAsync(\`INSERT OR IGNORE INTO exercises (...is_custom) VALUES (...)\`, 'id', ...)`
  // et récupère le premier argument littéral (l'id), pour compléter le set protégé avec
  // les exercices "custom" seedés en dur (jamais supprimés par le reseed, mais on veut
  // quand même les tracer explicitement ici).
  const ids = [];
  const blockRegex = /`INSERT OR IGNORE INTO exercises\s*\([^`]*is_custom\)[^`]*`,\s*\n\s*'([^']*)'/g;
  for (const m of dbServiceSource.matchAll(blockRegex)) {
    ids.push(m[1]);
  }
  return ids;
}

function extractDefaultTemplateExerciseIds(dbServiceSource) {
  const ids = new Set();
  for (const m of dbServiceSource.matchAll(/exId:\s*'([^']+)'/g)) {
    ids.add(m[1]);
  }
  return [...ids];
}

function main() {
  const catalog = loadInitialExercises(GENERATED_PATH);
  const dbServiceSource = fs.readFileSync(DB_SERVICE_PATH, 'utf-8');

  const catalogIds = catalog.map(e => e.id);
  const customSeedIds = extractCustomSeedIds(dbServiceSource);
  const templateExerciseIds = extractDefaultTemplateExerciseIds(dbServiceSource);

  const protectedIds = new Set([...catalogIds, ...customSeedIds, ...templateExerciseIds]);

  // Sanity check : tous les ids référencés par les templates par défaut doivent
  // exister quelque part (catalogue ou custom) — sinon le seed lui-même est déjà cassé.
  const knownIds = new Set([...catalogIds, ...customSeedIds]);
  const missingFromKnown = templateExerciseIds.filter(id => !knownIds.has(id));

  const report = {
    generatedAt: new Date().toISOString(),
    catalogCount: catalogIds.length,
    customSeedIds,
    templateExerciseIdsCount: templateExerciseIds.length,
    protectedIdsCount: protectedIds.size,
    missingFromKnown, // devrait être vide
    protectedIds: [...protectedIds].sort(),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  console.log('=== Audit des ids d\'exercices ===');
  console.log(`Catalogue (generatedExercises.ts) : ${catalogIds.length} exercices`);
  console.log(`Ids custom seedés en dur          : ${customSeedIds.join(', ') || '(aucun)'}`);
  console.log(`Ids référencés par DEFAULT_TEMPLATES : ${templateExerciseIds.length}`);
  console.log(`Total ids protégés (union)        : ${protectedIds.size}`);
  if (missingFromKnown.length) {
    console.error(`\n⚠️  ATTENTION: ${missingFromKnown.length} id(s) utilisés par des templates par défaut`);
    console.error(`   mais absents du catalogue ET des custom seeds : ${missingFromKnown.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\n✓ Tous les ids des templates par défaut sont couverts par le catalogue ou les seeds custom.');
  }
  console.log(`\nRapport écrit dans ${OUT_PATH}`);
}

main();
