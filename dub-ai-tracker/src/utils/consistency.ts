// Rolling 28-day consistency computation
// Replaces consecutive streak model with "X of last 28 days" consistency

import { storageList, storageGet, storageSet, STORAGE_KEYS } from './storage';
import type { StreakData } from '../types/profile';

const WINDOW_DAYS = 28;

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Compute rolling 28-day consistency data from log keys.
 *
 * A "logged day" = any day with >= 1 entry of any tag type.
 * Uses storageList to find all `dub.log.*` keys, then extracts
 * unique dates within the 28-day window. Efficient: single call
 * instead of 672 individual key checks.
 *
 * Also computes "current run" (consecutive days from today backward).
 */
export async function computeConsistency(): Promise<StreakData> {
  const today = new Date();
  const _todayStr = formatDate(today);

  // Build the set of dates in the 28-day window
  const windowDates: string[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    windowDates.push(formatDate(d));
  }
  const windowSet = new Set(windowDates);

  // Get all log keys and extract dates that fall within the window
  const allLogKeys = await storageList('dub.log.');
  const loggedDatesInWindow = new Set<string>();

  for (const key of allLogKeys) {
    // Keys follow pattern: dub.log.{type}.{YYYY-MM-DD}
    const dateMatch = key.match(/\.(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch && windowSet.has(dateMatch[1])) {
      loggedDatesInWindow.add(dateMatch[1]);
    }
  }

  const loggedDates28d = Array.from(loggedDatesInWindow).sort();

  // Compute current consecutive run (from today backward)
  let currentRun = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    if (loggedDatesInWindow.has(windowDates[i])) {
      currentRun++;
    } else {
      break;
    }
  }

  // Load existing streak data to preserve longest_streak / total_days_logged
  const existing = await storageGet<StreakData>(STORAGE_KEYS.STREAKS);

  const longestStreak = Math.max(existing?.longest_streak ?? 0, currentRun);

  // total_days_logged: count ALL log keys' unique dates (not just 28-day window)
  const allLoggedDates = new Set<string>();
  for (const key of allLogKeys) {
    const dateMatch = key.match(/\.(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      allLoggedDates.add(dateMatch[1]);
    }
  }

  const streakData: StreakData = {
    current_streak: currentRun,
    longest_streak: longestStreak,
    total_days_logged: allLoggedDates.size,
    last_logged_date: loggedDates28d.length > 0 ? loggedDates28d[loggedDates28d.length - 1] : existing?.last_logged_date ?? null,
    logged_dates_28d: loggedDates28d,
  };

  // Persist to AsyncStorage
  await storageSet(STORAGE_KEYS.STREAKS, streakData);

  return streakData;
}

/** Derive consistency percentage from StreakData */
export function consistencyPct(streak: StreakData): number {
  return Math.round((streak.logged_dates_28d.length / WINDOW_DAYS) * 100);
}
