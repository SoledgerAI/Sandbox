// DUB_AI Tracker -- Full Type Definitions
// Phase 2: Type System and Storage Layer
// Barrel file re-exporting all type modules + remaining entry types

// Re-export all type modules
export * from './profile';
export * from './tags';
export * from './food';
export * from './workout';
export * from './strength';
export * from './coach';
export * from './marketplace';

// ============================================================
// Remaining entry types referenced in Section 7 (AsyncStorage keys)
// and Section 10 (Tag System) that don't belong in a sub-module
// ============================================================

// -- HYDRATION --

export type BeverageType = 'water' | 'tea' | 'coffee' | 'juice' | 'sparkling' | 'other';

export interface WaterEntry {
  id: string;
  timestamp: string; // ISO datetime
  amount_oz: number;
  beverage?: BeverageType; // defaults to 'water' for backward compat
  notes: string | null;
}

export interface CaffeineEntry {
  id: string;
  timestamp: string; // ISO datetime
  amount_mg: number;
  source: string; // e.g., "coffee", "espresso", "tea", "soda", "energy drink", "custom"
  notes: string | null;
}

// -- BODY --

export interface BodyEntry {
  weight_lbs: number | null;
  body_fat_pct: number | null;
  measurements: BodyMeasurements | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  resting_hr: number | null;
  hrv_ms: number | null;
  spo2_pct: number | null;
  timestamp: string; // ISO datetime
}

export interface BodyMeasurements {
  neck: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  bicep_left: number | null;
  bicep_right: number | null;
  thigh_left: number | null;
  thigh_right: number | null;
  calf_left: number | null;
  calf_right: number | null;
}

export type ProgressPhotoType =
  | 'front_relaxed'
  | 'front_flexed'
  | 'side_left'
  | 'side_right'
  | 'back_relaxed'
  | 'back_flexed'
  | 'custom';

export interface ProgressPhoto {
  photo_uri: string;
  photo_type: ProgressPhotoType;
  timestamp: string; // ISO datetime
  body_weight: number | null;
  body_fat_pct: number | null;
  notes: string | null;
}

// -- SLEEP --

export interface SleepEntry {
  bedtime: string | null; // ISO datetime
  wake_time: string | null; // ISO datetime
  quality: number | null; // 1-5 scale
  bathroom_trips: number | null;
  alarm_used: boolean | null;
  time_to_fall_asleep_min: number | null;
  notes: string | null;
  device_data: SleepDeviceData | null;
}

export interface SleepDeviceData {
  deep_minutes: number | null;
  light_minutes: number | null;
  rem_minutes: number | null;
  awake_minutes: number | null;
  hrv_during_sleep: number | null;
  spo2_during_sleep: number | null;
  respiratory_rate: number | null;
}

// -- MENTAL WELLNESS --

export interface MoodEntry {
  id: string;
  timestamp: string; // ISO datetime
  score: number; // 1-5 mood scale ("very low" ↔ "great")
  /** 1-5 energy scale ("exhausted" ↔ "energized"). Null for pre-migration entries. */
  energy: number | null;
  /** 1-5 anxiety scale ("calm" ↔ "very anxious"). Null for pre-migration entries. */
  anxiety: number | null;
  note: string | null;
}

export interface GratitudeEntry {
  id: string;
  timestamp: string; // ISO datetime
  items: string[]; // 1-3 items
}

export interface MeditationEntry {
  duration_minutes: number;
  type: 'guided' | 'unguided' | 'breathing' | 'body_scan';
  timestamp: string; // ISO datetime
  notes: string | null;
}

export type StressTrigger = 'work' | 'relationships' | 'health' | 'finance' | 'family' | 'other';

export interface StressEntry {
  id: string;
  timestamp: string; // ISO datetime
  score: number; // 1-10 scale
  trigger: StressTrigger | null;
  notes: string | null;
}

export type TherapyType = 'individual' | 'couples' | 'group' | 'psychiatry';

export interface TherapyEntry {
  session_logged: boolean;
  therapist_name: string | null;
  type: TherapyType | null;
  notes: string | null; // MAXIMALLY PRIVATE -- never exported, never sent to Coach
  timestamp: string; // ISO datetime
}

// -- SUPPLEMENTS --

// P1-20: Predefined side effect labels for medications
export type SideEffectLabel =
  | 'Nausea'
  | 'Dizziness'
  | 'Headache'
  | 'Fatigue'
  | 'Insomnia'
  | 'Appetite change'
  | 'Mood change'
  | 'Other';

export const SIDE_EFFECT_OPTIONS: SideEffectLabel[] = [
  'Nausea', 'Dizziness', 'Headache', 'Fatigue',
  'Insomnia', 'Appetite change', 'Mood change', 'Other',
];

export interface SideEffectEntry {
  labels: SideEffectLabel[];
  other_text: string | null;
  timestamp: string;
  medication_id: string;
  medication_name: string;
}

export interface SupplementEntry {
  id: string;
  timestamp: string; // ISO datetime
  name: string;
  dosage: number;
  unit: string;
  taken: boolean;
  category: 'vitamin' | 'medication' | 'supplement';
  notes: string | null;
  side_effects: SideEffectEntry | null; // P1-20
}

// -- SUBSTANCES --

export type SubstanceType = 'alcohol' | 'cannabis' | 'tobacco' | 'caffeine';

export type AlcoholType = 'beer' | 'wine' | 'liquor' | 'cocktail';

export type CannabisMethod = 'smoked' | 'vaped' | 'edible' | 'topical' | 'beverage';

export interface SubstanceEntry {
  id: string;
  timestamp: string; // ISO datetime
  substance: SubstanceType;
  amount: number;
  unit: string;
  alcohol_type: AlcoholType | null;
  cannabis_method: CannabisMethod | null;
  thc_mg: number | null;
  cbd_mg: number | null;
  calories: number | null;
  notes: string | null;
}

// -- SEXUAL ACTIVITY --

export interface SexualEntry {
  id: string;
  timestamp: string; // ISO datetime
  duration_minutes: number;
  intensity: 'light' | 'moderate' | 'vigorous';
  compendium_code: string; // 14010, 14020, or 14030
  met_value: number; // 5.8, 3.0, or 1.8
  calories_burned: number;
}

// -- WOMEN'S HEALTH --

export type FlowLevel = 'light' | 'medium' | 'heavy' | 'spotting';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export type PeriodSymptom = 'cramps' | 'bloating' | 'headache' | 'fatigue' | 'mood_changes';

export interface CycleEntry {
  period_start: string | null; // ISO date
  flow_level: FlowLevel | null;
  symptoms: PeriodSymptom[];
  computed_phase: CyclePhase | null;
  cycle_day: number | null;
  notes: string | null;
}

// -- DIGESTIVE HEALTH --

export type BristolStoolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DigestiveEntry {
  id: string;
  timestamp: string; // ISO datetime
  bristol_type: BristolStoolType;
  notes: string | null;
}

// -- PERSONAL CARE --

export interface PersonalCareEntry {
  brush_teeth_am: boolean;
  brush_teeth_pm: boolean;
  floss: boolean;
  mouthwash: boolean;
  shower: boolean;
  skincare_am: boolean;
  skincare_am_detail: string | null;
  skincare_pm: boolean;
  skincare_pm_detail: string | null;
  sunscreen: boolean;
  grooming: boolean;
  grooming_notes: string | null;
  handwashing_count: number;
}

// -- INJURY --

export interface InjuryEntry {
  id: string;
  body_location: string;
  severity: number; // 1-10
  type: 'acute' | 'chronic' | 'recurring';
  description: string;
  aggravators: string[];
  onset_date: string; // ISO date
  resolved_date: string | null; // ISO date, null if ongoing
}

// -- HEALTH MARKERS / BLOODWORK --

export interface BloodworkMarker {
  name: string;
  value: number;
  unit: string;
  reference_range_low: number | null;
  reference_range_high: number | null;
  flagged: boolean;
}

export interface BloodworkEntry {
  date: string; // ISO date
  lab_name: string | null;
  markers: BloodworkMarker[];
  notes: string | null;
}

export interface DexaEntry {
  date: string;
  total_body_fat_pct: number;
  lean_mass_lbs: number;
  bone_density_t_score: number | null;
  facility: string | null;
}

// -- BLOOD GLUCOSE --

export type GlucoseTiming =
  | 'fasting'
  | 'before_meal'
  | '1hr_after_meal'
  | '2hr_after_meal'
  | 'before_exercise'
  | 'after_exercise'
  | 'bedtime'
  | 'other';

export interface GlucoseEntry {
  id: string;
  timestamp: string; // ISO datetime
  reading_mg_dl: number;
  timing: GlucoseTiming;
  linked_food_entry_id: string | null;
  notes: string | null;
}

// -- BLOOD PRESSURE --

export type BPPosition = 'sitting' | 'standing' | 'lying_down';

export type BPArm = 'left' | 'right';

export type BPTiming =
  | 'morning_before_meds'
  | 'morning_after_meds'
  | 'afternoon'
  | 'evening'
  | 'before_exercise'
  | 'after_exercise';

export interface BloodPressureEntry {
  id: string;
  timestamp: string; // ISO datetime
  systolic: number;
  diastolic: number;
  pulse_bpm: number | null;
  position: BPPosition | null;
  arm: BPArm | null;
  timing: BPTiming | null;
  notes: string | null;
}

// -- CUSTOM TAG --

export interface CustomEntry {
  id: string;
  tag_id: string;
  timestamp: string; // ISO datetime
  value: string | number | boolean;
  notes: string | null;
}

// -- AGGREGATES --

export interface DailySummary {
  date: string; // YYYY-MM-DD
  calories_consumed: number;
  calories_burned: number;
  calories_net: number;
  calories_remaining: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  water_oz: number;
  caffeine_mg: number;
  steps: number;
  active_minutes: number;
  sleep_hours: number | null;
  sleep_quality: number | null;
  mood_avg: number | null;
  energy_avg: number | null;
  anxiety_avg: number | null;
  weight_lbs: number | null;
  glucose_avg_mg_dl: number | null;
  bp_systolic_avg: number | null;
  bp_diastolic_avg: number | null;
  tags_logged: string[];
  recovery_score: number | null;
}

export interface WeeklySummary {
  week: string; // YYYY-WW
  start_date: string;
  end_date: string;
  avg_calories_consumed: number;
  avg_calories_burned: number;
  avg_protein_g: number;
  avg_carbs_g: number;
  avg_fat_g: number;
  avg_water_oz: number;
  avg_sleep_hours: number | null;
  avg_mood: number | null;
  avg_energy: number | null;
  avg_anxiety: number | null;
  avg_weight: number | null;
  weight_change: number | null;
  workout_count: number;
  days_logged: number;
  adherence_pct: number;
}

export interface RecoveryScore {
  date: string; // YYYY-MM-DD
  total_score: number; // 0-100
  components: RecoveryScoreComponent[];
  sufficient_data: boolean;
}

export interface RecoveryScoreComponent {
  name: string;
  weight: number;
  raw_score: number; // 0-100
  weighted_score: number;
  has_data: boolean;
}

// -- OFFLINE QUEUE --

export type OfflineAction = 'create' | 'update' | 'delete';

export interface OfflineQueueItem {
  id: string;
  action: OfflineAction;
  storage_key: string;
  data: unknown;
  timestamp: string; // ISO datetime
  retries: number;
}

// -- FASTING --

export type FastingProtocol = '16:8' | '18:6' | '20:4' | 'custom';

export interface FastingEntry {
  id: string;
  start_time: string; // ISO datetime
  target_duration_hours: number;
  protocol: FastingProtocol;
  end_time: string | null; // ISO datetime, null if still fasting
  completed: boolean;
}
