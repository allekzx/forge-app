import { initialExercises } from '@/assets/data/generatedExercises';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

// ─── Verrou global pour SQLite WASM/OPFS ─────────────────────────────────────
// Le proxy OPFS de SQLite WASM gère les messages du worker de façon séquentielle
// via une machine d'état. Des opérations concurrentes depuis plusieurs composants
// entremêlent leurs messages → "Invalid VFS state" / "Error finalizing statement".
// Ce verrou sérialise toutes les opérations sur web, comme le ferait un mutex.
let _webLock: Promise<void> = Promise.resolve();

function withWebLock<T>(fn: () => Promise<T>): Promise<T> {
  if (Platform.OS !== 'web') return fn();
  let release!: () => void;
  const acquired = new Promise<void>(res => { release = res; });
  const prev = _webLock;
  _webLock = prev.then(() => acquired);
  return prev.then(fn).finally(release);
}

// Proxy de DB qui sérialise toutes les opérations via withWebLock sur web.
// Chaque méthode async passe par le mutex avant d'accéder au worker WASM.
//
// Gestion du deadlock dans withTransactionAsync :
// Le callback de la transaction appelle database.runAsync(...) qui repasserait
// par le mutex déjà acquis → deadlock. Pour l'éviter, on swape temporairement
// les méthodes du proxy vers raw pendant la durée de la transaction (le mutex
// externe garantit qu'aucune autre opération ne peut interférer pendant ce temps).
function makeLockedDb(raw: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  if (Platform.OS !== 'web') return raw;
  const L = <T>(fn: () => Promise<T>) => withWebLock(fn);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = Object.create(raw);
  p.getAllAsync     = (...a: any[]) => L(() => (raw.getAllAsync as any)(...a));
  p.getFirstAsync   = (...a: any[]) => L(() => (raw.getFirstAsync as any)(...a));
  p.runAsync        = (...a: any[]) => L(() => (raw.runAsync as any)(...a));
  p.execAsync       = (...a: any[]) => L(() => (raw.execAsync as any)(...a));
  p.withTransactionAsync = (fn: () => Promise<void>) => L(async () => {
    // Pendant la transaction, les méthodes du proxy pointent sur raw (sans verrou)
    // car le verrou externe est déjà acquis — les appels imbriqués passent en direct.
    const prev = { run: p.runAsync, getAll: p.getAllAsync, getFirst: p.getFirstAsync, exec: p.execAsync };
    p.runAsync      = (...a: any[]) => (raw.runAsync as any)(...a);
    p.getAllAsync    = (...a: any[]) => (raw.getAllAsync as any)(...a);
    p.getFirstAsync = (...a: any[]) => (raw.getFirstAsync as any)(...a);
    p.execAsync     = (...a: any[]) => (raw.execAsync as any)(...a);
    try {
      return await raw.withTransactionAsync(fn);
    } finally {
      p.runAsync = prev.run; p.getAllAsync = prev.getAll;
      p.getFirstAsync = prev.getFirst; p.execAsync = prev.exec;
    }
  });
  return p as SQLite.SQLiteDatabase;
}

const openDatabase = async () => {
  if (dbInstance) return dbInstance;

  if (!dbPromise) {
    dbPromise = (async () => {
      let lastError: unknown;
      let delay = 200;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const raw = await SQLite.openDatabaseAsync('strong_v3.db');
          dbInstance = makeLockedDb(raw);
          return dbInstance;
        } catch (e: unknown) {
          lastError = e;
          const msg = e instanceof Error ? e.message : '';
          const isRetriable =
            msg.includes('NoModificationAllowedError') ||
            msg.includes('Invalid VFS state') ||
            msg.includes('Database not found');
          if (!isRetriable || attempt === 5) {
            dbPromise = null; // Permet un retry ultérieur
            throw e;
          }
          await new Promise(res => setTimeout(res, delay));
          delay = Math.min(delay * 2, 2000);
        }
      }
      throw lastError;
    })();
  }

  return dbPromise;
};

export const initDatabase = async (): Promise<void> => {
  if (initPromise) return initPromise;
  initPromise = _doInit().catch((e) => {
    // Don't wedge every future caller behind one failed attempt (e.g. a transient
    // "Database not found" race on cold start) — let the next call retry from scratch.
    initPromise = null;
    throw e;
  });
  return initPromise;
};

// ─── Default template seed ───────────────────────────────────────────────────

type SeedSet = { type: 'normal' | 'warmup' | 'dropset' | 'failure'; reps: number; weight: number; rest: number };
type SeedEx  = { exId: string; sets: SeedSet[] };
type SeedTpl = { id: string; name: string; exercises: SeedEx[] };

const DEFAULT_TEMPLATES: SeedTpl[] = [
  {
    id: 'seed_push', name: 'Push',
    exercises: [
      { exId: 'Leverage_Chest_Press',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'wger_537',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Dumbbell_Flyes',
        sets: [
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
        ]},
      { exId: 'wger_543',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Side_Lateral_Raise',
        sets: [
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
        ]},
      { exId: 'Dips_-_Triceps_Version',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
    ],
  },
  {
    id: 'seed_pull', name: 'Pull',
    exercises: [
      { exId: 'Wide-Grip_Lat_Pulldown',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Leverage_Iso_Row',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Seated_Cable_Rows',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Reverse_Machine_Flyes',
        sets: [
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
        ]},
      { exId: 'Machine_Preacher_Curls',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Incline_Dumbbell_Curl',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'seed_kneeling_band_pulldown',
        sets: [
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
        ]},
    ],
  },
  {
    id: 'seed_legs', name: 'Legs',
    exercises: [
      { exId: 'Barbell_Squat',
        sets: [
          { type:'warmup', reps:10, weight:0,  rest:60  },
          { type:'normal', reps:8,  weight:0,  rest:120 },
          { type:'normal', reps:8,  weight:0,  rest:120 },
          { type:'normal', reps:8,  weight:0,  rest:120 },
        ]},
      { exId: 'Leg_Press',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'wger_1366',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Stiff-Legged_Dumbbell_Deadlift',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Hyperextensions_(Back_Extensions)',
        sets: [
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
        ]},
      { exId: 'Thigh_Abductor',
        sets: [
          { type:'normal', reps:15, weight:0, rest:60 },
          { type:'normal', reps:15, weight:0, rest:60 },
          { type:'normal', reps:15, weight:0, rest:60 },
        ]},
      { exId: 'Thigh_Adductor',
        sets: [
          { type:'normal', reps:15, weight:0, rest:60 },
          { type:'normal', reps:15, weight:0, rest:60 },
          { type:'normal', reps:15, weight:0, rest:60 },
        ]},
    ],
  },
  {
    id: 'seed_upper', name: 'Upper',
    exercises: [
      { exId: 'Smith_Machine_Incline_Bench_Press',
        sets: [
          { type:'warmup', reps:10, weight:0,  rest:60  },
          { type:'normal', reps:8,  weight:35, rest:120 },
          { type:'normal', reps:8,  weight:40, rest:120 },
          { type:'normal', reps:8,  weight:35, rest:120 },
        ]},
      { exId: 'Chin-Up',
        sets: [
          { type:'normal', reps:10, weight:0, rest:120 },
          { type:'normal', reps:8,  weight:0, rest:120 },
          { type:'normal', reps:7,  weight:0, rest:120 },
        ]},
      { exId: 'One-Arm_Dumbbell_Row',
        sets: [
          { type:'normal', reps:8, weight:20, rest:90 },
          { type:'normal', reps:8, weight:20, rest:90 },
          { type:'normal', reps:8, weight:18, rest:90 },
        ]},
      { exId: 'wger_1730',
        sets: [
          { type:'normal', reps:10, weight:9, rest:60 },
          { type:'normal', reps:10, weight:9, rest:60 },
          { type:'normal', reps:10, weight:9, rest:60 },
        ]},
      { exId: 'Hammer_Curls',
        sets: [
          { type:'normal', reps:10, weight:14, rest:90 },
          { type:'normal', reps:10, weight:14, rest:90 },
          { type:'normal', reps:8,  weight:14, rest:90 },
        ]},
      { exId: 'Machine_Triceps_Extension',
        sets: [
          { type:'normal',  reps:10, weight:35, rest:90 },
          { type:'dropset', reps:10, weight:25, rest:90 },
        ]},
    ],
  },
  {
    id: 'seed_upper_b', name: 'Upper B',
    exercises: [
      { exId: 'Leverage_Chest_Press',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Dumbbell_Flyes',
        sets: [
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
        ]},
      { exId: 'Wide-Grip_Lat_Pulldown',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'wger_543',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
      { exId: 'Machine_Preacher_Curls',
        sets: [
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
          { type:'normal', reps:12, weight:0, rest:60 },
        ]},
      { exId: 'Dips_-_Triceps_Version',
        sets: [
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
          { type:'normal', reps:10, weight:0, rest:90 },
        ]},
    ],
  },
  {
    id: 'seed_lower', name: 'Lower',
    exercises: [
      { exId: 'Barbell_Deadlift',
        sets: [
          { type:'warmup', reps:7,  weight:0,  rest:60  },
          { type:'normal', reps:8,  weight:40, rest:180 },
          { type:'normal', reps:8,  weight:40, rest:180 },
          { type:'normal', reps:7,  weight:40, rest:180 },
        ]},
      { exId: 'Leg_Press',
        sets: [
          { type:'normal', reps:8, weight:93, rest:120 },
          { type:'normal', reps:8, weight:93, rest:120 },
          { type:'normal', reps:8, weight:93, rest:120 },
        ]},
      { exId: 'Seated_Leg_Curl',
        sets: [
          { type:'normal', reps:8, weight:64, rest:90 },
          { type:'normal', reps:8, weight:64, rest:90 },
          { type:'normal', reps:8, weight:59, rest:90 },
        ]},
      { exId: 'Dumbbell_Lunges',
        sets: [
          { type:'normal', reps:8, weight:14, rest:90 },
          { type:'normal', reps:8, weight:14, rest:90 },
          { type:'normal', reps:8, weight:14, rest:90 },
        ]},
      { exId: 'Ab_Crunch_Machine',
        sets: [
          { type:'normal', reps:8, weight:55, rest:60 },
          { type:'normal', reps:8, weight:55, rest:60 },
          { type:'normal', reps:8, weight:55, rest:60 },
        ]},
      { exId: 'Thigh_Abductor',
        sets: [
          { type:'normal', reps:8, weight:36, rest:60 },
          { type:'normal', reps:8, weight:36, rest:60 },
          { type:'normal', reps:8, weight:36, rest:60 },
        ]},
      { exId: 'Thigh_Adductor',
        sets: [
          { type:'normal', reps:10, weight:36, rest:60 },
          { type:'normal', reps:10, weight:36, rest:60 },
          { type:'normal', reps:9,  weight:40, rest:60 },
        ]},
      { exId: 'Plank',
        sets: [
          { type:'normal', reps:60, weight:0, rest:60 },
        ]},
    ],
  },
];

async function seedDefaultTemplates(database: SQLite.SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();
  for (const tpl of DEFAULT_TEMPLATES) {
    // Supprimer les anciens templates avec le même nom mais un ID différent (créés manuellement)
    const oldTemplates = await database.getAllAsync<{ id: string }>(
      'SELECT id FROM workout_templates WHERE name = ? AND id != ?',
      tpl.name, tpl.id
    );
    for (const old of oldTemplates) {
      const oldTEs = await database.getAllAsync<{ id: string }>(
        'SELECT id FROM workout_template_exercises WHERE template_id = ?', old.id
      );
      for (const te of oldTEs) {
        await database.runAsync('DELETE FROM template_exercise_sets WHERE template_exercise_id = ?', te.id);
      }
      await database.runAsync('DELETE FROM workout_template_exercises WHERE template_id = ?', old.id);
      await database.runAsync('DELETE FROM workout_templates WHERE id = ?', old.id);
    }

    // Upsert le template seed
    await database.runAsync(
      'INSERT OR REPLACE INTO workout_templates (id, name, created_at) VALUES (?, ?, ?)',
      tpl.id, tpl.name, now
    );

    // Nettoyer les exercices existants pour repartir propre
    const existingTEs = await database.getAllAsync<{ id: string }>(
      'SELECT id FROM workout_template_exercises WHERE template_id = ?', tpl.id
    );
    for (const te of existingTEs) {
      await database.runAsync('DELETE FROM template_exercise_sets WHERE template_exercise_id = ?', te.id);
    }
    await database.runAsync('DELETE FROM workout_template_exercises WHERE template_id = ?', tpl.id);

    // Insérer les bons exercices
    for (let ei = 0; ei < tpl.exercises.length; ei++) {
      const ex = tpl.exercises[ei];
      const teId = `${tpl.id}_e${ei + 1}`;
      const firstNormal = ex.sets.find(s => s.type === 'normal');
      await database.runAsync(
        `INSERT INTO workout_template_exercises
         (id, template_id, exercise_id, sets, reps, rest_seconds, order_index, default_weight_kg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        teId, tpl.id, ex.exId,
        ex.sets.length,
        firstNormal?.reps ?? ex.sets[0].reps,
        firstNormal?.rest ?? ex.sets[0].rest,
        ei + 1,
        firstNormal?.weight ?? 0
      );
      for (let si = 0; si < ex.sets.length; si++) {
        const s = ex.sets[si];
        await database.runAsync(
          `INSERT INTO template_exercise_sets
           (id, template_exercise_id, set_index, set_type, target_reps, target_weight_kg, rest_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          `${teId}_s${si + 1}`, teId, si + 1, s.type, s.reps, s.weight, s.rest
        );
      }
    }
  }
}

const _doInit = async () => {
  const database = await openDatabase();

  // Ferme proprement la connexion OPFS au hot-reload / fermeture d'onglet (web uniquement)
  if (Platform.OS === 'web') {
    window.addEventListener('beforeunload', () => { database.closeAsync(); }, { once: true });
  }

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      muscle TEXT NOT NULL,
      equipment TEXT NOT NULL,
      image TEXT,
      description TEXT,
      instructions TEXT,
      is_custom INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      FOREIGN KEY(workout_id) REFERENCES workouts(id),
      FOREIGN KEY(exercise_id) REFERENCES exercises(id)
    );
    CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workout_template_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      template_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      sets INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      rest_seconds INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      FOREIGN KEY(template_id) REFERENCES workout_templates(id),
      FOREIGN KEY(exercise_id) REFERENCES exercises(id)
    );
    CREATE TABLE IF NOT EXISTS workout_sets (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      target_reps INTEGER NOT NULL,
      target_weight REAL NOT NULL,
      rest_seconds INTEGER NOT NULL,
      actual_reps INTEGER,
      actual_weight REAL,
      completed_at TEXT,
      FOREIGN KEY(workout_id) REFERENCES workouts(id),
      FOREIGN KEY(exercise_id) REFERENCES exercises(id)
    );
    CREATE TABLE IF NOT EXISTS body_measurements (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // Migrations — check column existence first to avoid execAsync failures that can corrupt WASM statement state
  const workoutCols = await database.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('workouts')`);
  const workoutColNames = new Set(workoutCols.map(r => r.name));
  if (!workoutColNames.has('finished_at')) await database.execAsync('ALTER TABLE workouts ADD COLUMN finished_at TEXT');
  if (!workoutColNames.has('template_id')) await database.execAsync('ALTER TABLE workouts ADD COLUMN template_id TEXT');
  if (!workoutColNames.has('notes')) await database.execAsync('ALTER TABLE workouts ADD COLUMN notes TEXT');

  const wteCols = await database.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('workout_template_exercises')`);
  if (!wteCols.some(r => r.name === 'default_weight_kg')) await database.execAsync('ALTER TABLE workout_template_exercises ADD COLUMN default_weight_kg REAL');

  const exerciseCols = await database.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('exercises')`);
  if (!exerciseCols.some(r => r.name === 'is_custom')) await database.execAsync('ALTER TABLE exercises ADD COLUMN is_custom INTEGER DEFAULT 0');

  const setsCols = await database.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('workout_sets')`);
  if (!setsCols.some(r => r.name === 'set_type')) await database.execAsync("ALTER TABLE workout_sets ADD COLUMN set_type TEXT DEFAULT 'normal'");

  const workoutExerciseCols = await database.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('workout_exercises')`);
  if (!workoutExerciseCols.some(r => r.name === 'order_index')) {
    await database.execAsync('ALTER TABLE workout_exercises ADD COLUMN order_index INTEGER DEFAULT 0');
    // Backfill: assign sequential order based on rowid (insertion order)
    await database.execAsync(`
      UPDATE workout_exercises
      SET order_index = (
        SELECT COUNT(*) - 1
        FROM workout_exercises we2
        WHERE we2.workout_id = workout_exercises.workout_id AND we2.rowid <= workout_exercises.rowid
      )
    `);
  }
  // v7 — per-set configuration in templates
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS template_exercise_sets (
      id TEXT PRIMARY KEY NOT NULL,
      template_exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      set_type TEXT NOT NULL DEFAULT 'normal',
      target_reps INTEGER NOT NULL DEFAULT 10,
      target_weight_kg REAL NOT NULL DEFAULT 0,
      rest_seconds INTEGER NOT NULL DEFAULT 90,
      FOREIGN KEY(template_exercise_id) REFERENCES workout_template_exercises(id)
    );
  `);
  // Backfill: for each existing template exercise row, insert N set rows (idempotent)
  // Sequential runAsync — withTransactionAsync is unreliable on expo-sqlite WASM/web
  const templateExercises = await database.getAllAsync<{
    id: string; sets: number; reps: number; rest_seconds: number; default_weight_kg: number | null;
  }>('SELECT id, sets, reps, rest_seconds, default_weight_kg FROM workout_template_exercises');
  for (const te of templateExercises) {
    for (let i = 1; i <= te.sets; i++) {
      const setId = `${te.id}_s${i}`;
      await database.runAsync(
        `INSERT OR IGNORE INTO template_exercise_sets
         (id, template_exercise_id, set_index, set_type, target_reps, target_weight_kg, rest_seconds)
         VALUES (?, ?, ?, 'normal', ?, ?, ?)`,
        setId, te.id, i, te.reps, te.default_weight_kg ?? 0, te.rest_seconds
      );
    }
  }

  // Seed default templates — v5 : Legs — Machine abdos remplacée par Extensions lombaires
  const SEED_VERSION = 5;
  const seedVerRow = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = 'seed_version'"
  );
  const currentSeedVersion = seedVerRow ? parseInt(seedVerRow.value, 10) : 0;
  if (currentSeedVersion < SEED_VERSION) {
    await seedDefaultTemplates(database);
    await database.runAsync(
      "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('seed_version', ?)",
      String(SEED_VERSION)
    );
  }

  // Seed exercises si vide, trop peu (< 900) OU trop (> 950 = ancien dataset non filtré avec 1592 entrées)
  const result = await database.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM exercises WHERE is_custom = 0 OR is_custom IS NULL');
  if (result && (result.count < 900 || result.count > 950)) {
    await database.execAsync('DELETE FROM exercises WHERE is_custom IS NULL OR is_custom = 0');
    // Batch insert (50 rows per execAsync) — far faster than 1500+ sequential runAsync on WASM
    const esc = (s: string | null | undefined): string =>
      s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
    const CHUNK = 50;
    for (let i = 0; i < initialExercises.length; i += CHUNK) {
      const chunk = initialExercises.slice(i, i + CHUNK);
      const vals = chunk.map(ex =>
        `(${esc(ex.id)},${esc(ex.name)},${esc(ex.muscle)},${esc(ex.equipment)},${esc(ex.image ?? null)},${esc(ex.description ?? '')},${esc(ex.instructions ?? '')})`
      ).join(',');
      await database.execAsync(
        `INSERT OR IGNORE INTO exercises (id,name,muscle,equipment,image,description,instructions) VALUES ${vals};`
      );
    }
  }

  // Seed custom exercises used in default templates (is_custom=1 prevents deletion on reseed)
  await database.runAsync(
    `INSERT OR IGNORE INTO exercises (id, name, muscle, equipment, image, description, instructions, is_custom)
     VALUES (?, ?, ?, ?, NULL, ?, ?, 1)`,
    'seed_kneeling_band_pulldown',
    'Kneeling Band Pulldown',
    'Lats',
    'Bands',
    'Agenouillez-vous face à un ancrage haut. Saisissez la bande avec les deux mains et tirez-la vers vos cuisses en gardant les bras tendus.',
    ''
  );

  // Migrate existing seed templates to use correct exercise IDs (idempotent via UPDATE)
  const seedExMigrations: [string, string][] = [
    ['seed_push_e1', 'Leverage_Chest_Press'],
    ['seed_push_e3', 'Dumbbell_Flyes'],
    ['seed_push_e5', 'Side_Lateral_Raise'],
    ['seed_push_e6', 'Dips_-_Triceps_Version'],
    ['seed_pull_e1', 'Wide-Grip_Lat_Pulldown'],
    ['seed_pull_e3', 'Seated_Cable_Rows'],
    ['seed_pull_e6', 'Incline_Dumbbell_Curl'],
    ['seed_pull_e7', 'seed_kneeling_band_pulldown'],
    ['seed_legs_e1', 'Barbell_Squat'],
    ['seed_legs_e4', 'Stiff-Legged_Dumbbell_Deadlift'],
    ['seed_upper_e1', 'Smith_Machine_Incline_Bench_Press'],
    ['seed_upper_e3', 'One-Arm_Dumbbell_Row'],
    ['seed_upper_e4', 'wger_1730'],
    ['seed_upper_e6', 'Machine_Triceps_Extension'],
    ['seed_lower_e2', 'Leg_Press'],
    ['seed_lower_e3', 'Seated_Leg_Curl'],
    ['seed_lower_e4', 'Dumbbell_Lunges'],
    ['seed_lower_e8', 'Plank'],
  ];
  for (const [teId, exId] of seedExMigrations) {
    await database.runAsync(
      'UPDATE workout_template_exercises SET exercise_id = ? WHERE id = ?',
      exId, teId
    );
  }
  // Fix reps for Chin-Up sets in Upper template (old seed had 8/6/5, now 10/8/7)
  await database.runAsync('UPDATE template_exercise_sets SET target_reps = 10 WHERE id = ?', 'seed_upper_e2_s1');
  await database.runAsync('UPDATE template_exercise_sets SET target_reps = 8  WHERE id = ?', 'seed_upper_e2_s2');
  await database.runAsync('UPDATE template_exercise_sets SET target_reps = 7  WHERE id = ?', 'seed_upper_e2_s3');
  // Fix reps for Kneeling Pulldown Band sets in Pull template (old seed had 10, now 12)
  await database.runAsync('UPDATE template_exercise_sets SET target_reps = 12 WHERE id IN (?, ?, ?)', 'seed_pull_e7_s1', 'seed_pull_e7_s2', 'seed_pull_e7_s3');

  // Rename exercises to match user's own naming convention — version 2
  const EXERCISE_NAME_VERSION = 2;
  const nameVerRow = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = 'exercise_name_version'"
  );
  if (!nameVerRow || parseInt(nameVerRow.value, 10) < EXERCISE_NAME_VERSION) {
    const renames: [string, string][] = [
      // ── Upper (noms de l'app Strong de l'utilisateur) ──────────────────────
      ['Smith_Machine_Incline_Bench_Press', 'Développé incliné Smith'],
      ['Chin-Up',                           'Tractions supination'],
      ['One-Arm_Dumbbell_Row',              'Rowing haltères sur banc'],
      ['wger_1730',                         'Épaules latérale poulie'],
      ['Hammer_Curls',                      'Hammer curl'],
      ['Machine_Triceps_Extension',         'Triceps extension'],
      // ── Lower (noms de l'app Strong de l'utilisateur) ──────────────────────
      ['Barbell_Deadlift',                  'Deadlift'],
      ['Leg_Press',                         'Presse'],
      ['Seated_Leg_Curl',                   'Curl ischios machine'],
      ['Dumbbell_Lunges',                   'Fentes marchées'],
      ['Ab_Crunch_Machine',                 'Machine abdos'],
      ['Thigh_Abductor',                    'Abducteur ouvert'],
      ['Thigh_Adductor',                    'Adducteur fermer'],
      ['Plank',                             'Planche'],
      // ── Push ───────────────────────────────────────────────────────────────
      ['Leverage_Chest_Press',              'Développé couché machine'],
      ['wger_537',                          'Développé incliné haltères'],
      ['Dumbbell_Flyes',                    'Écarté haltères'],
      ['wger_543',                          'Développé épaules machine'],
      ['Side_Lateral_Raise',                'Élévations latérales haltères'],
      ['Dips_-_Triceps_Version',            'Dips triceps'],
      // ── Pull ───────────────────────────────────────────────────────────────
      ['Wide-Grip_Lat_Pulldown',            'Tirage vertical prise large'],
      ['Leverage_Iso_Row',                  'Rowing machine assis'],
      ['Seated_Cable_Rows',                 'Rowing câble assis'],
      ['Reverse_Machine_Flyes',             'Écarté arrière machine'],
      ['Machine_Preacher_Curls',            'Curl pupitre machine'],
      ['Incline_Dumbbell_Curl',             'Curl incliné haltères'],
      ['seed_kneeling_band_pulldown',       'Tirage nuque élastique'],
      // ── Legs ───────────────────────────────────────────────────────────────
      ['Barbell_Squat',                     'Squat barre'],
      ['wger_1366',                         'Bulgarian Split Squat'],
      ['Stiff-Legged_Dumbbell_Deadlift',    'Soulevé de terre jambes tendues'],
      ['Hyperextensions_(Back_Extensions)', 'Extensions lombaires'],
    ];
    for (const [id, name] of renames) {
      await database.runAsync('UPDATE exercises SET name = ? WHERE id = ?', name, id);
    }
    await database.runAsync(
      "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('exercise_name_version', ?)",
      String(EXERCISE_NAME_VERSION)
    );
  }
};

// ─── Exercises ───────────────────────────────────────────────────────────────

export const getExercises = async (filter: string = '') => {
  const database = await openDatabase();
  if (!filter) {
    return await database.getAllAsync('SELECT * FROM exercises ORDER BY name ASC');
  }
  const sanitizedFilter = `%${filter}%`;
  return await database.getAllAsync(
    'SELECT * FROM exercises WHERE name LIKE ? OR muscle LIKE ? OR equipment LIKE ? ORDER BY name ASC',
    sanitizedFilter, sanitizedFilter, sanitizedFilter
  );
};

export type ExerciseDetail = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  image: string | null;
  description: string | null;
  instructions: string | null;
};

export const getExerciseById = async (id: string): Promise<ExerciseDetail | null> => {
  const database = await openDatabase();
  return await database.getFirstAsync<ExerciseDetail>(
    'SELECT id, name, muscle, equipment, image, description, instructions FROM exercises WHERE id = ?',
    id
  ) ?? null;
};

export const addExercise = async (exercise: {
  name: string;
  muscle: string;
  equipment: string;
  image?: string;
  description?: string;
  instructions?: string;
}) => {
  const database = await openDatabase();
  const id = Date.now().toString();
  await database.runAsync(
    'INSERT INTO exercises (id, name, muscle, equipment, image, description, instructions) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, exercise.name, exercise.muscle, exercise.equipment, exercise.image ?? null, exercise.description ?? '', exercise.instructions ?? ''
  );
  return id;
};

// ─── Workouts ─────────────────────────────────────────────────────────────────

export type WorkoutSummary = {
  id: string;
  name: string;
  created_at: string;
  finished_at: string | null;
  exerciseCount: number;
};

export const createEmptyWorkout = async (name?: string): Promise<string> => {
  const database = await openDatabase();
  const workoutId = Date.now().toString();
  const workoutName = name ?? 'Workout ' + new Date().toLocaleDateString();
  const createdAt = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO workouts (id, name, created_at) VALUES (?, ?, ?)',
    workoutId, workoutName, createdAt
  );
  return workoutId;
};

export const createWorkoutWithExercises = async (exerciseIds: string[], name?: string): Promise<string | null> => {
  const database = await openDatabase();
  const workoutId = Date.now().toString();
  const workoutName = name ?? 'Workout ' + new Date().toLocaleDateString();
  const createdAt = new Date().toISOString();

  await database.runAsync(
    'INSERT INTO workouts (id, name, created_at) VALUES (?, ?, ?)',
    workoutId, workoutName, createdAt
  );

  for (const exId of exerciseIds) {
    const rowId = `${workoutId}_${exId}`;
    await database.runAsync(
      'INSERT INTO workout_exercises (id, workout_id, exercise_id) VALUES (?, ?, ?)',
      rowId, workoutId, exId
    );
  }

  return workoutId;
};

export const finishWorkout = async (workoutId: string): Promise<void> => {
  const database = await openDatabase();
  await database.runAsync(
    'UPDATE workouts SET finished_at = ? WHERE id = ?',
    new Date().toISOString(), workoutId
  );
};

export const getWorkouts = async (onlyFinished?: boolean): Promise<WorkoutSummary[]> => {
  const database = await openDatabase();
  const rows = await database.getAllAsync<WorkoutSummary>(`
    SELECT w.id, w.name, w.created_at, w.finished_at, COUNT(we.id) as exerciseCount
    FROM workouts w
    LEFT JOIN workout_exercises we ON we.workout_id = w.id
    ${onlyFinished ? 'WHERE w.finished_at IS NOT NULL' : ''}
    GROUP BY w.id
    ORDER BY w.created_at DESC
  `);
  return rows;
};

// ─── Last Session Weights ─────────────────────────────────────────────────────

export type LastSetData = { weight: number | null; reps: number | null };

/**
 * For each exerciseId, returns the actual weight/reps per set_index from the
 * most recent finished workout (excluding currentWorkoutId).
 */
export const getLastSessionWeightsForExercises = async (
  exerciseIds: string[],
  currentWorkoutId: string
): Promise<Map<string, Map<number, LastSetData>>> => {
  const result = new Map<string, Map<number, LastSetData>>();
  if (!exerciseIds.length) return result;

  const database = await openDatabase();

  for (const exerciseId of exerciseIds) {
    // Find the most recent finished workout containing this exercise
    const lastWorkout = await database.getFirstAsync<{ workout_id: string }>(
      `SELECT ws.workout_id
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE ws.exercise_id = ?
         AND ws.workout_id != ?
         AND w.finished_at IS NOT NULL
       ORDER BY w.finished_at DESC
       LIMIT 1`,
      exerciseId, currentWorkoutId
    );

    if (!lastWorkout) continue;

    const sets = await database.getAllAsync<{ set_index: number; actual_weight: number | null; actual_reps: number | null }>(
      `SELECT set_index, actual_weight, actual_reps
       FROM workout_sets
       WHERE workout_id = ? AND exercise_id = ?
       ORDER BY set_index ASC`,
      lastWorkout.workout_id, exerciseId
    );

    const setMap = new Map<number, LastSetData>();
    for (const s of sets) {
      setMap.set(s.set_index, { weight: s.actual_weight, reps: s.actual_reps });
    }
    result.set(exerciseId, setMap);
  }

  return result;
};

// ─── Stats & Analytics ────────────────────────────────────────────────────────

export type WeekDayActivity = {
  date: string;
  hasWorkout: boolean;
};

export type WeeklyStats = {
  days: WeekDayActivity[];
  totalVolume: number;
  workoutCount: number;
  totalDurationMinutes: number;
};

/** Returns activity data for the current Mon–Sun week */
export const getWeeklyStats = async (): Promise<WeeklyStats> => {
  const database = await openDatabase();

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  // `created_at` is stored as a UTC ISO instant. Comparing it lexicographically against
  // another ISO instant is timezone-safe; extracting SQLite's DATE(created_at) is not —
  // it reads the UTC calendar date, which for any positive-UTC-offset user (e.g. Paris)
  // falls a day earlier than the local calendar date for hours after local midnight,
  // shifting every "done" dot on the week strip one column later than the real day.
  const mondayIso = monday.toISOString();

  // Toutes les stats en une seule requête JOIN — pas d'interpolation de chaîne
  const stats = await database.getFirstAsync<{
    totalVolume: number;
    workoutCount: number;
    totalDurationSeconds: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN ws.completed_at IS NOT NULL
                    THEN ws.actual_weight * ws.actual_reps ELSE 0 END), 0) AS totalVolume,
       COUNT(DISTINCT w.id) AS workoutCount,
       COALESCE(SUM(strftime('%s', w.finished_at) - strftime('%s', w.created_at)), 0) AS totalDurationSeconds
     FROM workouts w
     LEFT JOIN workout_sets ws ON ws.workout_id = w.id
     WHERE w.created_at >= ?
       AND w.finished_at IS NOT NULL`,
    mondayIso
  );

  // Jours actifs — comparés comme de vrais instants (Date), pas comme des chaînes UTC,
  // pour retomber sur le bon jour calendaire local quel que soit le fuseau horaire.
  const activeRows = await database.getAllAsync<{ created_at: string }>(
    `SELECT created_at FROM workouts WHERE created_at >= ? AND finished_at IS NOT NULL`,
    mondayIso
  );
  const activeTimestamps = activeRows.map(r => new Date(r.created_at).getTime());

  const days: WeekDayActivity[] = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(monday);
    dayStart.setDate(monday.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const hasWorkout = activeTimestamps.some(t => t >= dayStart.getTime() && t < dayEnd.getTime());
    return { date: dayStart.toISOString().split('T')[0], hasWorkout };
  });

  return {
    days,
    totalVolume: Math.round(stats?.totalVolume ?? 0),
    workoutCount: stats?.workoutCount ?? 0,
    totalDurationMinutes: Math.round((stats?.totalDurationSeconds ?? 0) / 60),
  };
};

export type LastWorkoutInfo = {
  id: string;
  name: string;
  created_at: string;
  finished_at: string | null;
  exerciseCount: number;
  durationMinutes: number | null;
} | null;

export const getLastWorkout = async (): Promise<LastWorkoutInfo> => {
  const database = await openDatabase();
  const workout = await database.getFirstAsync<{
    id: string;
    name: string;
    created_at: string;
    finished_at: string | null;
    exerciseCount: number;
  }>(
    `SELECT w.id, w.name, w.created_at, w.finished_at, COUNT(DISTINCT we.exercise_id) as exerciseCount
     FROM workouts w
     LEFT JOIN workout_exercises we ON we.workout_id = w.id
     WHERE w.finished_at IS NOT NULL
     GROUP BY w.id
     ORDER BY w.finished_at DESC
     LIMIT 1`
  );

  if (!workout) return null;

  let durationMinutes: number | null = null;
  if (workout.finished_at) {
    durationMinutes = Math.round(
      (new Date(workout.finished_at).getTime() - new Date(workout.created_at).getTime()) / 1000 / 60
    );
  }

  return { ...workout, durationMinutes };
};

export type PersonalRecord = {
  exercise_id: string;
  name: string;
  muscle: string;
  maxWeight: number;
  reps: number | null;
  achieved_at: string;
};

export const getPRForExercise = async (exerciseId: string, excludeWorkoutId: string): Promise<number | null> => {
  const database = await openDatabase();
  const row = await database.getFirstAsync<{ maxWeight: number | null }>(
    `SELECT MAX(actual_weight) as maxWeight
     FROM workout_sets
     WHERE exercise_id = ?
       AND workout_id != ?
       AND completed_at IS NOT NULL
       AND actual_weight IS NOT NULL`,
    exerciseId, excludeWorkoutId
  );
  return row?.maxWeight ?? null;
};

export const getPersonalRecords = async (limit: number = 10): Promise<PersonalRecord[]> => {
  const database = await openDatabase();
  return await database.getAllAsync<PersonalRecord>(
    `SELECT ws.exercise_id, e.name, e.muscle, ws.actual_weight as maxWeight, ws.actual_reps as reps, ws.completed_at as achieved_at
     FROM workout_sets ws
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.completed_at IS NOT NULL
       AND ws.actual_weight IS NOT NULL
       AND ws.actual_weight > 0
       AND ws.actual_weight = (
         SELECT MAX(ws2.actual_weight)
         FROM workout_sets ws2
         WHERE ws2.exercise_id = ws.exercise_id
           AND ws2.completed_at IS NOT NULL
           AND ws2.actual_weight IS NOT NULL
       )
     GROUP BY ws.exercise_id
     ORDER BY maxWeight DESC
     LIMIT ?`,
    limit
  );
};

export type VolumeByWeek = {
  weekLabel: string;
  volume: number;
};

export const getVolumeByWeek = async (weeks: number = 8): Promise<VolumeByWeek[]> => {
  const database = await openDatabase();
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const result: VolumeByWeek[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysFromMonday - i * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7); // exclusive upper bound (next Monday)

    // Instant range on the raw ISO string, not DATE() string extraction — see getWeeklyStats
    // for why DATE(created_at) misattributes workouts near local midnight for non-UTC users.
    const vol = await database.getFirstAsync<{ volume: number }>(
      `SELECT COALESCE(SUM(ws.actual_weight * ws.actual_reps), 0) as volume
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE w.created_at >= ? AND w.created_at < ?
         AND ws.completed_at IS NOT NULL
         AND ws.actual_weight IS NOT NULL
         AND ws.actual_reps IS NOT NULL`,
      weekStart.toISOString(), weekEnd.toISOString()
    );

    const label = weekStart.toLocaleDateString('fr', { month: 'short', day: 'numeric' });
    result.push({ weekLabel: label, volume: Math.round(vol?.volume ?? 0) });
  }

  return result;
};

/** Returns the total volume (kg) across all completed sets ever */
export const getTotalVolumeAllTime = async (): Promise<number> => {
  const database = await openDatabase();
  const result = await database.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(actual_weight * actual_reps), 0) as total
     FROM workout_sets
     WHERE completed_at IS NOT NULL
       AND actual_weight IS NOT NULL
       AND actual_reps IS NOT NULL`
  );
  return Math.round(result?.total ?? 0);
};

export const getTotalWorkoutsAllTime = async (): Promise<number> => {
  const database = await openDatabase();
  const result = await database.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM workouts WHERE finished_at IS NOT NULL`
  );
  return result?.total ?? 0;
};

export const getTotalSetsAllTime = async (): Promise<number> => {
  const database = await openDatabase();
  const result = await database.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM workout_sets WHERE completed_at IS NOT NULL`
  );
  return result?.total ?? 0;
};

/** Returns the number of consecutive weeks with at least one workout */
export const getWorkoutStreak = async (): Promise<number> => {
  const database = await openDatabase();
  const workouts = await database.getAllAsync<{ created_at: string }>(
    `SELECT created_at FROM workouts WHERE finished_at IS NOT NULL ORDER BY created_at DESC`
  );

  if (!workouts.length) return 0;

  let streak = 0;
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  for (let i = 0; i < 52; i++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysFromMonday - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const hasWorkout = workouts.some(w => {
      const d = new Date(w.created_at);
      return d >= weekStart && d <= weekEnd;
    });

    if (hasWorkout) {
      streak++;
    } else if (i > 0) {
      // Allow current week to be incomplete
      break;
    }
  }

  return streak;
};

// ─── Body Measurements ────────────────────────────────────────────────────────

export type BodyMeasurement = {
  id: string;
  type: string;
  value: number;
  unit: string;
  recorded_at: string;
};

export const saveBodyMeasurement = async (type: string, value: number, unit: string): Promise<void> => {
  const database = await openDatabase();
  const id = Date.now().toString();
  await database.runAsync(
    'INSERT INTO body_measurements (id, type, value, unit, recorded_at) VALUES (?, ?, ?, ?, ?)',
    id, type, value, unit, new Date().toISOString()
  );
};

export const getBodyMeasurements = async (type: string, limit: number = 30): Promise<BodyMeasurement[]> => {
  const database = await openDatabase();
  return await database.getAllAsync<BodyMeasurement>(
    'SELECT * FROM body_measurements WHERE type = ? ORDER BY recorded_at DESC LIMIT ?',
    type, limit
  );
};

// ─── Templates ────────────────────────────────────────────────────────────────

export type WorkoutTemplateSummary = {
  id: string;
  name: string;
  created_at: string;
  exerciseCount: number;
  lastPerformedAt: string | null;
};

export type WorkoutTemplateExercise = {
  id: string;
  template_id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  order_index: number;
  name: string;
  muscle: string;
  equipment: string;
  image: string | null;
};

export type WorkoutTemplateDetail = {
  id: string;
  name: string;
  created_at: string;
  exercises: WorkoutTemplateExercise[];
};

export const createWorkoutTemplate = async (name?: string): Promise<string> => {
  const database = await openDatabase();
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  const workoutName = name ?? 'New Workout';

  await database.runAsync(
    'INSERT INTO workout_templates (id, name, created_at) VALUES (?, ?, ?)',
    id, workoutName, createdAt
  );

  return id;
};

export const addExercisesToTemplate = async (templateId: string, exerciseIds: string[]) => {
  if (!exerciseIds.length) return;
  const database = await openDatabase();

  const result = await database.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(order_index) as maxOrder FROM workout_template_exercises WHERE template_id = ?',
    templateId
  );
  let currentOrder = (result?.maxOrder ?? 0) + 1;

  for (const exId of exerciseIds) {
    const rowId = `${templateId}_${exId}_${currentOrder}`;
    await database.runAsync(
      'INSERT INTO workout_template_exercises (id, template_id, exercise_id, sets, reps, rest_seconds, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
      rowId, templateId, exId, 3, 8, 90, currentOrder
    );
    for (let i = 1; i <= 3; i++) {
      await database.runAsync(
        `INSERT OR IGNORE INTO template_exercise_sets
         (id, template_exercise_id, set_index, set_type, target_reps, target_weight_kg, rest_seconds)
         VALUES (?, ?, ?, 'normal', ?, ?, ?)`,
        `${rowId}_s${i}`, rowId, i, 8, 0, 90
      );
    }
    currentOrder += 1;
  }
};

// ─── Template Exercise Sets ───────────────────────────────────────────────────

export type TemplateExerciseSet = {
  id: string;
  template_exercise_id: string;
  set_index: number;
  set_type: string;
  target_reps: number;
  target_weight_kg: number;
  rest_seconds: number;
};

export const getTemplateExerciseSets = async (templateExerciseId: string): Promise<TemplateExerciseSet[]> => {
  const database = await openDatabase();
  return await database.getAllAsync<TemplateExerciseSet>(
    'SELECT * FROM template_exercise_sets WHERE template_exercise_id = ? ORDER BY set_index ASC',
    templateExerciseId
  );
};

export const updateTemplateExerciseSetType = async (setId: string, setType: string): Promise<void> => {
  const database = await openDatabase();
  await database.runAsync(
    'UPDATE template_exercise_sets SET set_type = ? WHERE id = ?',
    setType, setId
  );
};

export const updateTemplateExercisesOrder = async (orderedIds: string[]): Promise<void> => {
  const database = await openDatabase();
  for (let i = 0; i < orderedIds.length; i++) {
    await database.runAsync(
      'UPDATE workout_template_exercises SET order_index = ? WHERE id = ?',
      i + 1, orderedIds[i]
    );
  }
};

export const addTemplateExerciseSet = async (templateExerciseId: string): Promise<TemplateExerciseSet | null> => {
  const database = await openDatabase();
  const existing = await database.getFirstAsync<{ maxIdx: number; reps: number; rest: number; weight: number }>(
    `SELECT MAX(tes.set_index) as maxIdx, tes.target_reps as reps, tes.rest_seconds as rest, tes.target_weight_kg as weight
     FROM template_exercise_sets tes WHERE tes.template_exercise_id = ?`,
    templateExerciseId
  );
  const nextIdx = (existing?.maxIdx ?? 0) + 1;
  const id = `${templateExerciseId}_s${nextIdx}`;
  await database.runAsync(
    `INSERT INTO template_exercise_sets (id, template_exercise_id, set_index, set_type, target_reps, target_weight_kg, rest_seconds)
     VALUES (?, ?, ?, 'normal', ?, ?, ?)`,
    id, templateExerciseId, nextIdx, existing?.reps ?? 8, existing?.weight ?? 0, existing?.rest ?? 90
  );
  return await database.getFirstAsync<TemplateExerciseSet>(
    'SELECT * FROM template_exercise_sets WHERE id = ?', id
  ) ?? null;
};

export const deleteTemplateExerciseSet = async (setId: string): Promise<void> => {
  const database = await openDatabase();
  await database.runAsync('DELETE FROM template_exercise_sets WHERE id = ?', setId);
};

export const updateTemplateExerciseSet = async (
  id: string,
  fields: { target_reps?: number; rest_seconds?: number }
): Promise<void> => {
  const database = await openDatabase();
  const updates: string[] = [];
  const params: (number | string)[] = [];

  if (typeof fields.target_reps === 'number') { updates.push('target_reps = ?'); params.push(fields.target_reps); }
  if (typeof fields.rest_seconds === 'number') { updates.push('rest_seconds = ?'); params.push(fields.rest_seconds); }

  if (!updates.length) return;
  params.push(id);
  await database.runAsync(`UPDATE template_exercise_sets SET ${updates.join(', ')} WHERE id = ?`, ...params);
};

// ─────────────────────────────────────────────────────────────────────────────

export const getWorkoutTemplateDetail = async (templateId: string): Promise<WorkoutTemplateDetail | null> => {
  const database = await openDatabase();

  const template = await database.getFirstAsync<{ id: string; name: string; created_at: string }>(
    'SELECT id, name, created_at FROM workout_templates WHERE id = ?',
    templateId
  );

  if (!template) return null;

  const exercises = await database.getAllAsync<WorkoutTemplateExercise>(
    `SELECT
       wte.id, wte.template_id, wte.exercise_id, wte.sets, wte.reps,
       wte.rest_seconds, wte.order_index, e.name, e.muscle, e.equipment, e.image
     FROM workout_template_exercises wte
     JOIN exercises e ON e.id = wte.exercise_id
     WHERE wte.template_id = ?
     ORDER BY wte.order_index ASC`,
    templateId
  );

  return { id: template.id, name: template.name, created_at: template.created_at, exercises };
};

export type TemplateDetail = {
  id: string;
  name: string;
  exercises: Array<{ exerciseId: string; name: string; sets: number; reps: number; weight_kg: number | null }>;
};

export const getTemplateWithExercises = async (templateId: string): Promise<TemplateDetail | null> => {
  const database = await openDatabase();
  const template = await database.getFirstAsync<{ id: string; name: string }>(
    'SELECT id, name FROM workout_templates WHERE id = ?', templateId
  );
  if (!template) return null;

  const rows = await database.getAllAsync<{
    exercise_id: string; name: string; sets: number; reps: number; default_weight_kg: number | null;
  }>(
    `SELECT wte.exercise_id, e.name, wte.sets, wte.reps, wte.default_weight_kg
     FROM workout_template_exercises wte
     JOIN exercises e ON e.id = wte.exercise_id
     WHERE wte.template_id = ?
     ORDER BY wte.order_index ASC`,
    templateId
  );

  return {
    id: template.id,
    name: template.name,
    exercises: rows.map(r => ({
      exerciseId: r.exercise_id,
      name: r.name,
      sets: r.sets,
      reps: r.reps,
      weight_kg: r.default_weight_kg,
    })),
  };
};

export const getWorkoutTemplates = async (): Promise<WorkoutTemplateSummary[]> => {
  const database = await openDatabase();
  const templates = await database.getAllAsync<Omit<WorkoutTemplateSummary, 'lastPerformedAt'>>(`
    SELECT t.id, t.name, t.created_at, COUNT(te.id) as exerciseCount
    FROM workout_templates t
    LEFT JOIN workout_template_exercises te ON te.template_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);
  // Fetch last performed dates separately — correlated subquery unreliable on SQLite WASM
  const lastDates = await database.getAllAsync<{ template_id: string; lastPerformedAt: string }>(
    `SELECT template_id, MAX(finished_at) as lastPerformedAt
     FROM workouts
     WHERE finished_at IS NOT NULL AND template_id IS NOT NULL
     GROUP BY template_id`
  );
  const dateMap = new Map(lastDates.map(r => [r.template_id, r.lastPerformedAt]));
  return templates.map(t => ({ ...t, lastPerformedAt: dateMap.get(t.id) ?? null }));
};

export const updateWorkoutTemplateName = async (templateId: string, name: string) => {
  const database = await openDatabase();
  await database.runAsync('UPDATE workout_templates SET name = ? WHERE id = ?', name, templateId);
};

export const updateTemplateExerciseConfig = async (
  id: string,
  fields: { sets?: number; reps?: number; rest_seconds?: number }
) => {
  const database = await openDatabase();
  const updates: string[] = [];
  const params: (number | string)[] = [];

  if (typeof fields.sets === 'number') { updates.push('sets = ?'); params.push(fields.sets); }
  if (typeof fields.reps === 'number') { updates.push('reps = ?'); params.push(fields.reps); }
  if (typeof fields.rest_seconds === 'number') { updates.push('rest_seconds = ?'); params.push(fields.rest_seconds); }

  if (!updates.length) return;
  params.push(id);
  await database.runAsync(`UPDATE workout_template_exercises SET ${updates.join(', ')} WHERE id = ?`, ...params);
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
  const database = await openDatabase();
  await database.runAsync(
    'DELETE FROM template_exercise_sets WHERE template_exercise_id IN (SELECT id FROM workout_template_exercises WHERE template_id = ?)',
    templateId
  );
  await database.runAsync('DELETE FROM workout_template_exercises WHERE template_id = ?', templateId);
  await database.runAsync('DELETE FROM workout_templates WHERE id = ?', templateId);
};

export const updateWorkoutNotes = async (workoutId: string, notes: string): Promise<void> => {
  const database = await openDatabase();
  await database.runAsync('UPDATE workouts SET notes = ? WHERE id = ?', notes, workoutId);
};

// ─── Workout Sets ─────────────────────────────────────────────────────────────

export type WorkoutSetRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_index: number;
  target_reps: number;
  target_weight: number;
  rest_seconds: number;
  actual_reps: number | null;
  actual_weight: number | null;
  completed_at: string | null;
  set_type: string;
  name: string;
  muscle: string;
  equipment: string;
};

export type WorkoutSessionDetail = {
  id: string;
  name: string;
  created_at: string;
  finished_at: string | null;
  notes: string | null;
  sets: WorkoutSetRow[];
};

export const startWorkoutFromTemplate = async (templateId: string): Promise<string | null> => {
  const template = await getWorkoutTemplateDetail(templateId);
  if (!template || template.exercises.length === 0) return null;

  const database = await openDatabase();
  const workoutId = Date.now().toString();
  const createdAt = new Date().toISOString();

  // Sequential runAsync — withTransactionAsync has issues on expo-sqlite WASM/web
  await database.runAsync(
    'INSERT INTO workouts (id, name, created_at, template_id) VALUES (?, ?, ?, ?)',
    workoutId, template.name || 'Workout', createdAt, templateId
  );

  for (const ex of template.exercises) {
    const workoutExerciseId = `${workoutId}_${ex.exercise_id}`;
    await database.runAsync(
      'INSERT INTO workout_exercises (id, workout_id, exercise_id, order_index) VALUES (?, ?, ?, ?)',
      workoutExerciseId, workoutId, ex.exercise_id, ex.order_index
    );

    // Use per-set config from template_exercise_sets when available
    const templateSets = await database.getAllAsync<{
      set_index: number;
      set_type: string;
      target_reps: number;
      target_weight_kg: number;
      rest_seconds: number;
    }>(
      'SELECT set_index, set_type, target_reps, target_weight_kg, rest_seconds FROM template_exercise_sets WHERE template_exercise_id = ? ORDER BY set_index ASC',
      ex.id
    );

    if (templateSets.length > 0) {
      for (const ts of templateSets) {
        const setId = `${workoutId}_${ex.exercise_id}_${ts.set_index}`;
        await database.runAsync(
          'INSERT INTO workout_sets (id, workout_id, exercise_id, set_index, target_reps, target_weight, rest_seconds, set_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          setId, workoutId, ex.exercise_id, ts.set_index, ts.target_reps, ts.target_weight_kg, ts.rest_seconds, ts.set_type
        );
      }
    } else {
      // Fallback: use aggregate data from workout_template_exercises
      for (let i = 1; i <= ex.sets; i++) {
        const setId = `${workoutId}_${ex.exercise_id}_${i}`;
        await database.runAsync(
          'INSERT INTO workout_sets (id, workout_id, exercise_id, set_index, target_reps, target_weight, rest_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)',
          setId, workoutId, ex.exercise_id, i, ex.reps, 0, ex.rest_seconds
        );
      }
    }
  }

  return workoutId;
};

export const getWorkoutSessionDetail = async (workoutId: string): Promise<WorkoutSessionDetail | null> => {
  const database = await openDatabase();

  const workout = await database.getFirstAsync<{ id: string; name: string; created_at: string; finished_at: string | null; notes: string | null }>(
    'SELECT id, name, created_at, finished_at, notes FROM workouts WHERE id = ?',
    workoutId
  );

  if (!workout) return null;

  const sets = await database.getAllAsync<WorkoutSetRow>(
    `SELECT
       ws.id, ws.workout_id, ws.exercise_id, ws.set_index, ws.target_reps,
       ws.target_weight, ws.rest_seconds, ws.actual_reps, ws.actual_weight,
       ws.completed_at, COALESCE(ws.set_type, 'normal') as set_type,
       e.name, e.muscle, e.equipment
     FROM workout_sets ws
     JOIN exercises e ON e.id = ws.exercise_id
     LEFT JOIN workout_exercises we ON we.workout_id = ws.workout_id AND we.exercise_id = ws.exercise_id
     WHERE ws.workout_id = ?
     ORDER BY COALESCE(we.order_index, 0) ASC, e.name ASC, ws.set_index ASC`,
    workoutId
  );

  return { id: workout.id, name: workout.name, created_at: workout.created_at, finished_at: workout.finished_at, notes: workout.notes ?? null, sets };
};

export const updateWorkoutSet = async (
  id: string,
  fields: { actual_reps?: number; actual_weight?: number; toggleComplete?: boolean; rest_seconds?: number; set_type?: string }
) => {
  const database = await openDatabase();
  const updates: string[] = [];
  const params: (number | string | null)[] = [];

  if (typeof fields.actual_reps === 'number') { updates.push('actual_reps = ?'); params.push(fields.actual_reps); }
  if (typeof fields.actual_weight === 'number') { updates.push('actual_weight = ?'); params.push(fields.actual_weight); }
  if (typeof fields.rest_seconds === 'number') { updates.push('rest_seconds = ?'); params.push(fields.rest_seconds); }
  if (typeof fields.set_type === 'string') { updates.push('set_type = ?'); params.push(fields.set_type); }
  if (fields.toggleComplete) {
    updates.push('completed_at = CASE WHEN completed_at IS NULL THEN ? ELSE NULL END');
    params.push(new Date().toISOString());
  }

  if (!updates.length) return;
  params.push(id);
  await database.runAsync(`UPDATE workout_sets SET ${updates.join(', ')} WHERE id = ?`, ...params);
};

export const addSetToWorkout = async (workoutId: string, exerciseId: string): Promise<WorkoutSetRow | null> => {
  const database = await openDatabase();

  // Check if exercise is already in workout_exercises
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM workout_exercises WHERE workout_id = ? AND exercise_id = ?',
    workoutId, exerciseId
  );
  if (!existing) {
    const maxOrder = await database.getFirstAsync<{ maxOrder: number | null }>(
      'SELECT MAX(order_index) as maxOrder FROM workout_exercises WHERE workout_id = ?',
      workoutId
    );
    await database.runAsync(
      'INSERT INTO workout_exercises (id, workout_id, exercise_id, order_index) VALUES (?, ?, ?, ?)',
      `${workoutId}_${exerciseId}`, workoutId, exerciseId, (maxOrder?.maxOrder ?? -1) + 1
    );
  }

  // Find next set index + copy values from last set
  const lastSet = await database.getFirstAsync<{
    maxIdx: number | null; target_reps: number; target_weight: number;
    rest_seconds: number; actual_reps: number | null; actual_weight: number | null;
  }>(
    `SELECT MAX(set_index) as maxIdx, target_reps, target_weight, rest_seconds, actual_reps, actual_weight
     FROM workout_sets WHERE workout_id = ? AND exercise_id = ?
     ORDER BY set_index DESC LIMIT 1`,
    workoutId, exerciseId
  );
  const newIndex = (lastSet?.maxIdx ?? 0) + 1;
  const defaultReps = lastSet?.actual_reps ?? lastSet?.target_reps ?? 8;
  const defaultWeight = lastSet?.actual_weight ?? lastSet?.target_weight ?? 0;
  const defaultRest = lastSet?.rest_seconds ?? 90;
  const setId = `${workoutId}_${exerciseId}_${newIndex}_${Date.now()}`;

  await database.runAsync(
    'INSERT INTO workout_sets (id, workout_id, exercise_id, set_index, target_reps, target_weight, rest_seconds, set_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    setId, workoutId, exerciseId, newIndex, defaultReps, defaultWeight, defaultRest, 'normal'
  );

  const exercise = await database.getFirstAsync<{ name: string; muscle: string; equipment: string }>(
    'SELECT name, muscle, equipment FROM exercises WHERE id = ?', exerciseId
  );

  return {
    id: setId, workout_id: workoutId, exercise_id: exerciseId,
    set_index: newIndex, target_reps: defaultReps, target_weight: defaultWeight, rest_seconds: defaultRest,
    actual_reps: null, actual_weight: null, completed_at: null, set_type: 'normal',
    name: exercise?.name ?? '', muscle: exercise?.muscle ?? '', equipment: exercise?.equipment ?? '',
  };
};

export const deleteWorkoutSet = async (setId: string): Promise<void> => {
  const database = await openDatabase();
  await database.runAsync('DELETE FROM workout_sets WHERE id = ?', setId);
};

export const updateWorkoutExerciseOrder = async (workoutId: string, orderedExerciseIds: string[]): Promise<void> => {
  const database = await openDatabase();
  for (let i = 0; i < orderedExerciseIds.length; i++) {
    await database.runAsync(
      'UPDATE workout_exercises SET order_index = ? WHERE workout_id = ? AND exercise_id = ?',
      i, workoutId, orderedExerciseIds[i]
    );
  }
};

export const removeExerciseFromWorkout = async (workoutId: string, exerciseId: string): Promise<void> => {
  const database = await openDatabase();
  await database.runAsync(
    'DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ?',
    workoutId, exerciseId
  );
  await database.runAsync(
    'DELETE FROM workout_exercises WHERE workout_id = ? AND exercise_id = ?',
    workoutId, exerciseId
  );
};

export const getActiveWorkout = async (): Promise<{ id: string; name: string } | null> => {
  const database = await openDatabase();
  return await database.getFirstAsync<{ id: string; name: string }>(
    'SELECT id, name FROM workouts WHERE finished_at IS NULL ORDER BY created_at DESC LIMIT 1'
  );
};

// ─── Workout Summary ──────────────────────────────────────────────────────────

export type WorkoutExerciseSummary = {
  exerciseId: string;
  name: string;
  completedSets: number;
  totalSets: number;
  avgActualReps: number | null;
  avgActualWeight: number | null;
};

export type WorkoutSummaryData = {
  id: string;
  name: string;
  durationSeconds: number;
  totalVolume: number;
  completedSets: number;
  totalSets: number;
  templateId: string | null;
  exercises: WorkoutExerciseSummary[];
};

export const getWorkoutSummary = async (workoutId: string): Promise<WorkoutSummaryData | null> => {
  const database = await openDatabase();

  const workout = await database.getFirstAsync<{
    id: string; name: string; created_at: string; finished_at: string | null; template_id: string | null;
  }>(
    'SELECT id, name, created_at, finished_at, template_id FROM workouts WHERE id = ?',
    workoutId
  );
  if (!workout) return null;

  const durationSeconds = workout.finished_at
    ? Math.round((new Date(workout.finished_at).getTime() - new Date(workout.created_at).getTime()) / 1000)
    : 0;

  const vol = await database.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(actual_weight * actual_reps), 0) as total
     FROM workout_sets WHERE workout_id = ? AND completed_at IS NOT NULL`,
    workoutId
  );

  const rows = await database.getAllAsync<{
    exercise_id: string; name: string; completed_at: string | null;
    actual_reps: number | null; actual_weight: number | null;
  }>(
    `SELECT ws.exercise_id, e.name, ws.completed_at, ws.actual_reps, ws.actual_weight
     FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.workout_id = ? ORDER BY e.name ASC`,
    workoutId
  );

  type ExAcc = {
    exerciseId: string; name: string;
    completedSets: number; totalSets: number;
    repsSum: number; repsCount: number;
    weightSum: number; weightCount: number;
  };
  const exMap = new Map<string, ExAcc>();
  let completedTotal = 0;

  for (const s of rows) {
    if (!exMap.has(s.exercise_id)) {
      exMap.set(s.exercise_id, {
        exerciseId: s.exercise_id, name: s.name,
        completedSets: 0, totalSets: 0,
        repsSum: 0, repsCount: 0, weightSum: 0, weightCount: 0,
      });
    }
    const ex = exMap.get(s.exercise_id)!;
    ex.totalSets++;
    if (s.completed_at) {
      ex.completedSets++;
      completedTotal++;
      if (s.actual_reps != null) { ex.repsSum += s.actual_reps; ex.repsCount++; }
      if (s.actual_weight != null) { ex.weightSum += s.actual_weight; ex.weightCount++; }
    }
  }

  return {
    id: workout.id,
    name: workout.name,
    durationSeconds,
    totalVolume: Math.round(vol?.total ?? 0),
    completedSets: completedTotal,
    totalSets: rows.length,
    templateId: workout.template_id,
    exercises: Array.from(exMap.values()).map(ex => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      completedSets: ex.completedSets,
      totalSets: ex.totalSets,
      avgActualReps: ex.repsCount > 0 ? Math.round(ex.repsSum / ex.repsCount) : null,
      avgActualWeight: ex.weightCount > 0 ? Math.round(ex.weightSum / ex.weightCount * 10) / 10 : null,
    })),
  };
};

export type ExercisePR = { maxWeight: number; reps: number | null; achieved_at: string } | null;

export const getExercisePR = async (exerciseId: string): Promise<ExercisePR> => {
  const database = await openDatabase();
  const row = await database.getFirstAsync<{ maxWeight: number; reps: number | null; achieved_at: string }>(
    `SELECT ws.actual_weight as maxWeight, ws.actual_reps as reps, ws.completed_at as achieved_at
     FROM workout_sets ws
     WHERE ws.exercise_id = ? AND ws.completed_at IS NOT NULL AND ws.actual_weight IS NOT NULL
     ORDER BY ws.actual_weight DESC, ws.completed_at DESC
     LIMIT 1`,
    exerciseId
  );
  return row ?? null;
};

export type ExerciseProgressPoint = { date: string; maxWeight: number };

export const getExerciseProgressHistory = async (exerciseId: string): Promise<ExerciseProgressPoint[]> => {
  const database = await openDatabase();
  const rows = await database.getAllAsync<{ date: string; maxWeight: number }>(
    `SELECT DATE(w.finished_at) as date, MAX(ws.actual_weight) as maxWeight
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     WHERE ws.exercise_id = ?
       AND ws.actual_weight IS NOT NULL
       AND ws.completed_at IS NOT NULL
       AND w.finished_at IS NOT NULL
     GROUP BY DATE(w.finished_at)
     ORDER BY w.finished_at ASC`,
    exerciseId
  );
  return rows;
};

export const updateTemplateFromWorkout = async (workoutId: string, templateId: string): Promise<void> => {
  const database = await openDatabase();

  const exercises = await database.getAllAsync<{
    exercise_id: string; avgReps: number | null; avgWeight: number | null;
  }>(
    `SELECT exercise_id,
       AVG(CASE WHEN completed_at IS NOT NULL AND actual_reps IS NOT NULL THEN actual_reps END) as avgReps,
       AVG(CASE WHEN completed_at IS NOT NULL AND actual_weight IS NOT NULL THEN actual_weight END) as avgWeight
     FROM workout_sets WHERE workout_id = ? GROUP BY exercise_id`,
    workoutId
  );

  for (const ex of exercises) {
    if (ex.avgReps != null) {
      await database.runAsync(
        'UPDATE workout_template_exercises SET reps = ? WHERE template_id = ? AND exercise_id = ?',
        Math.round(ex.avgReps), templateId, ex.exercise_id
      );
    }
    if (ex.avgWeight != null) {
      await database.runAsync(
        'UPDATE workout_template_exercises SET default_weight_kg = ? WHERE template_id = ? AND exercise_id = ?',
        Math.round(ex.avgWeight * 10) / 10, templateId, ex.exercise_id
      );
    }
  }
};

// ─── User Settings ────────────────────────────────────────────────────────────

export const getUserSetting = async (key: string, defaultValue: string = ''): Promise<string> => {
  const database = await openDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM user_settings WHERE key = ?', key
  );
  return row?.value ?? defaultValue;
};

export const saveUserSetting = async (key: string, value: string): Promise<void> => {
  const database = await openDatabase();
  await database.runAsync(
    'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)', key, value
  );
};

export const resetAllWorkoutData = async (): Promise<void> => {
  const database = await openDatabase();
  await database.execAsync(`
    DELETE FROM workout_sets;
    DELETE FROM workout_exercises;
    DELETE FROM workouts;
    DELETE FROM workout_template_exercises;
    DELETE FROM workout_templates;
    DELETE FROM body_measurements;
    DELETE FROM user_settings;
  `);
};
