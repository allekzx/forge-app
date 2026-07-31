/**
 * Tests de services/exerciseMigration.ts avec node:sqlite — reproduit le
 * schéma réel de services/DatabaseService.ts pour valider, en Phase 2,
 * que la migration additive/versionnée ne casse jamais le lien
 * exercice <-> séances/templates, contrairement à l'ancienne logique
 * "DELETE puis reinsert basé sur un comptage".
 *
 * Run: node --experimental-strip-types --test scripts/test/exercise-migration.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  runExerciseCatalogMigration,
  ensureExerciseProvenanceColumns,
  type CatalogDb,
  type CatalogExercise,
} from '../../services/exerciseMigration.ts';
import { checkExerciseIntegrity } from '../../services/exerciseIntegrity.ts';

function makeDb(): { db: DatabaseSync; adapter: CatalogDb } {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE exercises (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      muscle TEXT NOT NULL,
      equipment TEXT NOT NULL,
      image TEXT,
      description TEXT,
      instructions TEXT,
      is_custom INTEGER DEFAULT 0
    );
    CREATE TABLE workouts (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE workout_exercises (id TEXT PRIMARY KEY NOT NULL, workout_id TEXT NOT NULL, exercise_id TEXT NOT NULL);
    CREATE TABLE workout_templates (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE workout_template_exercises (
      id TEXT PRIMARY KEY NOT NULL, template_id TEXT NOT NULL, exercise_id TEXT NOT NULL,
      sets INTEGER NOT NULL, reps INTEGER NOT NULL, rest_seconds INTEGER NOT NULL, order_index INTEGER NOT NULL
    );
    CREATE TABLE workout_sets (
      id TEXT PRIMARY KEY NOT NULL, workout_id TEXT NOT NULL, exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL, target_reps INTEGER NOT NULL, target_weight REAL NOT NULL,
      rest_seconds INTEGER NOT NULL, actual_reps INTEGER, actual_weight REAL, completed_at TEXT
    );
    CREATE TABLE user_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `);
  const adapter: CatalogDb = {
    execAsync: async sql => db.exec(sql),
    runAsync: async (sql, ...params) => db.prepare(sql).run(...(params as never[])),
    getAllAsync: async (sql, ...params) => db.prepare(sql).all(...(params as never[])) as never[],
    getFirstAsync: async (sql, ...params) => (db.prepare(sql).get(...(params as never[])) ?? null) as never,
  };
  return { db, adapter };
}

const SAMPLE_CATALOG: CatalogExercise[] = [
  { id: 'Barbell_Squat', name: 'Squat barre', muscle: 'Quadriceps', equipment: 'Barbell', source: 'hasaneyldrm/exercises-dataset', sourceId: '0100' },
  { id: 'Barbell_Bench_Press', name: 'Développé couché', muscle: 'Chest', equipment: 'Barbell', source: 'legacy', sourceId: null },
  { id: 'hgd_9999', name: 'New Exercise', muscle: 'Abdominals', equipment: 'Body only', source: 'hasaneyldrm/exercises-dataset', sourceId: '9999' },
];

test('runExerciseCatalogMigration: seed initial sur base vide', async () => {
  const { adapter } = makeDb();
  const result = await runExerciseCatalogMigration(adapter, { newExercises: SAMPLE_CATALOG, targetVersion: 1 });

  assert.equal(result.skipped, false);
  assert.equal(result.upserted, 3);
  assert.equal(result.deletedOrphanFree, 0);

  const rows = await adapter.getAllAsync<{ id: string; source: string | null }>('SELECT id, source FROM exercises ORDER BY id');
  assert.deepEqual(rows.map(r => r.id), ['Barbell_Bench_Press', 'Barbell_Squat', 'hgd_9999']);
  assert.equal(rows.find(r => r.id === 'Barbell_Squat')?.source, 'hasaneyldrm/exercises-dataset');
});

test('runExerciseCatalogMigration: idempotent — ne rejoue pas une version déjà appliquée', async () => {
  const { adapter } = makeDb();
  await runExerciseCatalogMigration(adapter, { newExercises: SAMPLE_CATALOG, targetVersion: 1 });
  const second = await runExerciseCatalogMigration(adapter, {
    newExercises: [{ id: 'Should_Not_Appear', name: 'x', muscle: 'Chest', equipment: 'Barbell' }],
    targetVersion: 1,
  });
  assert.equal(second.skipped, true);
  const row = await adapter.getFirstAsync('SELECT id FROM exercises WHERE id = ?', 'Should_Not_Appear');
  assert.equal(row, null);
});

test('runExerciseCatalogMigration: préserve un id retiré du catalogue mais référencé par une séance', async () => {
  const { adapter } = makeDb();
  // Simule l'ancien catalogue avant migration : contient un exercice qui va
  // disparaître du nouveau dataset mais qu'un utilisateur a déjà utilisé.
  await adapter.runAsync(
    'INSERT INTO exercises (id, name, muscle, equipment, is_custom) VALUES (?, ?, ?, ?, 0)',
    'Retired_Exercise', 'Old Name', 'Chest', 'Barbell'
  );
  await adapter.runAsync('INSERT INTO workouts (id, name, created_at) VALUES (?, ?, ?)', 'w1', 'Séance', '2026-01-01');
  await adapter.runAsync(
    'INSERT INTO workout_sets (id, workout_id, exercise_id, set_index, target_reps, target_weight, rest_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)',
    's1', 'w1', 'Retired_Exercise', 1, 10, 50, 90
  );

  const result = await runExerciseCatalogMigration(adapter, { newExercises: SAMPLE_CATALOG, targetVersion: 1 });

  assert.equal(result.keptLegacyInUse, 1);
  assert.equal(result.deletedOrphanFree, 0);
  const row = await adapter.getFirstAsync<{ id: string }>('SELECT id FROM exercises WHERE id = ?', 'Retired_Exercise');
  assert.ok(row, 'l\'exercice retiré mais en usage doit être conservé');

  const integrity = await checkExerciseIntegrity(adapter);
  assert.equal(integrity.ok, true, 'aucun orphelin ne doit apparaître après la migration');
});

test('runExerciseCatalogMigration: supprime un id retiré du catalogue et jamais utilisé', async () => {
  const { adapter } = makeDb();
  await adapter.runAsync(
    'INSERT INTO exercises (id, name, muscle, equipment, is_custom) VALUES (?, ?, ?, ?, 0)',
    'Truly_Unused_Exercise', 'Old Name', 'Chest', 'Barbell'
  );

  const result = await runExerciseCatalogMigration(adapter, { newExercises: SAMPLE_CATALOG, targetVersion: 1 });

  assert.equal(result.deletedOrphanFree, 1);
  assert.equal(result.keptLegacyInUse, 0);
  const row = await adapter.getFirstAsync('SELECT id FROM exercises WHERE id = ?', 'Truly_Unused_Exercise');
  assert.equal(row, null);
});

test('runExerciseCatalogMigration: ne touche jamais un exercice custom utilisateur', async () => {
  const { adapter } = makeDb();
  await adapter.runAsync(
    'INSERT INTO exercises (id, name, muscle, equipment, is_custom) VALUES (?, ?, ?, ?, 1)',
    '1234567890', 'Mon exercice maison', 'Chest', 'Bands'
  );

  await runExerciseCatalogMigration(adapter, { newExercises: SAMPLE_CATALOG, targetVersion: 1 });

  const row = await adapter.getFirstAsync<{ name: string; is_custom: number }>(
    'SELECT name, is_custom FROM exercises WHERE id = ?', '1234567890'
  );
  assert.equal(row?.name, 'Mon exercice maison');
  assert.equal(row?.is_custom, 1);
});

test('runExerciseCatalogMigration: met à jour le contenu enrichi d\'un id déjà existant sans changer l\'id', async () => {
  const { adapter } = makeDb();
  await adapter.runAsync(
    'INSERT INTO exercises (id, name, muscle, equipment, description, is_custom) VALUES (?, ?, ?, ?, ?, 0)',
    'Barbell_Squat', 'Ancien nom', 'Quadriceps', 'Barbell', ''
  );

  await runExerciseCatalogMigration(adapter, {
    newExercises: [{ id: 'Barbell_Squat', name: 'Squat barre', muscle: 'Quadriceps', equipment: 'Barbell', description: 'Instructions enrichies FR' }],
    targetVersion: 1,
  });

  const row = await adapter.getFirstAsync<{ id: string; name: string; description: string }>(
    'SELECT id, name, description FROM exercises WHERE id = ?', 'Barbell_Squat'
  );
  assert.equal(row?.id, 'Barbell_Squat');
  assert.equal(row?.name, 'Squat barre');
  assert.equal(row?.description, 'Instructions enrichies FR');
});

test('ensureExerciseProvenanceColumns: idempotent (peut être appelé plusieurs fois sans erreur)', async () => {
  const { adapter } = makeDb();
  await ensureExerciseProvenanceColumns(adapter);
  await ensureExerciseProvenanceColumns(adapter); // ne doit pas lever "duplicate column"
  const cols = await adapter.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('exercises')`);
  const names = cols.map(c => c.name);
  assert.ok(names.includes('source'));
  assert.ok(names.includes('source_id'));
});

test('scénario complet : migration + intégrité restent cohérentes avec templates ET historique', async () => {
  const { adapter } = makeDb();
  // Ancien catalogue avec un exercice qui va être remplacé par un nouvel id externe
  await adapter.runAsync(
    'INSERT INTO exercises (id, name, muscle, equipment, is_custom) VALUES (?, ?, ?, ?, 0)',
    'Barbell_Squat', 'Squat barre', 'Quadriceps', 'Barbell'
  );
  await adapter.runAsync('INSERT INTO workout_templates (id, name, created_at) VALUES (?, ?, ?)', 't1', 'Legs', '2026-01-01');
  await adapter.runAsync(
    'INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, rest_seconds, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'te1', 't1', 'Barbell_Squat', 3, 8, 120, 1
  );

  await runExerciseCatalogMigration(adapter, { newExercises: SAMPLE_CATALOG, targetVersion: 1 });

  const integrity = await checkExerciseIntegrity(adapter);
  assert.equal(integrity.ok, true);
  const templateEx = await adapter.getFirstAsync<{ exercise_id: string }>(
    'SELECT exercise_id FROM workout_template_exercises WHERE id = ?', 'te1'
  );
  assert.equal(templateEx?.exercise_id, 'Barbell_Squat');
});

test('runExerciseCatalogMigration: upsert par lots (execAsync) — correct sur des frontières de chunk non alignées', async () => {
  // CHUNK vaut 50 dans l'implémentation : 130 lignes couvre 2 lots pleins
  // + 1 lot partiel, pour vérifier qu'aucune ligne n'est perdue/dupliquée
  // au niveau des bornes.
  const { adapter } = makeDb();
  const many: CatalogExercise[] = Array.from({ length: 130 }, (_, i) => ({
    id: `ex_${i}`,
    name: `Exercise ${i}`,
    muscle: 'Chest',
    equipment: 'Barbell',
  }));

  const result = await runExerciseCatalogMigration(adapter, { newExercises: many, targetVersion: 1 });
  assert.equal(result.upserted, 130);

  const rows = await adapter.getAllAsync<{ id: string }>('SELECT id FROM exercises');
  assert.equal(rows.length, 130);
  const ids = new Set(rows.map(r => r.id));
  for (let i = 0; i < 130; i++) assert.ok(ids.has(`ex_${i}`), `ex_${i} manquant`);
});

test('runExerciseCatalogMigration: échappe correctement apostrophes, accents et retours à la ligne (SQL construit à la main)', async () => {
  const { adapter } = makeDb();
  const tricky: CatalogExercise = {
    id: 'Farmer_s_Walk',
    name: "Farmer's Walk",
    muscle: 'Forearms',
    equipment: 'Dumbbell',
    description: 'Étape 1 : saisis les haltères.\nÉtape 2 : marche droit.',
    instructions: "Garde le dos droit ; ne courbe pas l'épaule.",
  };

  await runExerciseCatalogMigration(adapter, { newExercises: [tricky], targetVersion: 1 });

  const row = await adapter.getFirstAsync<{ name: string; description: string; instructions: string }>(
    'SELECT name, description, instructions FROM exercises WHERE id = ?', 'Farmer_s_Walk'
  );
  assert.equal(row?.name, "Farmer's Walk");
  assert.equal(row?.description, 'Étape 1 : saisis les haltères.\nÉtape 2 : marche droit.');
  assert.equal(row?.instructions, "Garde le dos droit ; ne courbe pas l'épaule.");
});

test('runExerciseCatalogMigration: suppression d\'orphelins également par lots au-delà d\'un chunk', async () => {
  const { adapter } = makeDb();
  // 60 exercices "stale" (absents du nouveau catalogue, jamais utilisés) —
  // couvre un lot plein (50) + un lot partiel (10) côté suppression.
  for (let i = 0; i < 60; i++) {
    await adapter.runAsync(
      'INSERT INTO exercises (id, name, muscle, equipment, is_custom) VALUES (?, ?, ?, ?, 0)',
      `stale_${i}`, `Stale ${i}`, 'Chest', 'Barbell'
    );
  }

  const result = await runExerciseCatalogMigration(adapter, { newExercises: SAMPLE_CATALOG, targetVersion: 1 });
  assert.equal(result.deletedOrphanFree, 60);

  const remaining = await adapter.getAllAsync<{ id: string }>("SELECT id FROM exercises WHERE id LIKE 'stale_%'");
  assert.equal(remaining.length, 0);
});
