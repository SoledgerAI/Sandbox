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

// ============================================================
// Version constant & storage key
// ============================================================

/**
 * Increment this every time you add a new migration.
 * Must match the highest `version` in MIGRATIONS.
 */
export const CURRENT_SCHEMA_VERSION = 1;

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
];

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
