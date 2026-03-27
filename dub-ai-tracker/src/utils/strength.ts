// Strength training utilities -- volume calc, 1RM estimation (Brzycki)
// Phase 11: Fitness and Workout Logging
//
// Source: Brzycki M., Strength Testing -- Predicting a One-Rep Max from
//   Reps-to-Fatigue. JOHPERD. 1993;64(1):88-90.
//   DOI: 10.1080/07303084.1993.10606684

import {
  BRZYCKI_NUMERATOR,
  BRZYCKI_DENOMINATOR_BASE,
  BRZYCKI_MAX_REPS,
} from '../constants/formulas';
import type { ExerciseSet, StrengthExercise, PersonalRecord } from '../types/workout';
import { storageGet, storageList } from '../utils/storage';

/**
 * Estimate 1RM using the Brzycki formula.
 * 1RM = weight x (36 / (37 - reps))
 * Valid for reps 1-10 only. Returns null for reps > 10.
 */
export function estimate1RM(weight: number, reps: number): number | null {
  if (reps < 1 || reps > BRZYCKI_MAX_REPS) return null;
  if (reps === 1) return weight;
  return weight * (BRZYCKI_NUMERATOR / (BRZYCKI_DENOMINATOR_BASE - reps));
}

/**
 * Calculate total volume for an exercise across working sets.
 * Volume = sum of (weight x reps) for non-warmup sets.
 */
export function calculateVolume(sets: ExerciseSet[]): number {
  return sets
    .filter((s) => !s.is_warmup)
    .reduce((total, s) => total + s.weight * s.reps, 0);
}

/**
 * Calculate total session volume across all exercises.
 */
export function calculateSessionVolume(exercises: StrengthExercise[]): number {
  return exercises.reduce((total, ex) => total + calculateVolume(ex.sets), 0);
}

/**
 * Check if a set is a PR by comparing against previous records.
 * Returns the type of PR achieved, or null if not a PR.
 */
export function detectPR(
  set: ExerciseSet,
  existingPRs: PersonalRecord[],
  exerciseId: string,
): { type: PersonalRecord['type']; value: number } | null {
  if (set.is_warmup) return null;

  const estimated1rm = estimate1RM(set.weight, set.reps);

  // Check 1RM PR
  if (estimated1rm !== null) {
    const existing1rm = existingPRs.find(
      (pr) => pr.exercise_id === exerciseId && pr.type === '1rm_estimated',
    );
    if (!existing1rm || estimated1rm > existing1rm.value) {
      return { type: '1rm_estimated', value: Math.round(estimated1rm * 10) / 10 };
    }
  }

  // Check max weight PR (at any rep count)
  const existingMaxWeight = existingPRs.find(
    (pr) => pr.exercise_id === exerciseId && pr.type === 'max_weight',
  );
  if (!existingMaxWeight || set.weight > existingMaxWeight.value) {
    return { type: 'max_weight', value: set.weight };
  }

  // Check max reps PR (at same or higher weight)
  const existingMaxReps = existingPRs.find(
    (pr) =>
      pr.exercise_id === exerciseId &&
      pr.type === 'max_reps' &&
      pr.weight !== null &&
      pr.weight <= set.weight,
  );
  if (!existingMaxReps || set.reps > existingMaxReps.value) {
    return { type: 'max_reps', value: set.reps };
  }

  return null;
}

/**
 * Load all personal records from storage.
 */
export async function loadPersonalRecords(): Promise<PersonalRecord[]> {
  const prs = await storageGet<PersonalRecord[]>('dub.strength.prs');
  return prs ?? [];
}

/**
 * Save a personal record, updating existing or adding new.
 */
export async function savePersonalRecord(
  pr: PersonalRecord,
  existingPRs: PersonalRecord[],
): Promise<PersonalRecord[]> {
  const idx = existingPRs.findIndex(
    (p) => p.exercise_id === pr.exercise_id && p.type === pr.type,
  );

  let updated: PersonalRecord[];
  if (idx >= 0) {
    updated = [...existingPRs];
    updated[idx] = pr;
  } else {
    updated = [...existingPRs, pr];
  }

  const { storageSet } = await import('../utils/storage');
  await storageSet('dub.strength.prs', updated);
  return updated;
}
