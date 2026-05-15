# Screen Route Contracts

**Branch**: `001-workout-session-crud` | **Date**: 2026-05-10

Expo Router uses file-based routing. Each screen is a file; params are passed via `useLocalSearchParams`. This document defines the route contracts — params, navigation intent, and data dependencies.

---

## Existing Routes (unchanged)

| Route | Params | Purpose |
|-------|--------|---------|
| `/(tabs)/` | — | Home dashboard |
| `/(tabs)/workout` | — | Routine list + Quick Start |
| `/(tabs)/exercises` | `mode?: string`, `templateId?: string` | Exercise library / template picker |
| `/(tabs)/history` | — | Past workouts list |
| `/(tabs)/stats` | — | Stats and progression |
| `/workouts/[workoutId]` | `workoutId: string` | **Active** workout session |
| `/workouts/template` | `templateId: string` | Template editor |
| `/workouts/new-template` | — | Create new template |
| `/workouts/exercise-picker` | `workoutId?: string`, `templateId?: string` | Exercise picker for workout/template |
| `/exercises/[exerciseId]` | `exerciseId: string` | Exercise detail |
| `/add-exercise` | — | Create custom exercise |
| `/settings` | — | App preferences |

---

## New Route

### `/history/[workoutId]`

**File**: `app/history/[workoutId].tsx`  
**Params**: `workoutId: string`  
**Purpose**: Read-only view of a completed (past) workout. Distinct from the active workout screen.  
**Navigation from**: `/(tabs)/history` card press  
**Presentation**: `card` (standard push transition)  
**Data**: `getWorkoutSessionDetail(workoutId)` + `getWorkoutSummary(workoutId)`  
**Constraints**:
- Must NOT render any editing controls (no TextInput, no "Terminer" button)
- Must NOT accept a workout where `finished_at IS NULL` (active workouts belong to `/workouts/[workoutId]`)
- Shows: workout name, date, duration, total volume, exercises with sets (poids, reps, set_type)

**TypeScript contract**:
```typescript
// app/history/[workoutId].tsx — useLocalSearchParams return type
type HistoryDetailParams = {
  workoutId: string; // required, non-empty
};
```

---

## Modified Route Contracts

### `/workouts/[workoutId]`

**Change**: Active workout only (existing behavior clarified). If `finished_at IS NOT NULL` when screen loads, redirect to `/history/[workoutId]` instead of showing the finished read-only mode in this screen.

**Added behavior**: 
- Compact tab bar strip at bottom (if workout active) for tab navigation without pressing Back
- PR badge overlay when a PR is set during the session

### `/(tabs)/history`

**Change**: Card `onPress` navigates to `/history/[workoutId]` (new route) instead of `/workouts/[workoutId]`.

```typescript
// Before
router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: item.id } });

// After
router.push({ pathname: '/history/[workoutId]', params: { workoutId: item.id } });
```

### `/(tabs)/exercises`

**Added param**: `workoutId?: string` — when provided along with `mode: 'workout'`, adding exercises links to the active workout (existing behavior via exercise-picker, but exercises tab now also supports direct selection).

---

## New Components

### `<ActiveWorkoutBanner />`

**File**: `components/shared/ActiveWorkoutBanner.tsx`  
**Props**:
```typescript
type Props = {
  workoutId: string;
  workoutName: string;
  onResume: () => void;
  onDismiss: () => void;
};
```
**Usage**: Mounted in `/(tabs)/index.tsx` when an active workout is detected on focus.

### `<PRBadge />`

**File**: `components/workout/PRBadge.tsx`  
**Props**:
```typescript
type Props = {
  visible: boolean;      // triggers enter/exit animation
  weight: number;
  unit: 'kg' | 'lbs';
};
```
**Behavior**: Animates in (scale + opacity), shows for 3 seconds, animates out. Positioned absolute over the set row.

---

## Navigation Flow Diagram

```
[Home] ←→ [Workout list] ←→ [History] ←→ [Stats] ←→ [Exercises]
                │                 │
        [Template editor]   [History detail]  ← NEW, read-only
                │
        [Exercise picker]
                │
        [Active workout]  ← fullScreenModal, compact tab bar inside
```
