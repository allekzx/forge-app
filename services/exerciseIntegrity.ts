/**
 * Vérification d'intégrité du lien exercice <-> séances/templates.
 *
 * Module volontairement indépendant de `expo-sqlite` / React Native (aucune
 * dépendance native) : il ne dépend que d'une interface minimale compatible
 * avec `SQLite.SQLiteDatabase.getAllAsync`, ce qui permet de le tester avec
 * n'importe quel moteur SQLite (y compris `node:sqlite` en environnement de
 * test Node pur, hors Expo/React Native).
 *
 * Contexte : `exercises.id` est la seule clé de liaison utilisée par
 * `workout_exercises`, `workout_sets` et `workout_template_exercises` — il
 * n'y a pas de contrainte FK enforced par SQLite ici. Un exercice supprimé
 * (ou dont l'id change) sans mise à jour de ces tables laisse des lignes
 * "orphelines" : l'historique/les stats/les templates de l'utilisateur
 * continuent d'exister mais ne peuvent plus résoudre le nom/l'image de
 * l'exercice. Cette fonction sert de garde-fou avant/après toute migration
 * du catalogue d'exercices.
 */

export type QueryableDb = {
  // Syntaxe "méthode" (et non propriété-flèche) : TypeScript vérifie alors
  // la compatibilité des paramètres en mode bivariant, ce qui permet à ce
  // type de rester compatible avec `SQLite.SQLiteDatabase.getAllAsync`
  // (dont les surcharges typent les params en `SQLiteBindParams`, pas
  // `unknown[]`) sans avoir à importer expo-sqlite ici.
  getAllAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
};

export type OrphanGroup = {
  table: string;
  exerciseId: string;
  rowCount: number;
};

export type ExerciseIntegrityReport = {
  ok: boolean;
  orphanGroups: OrphanGroup[];
  totalOrphanRows: number;
};

// Tables qui portent directement une colonne `exercise_id` référençant `exercises.id`.
// `template_exercise_sets` est couvert indirectement via `workout_template_exercises`
// (elle référence `template_exercise_id`, pas `exercise_id`).
const TABLES_WITH_EXERCISE_ID = [
  'workout_exercises',
  'workout_sets',
  'workout_template_exercises',
] as const;

export async function checkExerciseIntegrity(db: QueryableDb): Promise<ExerciseIntegrityReport> {
  const orphanGroups: OrphanGroup[] = [];

  for (const table of TABLES_WITH_EXERCISE_ID) {
    const rows = await db.getAllAsync<{ exercise_id: string; rowCount: number }>(
      `SELECT exercise_id, COUNT(*) as rowCount
       FROM ${table}
       WHERE exercise_id NOT IN (SELECT id FROM exercises)
       GROUP BY exercise_id`
    );
    for (const row of rows) {
      orphanGroups.push({ table, exerciseId: row.exercise_id, rowCount: row.rowCount });
    }
  }

  const totalOrphanRows = orphanGroups.reduce((sum, g) => sum + g.rowCount, 0);

  return {
    ok: orphanGroups.length === 0,
    orphanGroups,
    totalOrphanRows,
  };
}
