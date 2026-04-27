// Sprint 30: derive the user's target sleep hours.
// Decision (Josh, 2026-04-27): hybrid. Prefer the duration implied by
// SETTINGS_SLEEP_SCHEDULE (target_bedtime → target_wake_time), and fall back
// to a fixed default when the schedule is missing or malformed.

import { storageGet, STORAGE_KEYS } from './storage';
import type { SleepScheduleSettings } from '../types';

export const DEFAULT_SLEEP_TARGET_HOURS = 8;

const HHMM_RE = /^(\d{1,2}):(\d{2})$/;

function parseHHMMToMinutes(hhmm: string): number | null {
  const m = HHMM_RE.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Returns the user's target sleep duration in hours.
 * - Reads SETTINGS_SLEEP_SCHEDULE; if both target_bedtime and target_wake_time
 *   are valid HH:MM strings, returns the cross-midnight-aware duration.
 * - Otherwise (or on parse failure) returns DEFAULT_SLEEP_TARGET_HOURS.
 * - Result is clamped to [4, 12] hours so a misconfigured schedule cannot
 *   drive downstream debt logic to absurd values.
 */
export async function getSleepTargetHours(): Promise<number> {
  const settings = await storageGet<SleepScheduleSettings>(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE);
  if (!settings || !settings.target_bedtime || !settings.target_wake_time) {
    return DEFAULT_SLEEP_TARGET_HOURS;
  }
  const bed = parseHHMMToMinutes(settings.target_bedtime);
  const wake = parseHHMMToMinutes(settings.target_wake_time);
  if (bed == null || wake == null) return DEFAULT_SLEEP_TARGET_HOURS;
  // Cross-midnight: bedtime 22:30, wake 06:00 → (360 - 1350 + 1440) % 1440 = 450 → 7.5h
  const diffMin = (wake - bed + 24 * 60) % (24 * 60);
  const hours = diffMin / 60;
  if (!Number.isFinite(hours)) return DEFAULT_SLEEP_TARGET_HOURS;
  if (hours < 4) return 4;
  if (hours > 12) return 12;
  return hours;
}
