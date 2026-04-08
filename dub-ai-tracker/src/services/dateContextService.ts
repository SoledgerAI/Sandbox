// Date Context Service — Prompt 14: Missed-Day Backfill Logging
// Manages which date the app is currently logging entries for.
// In-memory only — resets to today on app restart.

import { todayDateString } from '../utils/dayBoundary';
import { storageGet, dateKey, STORAGE_KEYS } from '../utils/storage';

// ============================================================
// State (in-memory, not persisted)
// ============================================================

let activeDate: string = todayDateString();

// ============================================================
// Listeners (for React hook re-renders)
// ============================================================

type DateChangeListener = (date: string) => void;
const listeners: Set<DateChangeListener> = new Set();

function notifyListeners(): void {
  listeners.forEach((fn) => fn(activeDate));
}

export function addDateChangeListener(listener: DateChangeListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// ============================================================
// Date Format Validation
// ============================================================

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(date: string): boolean {
  if (!DATE_REGEX.test(date)) return false;
  const parsed = new Date(date + 'T12:00:00');
  return !isNaN(parsed.getTime());
}

// ============================================================
// Public API
// ============================================================

/**
 * Returns the currently active logging date as YYYY-MM-DD.
 * Default: today (local timezone).
 */
export function getActiveDate(): string {
  return activeDate;
}

/**
 * Sets the active logging date. Validates format.
 * Only allows today or past dates (no future).
 */
export function setActiveDate(date: string): void {
  if (!isValidDateString(date)) {
    throw new Error(`Invalid date format: "${date}". Expected YYYY-MM-DD.`);
  }
  if (date > todayDateString()) {
    throw new Error(`Cannot set active date to a future date: "${date}".`);
  }
  activeDate = date;
  notifyListeners();
}

/**
 * Resets active date to today.
 */
export function resetToToday(): void {
  activeDate = todayDateString();
  notifyListeners();
}

/**
 * Returns true if active date is not today (i.e., user is backfilling).
 */
export function isBackfilling(): boolean {
  return activeDate !== todayDateString();
}

// ============================================================
// Gap Day Detection
// ============================================================

const LOG_PREFIXES = [
  STORAGE_KEYS.LOG_FOOD,
  STORAGE_KEYS.LOG_WATER,
  STORAGE_KEYS.LOG_CAFFEINE,
  STORAGE_KEYS.LOG_WORKOUT,
  STORAGE_KEYS.LOG_STRENGTH,
  STORAGE_KEYS.LOG_STEPS,
  STORAGE_KEYS.LOG_BODY,
  STORAGE_KEYS.LOG_SLEEP,
  STORAGE_KEYS.LOG_MOOD,
  STORAGE_KEYS.LOG_GRATITUDE,
  STORAGE_KEYS.LOG_MEDITATION,
  STORAGE_KEYS.LOG_STRESS,
  STORAGE_KEYS.LOG_THERAPY,
  STORAGE_KEYS.LOG_SUPPLEMENTS,
  STORAGE_KEYS.LOG_SUBSTANCES,
  STORAGE_KEYS.LOG_SEXUAL,
  STORAGE_KEYS.LOG_CYCLE,
  STORAGE_KEYS.LOG_DIGESTIVE,
  STORAGE_KEYS.LOG_PERSONALCARE,
  STORAGE_KEYS.LOG_INJURY,
  STORAGE_KEYS.LOG_BLOODWORK,
  STORAGE_KEYS.LOG_GLUCOSE,
  STORAGE_KEYS.LOG_BP,
  STORAGE_KEYS.LOG_CUSTOM,
];

/**
 * Scans the last N days (default 7). For each day, checks if there
 * are ANY log entries for that date. Returns YYYY-MM-DD strings for
 * days with zero entries. Does not include today.
 * Sorted most recent first.
 */
export async function getGapDays(lookbackDays: number = 7): Promise<string[]> {
  const gaps: string[] = [];

  for (let i = 1; i <= lookbackDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let hasAnyEntry = false;
    for (const prefix of LOG_PREFIXES) {
      const key = dateKey(prefix, dateStr);
      const data = await storageGet<unknown>(key);
      if (data !== null) {
        if (Array.isArray(data) ? data.length > 0 : true) {
          hasAnyEntry = true;
          break;
        }
      }
    }

    if (!hasAnyEntry) {
      gaps.push(dateStr);
    }
  }

  return gaps;
}
