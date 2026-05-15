export const MUSCLE_LABELS: Record<string, string> = {
  All: 'Tous',
  // Broad filter categories
  Back: 'Dos',
  Legs: 'Jambes',
  Arms: 'Bras',
  Core: 'Abdos',
  // Individual muscles from dataset
  Chest: 'Pectoraux',
  Shoulders: 'Épaules',
  Abdominals: 'Abdominaux',
  Abductors: 'Abducteurs',
  Adductors: 'Adducteurs',
  Biceps: 'Biceps',
  Calves: 'Mollets',
  Forearms: 'Avant-bras',
  Glutes: 'Fessiers',
  Hamstrings: 'Ischio-jambiers',
  Lats: 'Dorsaux',
  'Lower back': 'Bas du dos',
  'Middle back': 'Milieu du dos',
  Neck: 'Cou',
  Quadriceps: 'Quadriceps',
  Traps: 'Trapèzes',
  Triceps: 'Triceps',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  // Normalized keys (app-internal)
  Barbell: 'Barre',
  Dumbbell: 'Haltère',
  Machine: 'Machine',
  Cables: 'Câbles',
  Bodyweight: 'Corps libre',
  Kettlebell: 'Kettlebell',
  'Smith Machine': 'Smith Machine',
  'EZ Bar': 'Barre EZ',
  // Raw dataset values
  Cable: 'Câbles',
  'Body only': 'Corps libre',
  Body: 'Corps libre',
  Kettlebells: 'Kettlebell',
  'E-z curl bar': 'Barre EZ',
  Bands: 'Élastiques',
  'Exercise ball': 'Ballon',
  'Foam roll': 'Rouleau',
  'Medicine ball': 'Médecine-ball',
  Other: 'Autre',
};

export const SET_TYPE_LABELS: Record<string, string> = {
  normal: 'Normal',
  warmup: 'Échauffement',
  dropset: 'Drop Set',
  failure: 'Échec',
};

/** Abbreviated labels for narrow UI (type pills in set rows) */
export const SET_TYPE_SHORT: Record<string, string> = {
  normal: 'Nrm',
  warmup: 'Chauf',
  dropset: 'Drop',
  failure: 'Échec',
};

export function translateMuscle(muscle: string): string {
  return MUSCLE_LABELS[muscle] ?? muscle;
}

export function translateEquipment(equipment: string): string {
  return EQUIPMENT_LABELS[equipment] ?? equipment;
}

export function translateSetType(setType: string): string {
  return SET_TYPE_LABELS[setType] ?? setType;
}
