// S36: Schema migration v1 → v2 — defaults, backfill, idempotency, rollback backup.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import {
  runMigrations,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  __resetSchemaVersionForTests,
} from '../utils/schemaMigration';
import {
  isoWeekKey,
  usageCountKey,
  regionSessionsKey,
  getUsageCount,
  getRegionSessions,
} from '../services/strengthService';
import type { StrengthEntry } from '../types/strength';

beforeEach(async () => {
  await AsyncStorage.clear();
  await __resetSchemaVersionForTests();
});

const SAMPLE_TS = '2026-04-15T10:00:00.000Z';

describe('schema migration v1 → v2', () => {
  it('runs from a fresh (v0) starting state to CURRENT_SCHEMA_VERSION', async () => {
    const result = await runMigrations();
    expect(result.success).toBe(true);
    expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('initializes equipment to ["bodyweight"] when absent', async () => {
    await runMigrations();
    const equip = await storageGet<string[]>(STORAGE_KEYS.SETTINGS_EQUIPMENT);
    expect(equip).toEqual(['bodyweight']);
  });

  it('initializes elected_exercises to [] when absent', async () => {
    await runMigrations();
    const elected = await storageGet<string[]>(STORAGE_KEYS.SETTINGS_ELECTED_EXERCISES);
    expect(elected).toEqual([]);
  });

  it('migration is idempotent — running twice produces same result as once', async () => {
    // Seed an existing user's strength entry that backfill will match.
    await storageSet<StrengthEntry[]>(
      dateKey(STORAGE_KEYS.LOG_STRENGTH, '2026-04-15'),
      [
        {
          id: 'a',
          timestamp: SAMPLE_TS,
          mode: 'quick',
          duration_minutes: null,
          notes: null,
          exercises: [
            { id: 'x', name: 'Barbell Bench Press', sets: [{ set_number: 1, weight_lbs: 135, reps: 5, rpe: null }] },
          ],
        },
      ],
    );
    const r1 = await runMigrations();
    expect(r1.success).toBe(true);
    const usageAfter1 = await getUsageCount('barbell-bench-press');

    const r2 = await runMigrations();
    expect(r2.success).toBe(true);
    expect(r2.migrationsRun).toBe(0);
    const usageAfter2 = await getUsageCount('barbell-bench-press');
    expect(usageAfter2).toBe(usageAfter1);
  });

  it('preserves existing StrengthEntry free-text records (no overwrites)', async () => {
    const key = dateKey(STORAGE_KEYS.LOG_STRENGTH, '2026-04-15');
    const original: StrengthEntry[] = [
      {
        id: 'a',
        timestamp: SAMPLE_TS,
        mode: 'quick',
        duration_minutes: null,
        notes: null,
        exercises: [
          { id: 'x', name: 'Some Obscure Lift', sets: [{ set_number: 1, weight_lbs: 50, reps: 8, rpe: null }] },
        ],
      },
    ];
    await storageSet(key, original);
    await runMigrations();
    const after = await storageGet<StrengthEntry[]>(key);
    expect(after).toEqual(original);
  });

  it('substring-match backfill maps known names to catalog ids', async () => {
    const key = dateKey(STORAGE_KEYS.LOG_STRENGTH, '2026-04-15');
    await storageSet<StrengthEntry[]>(key, [
      {
        id: 'a',
        timestamp: SAMPLE_TS,
        mode: 'quick',
        duration_minutes: null,
        notes: null,
        exercises: [
          { id: 'x', name: 'Barbell Bench Press', sets: [{ set_number: 1, weight_lbs: 135, reps: 5, rpe: null }] },
          { id: 'y', name: 'Barbell Squat', sets: [{ set_number: 1, weight_lbs: 185, reps: 5, rpe: null }] },
          { id: 'z', name: 'Hammer Curl', sets: [{ set_number: 1, weight_lbs: 30, reps: 10, rpe: null }] },
        ],
      },
    ]);
    await runMigrations();
    expect(await getUsageCount('barbell-bench-press')).toBe(1);
    expect(await getUsageCount('barbell-squat')).toBe(1);
    expect(await getUsageCount('hammer-curl')).toBe(1);
  });

  it('unmatched names are left as free-text and do not increment counters', async () => {
    const key = dateKey(STORAGE_KEYS.LOG_STRENGTH, '2026-04-15');
    await storageSet<StrengthEntry[]>(key, [
      {
        id: 'a',
        timestamp: SAMPLE_TS,
        mode: 'quick',
        duration_minutes: null,
        notes: null,
        exercises: [
          { id: 'x', name: 'Made-Up Exercise X', sets: [{ set_number: 1, weight_lbs: 50, reps: 8, rpe: null }] },
        ],
      },
    ]);
    await runMigrations();
    const backup = await storageGet<{ backfill_stats: { unmatched: number; matches_found: number } }>(STORAGE_KEYS.MIGRATION_V1_V2_BACKUP);
    expect(backup?.backfill_stats.unmatched).toBeGreaterThan(0);
    expect(backup?.backfill_stats.matches_found).toBe(0);
  });

  it('region_sessions populated from backfill', async () => {
    const ts = '2026-04-15T10:00:00.000Z';
    const key = dateKey(STORAGE_KEYS.LOG_STRENGTH, '2026-04-15');
    await storageSet<StrengthEntry[]>(key, [
      {
        id: 'a',
        timestamp: ts,
        mode: 'quick',
        duration_minutes: null,
        notes: null,
        exercises: [
          { id: 'x', name: 'Barbell Bench Press', sets: [{ set_number: 1, weight_lbs: 135, reps: 5, rpe: null }] },
        ],
      },
    ]);
    await runMigrations();
    const week = isoWeekKey(new Date(ts));
    expect(await getRegionSessions(week, 'chest')).toBe(1);
  });

  it('writes a 30-day rollback backup with touched_keys', async () => {
    await runMigrations();
    const backup = await storageGet<{
      pre_version: number;
      performed_at: number;
      expires_at: number;
      touched_keys: string[];
    }>(STORAGE_KEYS.MIGRATION_V1_V2_BACKUP);
    expect(backup).not.toBeNull();
    expect(backup?.pre_version).toBe(1);
    expect(backup?.expires_at).toBeGreaterThan(backup!.performed_at);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const window = backup!.expires_at - backup!.performed_at;
    // Allow trivial drift since we set timestamps in the same call.
    expect(window).toBeGreaterThanOrEqual(thirtyDaysMs - 1000);
    expect(Array.isArray(backup?.touched_keys)).toBe(true);
  });

  it('persists schema version after a successful run', async () => {
    await runMigrations();
    const v = await storageGet<number>(SCHEMA_VERSION_KEY);
    expect(v).toBe(CURRENT_SCHEMA_VERSION);
  });
});
