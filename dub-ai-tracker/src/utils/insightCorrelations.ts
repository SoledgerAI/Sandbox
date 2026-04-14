// Sprint 25: Insight Correlations
// Basic Pearson correlation between metric pairs
// Only show insights with strong correlations (>0.5 over 14+ data points)

import { storageGet, STORAGE_KEYS, dateKey } from './storage';
import type { SleepEntry, MoodMentalEntry } from '../types';
import type { WorkoutEntry } from '../types/workout';

export interface CorrelationInsight {
  metricA: string;
  metricB: string;
  correlation: number; // -1 to 1
  description: string;
  dataPoints: number;
}

const MIN_DATA_POINTS = 14;
const MIN_CORRELATION = 0.5;

/**
 * Calculate Pearson correlation coefficient between two arrays.
 * Returns null if fewer than MIN_DATA_POINTS paired values.
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  // Pair only where both have values
  const pairs: Array<[number, number]> = [];
  const len = Math.min(xs.length, ys.length);
  for (let i = 0; i < len; i++) {
    if (xs[i] != null && ys[i] != null && !isNaN(xs[i]) && !isNaN(ys[i])) {
      pairs.push([xs[i], ys[i]]);
    }
  }

  if (pairs.length < MIN_DATA_POINTS) return null;

  const n = pairs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (const [x, y] of pairs) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return null;

  return Math.round((numerator / denominator) * 1000) / 1000;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Load daily metric arrays for the last N days.
 * Returns arrays indexed by day offset (0 = oldest, N-1 = today).
 * NaN signals missing data for that day.
 */
async function loadDailyMetrics(days: number): Promise<{
  dates: string[];
  sleepHours: number[];
  moodScores: number[];
  exerciseMinutes: number[];
}> {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }

  const [sleepEntries, moodEntries, exerciseEntries] = await Promise.all([
    Promise.all(dates.map((date) => storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, date)))),
    Promise.all(dates.map((date) => storageGet<MoodMentalEntry>(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, date)))),
    Promise.all(dates.map((date) => storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, date)))),
  ]);

  const sleepHours = sleepEntries.map((entry) => {
    if (!entry) return NaN;
    if (entry.total_duration_hours != null) return entry.total_duration_hours;
    if (entry.bedtime && entry.wake_time) {
      const bed = new Date(entry.bedtime).getTime();
      const wake = new Date(entry.wake_time).getTime();
      if (wake > bed) return (wake - bed) / (1000 * 60 * 60);
    }
    return NaN;
  });

  const moodScores = moodEntries.map((entry) => {
    return entry ? entry.overall_mood : NaN;
  });

  const exerciseMinutes = exerciseEntries.map((entries) => {
    if (!entries || entries.length === 0) return 0; // 0 = no exercise, not NaN
    return entries.reduce((s, w) => s + (w.duration_minutes ?? 0), 0);
  });

  return { dates, sleepHours, moodScores, exerciseMinutes };
}

/**
 * Calculate correlation insights from user data.
 * Compares mood vs sleep, mood vs exercise, compliance vs mood.
 * Only returns insights with |r| > 0.5 and 14+ data points.
 */
export async function calculateCorrelationInsights(): Promise<CorrelationInsight[]> {
  const { sleepHours, moodScores, exerciseMinutes } = await loadDailyMetrics(90);
  const insights: CorrelationInsight[] = [];

  // Mood vs Sleep
  const moodSleepR = pearsonCorrelation(sleepHours, moodScores);
  if (moodSleepR != null && Math.abs(moodSleepR) >= MIN_CORRELATION) {
    const dataPoints = sleepHours.filter((v, i) => !isNaN(v) && !isNaN(moodScores[i])).length;
    insights.push({
      metricA: 'Sleep Duration',
      metricB: 'Mood Score',
      correlation: moodSleepR,
      description: moodSleepR > 0
        ? 'Your mood tends to be higher on days you sleep more.'
        : 'Your mood tends to be lower on days you sleep more.',
      dataPoints,
    });
  }

  // Mood vs Exercise
  const moodExR = pearsonCorrelation(exerciseMinutes, moodScores);
  if (moodExR != null && Math.abs(moodExR) >= MIN_CORRELATION) {
    const dataPoints = exerciseMinutes.filter((v, i) => !isNaN(v) && !isNaN(moodScores[i])).length;
    insights.push({
      metricA: 'Exercise Minutes',
      metricB: 'Mood Score',
      correlation: moodExR,
      description: moodExR > 0
        ? 'You tend to log better moods on days with more exercise.'
        : 'Your mood tends to be lower on days with more exercise.',
      dataPoints,
    });
  }

  // Sleep vs Exercise
  const sleepExR = pearsonCorrelation(exerciseMinutes, sleepHours);
  if (sleepExR != null && Math.abs(sleepExR) >= MIN_CORRELATION) {
    const dataPoints = exerciseMinutes.filter((v, i) => !isNaN(v) && !isNaN(sleepHours[i])).length;
    insights.push({
      metricA: 'Exercise Minutes',
      metricB: 'Sleep Duration',
      correlation: sleepExR,
      description: sleepExR > 0
        ? 'You tend to sleep longer on days you exercise more.'
        : 'You tend to sleep less on days you exercise more.',
      dataPoints,
    });
  }

  return insights;
}
