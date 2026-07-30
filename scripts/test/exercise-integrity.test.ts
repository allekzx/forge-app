/**
 * Test du module services/exerciseIntegrity.ts avec node:sqlite (aucune
 * dépendance RN/Expo nécessaire). Fait partie de la Phase 0 de la migration
 * de source de données d'exercices : prouve que le détecteur d'orphelins
 * fonctionne avant de l'utiliser comme garde-fou dans les phases suivantes.
 *
 * Run: node --experimental-strip-types --test scripts/test/exercise-integrity.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { checkExerciseIntegrity, type QueryableDb } from '../../services/exerciseIntegrity.ts';

function makeDb(): { db: DatabaseSync; adapter: QueryableDb } {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE exercises (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE workout_exercises (id TEXT PRIMARY KEY, workout_id TEXT NOT NULL, exercise_id TEXT NOT NULL);
    CREATE TABLE workout_sets (id TEXT PRIMARY KEY, workout_id TEXT NOT NULL, exercise_id TEXT NOT NULL);
    CREATE TABLE workout_template_exercises (id TEXT PRIMARY KEY, template_id TEXT NOT NULL, exercise_id TEXT NOT NULL);
  `);
  const adapter: QueryableDb = {
    getAllAsync: async (sql, ...params) => db.prepare(sql).all(...(params as never[])) as never[],
  };
  return { db, adapter };
}

test('checkExerciseIntegrity: aucun orphelin sur une base saine', async () => {
  const { db, adapter } = makeDb();
  db.exec(`INSERT INTO exercises (id, name) VALUES ('Barbell_Squat', 'Squat')`);
  db.exec(`INSERT INTO workout_sets (id, workout_id, exercise_id) VALUES ('s1', 'w1', 'Barbell_Squat')`);
  db.exec(`INSERT INTO workout_exercises (id, workout_id, exercise_id) VALUES ('we1', 'w1', 'Barbell_Squat')`);

  const report = await checkExerciseIntegrity(adapter);
  assert.equal(report.ok, true);
  assert.deepEqual(report.orphanGroups, []);
  assert.equal(report.totalOrphanRows, 0);
});

test('checkExerciseIntegrity: détecte un exercice supprimé référencé par des sets', async () => {
  const { db, adapter } = makeDb();
  db.exec(`INSERT INTO exercises (id, name) VALUES ('Barbell_Squat', 'Squat')`);
  db.exec(`INSERT INTO workout_sets (id, workout_id, exercise_id) VALUES ('s1', 'w1', 'Barbell_Squat')`);
  db.exec(`INSERT INTO workout_sets (id, workout_id, exercise_id) VALUES ('s2', 'w1', 'Barbell_Squat')`);
  // Simule exactement le bug du reseed naïf : l'exercice référencé disparaît du catalogue.
  db.exec(`DELETE FROM exercises WHERE id = 'Barbell_Squat'`);

  const report = await checkExerciseIntegrity(adapter);
  assert.equal(report.ok, false);
  assert.equal(report.totalOrphanRows, 2);
  assert.equal(report.orphanGroups.length, 1);
  assert.equal(report.orphanGroups[0].table, 'workout_sets');
  assert.equal(report.orphanGroups[0].exerciseId, 'Barbell_Squat');
  assert.equal(report.orphanGroups[0].rowCount, 2);
});

test('checkExerciseIntegrity: détecte des orphelins répartis sur plusieurs tables', async () => {
  const { db, adapter } = makeDb();
  db.exec(`INSERT INTO exercises (id, name) VALUES ('Ok_Exercise', 'Ok')`);
  db.exec(`INSERT INTO workout_exercises (id, workout_id, exercise_id) VALUES ('we1', 'w1', 'Ghost_Exercise')`);
  db.exec(`INSERT INTO workout_template_exercises (id, template_id, exercise_id) VALUES ('te1', 't1', 'Ghost_Exercise_2')`);
  db.exec(`INSERT INTO workout_sets (id, workout_id, exercise_id) VALUES ('s1', 'w1', 'Ok_Exercise')`);

  const report = await checkExerciseIntegrity(adapter);
  assert.equal(report.ok, false);
  assert.equal(report.orphanGroups.length, 2);
  const tables = report.orphanGroups.map(g => g.table).sort();
  assert.deepEqual(tables, ['workout_exercises', 'workout_template_exercises']);
});
