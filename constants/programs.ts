export type ProgramDay = {
  templateId: string;
  label: string;
};

export type Program = {
  id: string;
  name: string;
  daysPerWeek: number;
  tagline: string;
  description: string;
  muscles: string; // which muscles hit 2×/week
  // weekSchedule[0]=Lun … weekSchedule[6]=Dim
  weekSchedule: (ProgramDay | null)[];
  recommended?: boolean;
};

const rest = null;

// Un seul programme, aligné sur les 4 templates réels (Haut/Bas A+B) — les anciennes
// variantes 2/3/5/6 jours reposaient sur Push/Pull/Legs/Upper/Lower, supprimés
// au profit de ce split unique.
export const PROGRAMS: Program[] = [
  {
    id: 'haut_bas_ab_4',
    name: 'Haut / Bas A/B',
    daysPerWeek: 4,
    tagline: 'Tous les muscles 2× — le split le plus efficace',
    description:
      'Haut A et Haut B travaillent le haut du corps sous deux angles différents (horizontal puis vertical). ' +
      'Bas A (squat + deadlift) et Bas B (presse + soulevé de terre jambes tendues) font de même pour les jambes. ' +
      'Chaque groupe musculaire est stimulé 2 fois par semaine.',
    muscles: 'Tous les groupes 2×/semaine',
    recommended: true,
    weekSchedule: [
      { templateId: 'seed_haut_a', label: 'Haut A' }, // Lun
      { templateId: 'seed_bas_a',  label: 'Bas A' },  // Mar
      rest,
      { templateId: 'seed_haut_b', label: 'Haut B' }, // Jeu
      { templateId: 'seed_bas_b',  label: 'Bas B' },  // Ven
      rest, rest,
    ],
  },
];

export const DAY_LABELS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DAY_LABELS_FULL  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Convert JS Date.getDay() (0=Sun) to weekSchedule index (0=Mon) */
export function todayScheduleIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

/** Returns the next workout day from today (inclusive), or null if none */
export function nextWorkoutDay(program: Program, fromIndex?: number): { dayIndex: number; day: ProgramDay } | null {
  const start = fromIndex ?? todayScheduleIndex();
  for (let i = 0; i < 7; i++) {
    const idx = (start + i) % 7;
    const day = program.weekSchedule[idx];
    if (day) return { dayIndex: idx, day };
  }
  return null;
}
