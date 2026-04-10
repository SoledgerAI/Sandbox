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
  | 'injuries';

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
  | 'perimenopause_logged';

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
