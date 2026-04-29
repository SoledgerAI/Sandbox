// S33-B: HabitsChecklist filtering + settings cadence persistence.
// Logic-level tests against the same primitives the UI uses
// (loadHabitDefinitions, isDueOnDate, normalizeHabit, storage).

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
} from '../utils/storage';
import { loadHabitDefinitions } from '../components/logging/HabitsChecklist';
import { isDueOnDate } from '../utils/cadence';
import { normalizeHabit } from '../types';
import type { HabitDefinition, CadenceRule } from '../types';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('habits cadence filtering (HabitsChecklist + settings)', () => {
  it('filters habits by isDueOnDate — Saturday with M-W-F habit excluded', () => {
    // 2026-05-02 Sat. M-W-F mask = 42.
    const sat = new Date(2026, 4, 2);
    const habits: HabitDefinition[] = [
      { id: 'h1', name: 'Daily', order: 0, cadence: { kind: 'daily' } },
      { id: 'h2', name: 'MWF', order: 1, cadence: { kind: 'weekdays', days: 42 } },
    ];
    const due = habits.filter((h) =>
      !h.archived && isDueOnDate(normalizeHabit(h).cadence, sat),
    );
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('h1');
  });

  it('"show all" reveals off-day habits via the inverse predicate', () => {
    // Same fixture: Saturday. Off-day predicate.
    const sat = new Date(2026, 4, 2);
    const habits: HabitDefinition[] = [
      { id: 'h1', name: 'Daily', order: 0, cadence: { kind: 'daily' } },
      { id: 'h2', name: 'MWF', order: 1, cadence: { kind: 'weekdays', days: 42 } },
    ];
    const offDay = habits.filter((h) =>
      !h.archived && !isDueOnDate(normalizeHabit(h).cadence, sat),
    );
    expect(offDay).toHaveLength(1);
    expect(offDay[0].id).toBe('h2');
  });

  it('off-day habits are non-tappable (logic invariant: filter excludes from due-today entries)', () => {
    // The HabitsChecklist renderer iterates over `habits` (entries built
    // from due-today defs only). Off-day defs render in a separate
    // section without onPress. The invariant tested here: a habit not
    // in the due-today set is also not in the entries set; the entries
    // array is what the toggle handler operates on.
    const sat = new Date(2026, 4, 2);
    const habits: HabitDefinition[] = [
      { id: 'h1', name: 'Daily', order: 0, cadence: { kind: 'daily' } },
      { id: 'h2', name: 'MWF', order: 1, cadence: { kind: 'weekdays', days: 42 } },
    ];
    const dueIds = new Set(
      habits
        .filter((h) => !h.archived && isDueOnDate(normalizeHabit(h).cadence, sat))
        .map((h) => h.id),
    );
    expect(dueIds.has('h2')).toBe(false);
  });

  it('empty state predicate: nothing due today when only off-day habits exist', () => {
    const sat = new Date(2026, 4, 2);
    const habits: HabitDefinition[] = [
      { id: 'h2', name: 'MWF', order: 0, cadence: { kind: 'weekdays', days: 42 } },
    ];
    const due = habits.filter((h) =>
      !h.archived && isDueOnDate(normalizeHabit(h).cadence, sat),
    );
    expect(due).toHaveLength(0);
  });

  it('cadence migration: pre-S33B HabitDefinition (no cadence field) loads as daily', async () => {
    // Stored shape pre-S33B: only {id, name, order}.
    const pre: HabitDefinition[] = [
      { id: 'h_old', name: 'Old', order: 0 },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, pre);
    const loaded = await loadHabitDefinitions();
    expect(loaded[0].cadence).toEqual({ kind: 'daily' });
  });

  it('settings cadence picker writes correct CadenceRule shape', async () => {
    // Simulates a save-after-picker flow: count_per_week, count=3.
    const cadence: CadenceRule = { kind: 'count_per_week', count: 3 };
    const saved: HabitDefinition[] = [
      { id: 'h_strength', name: 'Strength', order: 0, cadence, target: 3 },
    ];
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, saved);
    const loaded = await storageGet<HabitDefinition[]>(STORAGE_KEYS.SETTINGS_HABITS);
    expect(loaded?.[0].cadence).toEqual({ kind: 'count_per_week', count: 3 });
    expect(loaded?.[0].target).toBe(3);
  });

  it('archived habit is excluded from the due-today entries set', () => {
    const today = new Date(2026, 3, 29); // Wed
    const habits: HabitDefinition[] = [
      { id: 'h1', name: 'Live', order: 0, cadence: { kind: 'daily' } },
      { id: 'h2', name: 'Archived', order: 1, cadence: { kind: 'daily' }, archived: true },
    ];
    const due = habits.filter((h) =>
      !h.archived && isDueOnDate(normalizeHabit(h).cadence, today),
    );
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('h1');
  });
});
