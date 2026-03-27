// Recovery score computation
// Phase 12: Recovery Score v1.0

import {
  RECOVERY_WEIGHT_SLEEP_QUALITY,
  RECOVERY_WEIGHT_SLEEP_DURATION,
  RECOVERY_WEIGHT_HRV,
  RECOVERY_WEIGHT_RESTING_HR,
  RECOVERY_WEIGHT_TRAINING_LOAD,
  RECOVERY_WEIGHT_ALCOHOL,
} from '../constants/formulas';
import { storageGet, dateKey, STORAGE_KEYS } from './storage';
import type { SleepEntry, BodyEntry, SubstanceEntry } from '../types';
import type { WorkoutEntry } from '../types/workout';
import type { RecoveryScore, RecoveryScoreComponent } from '../types';

const MIN_COMPONENTS = 3;

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
 * Score sleep duration. 7-9 hours is optimal (100).
 * Below 5 or above 11 scores 0. Linear interpolation in between.
 */
function scoreSleepDuration(hours: number): number {
  if (hours >= 7 && hours <= 9) return 100;
  if (hours < 5 || hours > 11) return 0;
  if (hours < 7) return Math.round(((hours - 5) / 2) * 100);
  // hours > 9 && hours <= 11
  return Math.round(((11 - hours) / 2) * 100);
}

/**
 * Score HRV. Higher is generally better.
 * 0-20ms = 0, 20-100ms linear to 100, 100+ = 100.
 */
function scoreHrv(hrv: number): number {
  if (hrv <= 20) return 0;
  if (hrv >= 100) return 100;
  return Math.round(((hrv - 20) / 80) * 100);
}

/**
 * Score resting heart rate. Lower is better.
 * 40 bpm = 100, 80+ bpm = 0. Linear between.
 */
function scoreRestingHr(hr: number): number {
  if (hr <= 40) return 100;
  if (hr >= 80) return 0;
  return Math.round(((80 - hr) / 40) * 100);
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
 * Score alcohol consumption. 0 drinks = 100, 1 = 75, 2 = 50, 3 = 25, 4+ = 0.
 */
function scoreAlcohol(drinkCount: number): number {
  if (drinkCount === 0) return 100;
  if (drinkCount >= 4) return 0;
  return Math.round(100 - drinkCount * 25);
}

/**
 * Compute recovery score for a given date.
 * Reads sleep, body metrics, workout, and substance logs.
 */
export async function computeRecoveryScore(date: string): Promise<RecoveryScore> {
  // Load data in parallel
  const [sleepEntry, bodyEntry, workoutEntries, substanceEntries] = await Promise.all([
    storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, date)),
    storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, date)),
    storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, date)),
    storageGet<SubstanceEntry[]>(dateKey(STORAGE_KEYS.LOG_SUBSTANCES, date)),
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

  // Sleep duration
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

  // HRV
  const hrv = bodyEntry?.hrv_ms ?? null;
  inputs.push({
    name: 'HRV',
    weight: RECOVERY_WEIGHT_HRV,
    rawScore: hrv != null ? scoreHrv(hrv) : null,
  });

  // Resting HR
  const rhr = bodyEntry?.resting_hr ?? null;
  inputs.push({
    name: 'Resting HR',
    weight: RECOVERY_WEIGHT_RESTING_HR,
    rawScore: rhr != null ? scoreRestingHr(rhr) : null,
  });

  // Training load (yesterday's workouts)
  const totalWorkoutMin = workoutEntries
    ? workoutEntries.reduce((sum, w) => sum + (w.duration_minutes ?? 0), 0)
    : null;
  inputs.push({
    name: 'Training Load',
    weight: RECOVERY_WEIGHT_TRAINING_LOAD,
    rawScore: workoutEntries != null ? scoreTrainingLoad(totalWorkoutMin!) : null,
  });

  // Alcohol
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
