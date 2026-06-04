import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROGRAMS, Program, ProgramDay } from '@/constants/programs';

const STORAGE_KEY = '@active_program_id';
const CUSTOM_SCHEDULE_PREFIX = '@custom_schedule_';

export async function getActiveProgram(): Promise<Program | null> {
  try {
    const id = await AsyncStorage.getItem(STORAGE_KEY);
    return id ? (PROGRAMS.find(p => p.id === id) ?? null) : null;
  } catch {
    return null;
  }
}

export async function setActiveProgram(program: Program | null): Promise<void> {
  if (program) {
    await AsyncStorage.setItem(STORAGE_KEY, program.id);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export async function getCustomSchedule(programId: string): Promise<(ProgramDay | null)[] | null> {
  try {
    const json = await AsyncStorage.getItem(CUSTOM_SCHEDULE_PREFIX + programId);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function saveCustomSchedule(programId: string, schedule: (ProgramDay | null)[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOM_SCHEDULE_PREFIX + programId, JSON.stringify(schedule));
  } catch {
    // ignore
  }
}
