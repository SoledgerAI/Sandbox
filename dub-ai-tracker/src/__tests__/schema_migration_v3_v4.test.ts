// S33-B: Schema migration v3 → v4 — backfill cadence/archived/created_at/target.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
} from '../utils/storage';
import {
  runMigrations,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  __resetSchemaVersionForTests,
  migrateV3ToV4,
} from '../utils/schemaMigration';
import type { HabitDefinition } from '../types';

beforeEach(async () => {
  await AsyncStorage.clear();
  await __resetSchemaVersionForTests();
});

describe('schema migration v3 → v4', () => {
  it('runs from v3 starting state to v4', async () => {
    // Stored shape pre-S33B: only {id, name, order}.
    const pre: HabitDefinition[] = [
      { id: 'h1', name: 'Old habit', order: 0 },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, pre);
    await AsyncStorage.setItem(SCHEMA_VERSION_KEY, JSON.stringify(3));

    const result = await runMigrations();
    expect(result.success).toBe(true);
    expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(4);
  });

  it('migration is idempotent (run twice produces same backup record)', async () => {
    await migrateV3ToV4();
    const b1 = await storageGet<{ performed_at: number }>(STORAGE_KEYS.MIGRATION_V3_V4_BACKUP);
    await migrateV3ToV4();
    const b2 = await storageGet<{ performed_at: number }>(STORAGE_KEYS.MIGRATION_V3_V4_BACKUP);
    expect(b2?.performed_at).toBe(b1?.performed_at);
  });

  it('schemaVersion persisted = 4 post-migration', async () => {
    await runMigrations();
    const v = await storageGet<number>(SCHEMA_VERSION_KEY);
    expect(v).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('backfills cadence={kind:"daily"} on stored habits without cadence', async () => {
    const pre: HabitDefinition[] = [
      { id: 'h1', name: 'A', order: 0 },
      { id: 'h2', name: 'B', order: 1 },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, pre);
    await migrateV3ToV4();
    const after = await storageGet<HabitDefinition[]>(STORAGE_KEYS.SETTINGS_HABITS);
    expect(after?.[0].cadence).toEqual({ kind: 'daily' });
    expect(after?.[1].cadence).toEqual({ kind: 'daily' });
    expect(after?.[0].archived).toBe(false);
    expect(after?.[0].created_at).toEqual(expect.any(Number));
  });

  it('count_per_week habits get target = count when target absent', async () => {
    // Hypothetical pre-existing habit that already has a non-daily cadence
    // but no target field. Migration should fill target.
    const pre: HabitDefinition[] = [
      {
        id: 'h_strength',
        name: 'Strength',
        order: 0,
        cadence: { kind: 'count_per_week', count: 3 },
      },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, pre);
    await migrateV3ToV4();
    const after = await storageGet<HabitDefinition[]>(STORAGE_KEYS.SETTINGS_HABITS);
    expect(after?.[0].target).toBe(3);
  });

  it('writes v3_v4_backup record with backfill_stats', async () => {
    const pre: HabitDefinition[] = [
      { id: 'h1', name: 'A', order: 0 },
      {
        id: 'h2',
        name: 'B',
        order: 1,
        cadence: { kind: 'daily' },
        archived: false,
        created_at: 12345,
      },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, pre);
    await migrateV3ToV4();
    const backup = await storageGet<{
      pre_version: number;
      performed_at: number;
      expires_at: number;
      touched_keys: string[];
      backfill_stats: {
        habits_count: number;
        habits_already_normalized: number;
        habits_backfilled: number;
      };
    }>(STORAGE_KEYS.MIGRATION_V3_V4_BACKUP);
    expect(backup).not.toBeNull();
    expect(backup?.pre_version).toBe(3);
    expect(backup?.backfill_stats.habits_count).toBe(2);
    expect(backup?.backfill_stats.habits_already_normalized).toBe(1);
    expect(backup?.backfill_stats.habits_backfilled).toBe(1);
    // 30-day rollback window.
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const window = backup!.expires_at - backup!.performed_at;
    expect(window).toBeGreaterThanOrEqual(thirtyDays - 1000);
    expect(window).toBeLessThanOrEqual(thirtyDays + 1000);
  });
});
