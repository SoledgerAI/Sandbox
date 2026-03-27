// Profile types for DUB_AI Tracker
// Phase 2: Type System and Storage Layer

export type EngagementTier = 'precision' | 'structured' | 'balanced' | 'flexible' | 'mindful';

export type GoalDirection = 'LOSE' | 'GAIN' | 'MAINTAIN';

export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_say';

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';

export type UnitPreference = 'imperial' | 'metric';

export type GainType = 'lean' | 'standard' | 'aggressive';

export type WeightLossRate = 0.5 | 1.0 | 1.5 | 2.0;

export interface WeightGoal {
  direction: GoalDirection;
  target_weight: number | null;
  rate_lbs_per_week: WeightLossRate | null;
  gain_type: GainType | null;
  surplus_calories: number | null;
}

export interface UserProfile {
  name: string;
  dob: string; // ISO date string
  units: UnitPreference;
  sex: BiologicalSex | null;
  height_inches: number | null; // stored in inches regardless of unit pref
  weight_lbs: number | null; // stored in lbs regardless of unit pref
  activity_level: ActivityLevel | null;
  goal: WeightGoal | null;
  altitude_acclimated: boolean;
}

export interface ConsentRecord {
  consent_date: string; // ISO date
  consent_version: string;
  health_data_consent: boolean;
  third_party_ai_consent: boolean;
  age_verification: boolean;
}

export interface AppSettings {
  units: UnitPreference;
  notification_enabled: boolean;
  notification_cadence: number | null;
  eod_questionnaire_time: string | null; // HH:MM format
  privacy_screen_enabled: boolean;
  consent_date: string | null;
  consent_version: string | null;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_days_logged: number;
  last_logged_date: string | null; // ISO date
}

export type SobrietyGoalType = 'reduce' | 'quit' | 'monitor';

export interface SobrietyGoal {
  substance: string;
  goal_type: SobrietyGoalType;
  sobriety_start_date: string | null; // ISO date
  current_streak_days: number;
  longest_streak_days: number;
  target_amount: number | null;
  target_frequency: string | null;
}

export interface DeviceSyncState {
  connected: boolean;
  last_sync: string | null; // ISO datetime
  access_token: string | null;
  refresh_token: string | null;
}
