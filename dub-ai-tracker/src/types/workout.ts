// Workout and Fitness types for DUB_AI Tracker
// Simplified for v1.1: 25-activity library, no separate strength logger

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
  compendium_code: string | null; // activity ID from activities.ts (or legacy compendium code)
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

export interface StepsEntry {
  total_steps: number;
  active_minutes: number | null;
  distance: number | null;
  distance_unit: 'miles' | 'km' | null;
  calories_burned: number | null;
  source: 'manual' | 'apple_health' | 'google_health_connect';
}
