// Recovery score computation
// Phase 12: Recovery Score v1.1
// MASTER-18,19,20,21,23 — alcohol steps, yesterday training load,
// HRV/RHR personal baselines, sleep duration curve

import {
  RECOVERY_WEIGHT_SLEEP_QUALITY,
  RECOVERY_WEIGHT_SLEEP_DURATION,
  RECOVERY_WEIGHT_HRV,
  RECOVERY_WEIGHT_RESTING_HR,
  RECOVERY_WEIGHT_TRAINING_LOAD,
  RECOVERY_WEIGHT_ALCOHOL,
} from '../constants/formulas';
import { storageGet, storageGetMultiple, dateKey, STORAGE_KEYS } from './storage';
import type { SleepEntry, BodyEntry, SubstanceEntry } from '../types';
import type { WorkoutEntry } from '../types/workout';
import type { RecoveryScore, RecoveryScoreComponent } from '../types';

const MIN_COMPONENTS = 3;
const BASELINE_DAYS = 7;

interface ComponentInput {
  name: string;
  weight: number;
  rawScore: number | null; // null = no data
}

/**
 * Normalize sleep quality (1-5 scale) to 0-100.
 */
function scoreSleepQuality(quality: number): number {
  return Math.round(((quality - 1) / 4) * 100);
}

/**
 * Score sleep duration per spec (MASTER-23).
 * <4h=0, 4-6h=0-30, 6-7h=30-60, 7-9h=60-100, 9-10h=100-90, >10h=80.
 */
function scoreSleepDuration(hours: number): number {
  if (hours < 4) return 0;
  if (hours < 6) return Math.round((hours - 4) * 15); // 4h=0, 6h=30
  if (hours < 7) return Math.round(30 + (hours - 6) * 30); // 6h=30, 7h=60
  if (hours <= 9) return Math.round(60 + ((hours - 7) / 2) * 40); // 7h=60, 9h=100
  if (hours <= 10) return Math.round(100 - (hours - 9) * 10); // 9h=100, 10h=90
  return 80; // >10h diminishing returns
}

/**
 * Score HRV against 7-day personal baseline (MASTER-20).
 * Falls back to absolute scoring when no baseline available.
 */
function scoreHrv(todayHRV: number, baseline7Day: number | null): number {
  if (baseline7Day === null || baseline7Day === 0) {
    // No baseline yet — use absolute as fallback
    return Math.min(100, Math.max(0, Math.round((todayHRV / 60) * 100)));
  }
  const ratio = todayHRV / baseline7Day;
  if (ratio >= 1.15) return 100; // 15%+ above baseline
  if (ratio >= 1.0) return 85; // at or above baseline
  if (ratio >= 0.9) return 70; // within 10% below
  if (ratio >= 0.8) return 50; // 10-20% below
  if (ratio >= 0.7) return 30; // 20-30% below
  return 15; // 30%+ below baseline
}

/**
 * Score resting HR against 7-day personal baseline (MASTER-21).
 * Lower than baseline = better recovery.
 * Falls back to absolute scoring when no baseline available.
 */
function scoreRestingHr(todayRHR: number, baseline7Day: number | null): number {
  if (baseline7Day === null || baseline7Day === 0) {
    // No baseline — absolute fallback
    if (todayRHR <= 50) return 100;
    if (todayRHR <= 60) return 80;
    if (todayRHR <= 70) return 60;
    if (todayRHR <= 80) return 40;
    return 20;
  }
  const diff = todayRHR - baseline7Day;
  if (diff <= -5) return 100; // 5+ bpm below baseline
  if (diff <= -2) return 85; // 2-5 below
  if (diff <= 2) return 70; // within +/- 2 of baseline
  if (diff <= 5) return 50; // 2-5 above
  if (diff <= 10) return 30; // 5-10 above
  return 15; // 10+ above baseline
}

/**
 * Score training load from yesterday's workouts.
 * Moderate load (30-60 min) is optimal. Very high or zero scores lower.
 * 0 min = 50 (rest day is ok), 30-60 min = 100, 120+ min = 40.
 */
function scoreTrainingLoad(totalMinutes: number): number {
  if (totalMinutes === 0) return 50;
  if (totalMinutes >= 30 && totalMinutes <= 60) return 100;
  if (totalMinutes < 30) return Math.round(50 + (totalMinutes / 30) * 50);
  // 60 < totalMinutes
  if (totalMinutes >= 120) return 40;
  return Math.round(100 - ((totalMinutes - 60) / 60) * 60);
}

/**
 * Score alcohol consumption via step function (MASTER-18).
 * 0=100, 1=80, 2=50, 3+=20.
 */
function scoreAlcohol(drinkCount: number): number {
  if (drinkCount === 0) return 100;
  if (drinkCount === 1) return 80;
  if (drinkCount === 2) return 50;
  return 20; // 3+ drinks
}

/**
 * Build date strings for the N days preceding the given date.
 */
function getPrecedingDates(date: string, count: number): string[] {
  const dates: string[] = [];
  const d = new Date(date + 'T00:00:00');
  for (let i = 1; i <= count; i++) {
    const prev = new Date(d);
    prev.setDate(d.getDate() - i);
    dates.push(prev.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Compute 7-day baselines for HRV and RHR from body entries (MASTER-20, 21).
 * Uses batch read (storageGetMultiple) per MASTER-61 performance guidance.
 */
async function compute7DayBaselines(
  date: string,
): Promise<{ hrvBaseline: number | null; rhrBaseline: number | null }> {
  const pastDates = getPrecedingDates(date, BASELINE_DAYS);
  const keys = pastDates.map((d) => dateKey(STORAGE_KEYS.LOG_BODY, d));
  const entries = await storageGetMultiple<BodyEntry>(keys);

  let hrvSum = 0;
  let hrvCount = 0;
  let rhrSum = 0;
  let rhrCount = 0;

  for (const entry of entries.values()) {
    if (entry) {
      if (entry.hrv_ms != null) {
        hrvSum += entry.hrv_ms;
        hrvCount++;
      }
      if (entry.resting_hr != null) {
        rhrSum += entry.resting_hr;
        rhrCount++;
      }
    }
  }

  return {
    hrvBaseline: hrvCount > 0 ? hrvSum / hrvCount : null,
    rhrBaseline: rhrCount > 0 ? rhrSum / rhrCount : null,
  };
}

/**
 * Compute recovery score for a given date.
 * Reads sleep, body metrics, workout, and substance logs.
 */
export async function computeRecoveryScore(date: string): Promise<RecoveryScore> {
  // MASTER-19: training load uses YESTERDAY's workout data
  const yesterday = new Date(date + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Load data in parallel — includes 7-day baselines (MASTER-20, 21)
  const [sleepEntry, bodyEntry, workoutEntries, substanceEntries, baselines] =
    await Promise.all([
      storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, date)),
      storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, date)),
      storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, yesterdayStr)),
      storageGet<SubstanceEntry[]>(dateKey(STORAGE_KEYS.LOG_SUBSTANCES, date)),
      compute7DayBaselines(date),
    ]);

  // Build component inputs
  const inputs: ComponentInput[] = [];

  // Sleep quality
  const sleepQuality = sleepEntry?.quality ?? null;
  inputs.push({
    name: 'Sleep Quality',
    weight: RECOVERY_WEIGHT_SLEEP_QUALITY,
    rawScore: sleepQuality != null ? scoreSleepQuality(sleepQuality) : null,
  });

  // Sleep duration (MASTER-23: new curve)
  let sleepHours: number | null = null;
  if (sleepEntry?.bedtime && sleepEntry?.wake_time) {
    const bed = new Date(sleepEntry.bedtime).getTime();
    const wake = new Date(sleepEntry.wake_time).getTime();
    if (wake > bed) {
      sleepHours = (wake - bed) / (1000 * 60 * 60);
    }
  }
  inputs.push({
    name: 'Sleep Duration',
    weight: RECOVERY_WEIGHT_SLEEP_DURATION,
    rawScore: sleepHours != null ? scoreSleepDuration(sleepHours) : null,
  });

  // HRV — scored against 7-day baseline (MASTER-20)
  const hrv = bodyEntry?.hrv_ms ?? null;
  inputs.push({
    name: 'HRV',
    weight: RECOVERY_WEIGHT_HRV,
    rawScore: hrv != null ? scoreHrv(hrv, baselines.hrvBaseline) : null,
  });

  // Resting HR — scored against 7-day baseline (MASTER-21)
  const rhr = bodyEntry?.resting_hr ?? null;
  inputs.push({
    name: 'Resting HR',
    weight: RECOVERY_WEIGHT_RESTING_HR,
    rawScore: rhr != null ? scoreRestingHr(rhr, baselines.rhrBaseline) : null,
  });

  // Training load — YESTERDAY's workouts (MASTER-19)
  const totalWorkoutMin = workoutEntries
    ? workoutEntries.reduce((sum, w) => sum + (w.duration_minutes ?? 0), 0)
    : null;
  inputs.push({
    name: 'Training Load',
    weight: RECOVERY_WEIGHT_TRAINING_LOAD,
    rawScore: workoutEntries != null ? scoreTrainingLoad(totalWorkoutMin!) : null,
  });

  // Alcohol — step function (MASTER-18)
  const alcoholCount = substanceEntries
    ? substanceEntries.filter((e) => e.substance === 'alcohol').length
    : null;
  inputs.push({
    name: 'Alcohol',
    weight: RECOVERY_WEIGHT_ALCOHOL,
    rawScore: substanceEntries != null ? scoreAlcohol(alcoholCount!) : null,
  });

  // Count available components
  const available = inputs.filter((c) => c.rawScore != null);
  const sufficientData = available.length >= MIN_COMPONENTS;

  // Redistribute weights proportionally for available components
  const totalAvailableWeight = available.reduce((sum, c) => sum + c.weight, 0);

  const components: RecoveryScoreComponent[] = inputs.map((input) => {
    const hasData = input.rawScore != null;
    const adjustedWeight =
      hasData && totalAvailableWeight > 0
        ? input.weight / totalAvailableWeight
        : 0;
    const weightedScore = hasData ? input.rawScore! * adjustedWeight : 0;

    return {
      name: input.name,
      weight: input.weight,
      raw_score: input.rawScore ?? 0,
      weighted_score: Math.round(weightedScore * 10) / 10,
      has_data: hasData,
    };
  });

  const totalScore = sufficientData
    ? Math.round(components.reduce((sum, c) => sum + c.weighted_score, 0))
    : 0;

  return {
    date,
    total_score: totalScore,
    components,
    sufficient_data: sufficientData,
  };
}
