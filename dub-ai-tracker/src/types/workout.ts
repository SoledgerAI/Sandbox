// Workout and Fitness types for DUB_AI Tracker
// Phase 2: Type System and Storage Layer
// Per Section 10: Fitness and Strength Training

export type IntensityLevel = 'light' | 'moderate' | 'vigorous';

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export interface HeartRateZoneData {
  zone: HeartRateZone;
  minutes: number;
}

export interface EnvironmentalFields {
  elevation_gain_ft: number | null;
  elevation_loss_ft: number | null;
  altitude_ft: number | null;
  temperature_f: number | null;
}

export interface BiometricFields {
  avg_heart_rate_bpm: number | null;
  max_heart_rate_bpm: number | null;
  heart_rate_zones: HeartRateZoneData[] | null;
}

export interface WorkoutEntry {
  id: string;
  timestamp: string; // ISO datetime
  activity_name: string;
  compendium_code: string | null; // 5-digit MET compendium code
  met_value: number;
  duration_minutes: number;
  intensity: IntensityLevel;
  calories_burned: number; // MET x weight_kg x duration_hours
  distance: number | null;
  distance_unit: 'miles' | 'km' | 'meters' | 'yards' | null;
  environmental: EnvironmentalFields;
  biometric: BiometricFields;
  notes: string | null;
  source: 'manual' | 'strava' | 'apple_health' | 'google_health_connect';
}

export interface ExerciseSet {
  set_number: number;
  weight: number;
  weight_unit: 'lbs' | 'kg';
  reps: number;
  rpe: number | null; // 1-10
  rest_seconds: number | null;
  notes: string | null;
  is_warmup: boolean;
  is_pr: boolean;
}

export interface StrengthExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_groups: string[]; // primary + secondary
  equipment: string;
  sets: ExerciseSet[];
  total_volume: number; // sum of weight x reps across working sets
}

export interface StrengthSession {
  id: string;
  timestamp: string; // ISO datetime
  name: string | null; // e.g., "Push Day", "Upper Body"
  exercises: StrengthExercise[];
  duration_minutes: number | null;
  calories_burned: number | null;
  notes: string | null;
  template_id: string | null;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: Omit<StrengthExercise, 'sets' | 'total_volume'>[];
  created_at: string;
  last_used: string | null;
}

export interface PersonalRecord {
  exercise_id: string;
  exercise_name: string;
  type: '1rm_estimated' | 'max_weight' | 'max_reps';
  value: number;
  weight: number | null;
  reps: number | null;
  date: string; // ISO date
}

export interface StepsEntry {
  total_steps: number;
  active_minutes: number | null;
  distance: number | null;
  distance_unit: 'miles' | 'km' | null;
  calories_burned: number | null;
  source: 'manual' | 'apple_health' | 'google_health_connect';
}
