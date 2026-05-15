# Data Model: Application Fitness — Finalisation Strong-like

**Branch**: `001-workout-session-crud` | **Date**: 2026-05-10

## Existing Schema (unchanged tables)

```sql
exercises (id, name, muscle, equipment, image, description, instructions, is_custom)
workouts (id, name, created_at, finished_at, template_id, notes)
workout_exercises (id, workout_id, exercise_id)
workout_sets (id, workout_id, exercise_id, set_index, target_reps, target_weight,
              rest_seconds, actual_reps, actual_weight, completed_at, set_type)
workout_templates (id, name, created_at)
workout_template_exercises (id, template_id, exercise_id, sets, reps, rest_seconds,
                             order_index, default_weight_kg)
body_measurements (id, type, value, unit, recorded_at)
user_settings (key, value)
```

---

## Schema Changes Required

### 1. New table: `template_exercise_sets`

Enables per-set configuration (type, reps, weight, rest) within a template exercise.
Replaces the single `sets: INTEGER` count for type-aware templates.

```sql
CREATE TABLE IF NOT EXISTS template_exercise_sets (
  id              TEXT    PRIMARY KEY NOT NULL,
  template_exercise_id TEXT NOT NULL,
  set_index       INTEGER NOT NULL,
  set_type        TEXT    NOT NULL DEFAULT 'normal',
  target_reps     INTEGER NOT NULL DEFAULT 10,
  target_weight_kg REAL   NOT NULL DEFAULT 0,
  rest_seconds    INTEGER NOT NULL DEFAULT 90,
  FOREIGN KEY(template_exercise_id) REFERENCES workout_template_exercises(id) ON DELETE CASCADE
);
```

**Migration** (added to `_doInit` alongside existing migrations):
```sql
-- Create the table if not exists
CREATE TABLE IF NOT EXISTS template_exercise_sets (...);

-- Backfill from existing template_exercise rows (run once, idempotent via INSERT OR IGNORE)
INSERT OR IGNORE INTO template_exercise_sets
  (id, template_exercise_id, set_index, set_type, target_reps, target_weight_kg, rest_seconds)
SELECT
  wte.id || '_' || s.n,
  wte.id,
  s.n,
  'normal',
  wte.reps,
  COALESCE(wte.default_weight_kg, 0),
  wte.rest_seconds
FROM workout_template_exercises wte
CROSS JOIN (
  SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
) s
WHERE s.n <= wte.sets;
```

> Note: SQLite has no `generate_series`. The CROSS JOIN with a values table handles up to 10 sets per exercise. Templates with more sets would need extension of the values table.

---

### 2. Verify and fix: `workout_sets` volume query

No schema change — the formula `SUM(actual_weight * actual_reps)` is correct.

**Defensive query update** in `getTotalVolumeAllTime()`:
```sql
-- Before (implicit null exclusion):
SELECT COALESCE(SUM(actual_weight * actual_reps), 0) as total
FROM workout_sets WHERE completed_at IS NOT NULL

-- After (explicit, self-documenting):
SELECT COALESCE(SUM(actual_weight * actual_reps), 0) as total
FROM workout_sets
WHERE completed_at IS NOT NULL
  AND actual_weight IS NOT NULL
  AND actual_reps IS NOT NULL
```

---

### 3. New DB function: `getPRForExercise`

Returns the maximum `actual_weight` ever recorded for a given exercise, excluding the current active workout.

```typescript
export const getPRForExercise = async (
  exerciseId: string,
  excludeWorkoutId: string
): Promise<number | null> => {
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
```

Called once per exercise group on workout screen mount, cached in a `Map<exerciseId, number | null>`.

---

## Entity State Transitions

### Workout lifecycle

```
[not started]
     │  createEmptyWorkout() / startWorkoutFromTemplate()
     ▼
  ACTIVE (finished_at IS NULL)
     │  ← Sets updated in real-time (updateWorkoutSet)
     │  ← Crash/kill: state preserved in SQLite automatically
     │  finishWorkout()
     ▼
 FINISHED (finished_at IS NOT NULL)
     │  ← Read-only; shown in history
     ▼
  (deleted by user)
```

### WorkoutSet lifecycle

```
PENDING (actual_weight/reps = null, completed_at = null)
   │  User enters weight → actual_weight set
   │  User enters reps → actual_reps set
   │  toggleComplete → completed_at = NOW()
   ▼
COMPLETED (completed_at IS NOT NULL)
   │  toggleComplete again → completed_at = null (un-complete)
   ▼
PENDING
```

### Template lifecycle

```
DRAFT (being edited)
   │  Save name → updateWorkoutTemplateName()
   │  Add exercise → addExercisesToTemplate()
   │  Configure set → updateTemplateExerciseSet() [new]
   │  Reorder → updateTemplateExerciseOrder() [new]
   ▼
ACTIVE (used to start workouts)
   │  deleteTemplate()
   ▼
DELETED
```

---

## Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| workout_sets | actual_weight | ≥ 0; null allowed (not entered yet) |
| workout_sets | actual_reps | ≥ 0 (integer); null allowed |
| workout_sets | set_type | one of: normal, warmup, dropset, failure |
| template_exercise_sets | set_type | one of: normal, warmup, dropset, failure |
| template_exercise_sets | target_reps | ≥ 1 |
| template_exercise_sets | rest_seconds | 5–600 seconds |
| user_settings | weight_unit | 'kg' or 'lbs' |
| user_settings | theme | 'light' or 'dark' |
| workouts | name | non-empty string, max 100 chars |
| exercises | name | non-empty string, max 100 chars |

---

## Weight Unit Conversion Helper

Not a schema change — pure display-layer logic.

```typescript
// constants/units.ts
const KG_TO_LBS = 2.20462;

export function kgToDisplay(kg: number, unit: 'kg' | 'lbs'): string {
  if (unit === 'lbs') return (kg * KG_TO_LBS).toFixed(1);
  return kg.toFixed(1);
}

export function displayToKg(val: string, unit: 'kg' | 'lbs'): number {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return unit === 'lbs' ? n / KG_TO_LBS : n;
}
```

---

## Translation Maps

```typescript
// constants/translations.ts
export const MUSCLE_LABELS: Record<string, string> = {
  'Chest': 'Pectoraux',
  'Back': 'Dos',
  'Legs': 'Jambes',
  'Arms': 'Bras',
  'Shoulders': 'Épaules',
  'Core': 'Abdos',
  'All': 'Tous',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  'Barbell': 'Barre',
  'Dumbbell': 'Haltère',
  'Machine': 'Machine',
  'Cables': 'Câbles',
  'Bodyweight': 'Corps libre',
  'Kettlebell': 'Kettlebell',
};

export const SET_TYPE_LABELS: Record<string, string> = {
  'normal': 'Normal',
  'warmup': 'Échauffement',
  'dropset': 'Drop Set',
  'failure': 'Échec',
};
```
