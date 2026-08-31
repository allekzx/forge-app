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

export const PROGRAMS: Program[] = [
  // ── 2 jours ──────────────────────────────────────────────────────────────────
  {
    id: 'upper_lower_2',
    name: 'Upper / Lower',
    daysPerWeek: 2,
    tagline: 'Corps complet en 2 séances',
    description:
      'Tes séances Upper et Lower couvrent tout le corps chacune à leur tour. ' +
      'Idéal si ton emploi du temps ne permet que 2 sorties par semaine.',
    muscles: 'Tous les groupes 1×/semaine',
    weekSchedule: [
      { templateId: 'seed_upper', label: 'Upper' }, // Lun
      rest, rest,
      { templateId: 'seed_lower', label: 'Lower' }, // Jeu
      rest, rest, rest,
    ],
  },

  // ── 3 jours ──────────────────────────────────────────────────────────────────
  {
    id: 'ppl_3',
    name: 'Push / Pull / Legs',
    daysPerWeek: 3,
    tagline: 'Le split classique de l\'hypertrophie',
    description:
      'Un groupe musculaire par séance avec un volume élevé. ' +
      'Push (pecs, épaules, triceps), Pull (dos, biceps), Legs (jambes, abdos).',
    muscles: 'Tous les groupes 1×/semaine, volume élevé',
    weekSchedule: [
      { templateId: 'seed_push', label: 'Push' }, // Lun
      rest,
      { templateId: 'seed_pull', label: 'Pull' }, // Mer
      rest,
      { templateId: 'seed_legs', label: 'Legs' }, // Ven
      rest, rest,
    ],
  },

  // ── 4 jours ──────────────────────────────────────────────────────────────────
  {
    id: 'upper_lower_ab_4',
    name: 'Upper Lower A/B',
    daysPerWeek: 4,
    tagline: 'Tous les muscles 2× — le split le plus efficace',
    description:
      'Upper A (polyvalent) et Upper B (pecs + dos + épaules variés) travaillent le haut du corps avec des exercices différents. ' +
      'Lower A (squat) et Lower B (deadlift) font de même pour les jambes. ' +
      'Chaque groupe musculaire est stimulé 2 fois par semaine sans jamais répéter le même exercice.',
    muscles: 'Tous les groupes 2×/semaine',
    recommended: true,
    weekSchedule: [
      { templateId: 'seed_upper',   label: 'Upper A' }, // Lun
      { templateId: 'seed_lower',   label: 'Lower A' }, // Mar
      rest,
      { templateId: 'seed_upper_b', label: 'Upper B' }, // Jeu
      { templateId: 'seed_legs',    label: 'Lower B' }, // Ven
      rest, rest,
    ],
  },
  {
    id: 'push_pull_lower_legs_4',
    name: 'Push / Pull / Lower / Legs',
    daysPerWeek: 4,
    tagline: 'Jambes 2× + haut du corps complet',
    description:
      'Push (pecs, épaules, tris) et Pull (dos, biceps) le lundi et mardi. ' +
      'Lower (deadlift) et Legs (squat) le jeudi et vendredi pour les jambes 2×.',
    muscles: 'Jambes 2×, haut du corps 1×',
    weekSchedule: [
      { templateId: 'seed_push',  label: 'Push' },  // Lun
      { templateId: 'seed_pull',  label: 'Pull' },  // Mar
      rest,
      { templateId: 'seed_lower', label: 'Lower' }, // Jeu
      { templateId: 'seed_legs',  label: 'Legs' },  // Ven
      rest, rest,
    ],
  },

  // ── 5 jours ──────────────────────────────────────────────────────────────────
  {
    id: 'ppl_ul_5',
    name: 'PPL + Upper / Lower',
    daysPerWeek: 5,
    tagline: 'Volume maximal — chaque muscle 2×',
    description:
      'Tes 5 routines sur 5 jours. Push+Upper = pecs/épaules/tris 2×. ' +
      'Pull+Upper = dos/biceps 2×. Legs+Lower = jambes 2×. ' +
      'Programme avancé — prévoir une récupération optimale.',
    muscles: 'Tous les groupes 2×/semaine',
    weekSchedule: [
      { templateId: 'seed_push',  label: 'Push' },  // Lun
      { templateId: 'seed_pull',  label: 'Pull' },  // Mar
      { templateId: 'seed_legs',  label: 'Legs' },  // Mer
      rest,
      { templateId: 'seed_upper', label: 'Upper' }, // Jeu
      { templateId: 'seed_lower', label: 'Lower' }, // Ven
      rest,
    ],
  },

  // ── 6 jours ──────────────────────────────────────────────────────────────────
  {
    id: 'ppl_6',
    name: 'Push / Pull / Legs ×2',
    daysPerWeek: 6,
    tagline: 'Fréquence maximale — 1 jour de repos',
    description:
      'Push/Pull/Legs répété deux fois dans la semaine. ' +
      'Chaque groupe musculaire stimulé 2× avec des séances spécialisées. ' +
      'Pour les pratiquants avancés avec une excellente récupération.',
    muscles: 'Tous les groupes 2×/semaine',
    weekSchedule: [
      { templateId: 'seed_push', label: 'Push' }, // Lun
      { templateId: 'seed_pull', label: 'Pull' }, // Mar
      { templateId: 'seed_legs', label: 'Legs' }, // Mer
      { templateId: 'seed_push', label: 'Push' }, // Jeu
      { templateId: 'seed_pull', label: 'Pull' }, // Ven
      { templateId: 'seed_legs', label: 'Legs' }, // Sam
      rest,
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
