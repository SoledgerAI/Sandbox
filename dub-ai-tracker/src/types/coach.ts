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
  | 'log_feedback';

export interface ToolUseRequest {
  toolUseId: string;
  name: CoachToolName;
  input: Record<string, unknown>;
  /** User's confirmation state */
  status: 'pending' | 'confirmed' | 'cancelled';
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
