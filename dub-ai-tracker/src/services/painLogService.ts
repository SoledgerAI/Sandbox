// S33-A: Pain log persistence + Coach-context aggregations.
//
// Storage layout:
//   dub.log.pain.<entry_id>                       = PainEntry
//   dub.log.pain.index.by_date.<YYYY-MM-DD>       = entry_id[]
//   dub.log.pain.index.by_area.<area>             = entry_id[]
//
// All date keys are LOCAL-time per H46. Reference: todayString() in
// coachToolExecutor.ts (the canonical local-perspective helper).

import { storageGet, storageSet, storageDelete, STORAGE_KEYS } from '../utils/storage';
import type { JointPainArea, PainEntry } from '../types';
import {
  PAIN_PERSISTENT_THRESHOLD_COUNT,
  PAIN_PERSISTENT_THRESHOLD_DAYS,
  PAIN_CHRONIC_THRESHOLD_WEEKS,
  PAIN_CHRONIC_THRESHOLD_WINDOW,
} from '../constants/painChips';

function entryKey(id: string): string {
  return `${STORAGE_KEYS.PAIN_LOG_PREFIX}.${id}`;
}

function byDateKey(yyyymmdd: string): string {
  return `${STORAGE_KEYS.PAIN_LOG_INDEX_BY_DATE}.${yyyymmdd}`;
}

function byAreaKey(area: JointPainArea): string {
  return `${STORAGE_KEYS.PAIN_LOG_INDEX_BY_AREA}.${area}`;
}

/** LOCAL-time YYYY-MM-DD for a given Date. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** ISO 8601 week key (Monday start), LOCAL-anchored. Mirrors the helper
 *  in strengthService.ts so both surfaces compute the same week key. */
export function isoWeekKey(date: Date): string {
  const local = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(local.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((local.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${local.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function genEntryId(): string {
  return `pain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ------------------------------------------------------------
// Save / delete
// ------------------------------------------------------------

export interface SavePainInput {
  areas: JointPainArea[];
  severity: 1 | 2 | 3 | 4 | 5;
  duration_days?: number;
  notes?: string;
  /** Optional user-overridden timestamp. If omitted, "now" (local). */
  timestamp?: number;
}

export async function savePainEntry(input: SavePainInput): Promise<PainEntry> {
  if (input.areas.length === 0) {
    throw new Error('At least one pain area is required.');
  }
  if (input.notes != null && input.notes.length > 500) {
    throw new Error('Notes must be 500 characters or fewer.');
  }
  const ts = input.timestamp ?? Date.now();
  const entry: PainEntry = {
    id: genEntryId(),
    timestamp: ts,
    areas: Array.from(new Set(input.areas)),
    severity: input.severity,
    ...(input.duration_days != null ? { duration_days: input.duration_days } : {}),
    ...(input.notes != null && input.notes.length > 0 ? { notes: input.notes } : {}),
  };
  await storageSet(entryKey(entry.id), entry);

  // by-date index
  const dateKey = localDateKey(new Date(ts));
  const dateList = (await storageGet<string[]>(byDateKey(dateKey))) ?? [];
  if (!dateList.includes(entry.id)) {
    await storageSet(byDateKey(dateKey), [...dateList, entry.id]);
  }

  // by-area index (one row per selected area)
  for (const area of entry.areas) {
    const areaList = (await storageGet<string[]>(byAreaKey(area))) ?? [];
    if (!areaList.includes(entry.id)) {
      await storageSet(byAreaKey(area), [...areaList, entry.id]);
    }
  }

  return entry;
}

export async function getPainEntry(id: string): Promise<PainEntry | null> {
  return (await storageGet<PainEntry>(entryKey(id))) ?? null;
}

export async function deletePainEntry(id: string): Promise<void> {
  const entry = await getPainEntry(id);
  if (!entry) return;
  await storageDelete(entryKey(id));

  const dateKey = localDateKey(new Date(entry.timestamp));
  const dateList = (await storageGet<string[]>(byDateKey(dateKey))) ?? [];
  await storageSet(byDateKey(dateKey), dateList.filter((x) => x !== id));

  for (const area of entry.areas) {
    const areaList = (await storageGet<string[]>(byAreaKey(area))) ?? [];
    await storageSet(byAreaKey(area), areaList.filter((x) => x !== id));
  }
}

// ------------------------------------------------------------
// Coach context aggregations
// ------------------------------------------------------------

async function loadEntriesForArea(area: JointPainArea): Promise<PainEntry[]> {
  const ids = (await storageGet<string[]>(byAreaKey(area))) ?? [];
  const entries: PainEntry[] = [];
  for (const id of ids) {
    const e = await getPainEntry(id);
    if (e) entries.push(e);
  }
  return entries;
}

async function getAllEntries(): Promise<PainEntry[]> {
  const all: PainEntry[] = [];
  const seen = new Set<string>();
  // Walk via the per-area index (covers all entries since at least one area
  // is always selected).
  const areas: JointPainArea[] = ['hands', 'shoulders', 'back', 'hips', 'knees', 'feet', 'general'];
  for (const area of areas) {
    const entries = await loadEntriesForArea(area);
    for (const e of entries) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        all.push(e);
      }
    }
  }
  return all;
}

export interface PainContextSummary {
  pain_areas_last_14d: JointPainArea[];
  persistent_pain_areas: JointPainArea[];
  chronic_pain_areas: JointPainArea[];
}

/** Build the three pain-related Coach context arrays. `endDate` is "now"
 *  in production; tests inject a fixed date. Empty pain log → all arrays
 *  empty. */
export async function buildPainContext(endDate: Date): Promise<PainContextSummary> {
  const all = await getAllEntries();

  // last 14 days window — distinct areas, sorted by frequency desc
  const persistentMs = PAIN_PERSISTENT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const persistentCutoff = endDate.getTime() - persistentMs;
  const recent = all.filter((e) => e.timestamp >= persistentCutoff);
  const freq = new Map<JointPainArea, number>();
  for (const e of recent) {
    for (const area of e.areas) {
      freq.set(area, (freq.get(area) ?? 0) + 1);
    }
  }
  const pain_areas_last_14d = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area);

  const persistent_pain_areas = Array.from(freq.entries())
    .filter(([, count]) => count >= PAIN_PERSISTENT_THRESHOLD_COUNT)
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area);

  // chronic: per-area, count distinct ISO weeks within the last
  // PAIN_CHRONIC_THRESHOLD_WINDOW weeks; flag if ≥ THRESHOLD_WEEKS.
  const chronicMs = PAIN_CHRONIC_THRESHOLD_WINDOW * 7 * 24 * 60 * 60 * 1000;
  const chronicCutoff = endDate.getTime() - chronicMs;
  const weeksByArea = new Map<JointPainArea, Set<string>>();
  for (const e of all) {
    if (e.timestamp < chronicCutoff) continue;
    const week = isoWeekKey(new Date(e.timestamp));
    for (const area of e.areas) {
      let set = weeksByArea.get(area);
      if (!set) {
        set = new Set();
        weeksByArea.set(area, set);
      }
      set.add(week);
    }
  }
  const chronic_pain_areas: JointPainArea[] = [];
  for (const [area, weeks] of weeksByArea) {
    if (weeks.size >= PAIN_CHRONIC_THRESHOLD_WEEKS) chronic_pain_areas.push(area);
  }

  return { pain_areas_last_14d, persistent_pain_areas, chronic_pain_areas };
}
