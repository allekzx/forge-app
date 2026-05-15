# Research: Application Fitness — Finalisation Strong-like

**Branch**: `001-workout-session-crud` | **Date**: 2026-05-10

## Decision 1 — Theme flash fix (FR-002 / SC-003)

**Decision**: Hold the native splash screen while the theme loads from AsyncStorage, then release it.

**Current behavior**: `ThemeProvider` reads AsyncStorage asynchronously; `AppShell` renders `null` while `isReady = false`. The native splash hides immediately after JS loads (no `SplashScreen.preventAutoHideAsync()` call), revealing a blank frame before the theme is applied.

**Fix**:
1. Call `SplashScreen.preventAutoHideAsync()` at module level in `app/_layout.tsx` (before any component renders).
2. In `AppShell`, call `SplashScreen.hideAsync()` as a side-effect when `isReady` transitions to `true`.
3. No changes to `ThemeContext.tsx` needed — the AsyncStorage logic is already correct.

**Rationale**: expo-splash-screen is already installed (v31.0.13). This is the standard Expo pattern. Zero UI changes required; the splash acts as the loading state.

**Alternatives considered**:
- Render with a default theme and re-render: produces visible theme jump (worse than null).
- Synchronous storage read: not supported by AsyncStorage (async only); defeats offline-first pattern.

---

## Decision 2 — Exercise drag-and-drop reorder (FR-005, FR-006)

**Decision**: Implement drag-to-reorder using `react-native-reanimated` (v4.1, already installed) + `react-native-gesture-handler` (v2.28, already installed) via the `useAnimatedScrollHandler` + `PanGestureHandler` pattern. No new packages required.

**Rationale**: Both libraries are already in the project. `react-native-reanimated` 4.x includes the `useSharedValue` / `useAnimatedStyle` API compatible with this pattern. The implementation mirrors the approach used in popular OSS examples and avoids dependency bloat.

**Implementation approach**:
- Each exercise row in `template.tsx` gets a drag handle icon (three horizontal lines).
- Pressing the handle activates a `LongPressGestureHandler` → `PanGestureHandler` combo.
- Row position is driven by a `SharedValue`; other rows animate out of the way using `useAnimatedStyle`.
- On gesture end, the reordered positions are persisted via `UPDATE workout_template_exercises SET order_index = ? WHERE id = ?`.

**Alternatives considered**:
- `@wix/react-native-draggable-flatlist`: adds a dependency; good API but unnecessary given existing libs.
- Up/down arrow buttons: simpler but worse UX than Strong; doesn't match the spec requirement of "glisser-déposer".

---

## Decision 3 — Tab bar accessibility from workout screens (FR-003 / SC-004)

**Decision**: Add a persistent `ActiveWorkoutBanner` component (bottom strip) inside `workouts/[workoutId].tsx` that displays tab bar icons OR replaces the tab bar when inside a fullScreenModal. Additionally, expose a global banner on the home screen (`(tabs)/index.tsx`) so users can resume a crashed/backgrounded workout.

**Current situation**: `workouts/[workoutId].tsx` is a `fullScreenModal` — the tab bar is hidden by the OS during modal presentation. Changing `presentation` to `card` would break the slide-up UX expected for starting a workout.

**Fix approach**:
1. Keep `fullScreenModal` for the workout screen (good UX).
2. Add a compact bottom `TabBar` strip directly inside the workout screen's layout, visible only while the workout is active (hidden when `isFinished = true`). This strip shows the 5 main tab icons. Tapping one dismisses the workout screen and navigates to the tab.
3. For **settings** and **template editor** screens (already `card` presentation): these stack on top of tabs so the tab bar should already be accessible if they're not pushed over it — verify. If hidden, change their `presentation` to `transparentModal` or add the same compact strip.

**Alternatives considered**:
- Restructure workout screen inside the tab layout: requires major refactor of navigation tree; high risk.
- Use `router.back()` + tab navigation: two gestures, violates SC-004.

---

## Decision 4 — Set types in templates (FR-004)

**Decision**: Add a `template_exercise_sets` table (one row per set per exercise in a template). This replaces the single `sets: INTEGER` count with explicit per-set configuration.

**Current limitation**: `workout_template_exercises` has a single `sets` integer — all sets in a template exercise share the same type (implicitly "normal"). There is no way to mark set 1 as "warmup" and sets 2-4 as "normal" at the template level.

**New schema**:
```sql
CREATE TABLE IF NOT EXISTS template_exercise_sets (
  id TEXT PRIMARY KEY NOT NULL,
  template_exercise_id TEXT NOT NULL,
  set_index INTEGER NOT NULL,
  set_type TEXT NOT NULL DEFAULT 'normal',
  target_reps INTEGER NOT NULL,
  target_weight_kg REAL NOT NULL DEFAULT 0,
  rest_seconds INTEGER NOT NULL DEFAULT 90,
  FOREIGN KEY(template_exercise_id) REFERENCES workout_template_exercises(id)
);
```

**Migration strategy**: On first run after update, for each existing `workout_template_exercises` row, insert N rows into `template_exercise_sets` (where N = `sets` count). Keep `sets` column for backward compatibility but deprecate it.

**Rationale**: Per-set granularity matches how Strong models templates. The extra table is a clean normalization without breaking the existing query patterns.

**Alternatives considered**:
- JSON column `set_types TEXT` on `workout_template_exercises`: harder to query, harder to validate.
- Single `default_set_type` column: doesn't support mixed types per exercise (e.g., set 1 warmup, rest normal).

---

## Decision 5 — PR detection during workout (FR-008 / SC-007)

**Decision**: Add a `getPRForExercise(exerciseId)` function to `DatabaseService.ts` that returns the historical max `actual_weight` for that exercise (excluding the current workout). On `toggleComplete`, compare the new actual_weight against the PR. If exceeded, trigger an in-component animated badge.

**PR definition** (from clarification): Poids absolu maximum, quel que soit le nombre de reps.

**Implementation**:
- New DB function: `SELECT MAX(actual_weight) FROM workout_sets WHERE exercise_id = ? AND workout_id != ? AND completed_at IS NOT NULL AND actual_weight IS NOT NULL`
- In `workouts/[workoutId].tsx`: after `handleUpdateSet(set, 'toggleComplete')`, if `set.actual_weight > PR`, set a local state `newPRExerciseId` for 3 seconds.
- New component `<PRBadge />`: a small animated overlay (scale + fade) that appears over the set row for 3 seconds then auto-dismisses. No notification system needed (in-app visual only).

**Alternatives considered**:
- Expo Notifications: overkill, requires permissions, not needed for an in-app visual.
- Update the shared `PersonalRecord` entity on every completed set: premature optimization; the PR table in stats is computed via query, not stored separately.

---

## Decision 6 — Volume calculation verification (FR-001 / SC-002)

**Current implementation**:
```sql
SELECT COALESCE(SUM(actual_weight * actual_reps), 0) as total
FROM workout_sets WHERE completed_at IS NOT NULL
```

**Verdict**: The formula `SUM(weight × reps)` over all completed set rows is mathematically correct (each row = one set; summing across rows accounts for multiple sets). 

**Potential bug**: If `actual_weight IS NULL` or `actual_reps IS NULL`, SQLite `NULL * anything = NULL` and `SUM` ignores NULLs. So sets completed without entering weight/reps are silently excluded. This is correct behavior per the spec ("le calcul ne tient compte que des sets complétés").

**Action**: Add explicit `AND actual_weight IS NOT NULL AND actual_reps IS NOT NULL` to the WHERE clause for clarity (not a bug fix but defensive). Verify with a test session of 3 × 100 kg × 10 reps = 3000 kg expected.

---

## Decision 7 — History detail screen (FR-010, FR-011)

**Decision**: Create a new screen `app/history/[workoutId].tsx` (read-only) separate from `app/workouts/[workoutId].tsx` (active workout). The history tab navigates to the new screen, not the existing one.

**Rationale**: The existing `[workoutId].tsx` uses `isFinished` conditional rendering — readable but complex. A dedicated read-only screen is simpler to maintain, has no state management for editing, and makes the navigation intent clear.

**Data**: Reuses the same `getWorkoutSessionDetail(workoutId)` + `getWorkoutSummary(workoutId)` queries from DatabaseService — no new DB functions needed.

---

## Decision 8 — Crash recovery / active workout resume (FR-015 / SC-008)

**Decision**: No structural change needed — all workout data is already persisted to SQLite in real-time. The enhancement is **UX-only**: show a prominent "Reprendre la séance" banner on the home screen (`(tabs)/index.tsx`) if an unfinished workout exists on app cold start.

**Current state**: 
- `getActiveWorkout()` already returns the unfinished workout.
- The workout tab (`(tabs)/workout.tsx`) already shows an active workout banner.
- The home screen (`(tabs)/index.tsx`) uses `useFocusEffect` but doesn't show a dedicated resume prompt.

**Enhancement**: On app launch (or on home screen focus), call `getActiveWorkout()` and if one exists, show a dismissible banner with "Reprendre → [workout name]" at the top of the home screen. The existing workout tab banner provides secondary access.

---

## Decision 9 — Weight unit conversion (FR-007 / SC-006)

**Decision**: Add a `useWeightUnit()` hook that reads the user's unit preference from `user_settings` and exposes `display(kg: number) → string` (converts and formats) and `fromDisplay(val: string) → number` (parses back to kg for storage). Apply in all screens showing weight values.

**Storage**: Always in kg in SQLite (existing behavior). Conversion is display-only.

**Conversion**: 1 kg = 2.20462 lbs (standard). Round to 1 decimal place.

**Files impacted**: `workouts/[workoutId].tsx` (set weight column), `workouts/template.tsx` (default weight), `history/[workoutId].tsx` (display only).

---

## Decision 10 — FR/EN label harmonization (FR-012)

**Decision**: Map all English muscle group names and equipment names to French equivalents in the UI layer only. Do NOT change values stored in the SQLite `exercises` table (that would break existing data and the initial seed).

**Mapping approach**: Create a `constants/translations.ts` file with `MUSCLE_LABELS: Record<string, string>` and `EQUIPMENT_LABELS: Record<string, string>` maps. Apply in `(tabs)/exercises.tsx` filter chips and exercise list display, and in `workouts/[workoutId].tsx` exercise meta line.

**Set type labels**: Already partially localized. Standardize to: Normal / Échauffement / Drop Set / Échec (keeping "Drop Set" as it's the standard term in French lifting culture).

**Category filter chips**: Translate `['All', 'Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core']` to `['Tous', 'Pectoraux', 'Dos', 'Jambes', 'Bras', 'Épaules', 'Abdos']`.
