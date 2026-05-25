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

// Fixed anchor. 2026-04-29 is a Wednesday. All test dates derive from this
// via offsets; calculateHabitStreak is always called with TODAY, which now
// threads through calculateCategoryStreak — so the suite is clock-independent
// without any global timer manipulation.
const TODAY = new Date(2026, 3, 29);

function offsetDays(days: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d;
}

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
      await setEntry(h.id, h.name, offsetDays(-i), true);
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

  it('M-W-F habit, today Wed in-progress with 2 prior due days done: streak = 2', async () => {
    // TODAY is Wed (a due day for M-W-F mask=42), not yet completed.
    // Mon (TODAY-2) done, prev Fri (TODAY-5) done, prev Wed (TODAY-7) NOT done → walker stops at 2.
    const h: HabitDefinition = {
      id: 'h_mwf',
      name: 'MWF',
      order: 0,
      cadence: { kind: 'weekdays', days: 42 },
    };
    await setEntry(h.id, h.name, offsetDays(-2), true); // Mon
    await setEntry(h.id, h.name, offsetDays(-5), true); // prev Fri
    // offsetDays(-7) (prev Wed): explicit miss (no completion stored).

    expect(await calculateHabitStreak(h, TODAY)).toBe(2);
  });

  it('M-W-F habit, prior due day Mon missed: walker breaks at the missed due day', async () => {
    // TODAY is Wed (due, in-progress, not completed) → walker continues without break.
    // Walks back: Tue skip → Mon (TODAY-2, due, NOT completed) → break.
    // A completion further back (prev Fri TODAY-5) is unreachable.
    const h: HabitDefinition = {
      id: 'h_mwf',
      name: 'MWF',
      order: 0,
      cadence: { kind: 'weekdays', days: 42 },
    };
    await setEntry(h.id, h.name, offsetDays(-5), true); // prev Fri — unreachable
    // Mon (TODAY-2) explicitly NOT completed.

    expect(await calculateHabitStreak(h, TODAY)).toBe(0);
  });

  it('count_per_week 3: rolling 7-day window evaluation', async () => {
    // Trailing 7d window ending TODAY = TODAY-6..TODAY.
    // Complete 3 days in that window: TODAY-2, TODAY-1, TODAY.
    // Today's window count >= 3 → checkFn(today) = true → streak >= 1.
    const h: HabitDefinition = {
      id: 'h_3pw',
      name: '3xWeek',
      order: 0,
      cadence: { kind: 'count_per_week', count: 3 },
    };
    await setEntry(h.id, h.name, offsetDays(-2), true);
    await setEntry(h.id, h.name, offsetDays(-1), true);
    await setEntry(h.id, h.name, TODAY, true);
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
      await setEntry(h.id, h.name, offsetDays(-i), true);
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
    const todayLate = new Date(
      TODAY.getFullYear(),
      TODAY.getMonth(),
      TODAY.getDate(),
      23,
      50,
    );
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
      await setEntry(h.id, h.name, offsetDays(-i), true);
    }
    const first = await calculateHabitStreak(h, TODAY);
    const second = await calculateHabitStreak(h, TODAY);
    expect(first).toBe(second);
    expect(first).toBe(3);
  });
});
