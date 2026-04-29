// S33-B: Cadence rule evaluation.
//
// Critical binding (REV 2): bit positions align with Date.prototype.getDay()
// return values (0..6, Sun=0, Mon=1 ... Sat=6). Mask test:
//   isDue = (mask & (1 << date.getDay())) !== 0
// No off-by-one. The cadence_rules.test.ts pin asserts mask value 2 covers
// exactly Monday — regression guard against silent shifts.
//
// All date arithmetic uses local-time getters (getDay, getDate, getMonth,
// getFullYear). NO toISOString. NO UTC. Mirrors the H46 fix pattern.

import type { CadenceRule, WeekdayMask } from '../types';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns the local-midnight clone of `d`. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole-day delta from a → b (b - a), local-time. Negative if b < a. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

/**
 * Returns true if the habit's cadence rule says it should be completed on
 * `date`. Local-time. `lastCompletionDate` is required for every_n_days
 * accuracy; without it, every_n_days returns true (treats as overdue).
 */
export function isDueOnDate(
  cadence: CadenceRule,
  date: Date,
  lastCompletionDate?: Date,
): boolean {
  switch (cadence.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return (cadence.days & (1 << date.getDay())) !== 0;
    case 'count_per_week':
      // Cadence applies any day of the week — UI/streak code handles the
      // count semantics. isDueOnDate just answers "could it be done today".
      return true;
    case 'every_n_days': {
      if (!lastCompletionDate) return true;
      return daysBetween(lastCompletionDate, date) >= cadence.n;
    }
  }
}

/** Human-readable cadence label. */
export function describeRule(cadence: CadenceRule): string {
  switch (cadence.kind) {
    case 'daily':
      return 'Daily';
    case 'weekdays': {
      const names: string[] = [];
      for (let i = 0; i < 7; i++) {
        if ((cadence.days & (1 << i)) !== 0) names.push(WEEKDAY_NAMES[i]);
      }
      return names.length === 0 ? 'No days' : names.join(', ');
    }
    case 'count_per_week':
      return `${cadence.count}× per week`;
    case 'every_n_days':
      return `Every ${cadence.n} days`;
  }
}

/**
 * Next date (>= `from`, local-time) on which the habit is due.
 * - daily: always `from`.
 * - weekdays: next day with bit set, scanning [from, from+7].
 * - count_per_week: `from` (treated as always available).
 * - every_n_days: max(from, lastCompletion + n).
 */
export function nextDueDate(
  cadence: CadenceRule,
  from: Date,
  lastCompletionDate?: Date,
): Date {
  switch (cadence.kind) {
    case 'daily':
    case 'count_per_week':
      return startOfDay(from);
    case 'weekdays': {
      const start = startOfDay(from);
      for (let i = 0; i < 7; i++) {
        const candidate = new Date(start);
        candidate.setDate(candidate.getDate() + i);
        if ((cadence.days & (1 << candidate.getDay())) !== 0) return candidate;
      }
      return start;
    }
    case 'every_n_days': {
      const start = startOfDay(from);
      if (!lastCompletionDate) return start;
      const next = startOfDay(lastCompletionDate);
      next.setDate(next.getDate() + cadence.n);
      return next.getTime() > start.getTime() ? next : start;
    }
  }
}

/** Bit-position helper exposed for tests + settings UI. */
export function setWeekdayBit(mask: WeekdayMask, weekday: number): WeekdayMask {
  return mask | (1 << weekday);
}

export function clearWeekdayBit(mask: WeekdayMask, weekday: number): WeekdayMask {
  return mask & ~(1 << weekday);
}

export function hasWeekdayBit(mask: WeekdayMask, weekday: number): boolean {
  return (mask & (1 << weekday)) !== 0;
}
