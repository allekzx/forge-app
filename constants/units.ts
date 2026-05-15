const KG_TO_LBS = 2.20462;

export type WeightUnit = 'kg' | 'lbs';

export function kgToDisplay(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null || !isFinite(kg)) return '—';
  if (unit === 'lbs') return (kg * KG_TO_LBS).toFixed(1);
  return kg.toFixed(1);
}

export function displayToKg(val: string, unit: WeightUnit): number {
  const n = parseFloat(val.replace(',', '.'));
  if (isNaN(n) || n < 0) return 0;
  return unit === 'lbs' ? n / KG_TO_LBS : n;
}

export function unitLabel(unit: WeightUnit): string {
  return unit === 'lbs' ? 'lbs' : 'kg';
}
