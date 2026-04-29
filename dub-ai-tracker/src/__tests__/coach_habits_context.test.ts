// S33-B: coach context habit fields + cadence-aware [HABITS] section.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCoachContext } from '../ai/context_builder';
import {
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../utils/storage';
import type { HabitDefinition, HabitEntry } from '../types';

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLocal(): string {
  return pastDate(0);
}

async function seedProfile() {
  await AsyncStorage.setItem(
    'dub.profile',
    JSON.stringify({
      name: 'Test User',
      dob: '1994-06-15',
      units: 'imperial',
      sex: 'male',
      height_inches: 70,
      weight_lbs: 180,
      activity_level: 'moderately_active',
      goal: { direction: 'MAINTAIN', target_weight: null, rate_lbs_per_week: null, gain_type: null, surplus_calories: null },
      pronouns: null,
      metabolic_profile: null,
      main_goal: null,
      altitude_acclimated: false,
    }),
  );
  await AsyncStorage.setItem('dub.tier', JSON.stringify('balanced'));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await seedProfile();
});

describe('coach context — habit_streaks', () => {
  it('populates habit_streaks for non-archived habits', async () => {
    const habits: HabitDefinition[] = [
      { id: 'h_d', name: 'Daily', order: 0, cadence: { kind: 'daily' } },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, habits);
    // Seed 3 consecutive days completed.
    for (let i = 0; i < 3; i++) {
      await storageSet(dateKey(STORAGE_KEYS.LOG_HABITS, pastDate(i)), [
        { id: 'h_d', name: 'Daily', completed: true, completedAt: new Date().toISOString() } as HabitEntry,
      ]);
    }
    const { context } = await buildCoachContext('hello');
    expect(context.habit_streaks).toBeDefined();
    expect(context.habit_streaks).toHaveLength(1);
    expect(context.habit_streaks![0].habit_id).toBe('h_d');
    expect(context.habit_streaks![0].current_streak).toBeGreaterThanOrEqual(1);
  });
});

describe('coach context — habits_due_today', () => {
  it('filters by cadence rule (today only)', async () => {
    // Determine today's weekday locally. Build a "weekdays" cadence that
    // matches ONLY today, and another that EXCLUDES today.
    const today = new Date();
    const todayBit = 1 << today.getDay();
    const habits: HabitDefinition[] = [
      { id: 'h_today', name: 'TodayOnly', order: 0, cadence: { kind: 'weekdays', days: todayBit } },
      { id: 'h_other', name: 'OtherDay', order: 1, cadence: { kind: 'weekdays', days: 0b1111111 & ~todayBit } },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, habits);

    const { context } = await buildCoachContext('hello');
    expect(context.habits_due_today).toContain('TodayOnly');
    expect(context.habits_due_today).not.toContain('OtherDay');
  });
});

describe('coach context — habits_completed_today', () => {
  it('reads HabitEntry list for today and filters completed=true', async () => {
    const habits: HabitDefinition[] = [
      { id: 'h1', name: 'A', order: 0, cadence: { kind: 'daily' } },
      { id: 'h2', name: 'B', order: 1, cadence: { kind: 'daily' } },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, habits);
    await storageSet(dateKey(STORAGE_KEYS.LOG_HABITS, todayLocal()), [
      { id: 'h1', name: 'A', completed: true, completedAt: new Date().toISOString() },
      { id: 'h2', name: 'B', completed: false, completedAt: null },
    ]);

    const { context } = await buildCoachContext('hello');
    expect(context.habits_completed_today).toContain('A');
    expect(context.habits_completed_today).not.toContain('B');
  });
});

describe('coach context — habits_off_track', () => {
  it('flags count_per_week shortfall', async () => {
    const habits: HabitDefinition[] = [
      { id: 'h_s', name: 'Strength', order: 0, cadence: { kind: 'count_per_week', count: 3 } },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, habits);
    // Only 1 completion in last 7 days → missed = 3 - 1 = 2.
    await storageSet(dateKey(STORAGE_KEYS.LOG_HABITS, pastDate(2)), [
      { id: 'h_s', name: 'Strength', completed: true, completedAt: new Date().toISOString() },
    ]);

    const { context } = await buildCoachContext('hello');
    expect(context.habits_off_track).toBeDefined();
    const flag = context.habits_off_track!.find((f) => f.habit_id === 'h_s');
    expect(flag).toBeDefined();
    expect(flag!.target_per_7d).toBe(3);
    expect(flag!.missed_in_last_7d).toBe(2);
  });

  it('flags weekdays cadence shortfall (target derived from bits-in-window)', async () => {
    // M-W-F mask = 42. In any rolling 7-day window, exactly 3 days match.
    const habits: HabitDefinition[] = [
      { id: 'h_mwf', name: 'MWF', order: 0, cadence: { kind: 'weekdays', days: 42 } },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, habits);
    // Zero completions → missed = 3.
    const { context } = await buildCoachContext('hello');
    expect(context.habits_off_track).toBeDefined();
    const flag = context.habits_off_track!.find((f) => f.habit_id === 'h_mwf');
    expect(flag).toBeDefined();
    expect(flag!.target_per_7d).toBe(3);
    expect(flag!.missed_in_last_7d).toBe(3);
  });

  it('does NOT include daily-cadence habits in off_track', async () => {
    const habits: HabitDefinition[] = [
      { id: 'h_daily', name: 'Daily', order: 0, cadence: { kind: 'daily' } },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, habits);
    const { context } = await buildCoachContext('hello');
    const daily = context.habits_off_track?.find((f) => f.habit_id === 'h_daily');
    expect(daily).toBeUndefined();
  });
});

describe('coach context — [HABITS YYYY-MM-DD] section uses cadence-aware total', () => {
  it('total counts only DUE-TODAY habits, not all stored definitions', async () => {
    // Seed 1 daily + 1 off-day weekdays habit. Both have entries, but
    // only the daily one is "due today". Total should be 1, not 2.
    const today = new Date();
    const tomorrowBit = 1 << ((today.getDay() + 1) % 7); // bit for a NON-today day
    const habits: HabitDefinition[] = [
      { id: 'h_daily', name: 'Daily', order: 0, cadence: { kind: 'daily' } },
      { id: 'h_off', name: 'OffDay', order: 1, cadence: { kind: 'weekdays', days: tomorrowBit } },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, habits);
    await storageSet(dateKey(STORAGE_KEYS.LOG_HABITS, todayLocal()), [
      { id: 'h_daily', name: 'Daily', completed: true, completedAt: new Date().toISOString() },
      { id: 'h_off', name: 'OffDay', completed: false, completedAt: null },
    ]);

    // Use a habit-keyword message so the conditional [HABITS] section fires.
    const { conditionalSections } = await buildCoachContext('how are my habits today?');
    const habitsLine = conditionalSections.find((s) => s.startsWith('[HABITS '));
    expect(habitsLine).toBeDefined();
    // 1/1 (only the daily habit counts toward today's denominator).
    expect(habitsLine).toContain('1/1');
  });
});
