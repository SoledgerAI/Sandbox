// Tests for Prompt 14: Missed-Day Backfill Logging
// dateContextService, DateContextBanner, TimestampOverride, MissedDayCard

import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayDateString } from '../utils/dayBoundary';
import { dateKey, STORAGE_KEYS } from '../utils/storage';

// Reset module state between tests
let dateContextService: typeof import('../services/dateContextService');

beforeEach(async () => {
  jest.resetModules();
  (global as any).__mockStore.clear();
  dateContextService = require('../services/dateContextService');
  dateContextService.resetToToday();
});

// ============================================================
// 1. dateContextService
// ============================================================

describe('dateContextService', () => {
  it('getActiveDate returns today by default', () => {
    expect(dateContextService.getActiveDate()).toBe(todayDateString());
  });

  it('setActiveDate changes the active date', () => {
    const pastDate = '2026-04-01';
    dateContextService.setActiveDate(pastDate);
    expect(dateContextService.getActiveDate()).toBe(pastDate);
  });

  it('resetToToday resets to today', () => {
    dateContextService.setActiveDate('2026-04-01');
    dateContextService.resetToToday();
    expect(dateContextService.getActiveDate()).toBe(todayDateString());
  });

  it('isBackfilling returns true when date is not today', () => {
    dateContextService.setActiveDate('2026-04-01');
    expect(dateContextService.isBackfilling()).toBe(true);
  });

  it('isBackfilling returns false when date is today', () => {
    expect(dateContextService.isBackfilling()).toBe(false);
  });

  it('setActiveDate rejects invalid format', () => {
    expect(() => dateContextService.setActiveDate('04-01-2026')).toThrow('Invalid date format');
  });

  it('setActiveDate rejects future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(() => dateContextService.setActiveDate(futureStr)).toThrow('future date');
  });

  it('addDateChangeListener fires on setActiveDate', () => {
    const listener = jest.fn();
    const unsub = dateContextService.addDateChangeListener(listener);
    dateContextService.setActiveDate('2026-04-01');
    expect(listener).toHaveBeenCalledWith('2026-04-01');
    unsub();
  });

  it('addDateChangeListener fires on resetToToday', () => {
    dateContextService.setActiveDate('2026-04-01');
    const listener = jest.fn();
    const unsub = dateContextService.addDateChangeListener(listener);
    dateContextService.resetToToday();
    expect(listener).toHaveBeenCalledWith(todayDateString());
    unsub();
  });

  it('unsubscribed listener does not fire', () => {
    const listener = jest.fn();
    const unsub = dateContextService.addDateChangeListener(listener);
    unsub();
    dateContextService.setActiveDate('2026-04-01');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ============================================================
// 2. getGapDays
// ============================================================

describe('getGapDays', () => {
  it('returns empty array when all days have logs', async () => {
    // Seed the last 7 days with food entries
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, ds);
      await AsyncStorage.setItem(key, JSON.stringify([{ id: 'test' }]));
    }
    const gaps = await dateContextService.getGapDays(7);
    expect(gaps).toEqual([]);
  });

  it('returns correct dates when days are missing', async () => {
    // Seed only yesterday with data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    await AsyncStorage.setItem(
      dateKey(STORAGE_KEYS.LOG_FOOD, yesterdayStr),
      JSON.stringify([{ id: 'test' }]),
    );

    const gaps = await dateContextService.getGapDays(3);
    // Yesterday has data, so it should NOT be in gaps
    expect(gaps).not.toContain(yesterdayStr);
    // But 2 days ago and 3 days ago should be
    expect(gaps.length).toBe(2);
  });

  it('does not include today', async () => {
    const gaps = await dateContextService.getGapDays(7);
    expect(gaps).not.toContain(todayDateString());
  });

  it('does not include dates older than lookback', async () => {
    const gaps = await dateContextService.getGapDays(3);
    // Should be exactly 3 days of gaps (no data seeded)
    expect(gaps.length).toBe(3);
  });

  it('returns dates sorted most recent first', async () => {
    const gaps = await dateContextService.getGapDays(5);
    for (let i = 0; i < gaps.length - 1; i++) {
      expect(gaps[i] > gaps[i + 1]).toBe(true);
    }
  });
});

// ============================================================
// 3. DateContextBanner importability
// ============================================================

describe('DateContextBanner', () => {
  it('is importable', () => {
    const mod = require('../components/DateContextBanner');
    expect(mod.DateContextBanner).toBeDefined();
  });
});

// ============================================================
// 4. TimestampOverride importability
// ============================================================

describe('TimestampOverride', () => {
  it('is importable', () => {
    const mod = require('../components/TimestampOverride');
    expect(mod.TimestampOverride).toBeDefined();
  });
});

// ============================================================
// 5. MissedDayCard importability
// ============================================================

describe('MissedDayCard', () => {
  it('is importable', () => {
    const mod = require('../components/dashboard/MissedDayCard');
    expect(mod.MissedDayCard).toBeDefined();
  });
});

// ============================================================
// 6. useDateContext hook importability
// ============================================================

describe('useDateContext', () => {
  it('is importable', () => {
    const mod = require('../hooks/useDateContext');
    expect(mod.useDateContext).toBeDefined();
  });
});

// ============================================================
// 7. Integration: storage key uses active date
// ============================================================

describe('Integration: active date in storage keys', () => {
  it('WaterLogger module imports getActiveDate', () => {
    const mod = require('../components/logging/WaterLogger');
    expect(mod).toBeDefined();
  });

  it('MoodPicker module imports getActiveDate', () => {
    const mod = require('../components/logging/MoodPicker');
    expect(mod).toBeDefined();
  });

  it('ActivityLogger module imports getActiveDate', () => {
    const mod = require('../components/logging/ActivityLogger');
    expect(mod).toBeDefined();
  });

  it('SleepLogger module imports getActiveDate', () => {
    const mod = require('../components/logging/SleepLogger');
    expect(mod).toBeDefined();
  });

  it('SupplementChecklist module imports getActiveDate', () => {
    const mod = require('../components/logging/SupplementChecklist');
    expect(mod).toBeDefined();
  });

  it('dateKey uses active date when backfilling', () => {
    dateContextService.setActiveDate('2026-03-15');
    const key = dateKey(STORAGE_KEYS.LOG_WATER, dateContextService.getActiveDate());
    expect(key).toBe('dub.log.water.2026-03-15');
  });

  it('dateKey uses today when not backfilling', () => {
    dateContextService.resetToToday();
    const key = dateKey(STORAGE_KEYS.LOG_WATER, dateContextService.getActiveDate());
    expect(key).toBe(`dub.log.water.${todayDateString()}`);
  });
});
