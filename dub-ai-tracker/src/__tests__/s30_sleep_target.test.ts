// Sprint 30: tests for getSleepTargetHours / DEFAULT_SLEEP_TARGET_HOURS.

import { getSleepTargetHours, DEFAULT_SLEEP_TARGET_HOURS } from '../utils/sleepTarget';
import { storageSet, STORAGE_KEYS } from '../utils/storage';

beforeEach(() => {
  // @ts-expect-error global jest setup map
  global.__mockStore.clear();
});

describe('getSleepTargetHours', () => {
  it('returns DEFAULT (8h) when no schedule is set', async () => {
    expect(DEFAULT_SLEEP_TARGET_HOURS).toBe(8);
    await expect(getSleepTargetHours()).resolves.toBe(8);
  });

  it('returns 7.5 for 22:30 → 06:00 schedule', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '22:30',
      target_wake_time: '06:00',
    });
    await expect(getSleepTargetHours()).resolves.toBe(7.5);
  });

  it('returns 7 for 23:00 → 06:00 schedule', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '23:00',
      target_wake_time: '06:00',
    });
    await expect(getSleepTargetHours()).resolves.toBe(7);
  });

  it('handles cross-midnight: 23:30 → 05:30 = 6h', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '23:30',
      target_wake_time: '05:30',
    });
    await expect(getSleepTargetHours()).resolves.toBe(6);
  });

  it('clamps to >= 4h when schedule implies absurdly short sleep', async () => {
    // 02:00 → 03:00 is 1h sleep — clamp up to 4h floor.
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '02:00',
      target_wake_time: '03:00',
    });
    await expect(getSleepTargetHours()).resolves.toBe(4);
  });

  it('clamps to <= 12h when schedule implies absurdly long sleep', async () => {
    // 18:00 → 12:00 = 18h sleep — clamp down to 12h ceiling.
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '18:00',
      target_wake_time: '12:00',
    });
    await expect(getSleepTargetHours()).resolves.toBe(12);
  });

  it('falls back to default if target_bedtime is null', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: null,
      target_wake_time: '06:00',
    });
    await expect(getSleepTargetHours()).resolves.toBe(8);
  });

  it('falls back to default if target_wake_time is null', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '22:30',
      target_wake_time: null,
    });
    await expect(getSleepTargetHours()).resolves.toBe(8);
  });

  it('falls back to default if format is malformed', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: 'not-a-time',
      target_wake_time: '06:00',
    });
    await expect(getSleepTargetHours()).resolves.toBe(8);
  });

  it('falls back to default if hours/minutes are out of range', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '25:00',
      target_wake_time: '06:00',
    });
    await expect(getSleepTargetHours()).resolves.toBe(8);
  });
});
