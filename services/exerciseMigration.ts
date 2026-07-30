/**
 * Migration additive et versionnée du catalogue d'exercices.
 *
 * Remplace l'ancienne logique de reseed de `services/DatabaseService.ts`
 * (comptage des lignes + `DELETE FROM exercises` en masse si le compte
 * sort d'une fourchette [900, 950]). Cette ancienne logique casse dès que
 * la source de données change de taille/format : elle supprimerait TOUS
 * les exercices non-custom puis les réinsérerait, ce qui romprait le lien
 * `exercise_id` utilisé par workout_exercises/workout_sets/
 * workout_template_exercises pour tout exercice dont l'id changerait.
 *
 * Principes :
 *  - Upsert (jamais de DELETE + reinsert en masse) : chaque exercice du
 *    catalogue cible est inséré s'il n'existe pas, mis à jour sinon —
 *    l'id ne bouge jamais.
 *  - Un id absent du nouveau catalogue n'est supprimé que s'il n'est
 *    référencé nulle part (anti-jointure sur les 3 tables de liaison).
 *    Sinon il est conservé tel quel (ligne "legacy", inoffensive).
 *  - Versionné comme les autres migrations de ce fichier
 *    (`seed_version`, `exercise_name_version`) : idempotent, ne rejoue
 *    pas une migration déjà appliquée.
 *
 * Module volontairement indépendant de `expo-sqlite`/React Native (voir
 * exerciseIntegrity.ts pour la même approche) afin d'être testable avec
 * `node:sqlite` en Node pur.
 */

export type CatalogDb = {
  // Syntaxe "méthode" (voir exerciseIntegrity.ts pour l'explication) afin de
  // rester structurellement compatible avec `SQLite.SQLiteDatabase` sans en
  // dépendre.
  execAsync(sql: string): Promise<unknown>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T | null>;
};

export type CatalogExercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  image?: string | null;
  description?: string | null;
  instructions?: string | null;
  source?: string | null;
  sourceId?: string | null;
};

export type ExerciseCatalogMigrationResult = {
  skipped: boolean;
  upserted: number;
  deletedOrphanFree: number;
  keptLegacyInUse: number;
};

const TABLES_WITH_EXERCISE_ID = [
  'workout_exercises',
  'workout_sets',
  'workout_template_exercises',
] as const;

/** Ajoute les colonnes `source`/`source_id` si elles n'existent pas encore (migration additive). */
export async function ensureExerciseProvenanceColumns(db: CatalogDb): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('exercises')`);
  const names = new Set(cols.map(c => c.name));
  if (!names.has('source')) await db.execAsync('ALTER TABLE exercises ADD COLUMN source TEXT');
  if (!names.has('source_id')) await db.execAsync('ALTER TABLE exercises ADD COLUMN source_id TEXT');
}

async function getMigrationVersion(db: CatalogDb): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = 'exercise_dataset_version'"
  );
  return row ? parseInt(row.value, 10) : 0;
}

async function setMigrationVersion(db: CatalogDb, version: number): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('exercise_dataset_version', ?)",
    String(version)
  );
}

/** Ids actuellement référencés par au moins une des tables de liaison. */
async function getIdsInUse(db: CatalogDb): Promise<Set<string>> {
  const inUse = new Set<string>();
  for (const table of TABLES_WITH_EXERCISE_ID) {
    const rows = await db.getAllAsync<{ exercise_id: string }>(
      `SELECT DISTINCT exercise_id FROM ${table}`
    );
    for (const r of rows) inUse.add(r.exercise_id);
  }
  return inUse;
}

export async function runExerciseCatalogMigration(
  db: CatalogDb,
  options: { newExercises: CatalogExercise[]; targetVersion: number }
): Promise<ExerciseCatalogMigrationResult> {
  const { newExercises, targetVersion } = options;

  const currentVersion = await getMigrationVersion(db);
  if (currentVersion >= targetVersion) {
    return { skipped: true, upserted: 0, deletedOrphanFree: 0, keptLegacyInUse: 0 };
  }

  await ensureExerciseProvenanceColumns(db);

  // Upsert : jamais de suppression en masse. L'id, s'il existe déjà, est
  // conservé — c'est la clé de liaison avec l'historique/les templates.
  let upserted = 0;
  for (const ex of newExercises) {
    await db.runAsync(
      `INSERT INTO exercises (id, name, muscle, equipment, image, description, instructions, is_custom, source, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         muscle = excluded.muscle,
         equipment = excluded.equipment,
         image = excluded.image,
         description = excluded.description,
         instructions = excluded.instructions,
         source = excluded.source,
         source_id = excluded.source_id
       WHERE exercises.is_custom = 0 OR exercises.is_custom IS NULL`,
      ex.id,
      ex.name,
      ex.muscle,
      ex.equipment,
      ex.image ?? null,
      ex.description ?? '',
      ex.instructions ?? '',
      ex.source ?? null,
      ex.sourceId ?? null
    );
    upserted++;
  }

  // Nettoyage des orphelins SÛRS uniquement : un id catalogue absent du
  // nouveau dataset n'est supprimé que s'il n'est référencé par aucune
  // séance/template existant. Sinon on le garde (ligne "legacy").
  const newIds = new Set(newExercises.map(e => e.id));
  const existingCatalogRows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM exercises WHERE is_custom = 0 OR is_custom IS NULL'
  );
  const staleIds = existingCatalogRows.map(r => r.id).filter(id => !newIds.has(id));

  let deletedOrphanFree = 0;
  let keptLegacyInUse = 0;
  if (staleIds.length) {
    const idsInUse = await getIdsInUse(db);
    for (const id of staleIds) {
      if (idsInUse.has(id)) {
        keptLegacyInUse++;
      } else {
        await db.runAsync('DELETE FROM exercises WHERE id = ? AND (is_custom = 0 OR is_custom IS NULL)', id);
        deletedOrphanFree++;
      }
    }
  }

  await setMigrationVersion(db, targetVersion);

  return { skipped: false, upserted, deletedOrphanFree, keptLegacyInUse };
}
