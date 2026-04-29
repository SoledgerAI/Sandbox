// S33-B: per-habit streak calculation. Covers daily, weekdays,
// count_per_week, every_n_days, archived, milestone tier evaluation,
// and the H46 LOCAL-TIME date-key regression.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../utils/storage';
import {
  calculateHabitStreak,
  HABIT_MILESTONES,
} from '../utils/streakCalculator';
import type { HabitDefinition, HabitEntry } from '../types';

beforeEach(async () => {
  await AsyncStorage.clear();
});

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setEntry(habitId: string, name: string, date: Date, completed: boolean) {
  const key = dateKey(STORAGE_KEYS.LOG_HABITS, fmtLocal(date));
  const entry: HabitEntry = {
    id: habitId,
    name,
    completed,
    completedAt: completed ? date.toISOString() : null,
  };
  return storageSet(key, [entry]);
}

describe('calculateHabitStreak', () => {
  // 2026-04-29 (Wed). Anchor for all tests.
  const TODAY = new Date(2026, 3, 29);

  it('new habit, no entries: streak = 0', async () => {
    const h: HabitDefinition = {
      id: 'h_new',
      name: 'New',
      order: 0,
      cadence: { kind: 'daily' },
    };
    expect(await calculateHabitStreak(h, TODAY)).toBe(0);
  });

  it('5 consecutive days completed (daily): streak = 5', async () => {
    const h: HabitDefinition = {
      id: 'h_d',
      name: 'Daily',
      order: 0,
      cadence: { kind: 'daily' },
    };
    for (let i = 0; i < 5; i++) {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - i);
      await setEntry(h.id, h.name, d, true);
    }
    expect(await calculateHabitStreak(h, TODAY)).toBe(5);
  });

  it('missed yesterday + today (daily): streak = 0', async () => {
    const h: HabitDefinition = {
      id: 'h_d',
      name: 'Daily',
      order: 0,
      cadence: { kind: 'daily' },
    };
    // No completions at all → both today and yesterday checkFn = false.
    expect(await calculateHabitStreak(h, TODAY)).toBe(0);
  });

  it('M-W-F habit, M done, W done, today F not done: streak = 2 (in-progress, not broken)', async () => {
    // Today = Friday May 1, 2026 (getDay() === 5). M-W-F mask = 42.
    const friday = new Date(2026, 4, 1);
    const wed = new Date(2026, 3, 29); // Apr 29 Wed
    const mon = new Date(2026, 3, 27); // Apr 27 Mon
    const lastFriday = new Date(2026, 3, 24); // Apr 24 Fri (NOT completed)

    const h: HabitDefinition = {
      id: 'h_mwf',
      name: 'MWF',
      order: 0,
      cadence: { kind: 'weekdays', days: 42 },
    };
    await setEntry(h.id, h.name, mon, true);
    await setEntry(h.id, h.name, wed, true);
    // lastFriday: explicit miss (no completion stored).
    void lastFriday;

    expect(await calculateHabitStreak(h, friday)).toBe(2);
  });

  it('M-W-F habit, missed Wednesday: walker breaks at the missed due day', async () => {
    // Today = Thursday Apr 30, 2026. Walker: Thu (skip) → Wed (due, missed) → break.
    // streak = 0.
    const thursday = new Date(2026, 3, 30);
    const h: HabitDefinition = {
      id: 'h_mwf',
      name: 'MWF',
      order: 0,
      cadence: { kind: 'weekdays', days: 42 },
    };
    // Mon was completed but walker breaks before reaching it.
    const mon = new Date(2026, 3, 27);
    await setEntry(h.id, h.name, mon, true);
    // Wed (Apr 29) explicitly NOT completed.

    expect(await calculateHabitStreak(h, thursday)).toBe(0);
  });

  it('count_per_week 3: rolling 7-day window evaluation', async () => {
    // Trailing 7d ending TODAY (Wed Apr 29) = Apr 23..29.
    // Complete 3 days in that window: Apr 27 (Mon), Apr 28 (Tue), Apr 29 (Wed).
    // Today's window has count >= 3 → checkFn(today) = true → streak >= 1.
    const h: HabitDefinition = {
      id: 'h_3pw',
      name: '3xWeek',
      order: 0,
      cadence: { kind: 'count_per_week', count: 3 },
    };
    await setEntry(h.id, h.name, new Date(2026, 3, 27), true);
    await setEntry(h.id, h.name, new Date(2026, 3, 28), true);
    await setEntry(h.id, h.name, new Date(2026, 3, 29), true);
    expect(await calculateHabitStreak(h, TODAY)).toBeGreaterThanOrEqual(1);
  });

  it('archived habit: streak returns 0 regardless of past completions', async () => {
    const h: HabitDefinition = {
      id: 'h_arch',
      name: 'Archived',
      order: 0,
      cadence: { kind: 'daily' },
      archived: true,
    };
    // Past completions exist — should still return 0.
    for (let i = 0; i < 10; i++) {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - i);
      await setEntry(h.id, h.name, d, true);
    }
    expect(await calculateHabitStreak(h, TODAY)).toBe(0);
  });

  it('HABIT_MILESTONES tiers include 3, 7, 14', () => {
    expect(HABIT_MILESTONES).toContain(3);
    expect(HABIT_MILESTONES).toContain(7);
    expect(HABIT_MILESTONES).toContain(14);
    expect(HABIT_MILESTONES).toContain(30);
    expect(HABIT_MILESTONES).toContain(100);
    expect(HABIT_MILESTONES).toContain(365);
  });

  it('uses LOCAL-TIME date keys (H46 regression)', async () => {
    // Construct a completion at late-evening local time. If impl used
    // toISOString().slice(0,10), this would shift to next day in UTC and
    // the streak walker would miss it.
    const h: HabitDefinition = {
      id: 'h_local',
      name: 'Local',
      order: 0,
      cadence: { kind: 'daily' },
    };
    const todayLate = new Date(2026, 3, 29, 23, 50);
    await setEntry(h.id, h.name, todayLate, true);
    expect(await calculateHabitStreak(h, TODAY)).toBeGreaterThanOrEqual(1);
  });

  it('re-running calculateHabitStreak is deterministic (no side effects)', async () => {
    const h: HabitDefinition = {
      id: 'h_d',
      name: 'Daily',
      order: 0,
      cadence: { kind: 'daily' },
    };
    for (let i = 0; i < 3; i++) {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - i);
      await setEntry(h.id, h.name, d, true);
    }
    const first = await calculateHabitStreak(h, TODAY);
    const second = await calculateHabitStreak(h, TODAY);
    expect(first).toBe(second);
    expect(first).toBe(3);
  });
});
