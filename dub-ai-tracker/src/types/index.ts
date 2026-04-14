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

export type BeverageType =
  | 'water'
  | 'tea'
  | 'coffee'
  | 'juice'
  | 'sparkling'
  | 'energy_drink'
  | 'smoothie'
  | 'protein_shake'
  | 'soda'
  | 'milk'
  | 'other';

/** Beverages that do NOT count toward the daily hydration goal (caffeine/diuretic). */
export const NON_HYDRATING_BEVERAGES: BeverageType[] = [
  'coffee',
  'energy_drink',
  'soda',
  'protein_shake',
];

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

export type BodyMetricSource = 'manual' | 'apple_health' | 'google_health_connect' | 'garmin' | 'whoop' | 'oura';

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
  source?: BodyMetricSource;
  // Device readings stored when manual entry takes priority ("manual wins")
  device_weight_lbs?: number | null;
  device_resting_hr?: number | null;
  device_hrv_ms?: number | null;
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

export type SleepSource = 'manual' | 'apple_health' | 'google_health_connect' | 'oura' | 'whoop';

export type SleepDisturbance =
  | 'noise'
  | 'temperature'
  | 'pain_discomfort'
  | 'stress_racing_thoughts'
  | 'bathroom'
  | 'partner_pet_child'
  | 'nightmares'
  | 'sleep_apnea_snoring'
  | 'screen_time'
  | 'caffeine_alcohol'
  | 'other';

export const SLEEP_DISTURBANCE_OPTIONS: { value: SleepDisturbance; label: string }[] = [
  { value: 'noise', label: 'Noise' },
  { value: 'temperature', label: 'Temperature (too hot/cold)' },
  { value: 'pain_discomfort', label: 'Pain/discomfort' },
  { value: 'stress_racing_thoughts', label: 'Stress/racing thoughts' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'partner_pet_child', label: 'Partner/pet/child' },
  { value: 'nightmares', label: 'Nightmares' },
  { value: 'sleep_apnea_snoring', label: 'Sleep apnea/snoring' },
  { value: 'screen_time', label: 'Screen time before bed' },
  { value: 'caffeine_alcohol', label: 'Caffeine/alcohol' },
  { value: 'other', label: 'Other' },
];

export type SleepAid =
  | 'melatonin'
  | 'prescription_sleep_medication'
  | 'cbd_thc'
  | 'white_noise_sound_machine'
  | 'weighted_blanket'
  | 'breathing_exercises'
  | 'none'
  | 'other';

export const SLEEP_AID_OPTIONS: { value: SleepAid; label: string }[] = [
  { value: 'melatonin', label: 'Melatonin' },
  { value: 'prescription_sleep_medication', label: 'Prescription sleep medication' },
  { value: 'cbd_thc', label: 'CBD/THC' },
  { value: 'white_noise_sound_machine', label: 'White noise/sound machine' },
  { value: 'weighted_blanket', label: 'Weighted blanket' },
  { value: 'breathing_exercises', label: 'Breathing exercises' },
  { value: 'none', label: 'None' },
  { value: 'other', label: 'Other' },
];

export interface SleepEntry {
  bedtime: string | null; // ISO datetime
  wake_time: string | null; // ISO datetime
  quality: number | null; // 1-5 scale
  bathroom_trips: number | null;
  alarm_used: boolean | null;
  time_to_fall_asleep_min: number | null;
  notes: string | null;
  device_data: SleepDeviceData | null;
  source?: SleepSource;
  // Sprint 23 enhancements (all optional for backward compat)
  total_duration_hours?: number | null;
  wake_ups?: number | null; // 0-10 how many times woke during night
  disturbances?: SleepDisturbance[];
  disturbance_other_text?: string | null;
  sleep_aids_used?: SleepAid[];
  sleep_aid_other_text?: string | null;
  nap?: boolean | null;
  nap_duration_minutes?: number | null; // 5-180
}

export interface SleepDeviceData {
  deep_minutes: number | null;
  light_minutes: number | null;
  rem_minutes: number | null;
  awake_minutes: number | null;
  hrv_during_sleep: number | null;
  spo2_during_sleep: number | null;
  respiratory_rate: number | null;
  source?: 'apple_health' | 'google_health_connect' | 'oura' | 'whoop';
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

export type MeditationType =
  | 'guided'
  | 'unguided'
  | 'box_breathing'
  | 'body_scan'
  | 'loving_kindness'
  | 'custom';

export interface MeditationEntry {
  id: string;
  duration_minutes: number;
  type: MeditationType;
  custom_type: string | null; // free-text when type === 'custom'
  timestamp: string; // ISO datetime
  notes: string | null; // max 300 chars
}

// -- SOCIAL CONNECTION --

export type SocialConnectionType = 'in_person' | 'phone_call' | 'video_call' | 'group_activity';

export const SOCIAL_CONNECTION_TYPES: { value: SocialConnectionType; label: string; icon: string }[] = [
  { value: 'in_person', label: 'In Person', icon: 'people-outline' },
  { value: 'phone_call', label: 'Phone Call', icon: 'call-outline' },
  { value: 'video_call', label: 'Video Call', icon: 'videocam-outline' },
  { value: 'group_activity', label: 'Group Activity', icon: 'people-circle-outline' },
];

export interface SocialConnectionEntry {
  id: string;
  timestamp: string; // ISO datetime
  type: SocialConnectionType;
  who: string | null; // first name only, privacy
  duration_minutes: number;
  quality: number; // 1-5 (drained to energized)
  notes: string | null;
}

// -- SUNLIGHT / OUTDOORS --

export type SunlightActivityType =
  | 'walk'
  | 'hike'
  | 'yard_work'
  | 'outdoor_exercise'
  | 'just_outside'
  | 'custom';

export const SUNLIGHT_ACTIVITY_TYPES: { value: SunlightActivityType; label: string; icon: string }[] = [
  { value: 'walk', label: 'Walk', icon: 'walk-outline' },
  { value: 'hike', label: 'Hike', icon: 'trail-sign-outline' },
  { value: 'yard_work', label: 'Yard Work', icon: 'flower-outline' },
  { value: 'outdoor_exercise', label: 'Outdoor Exercise', icon: 'fitness-outline' },
  { value: 'just_outside', label: 'Just Outside', icon: 'sunny-outline' },
  { value: 'custom', label: 'Custom', icon: 'create-outline' },
];

export interface SunlightEntry {
  id: string;
  timestamp: string; // ISO datetime
  duration_minutes: number;
  type: SunlightActivityType;
  custom_type: string | null; // free-text when type === 'custom'
  nature: boolean; // park, trail, beach vs. parking lot, city sidewalk
}

// -- STRETCHING / MOBILITY --

export type MobilityType =
  | 'stretching'
  | 'foam_rolling'
  | 'yoga'
  | 'massage'
  | 'ice_bath'
  | 'sauna'
  | 'cold_shower'
  | 'custom';

export const MOBILITY_TYPES: { value: MobilityType; label: string; icon: string }[] = [
  { value: 'stretching', label: 'Stretching', icon: 'body-outline' },
  { value: 'foam_rolling', label: 'Foam Rolling', icon: 'ellipse-outline' },
  { value: 'yoga', label: 'Yoga', icon: 'leaf-outline' },
  { value: 'massage', label: 'Massage', icon: 'hand-left-outline' },
  { value: 'ice_bath', label: 'Ice Bath', icon: 'snow-outline' },
  { value: 'sauna', label: 'Sauna', icon: 'flame-outline' },
  { value: 'cold_shower', label: 'Cold Shower', icon: 'water-outline' },
  { value: 'custom', label: 'Custom', icon: 'create-outline' },
];

export type MobilityFocusArea =
  | 'upper_body'
  | 'lower_body'
  | 'back'
  | 'neck'
  | 'hips'
  | 'full_body';

export const MOBILITY_FOCUS_AREAS: { value: MobilityFocusArea; label: string }[] = [
  { value: 'upper_body', label: 'Upper Body' },
  { value: 'lower_body', label: 'Lower Body' },
  { value: 'back', label: 'Back' },
  { value: 'neck', label: 'Neck' },
  { value: 'hips', label: 'Hips' },
  { value: 'full_body', label: 'Full Body' },
];

export interface MobilityEntry {
  id: string;
  timestamp: string; // ISO datetime
  type: MobilityType;
  custom_type: string | null; // free-text when type === 'custom'
  duration_minutes: number;
  focus_areas: MobilityFocusArea[];
}

// -- JOURNAL --

export interface JournalEntry {
  id: string;
  timestamp: string; // ISO datetime
  text: string; // max 2000 chars
  mood_score: number | null; // 1-5, same scale as MoodEntry
  private: boolean; // default true — private entries excluded from Coach context and data export
}

// -- SLEEP SCHEDULE --

export interface SleepScheduleSettings {
  target_bedtime: string | null; // HH:MM 24-hour format, e.g. "22:30"
  target_wake_time: string | null; // HH:MM 24-hour format, e.g. "06:00"
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
  duration_minutes?: number | null;
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

export type SubstanceType = 'alcohol' | 'cannabis' | 'tobacco' | 'hemp' | 'caffeine';

export type AlcoholType = 'beer' | 'wine' | 'liquor' | 'cocktail';

export type CannabisMethod = 'smoked' | 'vaped' | 'edible' | 'topical' | 'beverage';

export type HempMethod = 'oil_tincture' | 'capsule' | 'topical' | 'edible' | 'flower';

export type CannabisTerpene =
  | 'myrcene'
  | 'limonene'
  | 'linalool'
  | 'pinene'
  | 'caryophyllene'
  | 'terpinolene'
  | 'humulene'
  | 'ocimene';

export interface SubstanceEntry {
  id: string;
  timestamp: string; // ISO datetime
  substance: SubstanceType;
  amount: number;
  unit: string;
  alcohol_type: AlcoholType | null;
  cannabis_method: CannabisMethod | null;
  hemp_method: HempMethod | null;
  thc_mg: number | null;
  cbd_mg: number | null;
  calories: number | null;
  notes: string | null;
  terpenes: CannabisTerpene[] | null;  // Cannabis terpene profile
  strain_name: string | null;          // Cannabis strain name
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

/** Legacy CycleEntry — pre-Sprint 24. Kept for backward compat in storage reads. */
export interface CycleEntry {
  period_start: string | null; // ISO date
  flow_level: FlowLevel | null;
  symptoms: PeriodSymptom[];
  computed_phase: CyclePhase | null;
  cycle_day: number | null;
  notes: string | null;
}

// Sprint 24: Enhanced Cycle Tracker

export type PeriodStatus = 'started' | 'ongoing' | 'ended' | 'spotting' | 'none';

/** 1-5 flow scale: light / medium / heavy / very heavy / flooding */
export type FlowScale = 1 | 2 | 3 | 4 | 5;

export type CrampSeverity = 'mild' | 'moderate' | 'severe';

export type CycleSymptom =
  | 'cramps'
  | 'bloating'
  | 'breast_tenderness'
  | 'headache'
  | 'back_pain'
  | 'fatigue'
  | 'acne'
  | 'mood_swings'
  | 'food_cravings'
  | 'insomnia'
  | 'nausea'
  | 'digestive_issues'
  | 'other';

export const CYCLE_SYMPTOM_OPTIONS: { value: CycleSymptom; label: string; icon: string }[] = [
  { value: 'cramps', label: 'Cramps', icon: 'flash-outline' },
  { value: 'bloating', label: 'Bloating', icon: 'water-outline' },
  { value: 'breast_tenderness', label: 'Breast Tenderness', icon: 'ellipse-outline' },
  { value: 'headache', label: 'Headache', icon: 'alert-circle-outline' },
  { value: 'back_pain', label: 'Back Pain', icon: 'body-outline' },
  { value: 'fatigue', label: 'Fatigue', icon: 'bed-outline' },
  { value: 'acne', label: 'Acne', icon: 'ellipsis-horizontal-circle-outline' },
  { value: 'mood_swings', label: 'Mood Swings', icon: 'happy-outline' },
  { value: 'food_cravings', label: 'Food Cravings', icon: 'restaurant-outline' },
  { value: 'insomnia', label: 'Insomnia', icon: 'moon-outline' },
  { value: 'nausea', label: 'Nausea', icon: 'medical-outline' },
  { value: 'digestive_issues', label: 'Diarrhea / Constipation', icon: 'fitness-outline' },
  { value: 'other', label: 'Other', icon: 'create-outline' },
];

export type CervicalMucusType = 'dry' | 'sticky' | 'creamy' | 'watery' | 'egg_white' | 'not_checked';

export const CERVICAL_MUCUS_OPTIONS: { value: CervicalMucusType; label: string }[] = [
  { value: 'dry', label: 'Dry' },
  { value: 'sticky', label: 'Sticky' },
  { value: 'creamy', label: 'Creamy' },
  { value: 'watery', label: 'Watery' },
  { value: 'egg_white', label: 'Egg White' },
  { value: 'not_checked', label: 'Not Checked' },
];

export type OvulationTestResult = 'positive' | 'negative' | 'not_taken';

export interface CycleEntryV2 {
  date: string; // YYYY-MM-DD
  period_status: PeriodStatus;
  flow_level: FlowScale | null; // only when period_status is started/ongoing
  symptoms: CycleSymptomEntry[];
  cervical_mucus: CervicalMucusType | null; // optional
  basal_body_temp: number | null; // optional, F or C based on user pref
  basal_body_temp_unit: 'F' | 'C' | null;
  intimacy: boolean | null; // optional, private — therapy firewall pattern
  ovulation_test: OvulationTestResult | null; // optional
  notes: string | null; // 500 char max
  // Backward compat: keep legacy fields for migration
  period_start?: string | null;
  computed_phase?: CyclePhase | null;
  cycle_day?: number | null;
}

export interface CycleSymptomEntry {
  symptom: CycleSymptom;
  severity: CrampSeverity | null; // only for 'cramps'
  other_text: string | null; // only for 'other'
}

export interface CyclePrediction {
  next_period_start: string; // YYYY-MM-DD
  fertile_window_start: string; // YYYY-MM-DD
  fertile_window_end: string; // YYYY-MM-DD
  average_cycle_length: number;
  average_period_duration: number;
  cycles_analyzed: number;
}

// Sprint 24: Notification Reminder Settings

export type WaterReminderInterval = 1 | 2 | 3;

export interface NotificationSettings {
  master_enabled: boolean;
  daily_logging: {
    enabled: boolean;
    time: string; // HH:MM
  };
  morning_checkin: {
    enabled: boolean;
    time: string; // HH:MM
  };
  medication_reminders: {
    enabled: boolean;
  };
  water_reminders: {
    enabled: boolean;
    interval_hours: WaterReminderInterval;
    start_time: string; // HH:MM
    end_time: string; // HH:MM
  };
  doctor_followup: {
    enabled: boolean;
  };
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

// -- DAILY HABITS --

export interface HabitDefinition {
  id: string;
  name: string;
  order: number;
}

export const DEFAULT_HABITS: Omit<HabitDefinition, 'id'>[] = [
  { name: 'Brush teeth (morning)', order: 0 },
  { name: 'Brush teeth (evening)', order: 1 },
  { name: 'Floss', order: 2 },
  { name: 'Make bed', order: 3 },
  { name: 'Face cream (morning)', order: 4 },
  { name: 'Face cream (evening)', order: 5 },
];

export interface HabitEntry {
  id: string;
  name: string;
  completed: boolean;
  completedAt: string | null; // ISO datetime, null if not completed
}

// -- BODYWEIGHT REPS --

export type BodyweightExerciseType =
  | 'pushups'
  | 'pullups'
  | 'situps'
  | 'jumping_jacks'
  | 'standing_squats';

export const BODYWEIGHT_EXERCISES: { type: BodyweightExerciseType; label: string; icon: string }[] = [
  { type: 'pushups', label: 'Push-ups', icon: 'body-outline' },
  { type: 'pullups', label: 'Pull-ups', icon: 'arrow-up-outline' },
  { type: 'situps', label: 'Sit-ups', icon: 'fitness-outline' },
  { type: 'jumping_jacks', label: 'Jumping Jacks', icon: 'walk-outline' },
  { type: 'standing_squats', label: 'Standing Squats', icon: 'chevron-down-circle-outline' },
];

export interface BodyweightRepEntry {
  id: string;
  timestamp: string; // ISO datetime
  exercise_type: BodyweightExerciseType;
  reps: number;
  sets: number; // default 1
  notes: string | null;
}

// -- DOCTOR VISITS --

export type DoctorVisitType =
  | 'general_physical'
  | 'psychiatrist'
  | 'therapist'
  | 'dentist'
  | 'dermatologist'
  | 'optometrist'
  | 'ob_gyn'
  | 'urgent_care'
  | 'specialist';

export const DOCTOR_VISIT_TYPES: { type: DoctorVisitType; label: string; icon: string; color: string }[] = [
  { type: 'general_physical', label: 'General / Physical', icon: 'medkit-outline', color: '#4CAF50' },
  { type: 'psychiatrist', label: 'Psychiatrist', icon: 'brain-outline', color: '#7E57C2' },
  { type: 'therapist', label: 'Therapist', icon: 'chatbubbles-outline', color: '#42A5F5' },
  { type: 'dentist', label: 'Dentist', icon: 'happy-outline', color: '#26C6DA' },
  { type: 'dermatologist', label: 'Dermatologist', icon: 'hand-left-outline', color: '#FF7043' },
  { type: 'optometrist', label: 'Optometrist', icon: 'eye-outline', color: '#5C6BC0' },
  { type: 'ob_gyn', label: 'OB-GYN', icon: 'flower-outline', color: '#EC407A' },
  { type: 'urgent_care', label: 'Urgent Care / Sick Visit', icon: 'alert-circle-outline', color: '#EF5350' },
  { type: 'specialist', label: 'Specialist', icon: 'person-outline', color: '#FFA726' },
];

export interface DoctorVisitEntry {
  id: string;
  timestamp: string; // ISO datetime (when entry was created)
  visit_type: DoctorVisitType;
  visit_date: string; // ISO date (YYYY-MM-DD)
  doctor_name: string | null;
  location: string | null;
  notes: string | null; // max 500 chars
  follow_up_date: string | null; // ISO date (YYYY-MM-DD)
  specialist_type: string | null; // free-text, only when visit_type === 'specialist'
}

// -- ALLERGY TRACKING --

export type AllergySeverity = 'none' | 'mild' | 'moderate' | 'severe';

export const ALLERGY_SEVERITY_OPTIONS: { value: AllergySeverity; label: string; color: string }[] = [
  { value: 'none', label: 'None', color: '#4CAF50' },
  { value: 'mild', label: 'Mild', color: '#D4A843' },
  { value: 'moderate', label: 'Moderate', color: '#FF9800' },
  { value: 'severe', label: 'Severe', color: '#EF5350' },
];

export type AllergySymptom =
  | 'congestion'
  | 'sneezing'
  | 'itchy_eyes'
  | 'headache'
  | 'fatigue'
  | 'skin_reaction'
  | 'breathing_difficulty';

export const ALLERGY_SYMPTOM_OPTIONS: { value: AllergySymptom; label: string }[] = [
  { value: 'congestion', label: 'Congestion' },
  { value: 'sneezing', label: 'Sneezing' },
  { value: 'itchy_eyes', label: 'Itchy Eyes' },
  { value: 'headache', label: 'Headache' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'skin_reaction', label: 'Skin Reaction' },
  { value: 'breathing_difficulty', label: 'Breathing Difficulty' },
];

export interface AllergyLogEntry {
  id: string;
  timestamp: string; // ISO datetime
  severity: AllergySeverity;
  symptoms: AllergySymptom[];
  medication_taken: boolean;
  medication_name: string | null; // free-text, e.g. "Zyrtec, Flonase"
  notes: string | null;
}

// -- PERIMENOPAUSE --

export type PerimenopauseSeverity = 'mild' | 'moderate' | 'severe';

export type JointPainArea =
  | 'hands'
  | 'knees'
  | 'hips'
  | 'shoulders'
  | 'back'
  | 'feet'
  | 'general';

export const JOINT_PAIN_AREAS: { value: JointPainArea; label: string }[] = [
  { value: 'hands', label: 'Hands' },
  { value: 'knees', label: 'Knees' },
  { value: 'hips', label: 'Hips' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'back', label: 'Back' },
  { value: 'feet', label: 'Feet' },
  { value: 'general', label: 'General' },
];

export interface HotFlashEntry {
  severity: PerimenopauseSeverity;
}

export interface PerimenopauseEntry {
  id: string;
  timestamp: string; // ISO datetime
  date: string; // YYYY-MM-DD
  hot_flashes_count: number; // 0-20
  hot_flashes: HotFlashEntry[]; // severity per flash
  night_sweats: boolean;
  night_sweats_severity: PerimenopauseSeverity | null; // null if no night sweats
  mood_shifts: number; // 1-5 (stable to highly variable)
  sleep_disruption: number; // 1-5 (none to severe)
  brain_fog: number; // 1-5 (clear to severe)
  joint_pain: number; // 1-5 (none to severe)
  joint_pain_areas: JointPainArea[];
  cycle_irregularity_days: number | null; // days since last period (manual or auto)
  energy_level: number; // 1-5 (exhausted to energized)
  notes: string | null; // max 500 chars
}

// -- BREASTFEEDING --

export type BreastfeedingType = 'nursing' | 'pumping' | 'bottle';

export type NursingSide = 'left' | 'right' | 'both';

export type VolumeUnit = 'oz' | 'ml';

export interface BreastfeedingEntry {
  id: string;
  timestamp: string; // ISO datetime
  type: BreastfeedingType;
  side: NursingSide | null; // only for nursing
  duration_minutes: number; // 1-120
  output_amount: number | null; // oz or ml (pumping)
  output_unit: VolumeUnit | null;
  bottle_amount: number | null; // oz or ml (bottle)
  bottle_unit: VolumeUnit | null;
  timer_start: string | null; // ISO datetime, for running timer
  timer_end: string | null; // ISO datetime
  notes: string | null; // max 300 chars
}

// -- MIGRAINE --

export type MigraineSymptom =
  | 'throbbing_pulsating'
  | 'aura'
  | 'light_sensitivity'
  | 'sound_sensitivity'
  | 'nausea_vomiting'
  | 'dizziness'
  | 'neck_stiffness'
  | 'brain_fog'
  | 'tingling_numbness'
  | 'eye_pain'
  | 'other';

export const MIGRAINE_SYMPTOM_OPTIONS: { value: MigraineSymptom; label: string }[] = [
  { value: 'throbbing_pulsating', label: 'Throbbing/pulsating pain' },
  { value: 'aura', label: 'Aura (visual disturbances)' },
  { value: 'light_sensitivity', label: 'Light sensitivity' },
  { value: 'sound_sensitivity', label: 'Sound sensitivity' },
  { value: 'nausea_vomiting', label: 'Nausea/vomiting' },
  { value: 'dizziness', label: 'Dizziness' },
  { value: 'neck_stiffness', label: 'Neck stiffness' },
  { value: 'brain_fog', label: 'Brain fog' },
  { value: 'tingling_numbness', label: 'Tingling/numbness' },
  { value: 'eye_pain', label: 'Eye pain' },
  { value: 'other', label: 'Other' },
];

export type MigraineHeadLocation =
  | 'left_side'
  | 'right_side'
  | 'front_forehead'
  | 'back_of_head'
  | 'behind_eyes'
  | 'all_over';

export const MIGRAINE_HEAD_LOCATION_OPTIONS: { value: MigraineHeadLocation; label: string }[] = [
  { value: 'left_side', label: 'Left side' },
  { value: 'right_side', label: 'Right side' },
  { value: 'front_forehead', label: 'Front/forehead' },
  { value: 'back_of_head', label: 'Back of head' },
  { value: 'behind_eyes', label: 'Behind eyes' },
  { value: 'all_over', label: 'All over' },
];

export type MigraineTrigger =
  | 'stress'
  | 'poor_sleep'
  | 'skipped_meal'
  | 'weather_barometric'
  | 'bright_lights'
  | 'strong_smells'
  | 'alcohol'
  | 'caffeine'
  | 'hormonal_changes'
  | 'exercise_exertion'
  | 'certain_foods'
  | 'medication_overuse'
  | 'other';

export const MIGRAINE_TRIGGER_OPTIONS: { value: MigraineTrigger; label: string }[] = [
  { value: 'stress', label: 'Stress' },
  { value: 'poor_sleep', label: 'Poor sleep / sleep change' },
  { value: 'skipped_meal', label: 'Skipped meal / dehydration' },
  { value: 'weather_barometric', label: 'Weather / barometric pressure change' },
  { value: 'bright_lights', label: 'Bright lights / screens' },
  { value: 'strong_smells', label: 'Strong smells' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'caffeine', label: 'Caffeine (too much or withdrawal)' },
  { value: 'hormonal_changes', label: 'Hormonal changes' },
  { value: 'exercise_exertion', label: 'Exercise / physical exertion' },
  { value: 'certain_foods', label: 'Certain foods' },
  { value: 'medication_overuse', label: 'Medication overuse' },
  { value: 'other', label: 'Other' },
];

export interface MigraineEntry {
  id: string;
  timestamp: string; // ISO datetime
  date: string; // YYYY-MM-DD
  occurred: boolean;
  start_time: string | null;
  end_time: string | null;
  total_duration_minutes: number | null;
  severity: number | null; // 1-10
  symptoms: MigraineSymptom[];
  symptom_other_text: string | null;
  location_on_head: MigraineHeadLocation[];
  triggers: MigraineTrigger[];
  trigger_other_text: string | null;
  zip_code: string | null;
  medication_taken: boolean;
  medication_name: string | null;
  medication_time: string | null;
  relief_rating: number | null; // 1-5
  notes: string | null; // max 500 chars
}

// -- MOOD & MENTAL HEALTH --

export type MoodEmotion =
  | 'happy' | 'grateful' | 'calm' | 'confident' | 'motivated'
  | 'sad' | 'anxious' | 'irritable' | 'overwhelmed' | 'lonely'
  | 'angry' | 'hopeless' | 'numb' | 'restless' | 'fearful';

export const MOOD_EMOTION_OPTIONS: { value: MoodEmotion; label: string; valence: 'positive' | 'negative' }[] = [
  { value: 'happy', label: 'Happy', valence: 'positive' },
  { value: 'grateful', label: 'Grateful', valence: 'positive' },
  { value: 'calm', label: 'Calm', valence: 'positive' },
  { value: 'confident', label: 'Confident', valence: 'positive' },
  { value: 'motivated', label: 'Motivated', valence: 'positive' },
  { value: 'sad', label: 'Sad', valence: 'negative' },
  { value: 'anxious', label: 'Anxious', valence: 'negative' },
  { value: 'irritable', label: 'Irritable', valence: 'negative' },
  { value: 'overwhelmed', label: 'Overwhelmed', valence: 'negative' },
  { value: 'lonely', label: 'Lonely', valence: 'negative' },
  { value: 'angry', label: 'Angry', valence: 'negative' },
  { value: 'hopeless', label: 'Hopeless', valence: 'negative' },
  { value: 'numb', label: 'Numb', valence: 'negative' },
  { value: 'restless', label: 'Restless', valence: 'negative' },
  { value: 'fearful', label: 'Fearful', valence: 'negative' },
];

export type MoodTrigger =
  | 'work_career'
  | 'relationship_issues'
  | 'financial_stress'
  | 'health_concerns'
  | 'poor_sleep'
  | 'social_isolation'
  | 'family_conflict'
  | 'major_life_change'
  | 'grief_loss'
  | 'weather_seasonal'
  | 'hormonal_changes'
  | 'substance_use'
  | 'news_world_events'
  | 'other';

export const MOOD_TRIGGER_OPTIONS: { value: MoodTrigger; label: string }[] = [
  { value: 'work_career', label: 'Work/career stress' },
  { value: 'relationship_issues', label: 'Relationship issues' },
  { value: 'financial_stress', label: 'Financial stress' },
  { value: 'health_concerns', label: 'Health concerns' },
  { value: 'poor_sleep', label: 'Poor sleep' },
  { value: 'social_isolation', label: 'Social isolation' },
  { value: 'family_conflict', label: 'Family conflict' },
  { value: 'major_life_change', label: 'Major life change' },
  { value: 'grief_loss', label: 'Grief/loss' },
  { value: 'weather_seasonal', label: 'Weather/seasonal' },
  { value: 'hormonal_changes', label: 'Hormonal changes' },
  { value: 'substance_use', label: 'Substance use' },
  { value: 'news_world_events', label: 'News/world events' },
  { value: 'other', label: 'Other' },
];

export type CopingStrategy =
  | 'exercise'
  | 'meditation_breathing'
  | 'talked_to_someone'
  | 'journaling'
  | 'time_outdoors'
  | 'music_art'
  | 'professional_support'
  | 'rest_sleep'
  | 'other';

export const COPING_STRATEGY_OPTIONS: { value: CopingStrategy; label: string }[] = [
  { value: 'exercise', label: 'Exercise' },
  { value: 'meditation_breathing', label: 'Meditation/breathing' },
  { value: 'talked_to_someone', label: 'Talked to someone' },
  { value: 'journaling', label: 'Journaling' },
  { value: 'time_outdoors', label: 'Time outdoors' },
  { value: 'music_art', label: 'Music/art' },
  { value: 'professional_support', label: 'Professional support' },
  { value: 'rest_sleep', label: 'Rest/sleep' },
  { value: 'other', label: 'Other' },
];

export interface MoodMentalEntry {
  id: string;
  timestamp: string; // ISO datetime
  date: string; // YYYY-MM-DD
  overall_mood: number; // 1-10
  energy_level: number; // 1-5
  anxiety_level: number; // 1-5
  stress_level: number; // 1-5
  mental_clarity: number; // 1-5
  emotions: MoodEmotion[];
  triggers: MoodTrigger[];
  trigger_other_text: string | null;
  coping_used: CopingStrategy[];
  coping_other_text: string | null;
  sleep_quality_last_night: number | null; // 1-5, null if already logged
  notes: string | null; // max 500 chars
}

// -- BODY MEASUREMENTS (Sprint 23) --

export type WeightUnit = 'lbs' | 'kg';
export type MeasurementUnit = 'in' | 'cm';

export interface BodyMeasurementMeasurements {
  waist: number | null;
  hips: number | null;
  chest: number | null;
  bicep_left: number | null;
  bicep_right: number | null;
  thigh_left: number | null;
  thigh_right: number | null;
  neck: number | null;
}

export interface BodyMeasurementEntry {
  id: string;
  timestamp: string; // ISO datetime
  date: string; // YYYY-MM-DD
  weight: number | null;
  weight_unit: WeightUnit;
  body_fat_percentage: number | null; // 1-60
  measurements: BodyMeasurementMeasurements;
  measurement_unit: MeasurementUnit;
  photo_taken: boolean;
  notes: string | null; // max 500 chars
}

// -- MEDICATION TRACKING (Sprint 23) --

export type MedicationFrequency = 'daily' | 'twice_daily' | 'weekly' | 'as_needed';

export const MEDICATION_FREQUENCY_OPTIONS: { value: MedicationFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_daily', label: 'Twice Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as_needed', label: 'As Needed' },
];

export interface MedicationDefinition {
  id: string;
  name: string;
  dosage: string; // free text, e.g. "50mg", "2 tablets"
  frequency: MedicationFrequency;
  scheduled_time: string; // HH:MM
}

export type MedicationSkippedReason = 'forgot' | 'side_effects' | 'ran_out' | 'doctor_advised' | 'other';

export const MEDICATION_SKIPPED_REASON_OPTIONS: { value: MedicationSkippedReason; label: string }[] = [
  { value: 'forgot', label: 'Forgot' },
  { value: 'side_effects', label: 'Side effects' },
  { value: 'ran_out', label: 'Ran out' },
  { value: 'doctor_advised', label: 'Doctor advised' },
  { value: 'other', label: 'Other' },
];

export interface MedicationLogItem {
  id: string;
  name: string;
  dosage: string;
  time_scheduled: string; // HH:MM
  time_taken: string | null; // HH:MM actual time taken
  taken: boolean;
  skipped_reason: MedicationSkippedReason | null;
  notes: string | null; // max 200 chars
}

export interface MedicationEntry {
  id: string;
  timestamp: string; // ISO datetime
  date: string; // YYYY-MM-DD
  medications: MedicationLogItem[];
}

// -- ELECT-IN CATEGORIES --

export type ElectInCategoryId =
  | 'blood_pressure'
  | 'glucose'
  | 'bloodwork'
  | 'allergies'
  | 'cycle_tracking'
  | 'breastfeeding'
  | 'perimenopause'
  | 'sexual_health'
  | 'substances'
  | 'injuries'
  | 'migraine_tracking'
  | 'body_measurements'
  | 'medication_tracking';

export type ElectInCategoryGroup = 'health_metrics' | 'womens_health' | 'other';

export interface ElectInCategoryDefinition {
  id: ElectInCategoryId;
  label: string;
  description: string;
  group: ElectInCategoryGroup;
  icon: string;
}

export const ELECT_IN_CATEGORY_GROUPS: { id: ElectInCategoryGroup; label: string }[] = [
  { id: 'health_metrics', label: 'Health Metrics' },
  { id: 'womens_health', label: "Women's Health" },
  { id: 'other', label: 'Other' },
];

export const ALL_ELECT_IN_CATEGORIES: ElectInCategoryDefinition[] = [
  // Health Metrics
  { id: 'blood_pressure', label: 'Blood Pressure', description: 'Track systolic/diastolic readings', group: 'health_metrics', icon: 'heart-circle-outline' },
  { id: 'glucose', label: 'Glucose', description: 'Track blood sugar levels', group: 'health_metrics', icon: 'fitness-outline' },
  { id: 'bloodwork', label: 'Bloodwork', description: 'Record lab results and panels', group: 'health_metrics', icon: 'water-outline' },
  { id: 'allergies', label: 'Allergies', description: 'Daily severity, symptoms, medication', group: 'health_metrics', icon: 'alert-circle-outline' },
  { id: 'migraine_tracking', label: 'Migraine Tracking', description: 'Severity, symptoms, triggers, medication, weather correlation', group: 'health_metrics', icon: 'flash-outline' },
  { id: 'body_measurements', label: 'Body Measurements', description: 'Weight, body fat, tape measurements with unit preferences', group: 'health_metrics', icon: 'resize-outline' },
  { id: 'medication_tracking', label: 'Medication Tracking', description: 'Daily medication adherence, scheduling, skipped reasons', group: 'health_metrics', icon: 'medical-outline' },
  // Women's Health
  { id: 'cycle_tracking', label: 'Cycle Tracking', description: 'Period, ovulation, symptoms', group: 'womens_health', icon: 'flower-outline' },
  { id: 'breastfeeding', label: 'Breastfeeding', description: 'Session duration, side, frequency, output tracking', group: 'womens_health', icon: 'heart-outline' },
  { id: 'perimenopause', label: 'Perimenopause', description: 'Hot flashes, night sweats, mood shifts, sleep disruption, brain fog, joint pain', group: 'womens_health', icon: 'thermometer-outline' },
  // Other
  { id: 'sexual_health', label: 'Sexual Health', description: 'Activity, protection, notes', group: 'other', icon: 'heart-half-outline' },
  { id: 'substances', label: 'Substances', description: 'Hemp/cannabis, terpenes, monitor/reduce/quit workflows', group: 'other', icon: 'wine-outline' },
  { id: 'injuries', label: 'Injuries', description: 'Type, body area, severity, recovery', group: 'other', icon: 'bandage-outline' },
];

// -- DAILY COMPLIANCE --

export type DailyGoalId =
  | 'log_food'
  | 'hit_calorie_target'
  | 'hit_protein_target'
  | 'log_water'
  | 'exercise'
  | 'pushups'
  | 'pullups'
  | 'situps'
  | 'log_weight'
  | 'log_sleep'
  | 'take_supplements'
  | 'complete_habits'
  | 'log_allergy_status'
  | 'steps_goal'
  | 'meditate'
  | 'social_connection'
  | 'sunlight'
  | 'mobility'
  | 'journal'
  | 'sleep_adherence'
  | 'breastfeeding_logged'
  | 'perimenopause_logged'
  | 'migraine_logged'
  | 'mood_logged'
  | 'body_measurement_logged'
  | 'medications_logged'
  | 'cycle_logged';

export interface DailyGoalDefinition {
  id: DailyGoalId;
  label: string;
  icon: string;
}

export const ALL_DAILY_GOALS: DailyGoalDefinition[] = [
  { id: 'log_food', label: 'Log food (at least 1 entry)', icon: 'restaurant-outline' },
  { id: 'hit_calorie_target', label: 'Hit calorie target (within 10%)', icon: 'flame-outline' },
  { id: 'hit_protein_target', label: 'Hit protein target (within 10%)', icon: 'barbell-outline' },
  { id: 'log_water', label: 'Log water (hit daily goal)', icon: 'water-outline' },
  { id: 'exercise', label: 'Exercise (at least 1 session)', icon: 'bicycle-outline' },
  { id: 'pushups', label: 'Push-ups (any reps logged)', icon: 'body-outline' },
  { id: 'pullups', label: 'Pull-ups (any reps logged)', icon: 'arrow-up-outline' },
  { id: 'situps', label: 'Sit-ups (any reps logged)', icon: 'fitness-outline' },
  { id: 'log_weight', label: 'Log weight', icon: 'scale-outline' },
  { id: 'log_sleep', label: 'Log sleep', icon: 'moon-outline' },
  { id: 'take_supplements', label: 'Take supplements (all scheduled doses)', icon: 'medkit-outline' },
  { id: 'complete_habits', label: 'Complete daily habits (all checked)', icon: 'checkbox-outline' },
  { id: 'log_allergy_status', label: 'Log allergy status', icon: 'leaf-outline' },
  { id: 'steps_goal', label: 'Steps goal (hit HealthKit step target)', icon: 'footsteps-outline' },
  { id: 'meditate', label: 'Meditate (at least 1 session)', icon: 'leaf-outline' },
  { id: 'social_connection', label: 'Social connection (at least 1 entry)', icon: 'people-outline' },
  { id: 'sunlight', label: 'Sunlight (at least 15 min outdoors)', icon: 'sunny-outline' },
  { id: 'mobility', label: 'Stretch / mobility (at least 1 session)', icon: 'body-outline' },
  { id: 'journal', label: 'Journal (at least 1 entry)', icon: 'book-outline' },
  { id: 'sleep_adherence', label: 'Sleep schedule adherence (75%+)', icon: 'alarm-outline' },
  { id: 'breastfeeding_logged', label: 'Breastfeeding (at least 1 session)', icon: 'heart-outline' },
  { id: 'perimenopause_logged', label: 'Perimenopause (daily entry)', icon: 'thermometer-outline' },
  { id: 'migraine_logged', label: 'Migraine (daily entry)', icon: 'flash-outline' },
  { id: 'mood_logged', label: 'Mood & mental health (daily entry)', icon: 'happy-outline' },
  { id: 'body_measurement_logged', label: 'Body measurements (weekly entry)', icon: 'resize-outline' },
  { id: 'medications_logged', label: 'Medications (daily adherence)', icon: 'medical-outline' },
  { id: 'cycle_logged', label: 'Cycle tracking (daily entry)', icon: 'flower-outline' },
];

export const DEFAULT_DAILY_GOALS: DailyGoalId[] = [
  'log_food',
  'log_water',
  'exercise',
  'complete_habits',
];

export interface ComplianceItem {
  id: DailyGoalId;
  label: string;
  completed: boolean;
  detail?: string;
}

export interface ComplianceResult {
  completed: number;
  total: number;
  percentage: number;
  items: ComplianceItem[];
}

// -- HYDRATION GOAL (Sprint 25) --

export type HydrationUnit = 'cups' | 'oz' | 'ml';

export interface HydrationGoalSettings {
  daily_goal: number; // in the selected unit
  unit: HydrationUnit;
}

export const HYDRATION_UNIT_OPTIONS: { value: HydrationUnit; label: string; defaultGoal: number }[] = [
  { value: 'cups', label: 'Cups', defaultGoal: 8 },
  { value: 'oz', label: 'Ounces', defaultGoal: 64 },
  { value: 'ml', label: 'Milliliters', defaultGoal: 1900 },
];

/** Convert a hydration amount to ounces (canonical storage unit for water entries). */
export function hydrationToOz(amount: number, unit: HydrationUnit): number {
  switch (unit) {
    case 'cups': return amount * 8; // 1 cup = 8 oz
    case 'oz': return amount;
    case 'ml': return amount / 29.5735;
  }
}

/** Convert ounces to a hydration unit. */
export function ozToHydration(oz: number, unit: HydrationUnit): number {
  switch (unit) {
    case 'cups': return oz / 8;
    case 'oz': return oz;
    case 'ml': return oz * 29.5735;
  }
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
