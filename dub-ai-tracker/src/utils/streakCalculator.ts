// Sprint 25: Streak Calculator for Dashboard
// Calculates per-category daily streaks and milestone thresholds
// S33-B: per-habit streaks added (calculateHabitStreak, calculateAllHabitStreaks)

import { storageGet, storageList, STORAGE_KEYS, dateKey } from './storage';
import { todayDateString } from './dayBoundary';
import type {
  FoodEntry,
  WaterEntry,
  SleepEntry,
  MoodMentalEntry,
  HabitDefinition,
  HabitEntry,
  CadenceRule,
} from '../types';
import { normalizeHabit } from '../types';
import { isDueOnDate } from './cadence';
import type { WorkoutEntry } from '../types/workout';

export interface CategoryStreak {
  category: string;
  label: string;
  icon: string;
  currentStreak: number;
  milestone: number | null; // next milestone (7, 30, 100) or null
  atMilestone: boolean; // currently at a milestone threshold
}

export interface StreakSummary {
  logging: CategoryStreak;
  exercise: CategoryStreak;
  hydration: CategoryStreak;
  sleep: CategoryStreak;
  streaks: CategoryStreak[];
}

const MILESTONES = [7, 30, 100];

/**
 * S33-B: finer-grained tiers for habit streaks. Habit chains build at lower
 * thresholds than category streaks (3 days = pattern starting; 7 = first-
 * week win), so this list intentionally diverges from MILESTONES.
 */
export const HABIT_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

function nextHabitMilestone(streak: number): number | null {
  for (const m of HABIT_MILESTONES) {
    if (streak < m) return m;
  }
  return null;
}

function atHabitMilestone(streak: number): boolean {
  return HABIT_MILESTONES.includes(streak);
}

function nextMilestone(streak: number): number | null {
  for (const m of MILESTONES) {
    if (streak < m) return m;
  }
  return null;
}

function atMilestone(streak: number): boolean {
  return MILESTONES.includes(streak);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Calculate consecutive days with entries for a given storage key prefix.
 * Walks backward from today counting consecutive days with data.
 */
export async function calculateCategoryStreak(
  storageKeyPrefix: string,
  checkFn?: (date: string) => Promise<boolean>,
): Promise<number> {
  const today = new Date();
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(new Date(today.getTime() - 86400000));

  if (checkFn) {
    // Use custom check function
    const hasToday = await checkFn(todayStr);
    const hasYesterday = await checkFn(yesterdayStr);

    let startDate: Date;
    if (hasToday) {
      startDate = today;
    } else if (hasYesterday) {
      startDate = new Date(today.getTime() - 86400000);
    } else {
      return 0;
    }

    let streak = 0;
    const d = new Date(startDate);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const dateStr = formatDate(d);
      const has = await checkFn(dateStr);
      if (!has) break;
      streak++;
      d.setDate(d.getDate() - 1);
      if (streak > 365) break; // safety cap
    }
    return streak;
  }

  // Fallback: scan storage keys
  const keys = await storageList(storageKeyPrefix + '.');
  const loggedDates = new Set<string>();
  for (const key of keys) {
    const dateStr = key.split('.').pop();
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      loggedDates.add(dateStr);
    }
  }

  if (loggedDates.size === 0) return 0;

  let startDate: Date;
  if (loggedDates.has(todayStr)) {
    startDate = today;
  } else if (loggedDates.has(yesterdayStr)) {
    startDate = new Date(today.getTime() - 86400000);
  } else {
    return 0;
  }

  let streak = 0;
  const d = new Date(startDate);
  while (loggedDates.has(formatDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
    if (streak > 365) break;
  }
  return streak;
}

/**
 * Calculate all active streaks for the dashboard.
 */
export async function calculateAllStreaks(): Promise<StreakSummary> {
  // Logging streak: any log entry on a given day
  const loggingStreak = await calculateCategoryStreak('', async (date) => {
    const prefixes = [
      STORAGE_KEYS.LOG_FOOD, STORAGE_KEYS.LOG_WATER, STORAGE_KEYS.LOG_WORKOUT,
      STORAGE_KEYS.LOG_SLEEP, STORAGE_KEYS.LOG_MOOD, STORAGE_KEYS.LOG_BODY,
      STORAGE_KEYS.LOG_MOOD_MENTAL,
    ];
    for (const prefix of prefixes) {
      const val = await storageGet(dateKey(prefix, date));
      if (val != null && (Array.isArray(val) ? val.length > 0 : true)) {
        return true;
      }
    }
    return false;
  });

  // Exercise streak: workout logged
  const exerciseStreak = await calculateCategoryStreak(STORAGE_KEYS.LOG_WORKOUT, async (date) => {
    const val = await storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, date));
    return val != null && val.length > 0;
  });

  // Hydration streak: water logged (any amount)
  const hydrationStreak = await calculateCategoryStreak(STORAGE_KEYS.LOG_WATER, async (date) => {
    const val = await storageGet<WaterEntry[]>(dateKey(STORAGE_KEYS.LOG_WATER, date));
    return val != null && val.length > 0;
  });

  // Sleep streak: sleep entry logged
  const sleepStreak = await calculateCategoryStreak(STORAGE_KEYS.LOG_SLEEP, async (date) => {
    const val = await storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, date));
    return val != null;
  });

  const logging: CategoryStreak = {
    category: 'logging',
    label: 'Logging Streak',
    icon: 'create-outline',
    currentStreak: loggingStreak,
    milestone: nextMilestone(loggingStreak),
    atMilestone: atMilestone(loggingStreak),
  };

  const exercise: CategoryStreak = {
    category: 'exercise',
    label: 'Exercise Streak',
    icon: 'bicycle-outline',
    currentStreak: exerciseStreak,
    milestone: nextMilestone(exerciseStreak),
    atMilestone: atMilestone(exerciseStreak),
  };

  const hydration: CategoryStreak = {
    category: 'hydration',
    label: 'Hydration Streak',
    icon: 'water-outline',
    currentStreak: hydrationStreak,
    milestone: nextMilestone(hydrationStreak),
    atMilestone: atMilestone(hydrationStreak),
  };

  const sleep: CategoryStreak = {
    category: 'sleep',
    label: 'Sleep Streak',
    icon: 'moon-outline',
    currentStreak: sleepStreak,
    milestone: nextMilestone(sleepStreak),
    atMilestone: atMilestone(sleepStreak),
  };

  const streaks = [logging, exercise, hydration, sleep].filter((s) => s.currentStreak > 0);

  return { logging, exercise, hydration, sleep, streaks };
}

// ============================================================
// S33-B: per-habit streaks
// ============================================================

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * S33-B: streak count for a single habit, respecting its cadence rule.
 *
 * Counting semantics by cadence (D-1 in S33-B deliverable):
 *   - daily: delegates to calculateCategoryStreak (skip-day concept N/A).
 *   - count_per_week: rolling-window checkFn passed to
 *     calculateCategoryStreak. A day is "good" when completions in the
 *     trailing 7-day window ending that day meet `count`.
 *   - weekdays / every_n_days: custom due-day walker. Counts confirmed
 *     completions of due-days; skip days are pass-through (don't
 *     increment, don't break). The spec edge-case test "M-W-F, completed
 *     M and W, today F not yet done → streak = 2" requires this — pure
 *     calculateCategoryStreak reuse would inflate the count with skip
 *     days (~6 instead of 2).
 *
 * Archived habits return 0 unconditionally.
 */
export async function calculateHabitStreak(
  habit: HabitDefinition,
  today: Date,
): Promise<number> {
  if (habit.archived) return 0;

  const norm = normalizeHabit(habit);
  const cadence = norm.cadence;
  const habitId = habit.id;

  const cache = new Map<string, boolean>();

  async function isCompletedOn(dateStr: string): Promise<boolean> {
    const cached = cache.get(dateStr);
    if (cached !== undefined) return cached;
    const entries = await storageGet<HabitEntry[]>(
      dateKey(STORAGE_KEYS.LOG_HABITS, dateStr),
    );
    const completed = !!entries?.find((e) => e.id === habitId && e.completed);
    cache.set(dateStr, completed);
    return completed;
  }

  if (cadence.kind === 'daily') {
    return calculateCategoryStreak('', (dateStr) => isCompletedOn(dateStr));
  }

  if (cadence.kind === 'count_per_week') {
    const target = cadence.count;
    return calculateCategoryStreak('', async (dateStr) => {
      const date = parseLocalDate(dateStr);
      let cnt = 0;
      const d = new Date(date);
      for (let i = 0; i < 7; i++) {
        if (await isCompletedOn(formatDate(d))) cnt++;
        d.setDate(d.getDate() - 1);
      }
      return cnt >= target;
    });
  }

  // weekdays | every_n_days: custom due-day walker.
  return dueDayWalker(cadence, today, isCompletedOn);
}

async function dueDayWalker(
  cadence: Extract<CadenceRule, { kind: 'weekdays' } | { kind: 'every_n_days' }>,
  today: Date,
  isCompletedOn: (dateStr: string) => Promise<boolean>,
): Promise<number> {
  let streak = 0;
  let lastCompletion: Date | undefined;

  // Step 1: examine today.
  const todayStr = formatDate(today);
  const todayDue = isDueOnDate(cadence, today);
  if (todayDue) {
    if (await isCompletedOn(todayStr)) {
      streak = 1;
      lastCompletion = today;
    }
    // else: today is in-progress; don't break — continue to walk back.
  }
  // If not due today: continue to walk back from yesterday.

  // Step 2: walk back day by day.
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const due = isDueOnDate(cadence, d, lastCompletion);
    if (due) {
      const ds = formatDate(d);
      if (await isCompletedOn(ds)) {
        streak += 1;
        lastCompletion = new Date(d);
      } else {
        break;
      }
    }
    // skip day → pass through.
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

/**
 * S33-B: compute streaks for all non-archived habit definitions, returned as
 * CategoryStreak[] for direct merge with calculateAllStreaks output. Sorted
 * desc by streak; only nonzero streaks included; capped at top 5.
 */
export async function calculateAllHabitStreaks(
  habits: HabitDefinition[],
  today: Date = new Date(),
): Promise<CategoryStreak[]> {
  const results: CategoryStreak[] = [];
  for (const h of habits) {
    if (h.archived) continue;
    const streak = await calculateHabitStreak(h, today);
    if (streak <= 0) continue;
    results.push({
      category: `habit:${h.id}`,
      label: h.name,
      icon: 'checkmark-circle-outline',
      currentStreak: streak,
      milestone: nextHabitMilestone(streak),
      atMilestone: atHabitMilestone(streak),
    });
  }
  results.sort((a, b) => b.currentStreak - a.currentStreak);
  return results.slice(0, 5);
}
