// Profile types for DUB_AI Tracker
// Phase 2: Type System and Storage Layer

export type EngagementTier = 'precision' | 'structured' | 'balanced' | 'flexible' | 'mindful';

export type GoalDirection = 'LOSE' | 'GAIN' | 'MAINTAIN';

// 'prefer_not_to_say' retained for backward compat with existing stored profiles
export type BiologicalSex = 'male' | 'female' | 'intersex' | 'prefer_not_to_say';

export type Pronouns = 'she_her' | 'he_him' | 'they_them' | 'prefer_not_to_say';

// For intersex users: which Mifflin-St Jeor constants to use for BMR
export type MetabolicProfile = 'male' | 'female';

export type MainGoal = 'lose_weight' | 'gain_muscle' | 'get_healthier' | 'track_condition' | 'support_recovery';

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
  pronouns: Pronouns | null;
  metabolic_profile: MetabolicProfile | null; // set when sex is 'intersex'
  main_goal: MainGoal | null;
  height_inches: number | null; // stored in inches regardless of unit pref
  weight_lbs: number | null; // stored in lbs regardless of unit pref
  activity_level: ActivityLevel | null;
  goal: WeightGoal | null;
  altitude_acclimated: boolean;
  custom_tdee?: number | null;
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
  hide_calories: boolean;
  consent_date: string | null;
  consent_version: string | null;
  day_boundary_hour?: number | null; // DEPRECATED (F-08): always midnight. Kept for storage compat.
  // Fasting / eating window settings
  fasting_enabled?: boolean;
  fasting_protocol?: '16:8' | '18:6' | '20:4' | 'custom';
  eating_window_start?: number; // hour (0-23), e.g. 12 for noon
  eating_window_end?: number;   // hour (0-23), e.g. 20 for 8pm
  // Per-category celebration toggles
  celebrations_weight?: boolean;
  celebrations_streaks?: boolean;
  celebrations_prs?: boolean;
  // Population norm comparison
  show_population_comparison?: boolean; // default: false
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_days_logged: number;
  last_logged_date: string | null; // ISO date
  logged_dates_28d: string[]; // ISO date strings within the rolling 28-day window
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
