// Sleep Schedule Adherence — Sprint 19
// Calculates how close actual bedtime/wake time is to user's targets

import { storageGet, STORAGE_KEYS } from './storage';
import type { SleepScheduleSettings } from '../types';

/**
 * Calculate adherence score for a single time comparison.
 * Returns 100 if within 15 min, 75 within 30 min, 50 within 60 min, 25 beyond.
 */
export function calculateTimeAdherence(actualISO: string, targetHHMM: string): {
  score: number;
  diffMinutes: number;
  label: string;
} {
  const actual = new Date(actualISO);
  const [targetH, targetM] = targetHHMM.split(':').map(Number);

  // Compare using local time hours/minutes to avoid timezone issues
  const actualMinutesOfDay = actual.getHours() * 60 + actual.getMinutes();
  const targetMinutesOfDay = targetH * 60 + targetM;

  // Calculate difference in minutes, handling overnight wrap
  let diffMinutes = actualMinutesOfDay - targetMinutesOfDay;

  // If the diff is more than 12 hours (720 min), the target was probably meant for the other day
  if (diffMinutes > 720) {
    diffMinutes -= 1440;
  } else if (diffMinutes < -720) {
    diffMinutes += 1440;
  }
  const absDiff = Math.abs(diffMinutes);

  let score: number;
  let label: string;
  if (absDiff <= 15) {
    score = 100;
    label = 'on target';
  } else if (absDiff <= 30) {
    score = 75;
    label = diffMinutes > 0 ? 'slightly late' : 'slightly early';
  } else if (absDiff <= 60) {
    score = 50;
    label = diffMinutes > 0 ? 'late' : 'early';
  } else {
    score = 25;
    label = diffMinutes > 0 ? 'very late' : 'very early';
  }

  return { score, diffMinutes, label };
}

/**
 * Calculate overall sleep schedule adherence for a given sleep entry.
 * Returns average of bedtime and wake time adherence.
 * Returns null if no schedule is set.
 */
export async function calculateSleepAdherence(
  actualBedtime: string | null,
  actualWakeTime: string | null,
): Promise<{
  overallScore: number;
  bedtimeAdherence: { score: number; diffMinutes: number; label: string } | null;
  wakeAdherence: { score: number; diffMinutes: number; label: string } | null;
} | null> {
  const schedule = await storageGet<SleepScheduleSettings>(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE);
  if (!schedule?.target_bedtime || !schedule?.target_wake_time) return null;
  if (!actualBedtime && !actualWakeTime) return null;

  let bedtimeAdherence = null;
  let wakeAdherence = null;
  const scores: number[] = [];

  if (actualBedtime && schedule.target_bedtime) {
    bedtimeAdherence = calculateTimeAdherence(actualBedtime, schedule.target_bedtime);
    scores.push(bedtimeAdherence.score);
  }

  if (actualWakeTime && schedule.target_wake_time) {
    wakeAdherence = calculateTimeAdherence(actualWakeTime, schedule.target_wake_time);
    scores.push(wakeAdherence.score);
  }

  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return { overallScore, bedtimeAdherence, wakeAdherence };
}
