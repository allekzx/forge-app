# Implementation Plan: Application Fitness — Finalisation Strong-like

**Branch**: `001-workout-session-crud` | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/001-workout-session-crud/spec.md`

## Summary

Complete the existing Expo/React Native fitness app to match the Strong app experience. The codebase already has ~80% of the core features working; this plan targets the remaining bugs, missing features, and UX gaps identified in the spec. All required libraries (AsyncStorage, Reanimated, GestureHandler, expo-splash-screen) are already installed — no new dependencies are needed.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81.5  
**Primary Dependencies**: Expo SDK 54, Expo Router 6, expo-sqlite 16, @react-native-async-storage/async-storage 2.2, react-native-reanimated 4.1, react-native-gesture-handler 2.28, expo-splash-screen 31, expo-notifications 0.32  
**Storage**: expo-sqlite (SQLite — all workout data), AsyncStorage (theme + accent preferences only)  
**Testing**: No test framework configured — manual testing via Expo dev client  
**Target Platform**: iOS, Android, Web (Expo)  
**Performance Goals**: 60fps UI during drag-and-drop; instant set logging (< 50ms perceived); no frame drop on rest timer  
**Constraints**: 100% offline; SQLite WASM mutex on web (already handled by `withWebLock`); single-user local storage  
**Scale/Scope**: Single user; SQLite database; ~15 screens

## Constitution Check

> No project constitution has been defined (constitution.md contains only the placeholder template). No architectural gates apply. Proceeding with standard practices.

**Standard gates applied:**
- [x] No new dependencies required — all libraries already installed
- [x] SQLite schema changes use `ALTER TABLE ... ADD COLUMN` migrations (existing pattern)
- [x] AsyncStorage used only for lightweight preferences (existing pattern)
- [x] No network calls — offline-first preserved

## Project Structure

### Documentation (this feature)

```text
specs/001-workout-session-crud/
├── plan.md              ← this file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← Phase 1 schema changes
├── quickstart.md        ← Phase 1 dev/test guide
├── contracts/
│   └── screens.md       ← Route & param contracts
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── _layout.tsx                    ← ADD: SplashScreen.preventAutoHideAsync + hide on isReady
├── (tabs)/
│   ├── _layout.tsx                ← REVIEW: tab bar visibility from modals
│   ├── index.tsx                  ← ADD: active workout resume banner on home
│   ├── workout.tsx                ← no change (already has active workout banner)
│   ├── history.tsx                ← CHANGE: cards navigate to new history-detail screen
│   ├── exercises.tsx              ← FIX: labels FR (muscle groups, filters)
│   └── stats.tsx                  ← FIX: weight chart on web (remove Platform.OS guard)
├── workouts/
│   ├── [workoutId].tsx            ← ADD: PR notification overlay; FIX: lbs conversion
│   ├── template.tsx               ← ADD: set-type per set; ADD: exercise drag-reorder
│   ├── new-template.tsx           ← no change
│   └── exercise-picker.tsx        ← FIX: labels FR
├── history/
│   └── [workoutId].tsx            ← NEW: read-only history detail screen
├── exercises/
│   └── [exerciseId].tsx           ← no change
├── add-exercise.tsx               ← FIX: labels FR
└── settings.tsx                   ← no change (already has theme toggle)

services/
└── DatabaseService.ts             ← ADD: getPRForExercise(); FIX: volume query null filter;
                                      ADD: migration for template_exercise_sets table;
                                      ADD: lbs conversion helpers

context/
└── ThemeContext.tsx               ← no change (AsyncStorage already in place)

components/
├── workout/
│   ├── RestTimer.tsx              ← no change
│   └── PRBadge.tsx                ← NEW: animated PR celebration overlay
└── shared/
    └── ActiveWorkoutBanner.tsx    ← NEW: global banner for in-progress workout
```

**Structure Decision**: Single Expo project (Option 3 from template: mobile app with web support). New screen `app/history/[workoutId].tsx` is added as a dedicated read-only history detail route rather than overloading the existing `workouts/[workoutId].tsx` screen.

## Complexity Tracking

No constitution violations to justify.
