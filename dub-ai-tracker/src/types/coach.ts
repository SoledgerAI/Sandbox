// AI Coach types for DUB_AI Tracker
// Phase 2: Type System and Storage Layer
// Per Section 12: AI Coach
// Sprint 12: Expert panel, streaming, tool use, photo capture

import type { EngagementTier, UserProfile } from './profile';

// ============================================================
// Expert Panel — 11 domain experts invoked via @mention
// ============================================================

export type ExpertId =
  | 'dietician'
  | 'trainer'
  | 'therapist'
  | 'physician'
  | 'analyst'
  | 'pharmacist'
  | 'recovery'
  | 'sleep'
  | 'coach'
  | 'biohacker'
  | 'dub';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string; // ISO datetime
  /** Which expert responded (assistant messages only) */
  expertId?: ExpertId;
  /** Photo URI attached to this message (user messages only) */
  imageUri?: string;
  /** Tool use confirmation pending (assistant messages only) */
  toolUse?: ToolUseRequest;
  /** Whether this message is still streaming */
  streaming?: boolean;
}

// ============================================================
// Tool Use — Coach can log data via Anthropic tool_use
// ============================================================

export type CoachToolName =
  | 'log_drink'
  | 'log_food'
  | 'log_weight'
  | 'log_exercise'
  | 'log_supplement'
  | 'log_feedback'
  | 'log_body_composition'
  | 'log_sleep'
  | 'log_mood'
  | 'log_substance'
  | 'log_recovery_metrics';

/**
 * Sprint 31: Wearable-derived recovery metrics input.
 * ToolUseRequest itself stays a single broad-input interface (matches every
 * other tool's pattern); the executor handler casts toolReq.input to this
 * type at runtime when toolReq.name === 'log_recovery_metrics'.
 */
export interface LogRecoveryMetricsInput {
  sleep_score?: number;
  sleep_duration_hours?: number;
  hrv_ms?: number;
  body_battery?: number;
  stress_baseline?: number;
  training_readiness?: number;
  vo2_max?: number;
  resting_heart_rate?: number;
  timestamp?: string;
  extraction_source: 'image' | 'text' | 'wearable_scan';
}

/** Sprint 30: How the model derived a tool's input values */
export type ExtractionSource = 'user_text' | 'image_vision' | 'inferred';

/** Sprint 30: Tier classification for confirmation UX */
export type ToolTier = 'auto_commit' | 'checklist' | 'explicit';

export interface ToolUseRequest {
  toolUseId: string;
  name: CoachToolName;
  input: Record<string, unknown>;
  /** User's confirmation state */
  status: 'pending' | 'confirmed' | 'cancelled';
  /** Sprint 30: tier classification — undefined for legacy callers */
  tier?: ToolTier;
}

export interface SuggestedPrompt {
  text: string;
  category: 'general' | 'nutrition' | 'fitness' | 'sleep' | 'patterns' | 'recovery';
}

// ============================================================
// Feedback Log — @dub exclusive
// ============================================================

export interface FeedbackEntry {
  id: string;
  timestamp: string; // ISO
  type: 'bug' | 'feature_request' | 'question';
  description: string;
  screen: string;
  userMessage: string;
  resolved: boolean;
}

export type EdRiskFlagType = 'sustained_low_intake' | 'extreme_restriction_today' | 'healthy_bmi_loss_goal' | 'underweight_bmi';

export interface EdRiskFlag {
  type: EdRiskFlagType;
  detail: string;
}

export interface CoachContext {
  profile: UserProfile;
  tier: EngagementTier;
  today_data: TodayDataSummary;
  rolling_7d: RollingStats;
  bmr: number | null;
  tdee: number | null;
  calorie_target: number | null;
  recovery_score: number | null;
  consistency_28d_pct: number;
  /** Sprint 25: 7-day compliance average percentage, null if no data */
  compliance_7d_avg: number | null;
  /** Sprint 25: Hydration goal progress string, null if no goal set */
  hydration_goal_progress: string | null;
  active_correlations: PatternInsight[];
  active_injuries: InjurySummary[];
  latest_bloodwork: BloodworkSummary | null;
  cycle_phase: string | null;
  sobriety_goals: SobrietyGoalSummary[];
  supplement_flags: string[];
  therapy_today: boolean;
  ed_risk_flags: EdRiskFlag[];
  /** True when mood trend detection triggers (sustained low mood, high anxiety, or crisis mood) */
  mood_trend_alert: boolean;
  /** Active milestone event string, e.g. "milestone: 100 days logged" (P2-05) */
  active_milestone: string | null;
  /** Sprint 30: sleep-debt 3-day flag. Undefined when partial data (<2 of 3 days). */
  sleep_debt_3d?: boolean;
  /** Sprint 30: sleep-debt 7-day flag. Undefined when partial data (<4 of 7 days). */
  sleep_debt_7d?: boolean;
  /** Sprint 30: derived target hours used to compute the debt flags. */
  sleep_target_hours?: number;
  /** Sprint 36: BodyRegion[] of regions trained at least once in the last 7 days. */
  last_7_days_regions_hit?: string[];
  /** Sprint 36: BodyRegion[] of regions trained at least once in the last 28 days. */
  last_28_days_regions_hit?: string[];
  /** Sprint 36: regions whose 4-week rolling avg is below 50% of the configured target. */
  region_undertrained_flags?: Array<{
    region: string;
    sessions_per_week_avg: number;
    target: number;
  }>;
  /** S33-A: distinct pain areas with any entry in last 14 days, freq desc. */
  pain_areas_last_14d?: string[];
  /** S33-A: areas with ≥3 pain entries in last 14 days. */
  persistent_pain_areas?: string[];
  /** S33-A: areas with at least one entry in ≥4 of the last 6 ISO weeks. */
  chronic_pain_areas?: string[];
  /** S33-B: per-habit current streak counts, non-archived only. */
  habit_streaks?: Array<{
    habit_id: string;
    habit_name: string;
    current_streak: number;
  }>;
  /** S33-B: names of habits whose cadence rule says they're due today. */
  habits_due_today?: string[];
  /** S33-B: names of habits the user has marked completed today. */
  habits_completed_today?: string[];
  /** S33-B: weekly-target habits falling short in the last 7 days. */
  habits_off_track?: Array<{
    habit_id: string;
    habit_name: string;
    missed_in_last_7d: number;
    target_per_7d: number;
  }>;
}

export interface TodayDataSummary {
  calories_consumed: number;
  calories_burned: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_oz: number;
  caffeine_mg: number;
  steps: number;
  workouts: string[];
  mood: number | null;
  energy: number | null;
  anxiety: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  tags_logged: string[];
}

export interface RollingStats {
  avg_calories: number | null;
  avg_protein_g: number | null;
  avg_carbs_g: number | null;
  avg_fat_g: number | null;
  avg_water_oz: number | null;
  avg_sleep_hours: number | null;
  avg_mood: number | null;
  avg_energy: number | null;
  avg_anxiety: number | null;
  avg_weight: number | null;
  /** Number of weight data points in the 7-day window */
  weight_count: number;
  workout_count: number;
}

export interface PatternInsight {
  id: string;
  category: string;
  observation: string;
  data_range: string;
  sample_size: number;
  correlation_note: string;
  detected_at: string; // ISO datetime
}

export interface InjurySummary {
  location: string;
  severity: number;
  type: 'acute' | 'chronic' | 'recurring';
  aggravators: string[];
}

export interface BloodworkSummary {
  date: string;
  flagged_markers: Array<{
    name: string;
    value: number;
    unit: string;
    reference_range: string;
    status: 'low' | 'high';
  }>;
}

export interface SobrietyGoalSummary {
  substance: string;
  goal_type: 'reduce' | 'quit' | 'monitor';
  current_streak_days: number;
}
