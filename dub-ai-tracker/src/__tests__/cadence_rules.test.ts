// S33-B: cadence rule evaluation + helpers + normalization.

import {
  isDueOnDate,
  describeRule,
  nextDueDate,
  setWeekdayBit,
  clearWeekdayBit,
  hasWeekdayBit,
} from '../utils/cadence';
import { normalizeHabit } from '../types';
import type { HabitDefinition } from '../types';

describe('cadence rules', () => {
  it('isDueOnDate daily: returns true for any date', () => {
    const rule = { kind: 'daily' } as const;
    expect(isDueOnDate(rule, new Date(2026, 0, 1))).toBe(true);
    expect(isDueOnDate(rule, new Date(2026, 6, 15))).toBe(true);
    expect(isDueOnDate(rule, new Date(2026, 11, 31))).toBe(true);
  });

  it('REGRESSION GUARD — mask value 2 covers exactly Monday (Mon=bit-position-1)', () => {
    // PIN: Date.getDay() returns 1 for Monday. Bit position = getDay().
    // Mask 0b0000010 = 2 covers ONLY Monday. Future refactors that
    // shift the convention will break this test.
    const monday = new Date(2026, 3, 27);
    expect(monday.getDay()).toBe(1);
    const monOnly = { kind: 'weekdays' as const, days: 2 };
    expect(isDueOnDate(monOnly, monday)).toBe(true);
    expect(isDueOnDate(monOnly, new Date(2026, 3, 28))).toBe(false); // Tue
    expect(isDueOnDate(monOnly, new Date(2026, 4, 3))).toBe(false); // Sun
  });

  it('isDueOnDate weekdays: M-W-F mask (42) matches Mon, Wed, Fri only', () => {
    // 2 (Mon) + 8 (Wed) + 32 (Fri) = 42
    const mwf = { kind: 'weekdays' as const, days: 42 };
    expect(isDueOnDate(mwf, new Date(2026, 3, 27))).toBe(true); // Mon
    expect(isDueOnDate(mwf, new Date(2026, 3, 28))).toBe(false); // Tue
    expect(isDueOnDate(mwf, new Date(2026, 3, 29))).toBe(true); // Wed
    expect(isDueOnDate(mwf, new Date(2026, 4, 1))).toBe(true); // Fri
    expect(isDueOnDate(mwf, new Date(2026, 4, 2))).toBe(false); // Sat
    expect(isDueOnDate(mwf, new Date(2026, 4, 3))).toBe(false); // Sun
  });

  it('isDueOnDate weekdays: uses LOCAL-time getDay (H46 regression)', () => {
    // Construct a date that would shift across UTC boundary if impl used
    // toISOString. Build via local-time getters and assert match.
    const localMon = new Date(2026, 3, 27, 23, 30); // 11:30 PM Monday local
    expect(localMon.getDay()).toBe(1);
    const monOnly = { kind: 'weekdays' as const, days: 2 };
    expect(isDueOnDate(monOnly, localMon)).toBe(true);
  });

  it('isDueOnDate count_per_week: returns true any day of the week (rule applies daily)', () => {
    const rule = { kind: 'count_per_week' as const, count: 3 };
    expect(isDueOnDate(rule, new Date(2026, 3, 27))).toBe(true); // Mon
    expect(isDueOnDate(rule, new Date(2026, 4, 3))).toBe(true); // Sun
  });

  it('isDueOnDate every_n_days: undefined last → overdue; n elapsed → due; else not', () => {
    const rule = { kind: 'every_n_days' as const, n: 3 };
    expect(isDueOnDate(rule, new Date(2026, 3, 27))).toBe(true); // no last
    const last = new Date(2026, 3, 27);
    expect(isDueOnDate(rule, new Date(2026, 3, 28), last)).toBe(false); // 1d
    expect(isDueOnDate(rule, new Date(2026, 3, 29), last)).toBe(false); // 2d
    expect(isDueOnDate(rule, new Date(2026, 3, 30), last)).toBe(true); // 3d
  });

  it('describeRule formats all four cadence kinds', () => {
    expect(describeRule({ kind: 'daily' })).toBe('Daily');
    expect(describeRule({ kind: 'weekdays', days: 42 })).toBe('Mon, Wed, Fri');
    expect(describeRule({ kind: 'weekdays', days: 2 })).toBe('Mon');
    expect(describeRule({ kind: 'weekdays', days: 1 + 64 })).toBe('Sun, Sat');
    expect(describeRule({ kind: 'count_per_week', count: 3 })).toBe('3× per week');
    expect(describeRule({ kind: 'every_n_days', n: 5 })).toBe('Every 5 days');
  });

  it('nextDueDate: daily returns from-day, weekdays scans forward, every_n_days adds n', () => {
    // daily
    const fromAfternoon = new Date(2026, 3, 27, 14, 30);
    const dailyNext = nextDueDate({ kind: 'daily' }, fromAfternoon);
    expect(dailyNext.getDate()).toBe(27);
    expect(dailyNext.getHours()).toBe(0);

    // weekdays — Sunday → next Monday
    const sunday = new Date(2026, 3, 26);
    const wkNext = nextDueDate({ kind: 'weekdays', days: 42 }, sunday);
    expect(wkNext.getDay()).toBe(1);

    // every_n_days
    const last = new Date(2026, 3, 27);
    const enNext = nextDueDate({ kind: 'every_n_days', n: 3 }, last, last);
    expect(enNext.getDate()).toBe(30);
  });

  it('bitmask helpers: set, clear, has', () => {
    expect(setWeekdayBit(0, 1)).toBe(2);
    expect(setWeekdayBit(2, 3)).toBe(2 + 8);
    expect(clearWeekdayBit(42, 3)).toBe(42 - 8);
    expect(hasWeekdayBit(42, 1)).toBe(true);
    expect(hasWeekdayBit(42, 2)).toBe(false);
  });

  it('normalizeHabit: defaults missing cadence to daily; preserves existing; does not mutate', () => {
    const raw: HabitDefinition = { id: 'x', name: 'Test', order: 0 };
    const norm = normalizeHabit(raw);
    expect(norm.cadence).toEqual({ kind: 'daily' });
    expect(raw.cadence).toBeUndefined(); // input not mutated

    const withCad: HabitDefinition = {
      id: 'y',
      name: 'Test',
      order: 0,
      cadence: { kind: 'count_per_week', count: 4 },
    };
    expect(normalizeHabit(withCad).cadence).toEqual({ kind: 'count_per_week', count: 4 });
  });
});
