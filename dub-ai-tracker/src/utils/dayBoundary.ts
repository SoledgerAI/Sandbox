// P1-21: Day boundary — configurable "day starts at" hour.
// Module-level state: set once on app init, consumed everywhere.

import { storageGet, STORAGE_KEYS } from './storage';
import type { AppSettings } from '../types/profile';

/** Valid "day starts at" options (hours past midnight). */
export type DayBoundaryHour = 0 | 3 | 4 | 5 | 6;

export const DAY_BOUNDARY_OPTIONS: { value: DayBoundaryHour; label: string }[] = [
  { value: 0, label: 'Midnight (default)' },
  { value: 3, label: '3:00 AM' },
  { value: 4, label: '4:00 AM' },
  { value: 5, label: '5:00 AM' },
  { value: 6, label: '6:00 AM' },
];

// -- Module-level boundary hour (set at app init) --

let _boundaryHour: DayBoundaryHour = 0;

export function setDayBoundaryHour(h: DayBoundaryHour): void {
  _boundaryHour = h;
}

export function getDayBoundaryHour(): DayBoundaryHour {
  return _boundaryHour;
}

/**
 * Load day boundary hour from settings. Call once at app startup.
 */
export async function initDayBoundary(): Promise<void> {
  const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
  const hour = settings?.day_boundary_hour;
  if (hour === 3 || hour === 4 || hour === 5 || hour === 6) {
    _boundaryHour = hour;
  } else {
    _boundaryHour = 0;
  }
}

/**
 * Returns today's logical date string (YYYY-MM-DD) respecting the day boundary.
 * If current time is before the boundary hour, we're still on "yesterday".
 */
export function todayDateString(): string {
  const now = new Date();
  if (_boundaryHour > 0 && now.getHours() < _boundaryHour) {
    now.setDate(now.getDate() - 1);
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Compute the EOD questionnaire trigger hour given the current day boundary.
 * Formula: boundary hour - 3 (wrapping at midnight), clamped to [18, 23].
 * Default (boundary=0): 21:00 (9 PM).
 */
export function getEODBoundaryHour(): number {
  if (_boundaryHour === 0) return 21;
  // boundary - 3, wrap around midnight
  let eod = _boundaryHour + 24 - 3; // e.g., 3 AM boundary → 24:00 → midnight
  if (eod >= 24) eod -= 24;
  // Clamp to [18, 23]
  return Math.max(18, Math.min(23, eod));
}
