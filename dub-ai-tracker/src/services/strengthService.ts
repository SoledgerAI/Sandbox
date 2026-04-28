// S36: Strength training service — pure logic for region counters,
// usage counts, ISO week derivation, election, and trend aggregation.
//
// All date keys are LOCAL-time. Do not change to UTC. Reference:
// coachToolExecutor.todayString() (the canonical local-perspective
// helper after H46). UTC-derived storage keys cause the daily-key
// mismatch bug class fixed in commit b83e1ee.

import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';
import {
  EXERCISE_CATALOG,
  type BodyRegion,
  type Equipment,
  type Exercise,
  ALL_BODY_REGIONS,
} from '../config/exerciseCatalog';
import type { StrengthEntry } from '../types/strength';

// ============================================================
// ISO week (Monday-start, ISO 8601), LOCAL time
// ============================================================

/**
 * Returns the ISO week string `YYYY-WW` for the given local Date.
 * Week numbering follows ISO 8601: weeks start Monday, week 1 is the
 * week containing the first Thursday of the year.
 *
 * Uses LOCAL-time getters (getFullYear, getMonth, getDate). Do NOT
 * substitute toISOString() / UTC math — see H46 incident.
 */
export function isoWeekKey(date: Date): string {
  // Construct a UTC-anchored copy of the local Y/M/D so the ISO-8601
  // arithmetic below is timezone-independent. The point is to keep the
  // *day* the user sees, not their wall clock; converting via UTC
  // getters would shift days for users west of UTC.
  const local = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  // ISO weeks: Sunday = 7
  const dayNum = local.getUTCDay() || 7;
  // Set to nearest Thursday (current date + 4 - day number)
  local.setUTCDate(local.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(local.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((local.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const yyyy = local.getUTCFullYear();
  const ww = String(weekNo).padStart(2, '0');
  return `${yyyy}-${ww}`;
}

/** LOCAL-time `YYYY-MM-DD` for a Date. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ============================================================
// Storage keys
// ============================================================

export function usageCountKey(exerciseId: string): string {
  return `${STORAGE_KEYS.EXERCISE_USAGE_COUNT_PREFIX}.${exerciseId}`;
}

export function regionSessionsKey(weekKey: string, region: BodyRegion): string {
  return `${STORAGE_KEYS.STRENGTH_REGION_SESSIONS_PREFIX}.${weekKey}.${region}`;
}

// ============================================================
// Equipment election
// ============================================================

export async function getElectedEquipment(): Promise<Equipment[]> {
  const stored = await storageGet<Equipment[]>(STORAGE_KEYS.SETTINGS_EQUIPMENT);
  return stored ?? ['bodyweight'];
}

export async function setElectedEquipment(items: Equipment[]): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS_EQUIPMENT, items);
}

// ============================================================
// Exercise election (favorites)
// ============================================================

export async function getElectedExercises(): Promise<string[]> {
  const stored = await storageGet<string[]>(STORAGE_KEYS.SETTINGS_ELECTED_EXERCISES);
  return stored ?? [];
}

export async function setElectedExercises(ids: string[]): Promise<void> {
  // Dedupe to keep election idempotent.
  await storageSet(STORAGE_KEYS.SETTINGS_ELECTED_EXERCISES, Array.from(new Set(ids)));
}

export async function toggleElectedExercise(id: string): Promise<string[]> {
  const current = await getElectedExercises();
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  await setElectedExercises(next);
  return next;
}

// ============================================================
// Usage count
// ============================================================

export async function getUsageCount(exerciseId: string): Promise<number> {
  const v = await storageGet<number>(usageCountKey(exerciseId));
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

export async function incrementUsageCount(exerciseId: string): Promise<number> {
  const next = (await getUsageCount(exerciseId)) + 1;
  await storageSet(usageCountKey(exerciseId), next);
  return next;
}

// ============================================================
// Region session counters
// ============================================================

export async function getRegionSessions(
  weekKey: string,
  region: BodyRegion,
): Promise<number> {
  const v = await storageGet<number>(regionSessionsKey(weekKey, region));
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

export async function setRegionSessions(
  weekKey: string,
  region: BodyRegion,
  count: number,
): Promise<void> {
  await storageSet(regionSessionsKey(weekKey, region), count);
}

/**
 * Increment a region's weekly session count by 1, but only if the same
 * (region, day) pair hasn't already been recorded that week. The
 * idempotency guard is stored in a tiny per-week ledger so multiple log
 * entries on the same day don't double-count.
 */
const SESSION_LEDGER_PREFIX = 'dub.strength.region_sessions._ledger';

function ledgerKey(weekKey: string): string {
  return `${SESSION_LEDGER_PREFIX}.${weekKey}`;
}

interface SessionLedgerEntry {
  region: BodyRegion;
  day: string; // YYYY-MM-DD local
}

export async function recordRegionSession(
  region: BodyRegion,
  date: Date,
): Promise<{ counted: boolean; total: number }> {
  const week = isoWeekKey(date);
  const day = localDateKey(date);
  const ledger = (await storageGet<SessionLedgerEntry[]>(ledgerKey(week))) ?? [];
  const already = ledger.some((e) => e.region === region && e.day === day);
  if (already) {
    const total = await getRegionSessions(week, region);
    return { counted: false, total };
  }
  const nextLedger = [...ledger, { region, day }];
  await storageSet(ledgerKey(week), nextLedger);
  const next = (await getRegionSessions(week, region)) + 1;
  await setRegionSessions(week, region, next);
  return { counted: true, total: next };
}

// ============================================================
// Backfill matcher (used by schema migration v1 → v2)
// ============================================================

/**
 * Map a free-text exercise name to a catalog id via case-insensitive
 * substring matching, longest-name-first to prefer more specific matches
 * ("Incline Bench Press" beats "Bench Press"). Returns null on no match.
 */
export function matchExerciseName(freeText: string): Exercise | null {
  const haystack = freeText.toLowerCase().trim();
  if (!haystack) return null;
  // Build an exact-name lookup first (highest signal).
  for (const ex of EXERCISE_CATALOG) {
    if (ex.name.toLowerCase() === haystack) return ex;
  }
  // Substring match: prefer entries whose name is contained in the user's
  // text (the catalog name is a substring of the user's free text), then
  // entries that contain the user's text. Longer catalog names win to bias
  // toward specificity.
  const sortedByLen = EXERCISE_CATALOG
    .slice()
    .sort((a, b) => b.name.length - a.name.length);
  for (const ex of sortedByLen) {
    const exName = ex.name.toLowerCase();
    if (haystack.includes(exName)) return ex;
  }
  for (const ex of sortedByLen) {
    const exName = ex.name.toLowerCase();
    if (exName.includes(haystack)) return ex;
  }
  return null;
}

// ============================================================
// Aggregation: 4-week rolling region averages and undertrained flags
// ============================================================

export interface RegionWeekly {
  region: BodyRegion;
  sessions_per_week_avg: number;
  weeks_sampled: number;
}

export interface UndertrainedFlag {
  region: BodyRegion;
  sessions_per_week_avg: number;
  target: number;
}

/** Returns ISO week keys for the last `weeks` weeks ending at `endDate`. */
export function lastNWeekKeys(endDate: Date, weeks: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < weeks; i += 1) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i * 7);
    out.push(isoWeekKey(d));
  }
  return Array.from(new Set(out));
}

export async function getStrengthTargetPerWeek(): Promise<number> {
  const v = await storageGet<number>(STORAGE_KEYS.STRENGTH_TARGET_PER_WEEK);
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 2;
}

export async function getRegionWeeklyAverages(
  endDate: Date,
  weeks: number,
): Promise<RegionWeekly[]> {
  const weekKeys = lastNWeekKeys(endDate, weeks);
  const out: RegionWeekly[] = [];
  for (const region of ALL_BODY_REGIONS) {
    let total = 0;
    for (const w of weekKeys) {
      total += await getRegionSessions(w, region);
    }
    out.push({
      region,
      sessions_per_week_avg: total / weekKeys.length,
      weeks_sampled: weekKeys.length,
    });
  }
  return out;
}

export async function getUndertrainedFlags(
  endDate: Date,
  weeks: number = 4,
): Promise<UndertrainedFlag[]> {
  const target = await getStrengthTargetPerWeek();
  const averages = await getRegionWeeklyAverages(endDate, weeks);
  const flags: UndertrainedFlag[] = [];
  for (const a of averages) {
    if (a.sessions_per_week_avg < target * 0.5) {
      flags.push({
        region: a.region,
        sessions_per_week_avg: a.sessions_per_week_avg,
        target,
      });
    }
  }
  return flags;
}

/**
 * Scan strength entries within the last `windowDays` and return the set of
 * regions that have at least one logged session. Used by the coach context
 * builder for `last_7_days_regions_hit` and `last_28_days_regions_hit`.
 */
export function regionsHitFromEntries(
  entries: StrengthEntry[],
  endDate: Date,
  windowDays: number,
): BodyRegion[] {
  const cutoff = new Date(endDate);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffMs = cutoff.getTime();
  const hit = new Set<BodyRegion>();
  for (const entry of entries) {
    const t = Date.parse(entry.timestamp);
    if (!Number.isFinite(t) || t < cutoffMs) continue;
    for (const ex of entry.exercises) {
      const id = ex.exercise_id ?? null;
      const matched = id ? EXERCISE_CATALOG.find((e) => e.id === id) : matchExerciseName(ex.name);
      if (matched) hit.add(matched.primary);
    }
  }
  return Array.from(hit);
}
