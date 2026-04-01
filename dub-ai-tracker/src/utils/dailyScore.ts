// Multi-factor Daily Score calculator
// MASTER-48: Replaces single calorie-percentage score with tier-weighted multi-factor score
// Per Section 9: Engagement Tier scoring weights

import { getTierDefinition } from '../constants/tiers';
import type { EngagementTier } from '../types/profile';
import type { DailySummary } from '../types';

export interface DailyScoreBreakdown {
  total: number;
  calorieAccuracy: number;
  macroAccuracy: number;
  tagCompletion: number;
  consistency: number;
  trendAlignment: number;
  loggingConsistency: number;
  weeklyTrend: number;
  weightStability: number;
  caloricTdeeAlignment: number;
}

interface ScoreInput {
  summary: DailySummary;
  calorieTarget: number;
  tdee: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  enabledTagCount: number;
  tagsLoggedToday: number;
  daysLoggedLast7: number;
  fiveDayCalorieAvg: number | null;
  currentWeight: number | null;
  goalWeight: number | null;
}

/**
 * Score a single component 0-100 based on how close actual is to target.
 * Uses inverted absolute-error: 100 - (|actual - target| / target * 100), floored at 0.
 */
function accuracyScore(actual: number, target: number): number {
  if (target <= 0) return 0;
  const error = Math.abs(actual - target) / target;
  return Math.max(0, Math.round(100 * (1 - error)));
}

/**
 * Compute the multi-factor daily score for a given tier.
 * Returns breakdown object with total (0-100) and per-component scores.
 */
export function computeDailyScore(
  tier: EngagementTier | null,
  input: ScoreInput,
): DailyScoreBreakdown {
  const tierDef = getTierDefinition(tier ?? 'balanced');
  const w = tierDef.scoreWeighting;

  // Calorie Accuracy: |consumed - target| / target, inverted
  const calorieAccuracy = accuracyScore(
    input.summary.calories_consumed,
    input.calorieTarget,
  );

  // Macro Accuracy: average of P/C/F accuracy
  const proteinAcc = accuracyScore(input.summary.protein_g, input.proteinTarget);
  const carbsAcc = accuracyScore(input.summary.carbs_g, input.carbsTarget);
  const fatAcc = accuracyScore(input.summary.fat_g, input.fatTarget);
  const macroAccuracy =
    input.proteinTarget > 0 || input.carbsTarget > 0 || input.fatTarget > 0
      ? Math.round((proteinAcc + carbsAcc + fatAcc) / 3)
      : 0;

  // Tag Completion: enabled tags with data today / enabled tags
  const tagCompletion =
    input.enabledTagCount > 0
      ? Math.round((input.tagsLoggedToday / input.enabledTagCount) * 100)
      : 0;

  // Consistency: days with logging in last 7 / 7
  const consistency = Math.round((input.daysLoggedLast7 / 7) * 100);

  // Trend Alignment (Balanced): 5-day avg vs target
  const trendAlignment =
    input.fiveDayCalorieAvg != null
      ? accuracyScore(input.fiveDayCalorieAvg, input.calorieTarget)
      : 0;

  // Logging Consistency (Flexible): same as consistency
  const loggingConsistency = consistency;

  // Weekly Trend (Flexible): 5-day average trend toward target
  const weeklyTrend = trendAlignment;

  // Weight Stability (Mindful): within +/- 3lb band of goal
  let weightStability = 0;
  if (input.currentWeight != null && input.goalWeight != null) {
    const diff = Math.abs(input.currentWeight - input.goalWeight);
    weightStability = diff <= 3 ? 100 : Math.max(0, Math.round(100 * (1 - (diff - 3) / 10)));
  }

  // Caloric TDEE Alignment (Mindful): consumed vs TDEE
  const caloricTdeeAlignment = accuracyScore(
    input.summary.calories_consumed,
    input.tdee,
  );

  // Weighted total
  const total = Math.min(
    100,
    Math.round(
      calorieAccuracy * w.calorieAccuracy +
      macroAccuracy * w.macroAccuracy +
      tagCompletion * w.tagCompletion +
      consistency * w.consistency +
      trendAlignment * w.trendAlignment +
      loggingConsistency * w.loggingConsistency +
      weeklyTrend * w.weeklyTrend +
      weightStability * w.weightStability +
      caloricTdeeAlignment * w.caloricTdeeAlignment,
    ),
  );

  return {
    total,
    calorieAccuracy,
    macroAccuracy,
    tagCompletion,
    consistency,
    trendAlignment,
    loggingConsistency,
    weeklyTrend,
    weightStability,
    caloricTdeeAlignment,
  };
}
