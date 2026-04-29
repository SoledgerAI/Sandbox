// S34-A: Schema migration v4 -> v5 — forward-fill expires_at on
// connected DeviceSyncState records.

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
  migrateV4ToV5,
} from '../utils/schemaMigration';
import type { DeviceSyncState } from '../types/profile';

beforeEach(async () => {
  await AsyncStorage.clear();
  await __resetSchemaVersionForTests();
});

describe('schema migration v4 -> v5', () => {
  it('runs from v4 starting state to v5', async () => {
    await AsyncStorage.setItem(SCHEMA_VERSION_KEY, JSON.stringify(4));
    const result = await runMigrations();
    expect(result.success).toBe(true);
    expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });

  it('schemaVersion persisted = 5 post-migration', async () => {
    await runMigrations();
    const v = await storageGet<number>(SCHEMA_VERSION_KEY);
    expect(v).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('migration is idempotent (run twice produces same backup record)', async () => {
    await migrateV4ToV5();
    const b1 = await storageGet<{ performed_at: number }>(STORAGE_KEYS.MIGRATION_V4_V5_BACKUP);
    await migrateV4ToV5();
    const b2 = await storageGet<{ performed_at: number }>(STORAGE_KEYS.MIGRATION_V4_V5_BACKUP);
    expect(b2?.performed_at).toBe(b1?.performed_at);
  });

  it('connected Strava state without expires_at gets expires_at=0', async () => {
    const pre: DeviceSyncState = {
      connected: true,
      last_sync: '2026-04-28T10:00:00.000Z',
      access_token: 'legacy_access',
      refresh_token: 'legacy_refresh',
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, pre);
    await migrateV4ToV5();
    const after = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
    expect(after?.connected).toBe(true);
    expect(after?.expires_at).toBe(0);
    // Other fields preserved
    expect(after?.access_token).toBe('legacy_access');
    expect(after?.refresh_token).toBe('legacy_refresh');
    expect(after?.last_sync).toBe('2026-04-28T10:00:00.000Z');
  });

  it('disconnected Strava state passes through unchanged', async () => {
    const pre: DeviceSyncState = {
      connected: false,
      last_sync: null,
      access_token: null,
      refresh_token: null,
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, pre);
    await migrateV4ToV5();
    const after = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
    expect(after?.connected).toBe(false);
    expect(after?.expires_at).toBeUndefined();
  });

  it('state with expires_at already set is preserved (no overwrite)', async () => {
    const pre: DeviceSyncState = {
      connected: true,
      last_sync: null,
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 1234567890,
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, pre);
    await migrateV4ToV5();
    const after = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
    expect(after?.expires_at).toBe(1234567890);
  });

  it('writes v4_v5_backup record with backfill_stats and 30-day expiry', async () => {
    const pre: DeviceSyncState = {
      connected: true,
      last_sync: null,
      access_token: 'a',
      refresh_token: 'r',
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, pre);
    await migrateV4ToV5();

    const backup = await storageGet<{
      pre_version: number;
      performed_at: number;
      expires_at: number;
      touched_keys: string[];
      backfill_stats: { devices_strava_forward_filled: number };
    }>(STORAGE_KEYS.MIGRATION_V4_V5_BACKUP);

    expect(backup).not.toBeNull();
    expect(backup?.pre_version).toBe(4);
    expect(backup?.touched_keys).toContain(STORAGE_KEYS.DEVICES_STRAVA);
    expect(backup?.backfill_stats.devices_strava_forward_filled).toBe(1);

    // 30-day rollback window.
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const window = backup!.expires_at - backup!.performed_at;
    expect(window).toBeGreaterThanOrEqual(thirtyDays - 1000);
    expect(window).toBeLessThanOrEqual(thirtyDays + 1000);
  });

  it('writes backup with forward_filled=0 when no Strava state exists', async () => {
    await migrateV4ToV5();
    const backup = await storageGet<{
      backfill_stats: { devices_strava_forward_filled: number };
      touched_keys: string[];
    }>(STORAGE_KEYS.MIGRATION_V4_V5_BACKUP);
    expect(backup?.backfill_stats.devices_strava_forward_filled).toBe(0);
    expect(backup?.touched_keys).toEqual([]);
  });
});
