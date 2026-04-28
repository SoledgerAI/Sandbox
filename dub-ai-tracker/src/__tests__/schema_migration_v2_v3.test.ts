// S33-A: Schema migration v2 → v3 — empty backfill + idempotency.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, STORAGE_KEYS } from '../utils/storage';
import {
  runMigrations,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  __resetSchemaVersionForTests,
  migrateV1ToV2,
} from '../utils/schemaMigration';

beforeEach(async () => {
  await AsyncStorage.clear();
  await __resetSchemaVersionForTests();
});

describe('schema migration v2 → v3', () => {
  it('runs from v2 starting state to v3', async () => {
    // Simulate v2 already applied.
    await migrateV1ToV2();
    await AsyncStorage.setItem(SCHEMA_VERSION_KEY, JSON.stringify(2));

    const result = await runMigrations();
    expect(result.success).toBe(true);
    expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
  });

  it('migration is idempotent (run twice produces same result as once)', async () => {
    await runMigrations();
    const backup1 = await storageGet<{ performed_at: number }>(STORAGE_KEYS.MIGRATION_V2_V3_BACKUP);
    const r2 = await runMigrations();
    expect(r2.migrationsRun).toBe(0);
    const backup2 = await storageGet<{ performed_at: number }>(STORAGE_KEYS.MIGRATION_V2_V3_BACKUP);
    expect(backup2?.performed_at).toBe(backup1?.performed_at);
  });

  it('schemaVersion persisted = 3 post-migration', async () => {
    await runMigrations();
    const v = await storageGet<number>(SCHEMA_VERSION_KEY);
    expect(v).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('writes v2_v3_backup record', async () => {
    await runMigrations();
    const backup = await storageGet<{
      pre_version: number;
      performed_at: number;
      expires_at: number;
      touched_keys: string[];
    }>(STORAGE_KEYS.MIGRATION_V2_V3_BACKUP);
    expect(backup).not.toBeNull();
    expect(backup?.pre_version).toBe(2);
  });

  it('touched_keys is empty (no data backfill in v3)', async () => {
    await runMigrations();
    const backup = await storageGet<{ touched_keys: string[] }>(STORAGE_KEYS.MIGRATION_V2_V3_BACKUP);
    expect(backup?.touched_keys).toEqual([]);
  });

  it('rollback backup respects 30-day expires_at', async () => {
    await runMigrations();
    const backup = await storageGet<{ performed_at: number; expires_at: number }>(
      STORAGE_KEYS.MIGRATION_V2_V3_BACKUP,
    );
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const window = backup!.expires_at - backup!.performed_at;
    expect(window).toBeGreaterThanOrEqual(thirtyDaysMs - 1000);
    expect(window).toBeLessThanOrEqual(thirtyDaysMs + 1000);
  });
});
