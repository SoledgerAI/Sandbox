// Strength training types -- per-set tracking with quick-log and detailed modes
// Wave 2 P1: Workout Quick-Log

export interface StrengthSet {
  set_number: number;
  weight_lbs: number;
  reps: number;
  rpe: number | null; // 1-10, null in quick-log mode
}

export interface StrengthExercise {
  id: string;
  name: string;
  sets: StrengthSet[];
}

export type StrengthLogMode = 'quick' | 'detailed';

export interface StrengthEntry {
  id: string;
  timestamp: string; // ISO datetime
  exercises: StrengthExercise[];
  mode: StrengthLogMode;
  duration_minutes: number | null;
  notes: string | null;
}
