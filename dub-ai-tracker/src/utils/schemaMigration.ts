// AsyncStorage schema migration framework (H2)
//
// Why this exists:
//   DUB_AI has 107 storage keys and ~50 distinct data shapes. Reads are
//   structural: `JSON.parse` + optional chaining. That tolerates additive
//   changes but silently breaks on renames or type changes. This module
//   gives us an ordered, versioned upgrade path for the stored data.
//
// How it works:
//   A "schema version" integer is stored under STORAGE_KEYS.SCHEMA_VERSION.
//   Each app boot, runMigrations() compares it to CURRENT_SCHEMA_VERSION
//   and runs every registered migration whose `version` is higher than
//   the stored value, in ascending order. After each migration succeeds,
//   the stored version is advanced. If any migration throws, the whole
//   sequence STOPS (we don't skip ahead) so the failed step can be
//   retried on the next boot.
//
// Adding a migration: see the example at the bottom of the file.
//
// This framework intentionally does NOT validate or migrate types that
// haven't declared a breaking change. The goal is to have the plumbing
// ready before it's needed.
//
// Ref: PE tech diligence — "no schema versioning or migration framework"
// (H2, Sprint 30).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, storageSet, storageDelete, storageList, STORAGE_KEYS } from './storage';
import type { StrengthEntry } from '../types/strength';
import {
  matchExerciseName,
  isoWeekKey,
  usageCountKey,
  regionSessionsKey,
  getUsageCount,
  getRegionSessions,
} from '../services/strengthService';
import type { BodyRegion } from '../config/exerciseCatalog';

// ============================================================
// Version constant & storage key
// ============================================================

/**
 * Increment this every time you add a new migration.
 * Must match the highest `version` in MIGRATIONS.
 */
export const CURRENT_SCHEMA_VERSION = 3;

/** AsyncStorage key holding the current schema version (number). */
export const SCHEMA_VERSION_KEY = STORAGE_KEYS.SCHEMA_VERSION;

// ============================================================
// Migration type
// ============================================================

export interface Migration {
  /** Monotonically increasing integer, unique across all migrations. */
  version: number;
  /** Short human-readable description — shown in logs. */
  description: string;
  /** Mutates stored data. Throw to abort the whole run. */
  migrate: () => Promise<void>;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migrationsRun: number;
  error?: string;
}

export interface RunMigrationsOptions {
  /** Override the migration list. Defaults to MIGRATIONS. Test-only. */
  migrations?: Migration[];
  /** Override the target version. Defaults to CURRENT_SCHEMA_VERSION. Test-only. */
  targetVersion?: number;
}

// ============================================================
// Migration registry
// ============================================================

/**
 * Ordered list of migrations. MUST be sorted by `version` ascending.
 * Append new entries; never reorder or delete past ones.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Establish schema versioning',
    migrate: async () => {
      // No data changes. This migration exists to set the initial
      // version marker on existing installs so future migrations have
      // a baseline to compare against.
    },
  },
  {
    version: 2,
    description: 'S36 — strength v2: equipment election, exercise election, region session counters with backfill',
    migrate: migrateV1ToV2,
  },
  {
    version: 3,
    description: 'S33-A — rep presets + pain logger: register new keyspaces; no data backfill',
    migrate: migrateV2ToV3,
  },
];

// ============================================================
// V1 → V2 migration (S36)
// ============================================================

const ROLLBACK_WINDOW_DAYS = 30;

interface V1V2Backup {
  pre_version: number;
  performed_at: number;        // epoch ms
  expires_at: number;          // epoch ms
  touched_keys: string[];
  backfill_stats: {
    entries_scanned: number;
    matches_found: number;
    unmatched: number;
  };
}

/**
 * One-time migration that:
 *   - Initializes equipment election to ['bodyweight'] if absent.
 *   - Initializes elected_exercises to [] if absent.
 *   - Backfills usage_count + region_sessions counters from existing
 *     StrengthEntry records via case-insensitive substring match.
 *   - Records a rollback backup record (30-day TTL).
 *
 * Idempotent: re-running with v2 already applied is a no-op because
 * (a) the framework's runMigrations early-exits when fromVersion >= target,
 * and (b) initialization steps use defaultIfAbsent semantics.
 *
 * Direct-call idempotency relies on the touched_keys backup — if a backup
 * already exists from a prior successful run, the backfill scan is skipped.
 */
export async function migrateV1ToV2(): Promise<void> {
  const existingBackup = await storageGet<V1V2Backup>(STORAGE_KEYS.MIGRATION_V1_V2_BACKUP);
  const alreadyRan = existingBackup != null;

  const touched = new Set<string>();

  // 1. Equipment election default.
  const equip = await storageGet<unknown>(STORAGE_KEYS.SETTINGS_EQUIPMENT);
  if (equip == null) {
    await storageSet(STORAGE_KEYS.SETTINGS_EQUIPMENT, ['bodyweight']);
    touched.add(STORAGE_KEYS.SETTINGS_EQUIPMENT);
  }

  // 2. Elected exercises default.
  const elected = await storageGet<unknown>(STORAGE_KEYS.SETTINGS_ELECTED_EXERCISES);
  if (elected == null) {
    await storageSet(STORAGE_KEYS.SETTINGS_ELECTED_EXERCISES, []);
    touched.add(STORAGE_KEYS.SETTINGS_ELECTED_EXERCISES);
  }

  // 3. Backfill counters from existing StrengthEntry records.
  // Skip if a previous run already did this (idempotency).
  let entriesScanned = 0;
  let matchesFound = 0;
  let unmatched = 0;

  if (!alreadyRan) {
    const strengthKeys = await storageList(STORAGE_KEYS.LOG_STRENGTH);
    // Per (week, region, day) ledger to avoid double-counting same-day sessions.
    const sessionLedger = new Set<string>();
    // Local accumulators keep us from re-reading per increment.
    const usageDeltas = new Map<string, number>();
    const regionDeltas = new Map<string, number>(); // key: weekKey|region

    for (const key of strengthKeys) {
      const entries = await storageGet<StrengthEntry[]>(key);
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        for (const ex of entry.exercises) {
          entriesScanned += 1;
          const matched = matchExerciseName(ex.name);
          if (!matched) {
            unmatched += 1;
            continue;
          }
          matchesFound += 1;
          usageDeltas.set(matched.id, (usageDeltas.get(matched.id) ?? 0) + 1);
          const t = Date.parse(entry.timestamp);
          if (!Number.isFinite(t)) continue;
          const d = new Date(t);
          const week = isoWeekKey(d);
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const region = matched.primary;
          const ledgerKey = `${week}|${region}|${day}`;
          if (!sessionLedger.has(ledgerKey)) {
            sessionLedger.add(ledgerKey);
            const rk = `${week}|${region}`;
            regionDeltas.set(rk, (regionDeltas.get(rk) ?? 0) + 1);
          }
        }
      }
    }

    // Apply usage deltas.
    for (const [exId, delta] of usageDeltas) {
      const k = usageCountKey(exId);
      const prev = await getUsageCount(exId);
      await storageSet(k, prev + delta);
      touched.add(k);
    }

    // Apply region deltas.
    for (const [weekRegion, delta] of regionDeltas) {
      const [week, region] = weekRegion.split('|');
      const k = regionSessionsKey(week, region as BodyRegion);
      const prev = await getRegionSessions(week, region as BodyRegion);
      await storageSet(k, prev + delta);
      touched.add(k);
    }
  } else {
    // Already-ran path: keep stats from the prior run for visibility.
    entriesScanned = existingBackup!.backfill_stats.entries_scanned;
    matchesFound = existingBackup!.backfill_stats.matches_found;
    unmatched = existingBackup!.backfill_stats.unmatched;
  }

  // 4. Write rollback backup if it doesn't already exist.
  if (!alreadyRan) {
    const now = Date.now();
    const backup: V1V2Backup = {
      pre_version: 1,
      performed_at: now,
      expires_at: now + ROLLBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      touched_keys: Array.from(touched),
      backfill_stats: {
        entries_scanned: entriesScanned,
        matches_found: matchesFound,
        unmatched,
      },
    };
    await storageSet(STORAGE_KEYS.MIGRATION_V1_V2_BACKUP, backup);
  }
}

// ============================================================
// runMigrations
// ============================================================

/**
 * Read the stored schema version, run any pending migrations in order,
 * and persist the new version. Call once during app boot, after storage
 * is confirmed accessible but before any screens read data.
 *
 * Never throws — returns { success: false, error } instead.
 */
export async function runMigrations(
  options: RunMigrationsOptions = {},
): Promise<MigrationResult> {
  const migrations = options.migrations ?? MIGRATIONS;
  const targetVersion = options.targetVersion ?? CURRENT_SCHEMA_VERSION;

  let fromVersion = 0;

  try {
    const stored = await storageGet<number>(SCHEMA_VERSION_KEY);
    if (typeof stored === 'number' && Number.isFinite(stored)) {
      fromVersion = stored;
    }
  } catch (error) {
    return {
      success: false,
      fromVersion: 0,
      toVersion: 0,
      migrationsRun: 0,
      error: `Failed to read schema version: ${String(error)}`,
    };
  }

  // Defensive: if stored version is ahead of code (downgrade scenario),
  // do nothing. Treat as already-current.
  if (fromVersion >= targetVersion) {
    return {
      success: true,
      fromVersion,
      toVersion: fromVersion,
      migrationsRun: 0,
    };
  }

  const pending = migrations
    .filter((m) => m.version > fromVersion && m.version <= targetVersion)
    .sort((a, b) => a.version - b.version);

  let currentVersion = fromVersion;
  let migrationsRun = 0;

  for (const migration of pending) {
    try {
      if (__DEV__) {
        console.log(
          `[MIGRATION] Running v${migration.version}: ${migration.description}`,
        );
      }
      await migration.migrate();
      currentVersion = migration.version;
      await storageSet(SCHEMA_VERSION_KEY, currentVersion);
      migrationsRun += 1;
    } catch (error) {
      // STOP — do not skip migrations. Next boot will retry from
      // the last-known-good version, which was persisted before this
      // one ran.
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[MIGRATION] v${migration.version} FAILED: ${message}`,
      );
      return {
        success: false,
        fromVersion,
        toVersion: currentVersion,
        migrationsRun,
        error: `Migration v${migration.version} failed: ${message}`,
      };
    }
  }

  return {
    success: true,
    fromVersion,
    toVersion: currentVersion,
    migrationsRun,
  };
}

// ============================================================
// Helpers for authoring migrations
// ============================================================

/**
 * Move the value at `oldKey` to `newKey` and delete the old key.
 * No-op if `oldKey` doesn't exist.
 */
export async function renameStorageKey(
  oldKey: string,
  newKey: string,
): Promise<void> {
  const value = await storageGet<unknown>(oldKey);
  if (value === null) return;
  await storageSet(newKey, value);
  await storageDelete(oldKey);
}

/**
 * Read the value at `key`, apply `transform`, and write the result back.
 * No-op if `key` doesn't exist. If `transform` returns `null`, the key is
 * deleted.
 */
export async function transformStorageValue<T>(
  key: string,
  transform: (old: unknown) => T | null,
): Promise<void> {
  const current = await storageGet<unknown>(key);
  if (current === null) return;
  const next = transform(current);
  if (next === null) {
    await storageDelete(key);
    return;
  }
  await storageSet(key, next);
}

/**
 * For every key starting with `keyPrefix` (typically a date-keyed log
 * prefix like "dub.log.food"), read the entries, add `fieldName` with
 * `defaultValue` to each entry that doesn't already have it, and write
 * back. Entries are expected to be arrays of objects; non-array values
 * are skipped.
 */
export async function addFieldToEntries(
  keyPrefix: string,
  fieldName: string,
  defaultValue: unknown,
): Promise<void> {
  const keys = await storageList(keyPrefix);
  for (const key of keys) {
    const value = await storageGet<unknown>(key);
    if (!Array.isArray(value)) continue;
    let changed = false;
    const next = value.map((entry) => {
      if (entry && typeof entry === 'object' && !(fieldName in entry)) {
        changed = true;
        return { ...entry, [fieldName]: defaultValue };
      }
      return entry;
    });
    if (changed) {
      await storageSet(key, next);
    }
  }
}

// ============================================================
// Test-only helpers
// ============================================================

/**
 * Reset the stored schema version. Intended for test setup only; exported
 * so tests don't have to know the raw key. Not referenced by app code.
 */
export async function __resetSchemaVersionForTests(): Promise<void> {
  await AsyncStorage.removeItem(SCHEMA_VERSION_KEY);
}

// ============================================================
// Example: how a future migration would look
// ============================================================
//
// Suppose in Sprint 31 we rename `profile.weight` to `profile.body_weight`.
// We would append this to MIGRATIONS and bump CURRENT_SCHEMA_VERSION to 2:
//
//   {
//     version: 2,
//     description: 'Rename profile.weight to profile.body_weight',
//     migrate: async () => {
//       await transformStorageValue('dub.profile', (profile) => {
//         if (profile && typeof profile === 'object' && 'weight' in profile) {
//           const p = profile as Record<string, unknown>;
//           p.body_weight = p.weight;
//           delete p.weight;
//           return p;
//         }
//         return profile as Record<string, unknown>;
//       });
//     },
//   }
//
// The framework handles ordering, version persistence, and failure
// recovery.

// ============================================================
// V2 → V3 migration (S33-A)
// ============================================================

interface V2V3Backup {
  pre_version: number;
  performed_at: number;
  expires_at: number;
  touched_keys: string[];
}

/**
 * S33-A migration. No data backfill — both new keyspaces
 * (dub.strength.rep_presets.* and dub.log.pain.*) start empty
 * and populate as the user uses the new surfaces.
 *
 * Idempotent by construction: the only side effect is writing
 * the rollback backup record, which is gated on its own
 * absence. Running the migration twice produces the same
 * stored state.
 */
export async function migrateV2ToV3(): Promise<void> {
  const existingBackup = await storageGet<V2V3Backup>(STORAGE_KEYS.MIGRATION_V2_V3_BACKUP);
  if (existingBackup != null) return; // already ran
  const now = Date.now();
  const backup: V2V3Backup = {
    pre_version: 2,
    performed_at: now,
    expires_at: now + ROLLBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    touched_keys: [], // no data backfill in this migration
  };
  await storageSet(STORAGE_KEYS.MIGRATION_V2_V3_BACKUP, backup);
}
