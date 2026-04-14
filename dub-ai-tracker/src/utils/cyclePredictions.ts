// Sprint 24: Cycle Prediction Engine
// Front-end only — calculates average cycle length and predicts next period/fertile window
// NOT for medical use — includes mandatory disclaimer

import { storageGet, storageList, STORAGE_KEYS } from './storage';
import type { CycleEntryV2, CyclePrediction } from '../types';

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_DURATION = 5;
const MAX_CYCLES_TO_ANALYZE = 6;
const MIN_CYCLES_FOR_PREDICTION = 3;

// Fertile window: ovulation ~14 days before next period, window is +-2 days
const OVULATION_DAYS_BEFORE_PERIOD = 14;
const FERTILE_WINDOW_MARGIN = 2;

/**
 * Get all period start dates from cycle entry history, sorted oldest to newest.
 */
export async function getPeriodStartDates(): Promise<string[]> {
  const keys = await storageList(STORAGE_KEYS.LOG_CYCLE);
  const sortedKeys = keys.sort();

  const periodStarts: string[] = [];

  for (const key of sortedKeys) {
    const entry = await storageGet<CycleEntryV2>(key);
    if (!entry) continue;

    // V2 entries use period_status === 'started'
    if (entry.period_status === 'started') {
      periodStarts.push(entry.date);
      continue;
    }

    // Legacy entries use period_start field
    if ((entry as any).period_start && !entry.period_status) {
      // Check if this is a period start day (not just continuation)
      const dateFromKey = key.replace(STORAGE_KEYS.LOG_CYCLE + '.', '');
      if ((entry as any).period_start === dateFromKey) {
        periodStarts.push(dateFromKey);
      }
    }
  }

  // Deduplicate and sort
  return [...new Set(periodStarts)].sort();
}

/**
 * Calculate average cycle length from period start dates.
 * Uses the last N cycles (up to MAX_CYCLES_TO_ANALYZE).
 */
export function calculateAverageCycleLength(periodStarts: string[]): number {
  if (periodStarts.length < 2) return DEFAULT_CYCLE_LENGTH;

  const recent = periodStarts.slice(-MAX_CYCLES_TO_ANALYZE - 1);
  const lengths: number[] = [];

  for (let i = 1; i < recent.length; i++) {
    const prev = new Date(recent[i - 1] + 'T00:00:00');
    const curr = new Date(recent[i] + 'T00:00:00');
    const days = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    // Filter out clearly invalid cycle lengths (< 15 or > 60 days)
    if (days >= 15 && days <= 60) {
      lengths.push(days);
    }
  }

  if (lengths.length === 0) return DEFAULT_CYCLE_LENGTH;
  return Math.round(lengths.reduce((sum, l) => sum + l, 0) / lengths.length);
}

/**
 * Calculate average period duration by counting consecutive period days.
 * Uses historical data to estimate how long periods typically last.
 */
export async function calculateAveragePeriodDuration(periodStarts: string[]): Promise<number> {
  if (periodStarts.length === 0) return DEFAULT_PERIOD_DURATION;

  const durations: number[] = [];

  for (const startDate of periodStarts.slice(-MAX_CYCLES_TO_ANALYZE)) {
    let duration = 1;
    const start = new Date(startDate + 'T00:00:00');

    // Count consecutive days with period data
    for (let d = 1; d <= 10; d++) {
      const nextDate = new Date(start);
      nextDate.setDate(nextDate.getDate() + d);
      const dateStr = formatDate(nextDate);
      const key = `${STORAGE_KEYS.LOG_CYCLE}.${dateStr}`;
      const entry = await storageGet<CycleEntryV2>(key);

      if (!entry) break;

      // V2: check period_status
      if (entry.period_status === 'ongoing' || entry.period_status === 'started') {
        duration++;
      } else if (entry.period_status === 'ended') {
        duration++;
        break;
      } else if (entry.period_status === 'none' || entry.period_status === 'spotting') {
        break;
      }

      // Legacy: check flow_level
      if (!entry.period_status && (entry as any).flow_level) {
        duration++;
      } else if (!entry.period_status) {
        break;
      }
    }

    if (duration >= 1 && duration <= 10) {
      durations.push(duration);
    }
  }

  if (durations.length === 0) return DEFAULT_PERIOD_DURATION;
  return Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
}

/**
 * Generate cycle predictions based on logged history.
 * Returns null if insufficient data (fewer than MIN_CYCLES_FOR_PREDICTION start dates).
 */
export async function getCyclePredictions(): Promise<CyclePrediction | null> {
  const periodStarts = await getPeriodStartDates();

  if (periodStarts.length < MIN_CYCLES_FOR_PREDICTION) {
    // Not enough data, return defaults with disclaimer
    if (periodStarts.length === 0) return null;

    // Even with < 3 cycles, provide a rough estimate with defaults
    const avgCycleLength = periodStarts.length >= 2
      ? calculateAverageCycleLength(periodStarts)
      : DEFAULT_CYCLE_LENGTH;
    const avgPeriodDuration = await calculateAveragePeriodDuration(periodStarts);

    const lastStart = new Date(periodStarts[periodStarts.length - 1] + 'T00:00:00');
    const nextStart = new Date(lastStart);
    nextStart.setDate(nextStart.getDate() + avgCycleLength);

    const ovulationDay = new Date(nextStart);
    ovulationDay.setDate(ovulationDay.getDate() - OVULATION_DAYS_BEFORE_PERIOD);

    const fertileStart = new Date(ovulationDay);
    fertileStart.setDate(fertileStart.getDate() - FERTILE_WINDOW_MARGIN);
    const fertileEnd = new Date(ovulationDay);
    fertileEnd.setDate(fertileEnd.getDate() + FERTILE_WINDOW_MARGIN);

    return {
      next_period_start: formatDate(nextStart),
      fertile_window_start: formatDate(fertileStart),
      fertile_window_end: formatDate(fertileEnd),
      average_cycle_length: avgCycleLength,
      average_period_duration: avgPeriodDuration,
      cycles_analyzed: periodStarts.length,
    };
  }

  const avgCycleLength = calculateAverageCycleLength(periodStarts);
  const avgPeriodDuration = await calculateAveragePeriodDuration(periodStarts);

  const lastStart = new Date(periodStarts[periodStarts.length - 1] + 'T00:00:00');
  const nextStart = new Date(lastStart);
  nextStart.setDate(nextStart.getDate() + avgCycleLength);

  const ovulationDay = new Date(nextStart);
  ovulationDay.setDate(ovulationDay.getDate() - OVULATION_DAYS_BEFORE_PERIOD);

  const fertileStart = new Date(ovulationDay);
  fertileStart.setDate(fertileStart.getDate() - FERTILE_WINDOW_MARGIN);
  const fertileEnd = new Date(ovulationDay);
  fertileEnd.setDate(fertileEnd.getDate() + FERTILE_WINDOW_MARGIN);

  return {
    next_period_start: formatDate(nextStart),
    fertile_window_start: formatDate(fertileStart),
    fertile_window_end: formatDate(fertileEnd),
    average_cycle_length: avgCycleLength,
    average_period_duration: avgPeriodDuration,
    cycles_analyzed: Math.min(periodStarts.length, MAX_CYCLES_TO_ANALYZE),
  };
}

/**
 * Get the current cycle day relative to last period start.
 * Returns null if no period start dates exist.
 */
export function getCurrentCycleDay(periodStarts: string[], today: string): number | null {
  if (periodStarts.length === 0) return null;

  const lastStart = new Date(periodStarts[periodStarts.length - 1] + 'T00:00:00');
  const todayDate = new Date(today + 'T00:00:00');
  const diffDays = Math.round((todayDate.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays < 1 || diffDays > 60) return null;
  return diffDays;
}

/**
 * Build a 35-day mini-calendar for display.
 * Returns array of dates with their period/prediction status.
 */
export async function buildMiniCalendar(today: string): Promise<Array<{
  date: string;
  isPeriodDay: boolean;
  isPredictedPeriod: boolean;
  isFertileWindow: boolean;
  isToday: boolean;
}>> {
  const todayDate = new Date(today + 'T00:00:00');
  const calendar: Array<{
    date: string;
    isPeriodDay: boolean;
    isPredictedPeriod: boolean;
    isFertileWindow: boolean;
    isToday: boolean;
  }> = [];

  const prediction = await getCyclePredictions();

  // Show 35 days: 28 past + today + 6 future
  for (let i = -28; i <= 6; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);

    // Check for actual period data
    const key = `${STORAGE_KEYS.LOG_CYCLE}.${dateStr}`;
    const entry = await storageGet<CycleEntryV2>(key);
    const isPeriodDay = entry
      ? (entry.period_status === 'started' || entry.period_status === 'ongoing' || entry.period_status === 'spotting')
        || (!entry.period_status && (entry as any).flow_level != null)
      : false;

    // Check predictions for future dates
    let isPredictedPeriod = false;
    let isFertileWindow = false;
    if (prediction && i > 0) {
      const nextPeriod = new Date(prediction.next_period_start + 'T00:00:00');
      const periodEnd = new Date(nextPeriod);
      periodEnd.setDate(periodEnd.getDate() + prediction.average_period_duration);
      isPredictedPeriod = d >= nextPeriod && d <= periodEnd;

      const fertileStart = new Date(prediction.fertile_window_start + 'T00:00:00');
      const fertileEnd = new Date(prediction.fertile_window_end + 'T00:00:00');
      isFertileWindow = d >= fertileStart && d <= fertileEnd;
    }

    calendar.push({
      date: dateStr,
      isPeriodDay,
      isPredictedPeriod,
      isFertileWindow,
      isToday: i === 0,
    });
  }

  return calendar;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
