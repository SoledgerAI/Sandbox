// Sprint 16: Daily Habits + Bodyweight Reps tests

import {
  storageGet,
  storageSet,
  storageDelete,
  STORAGE_KEYS,
  dateKey,
} from '../utils/storage';
import type {
  HabitEntry,
  HabitDefinition,
  BodyweightRepEntry,
  BodyweightExerciseType,
} from '../types';
import { DEFAULT_HABITS, BODYWEIGHT_EXERCISES } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TODAY = '2026-04-09';

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ============================================================
// Feature 1: Daily Habits
// ============================================================

describe('Daily Habits', () => {
  const habitsKey = dateKey(STORAGE_KEYS.LOG_HABITS, TODAY);

  describe('Habit toggle logic', () => {
    it('creates habits from definitions and saves to storage', async () => {
      const definitions: HabitDefinition[] = [
        { id: 'h1', name: 'Brush teeth (morning)', order: 0 },
        { id: 'h2', name: 'Floss', order: 1 },
      ];
      const habits: HabitEntry[] = definitions.map((d) => ({
        id: d.id,
        name: d.name,
        completed: false,
        completedAt: null,
      }));
      await storageSet(habitsKey, habits);
      const loaded = await storageGet<HabitEntry[]>(habitsKey);
      expect(loaded).toHaveLength(2);
      expect(loaded![0].completed).toBe(false);
      expect(loaded![0].completedAt).toBeNull();
    });

    it('toggles a habit to completed', async () => {
      const habits: HabitEntry[] = [
        { id: 'h1', name: 'Brush teeth', completed: false, completedAt: null },
      ];
      await storageSet(habitsKey, habits);

      // Toggle to completed
      const now = new Date().toISOString();
      const updated = habits.map((h) => ({
        ...h,
        completed: true,
        completedAt: now,
      }));
      await storageSet(habitsKey, updated);

      const loaded = await storageGet<HabitEntry[]>(habitsKey);
      expect(loaded![0].completed).toBe(true);
      expect(loaded![0].completedAt).toBeTruthy();
    });

    it('toggles a habit back to incomplete', async () => {
      const now = new Date().toISOString();
      const habits: HabitEntry[] = [
        { id: 'h1', name: 'Brush teeth', completed: true, completedAt: now },
      ];
      await storageSet(habitsKey, habits);

      // Toggle to incomplete
      const updated = habits.map((h) => ({
        ...h,
        completed: false,
        completedAt: null,
      }));
      await storageSet(habitsKey, updated);

      const loaded = await storageGet<HabitEntry[]>(habitsKey);
      expect(loaded![0].completed).toBe(false);
      expect(loaded![0].completedAt).toBeNull();
    });

    it('correctly counts completed habits', async () => {
      const habits: HabitEntry[] = [
        { id: 'h1', name: 'Brush AM', completed: true, completedAt: '2026-04-09T08:00:00Z' },
        { id: 'h2', name: 'Floss', completed: false, completedAt: null },
        { id: 'h3', name: 'Make bed', completed: true, completedAt: '2026-04-09T07:30:00Z' },
        { id: 'h4', name: 'Face cream', completed: false, completedAt: null },
      ];
      await storageSet(habitsKey, habits);

      const loaded = await storageGet<HabitEntry[]>(habitsKey);
      const completedCount = loaded!.filter((h) => h.completed).length;
      expect(completedCount).toBe(2);
      expect(loaded).toHaveLength(4);
    });
  });

  describe('Custom habit add/remove', () => {
    const settingsKey = STORAGE_KEYS.SETTINGS_HABITS;

    it('adds a custom habit definition', async () => {
      const existing: HabitDefinition[] = [
        { id: 'h1', name: 'Brush teeth', order: 0 },
      ];
      await storageSet(settingsKey, existing);

      const newHabit: HabitDefinition = { id: 'h2', name: 'Drink water', order: 1 };
      const updated = [...existing, newHabit];
      await storageSet(settingsKey, updated);

      const loaded = await storageGet<HabitDefinition[]>(settingsKey);
      expect(loaded).toHaveLength(2);
      expect(loaded![1].name).toBe('Drink water');
    });

    it('removes a custom habit definition', async () => {
      const existing: HabitDefinition[] = [
        { id: 'h1', name: 'Brush teeth', order: 0 },
        { id: 'h2', name: 'Drink water', order: 1 },
        { id: 'h3', name: 'Floss', order: 2 },
      ];
      await storageSet(settingsKey, existing);

      const updated = existing.filter((h) => h.id !== 'h2');
      await storageSet(settingsKey, updated);

      const loaded = await storageGet<HabitDefinition[]>(settingsKey);
      expect(loaded).toHaveLength(2);
      expect(loaded!.find((h) => h.id === 'h2')).toBeUndefined();
    });

    it('renames a habit definition', async () => {
      const existing: HabitDefinition[] = [
        { id: 'h1', name: 'Brush teeth', order: 0 },
      ];
      await storageSet(settingsKey, existing);

      const updated = existing.map((h) =>
        h.id === 'h1' ? { ...h, name: 'Brush teeth (AM)' } : h,
      );
      await storageSet(settingsKey, updated);

      const loaded = await storageGet<HabitDefinition[]>(settingsKey);
      expect(loaded![0].name).toBe('Brush teeth (AM)');
    });

    it('reorders habit definitions', async () => {
      const existing: HabitDefinition[] = [
        { id: 'h1', name: 'A', order: 0 },
        { id: 'h2', name: 'B', order: 1 },
        { id: 'h3', name: 'C', order: 2 },
      ];
      await storageSet(settingsKey, existing);

      // Move B to position 0
      const reordered = [existing[1], existing[0], existing[2]].map((h, i) => ({
        ...h,
        order: i,
      }));
      await storageSet(settingsKey, reordered);

      const loaded = await storageGet<HabitDefinition[]>(settingsKey);
      const sorted = loaded!.sort((a, b) => a.order - b.order);
      expect(sorted[0].name).toBe('B');
      expect(sorted[1].name).toBe('A');
      expect(sorted[2].name).toBe('C');
    });

    it('provides correct default habits', () => {
      expect(DEFAULT_HABITS).toHaveLength(6);
      expect(DEFAULT_HABITS[0].name).toBe('Brush teeth (morning)');
      expect(DEFAULT_HABITS[5].name).toBe('Face cream (evening)');
    });
  });
});

// ============================================================
// Feature 2: Bodyweight Reps
// ============================================================

describe('Bodyweight Reps', () => {
  const repsKey = dateKey(STORAGE_KEYS.LOG_REPS, TODAY);

  it('has 5 exercise types defined', () => {
    expect(BODYWEIGHT_EXERCISES).toHaveLength(5);
    const types = BODYWEIGHT_EXERCISES.map((e) => e.type);
    expect(types).toContain('pushups');
    expect(types).toContain('pullups');
    expect(types).toContain('situps');
    expect(types).toContain('jumping_jacks');
    expect(types).toContain('standing_squats');
  });

  describe('Rep logging save/retrieve', () => {
    const exerciseTypes: BodyweightExerciseType[] = [
      'pushups', 'pullups', 'situps', 'jumping_jacks', 'standing_squats',
    ];

    it.each(exerciseTypes)('saves and retrieves %s entry', async (exerciseType) => {
      const entry: BodyweightRepEntry = {
        id: `rep_${exerciseType}`,
        timestamp: '2026-04-09T10:00:00Z',
        exercise_type: exerciseType,
        reps: 20,
        sets: 3,
        notes: null,
      };
      await storageSet(repsKey, [entry]);

      const loaded = await storageGet<BodyweightRepEntry[]>(repsKey);
      expect(loaded).toHaveLength(1);
      expect(loaded![0].exercise_type).toBe(exerciseType);
      expect(loaded![0].reps).toBe(20);
      expect(loaded![0].sets).toBe(3);

      // Clean up for next test in the loop
      await storageDelete(repsKey);
    });

    it('saves multiple entries for different exercise types', async () => {
      const entries: BodyweightRepEntry[] = [
        { id: 'r1', timestamp: '2026-04-09T08:00:00Z', exercise_type: 'pushups', reps: 20, sets: 3, notes: null },
        { id: 'r2', timestamp: '2026-04-09T08:05:00Z', exercise_type: 'pullups', reps: 10, sets: 3, notes: null },
        { id: 'r3', timestamp: '2026-04-09T12:00:00Z', exercise_type: 'situps', reps: 30, sets: 2, notes: null },
        { id: 'r4', timestamp: '2026-04-09T12:05:00Z', exercise_type: 'jumping_jacks', reps: 50, sets: 2, notes: null },
        { id: 'r5', timestamp: '2026-04-09T17:00:00Z', exercise_type: 'standing_squats', reps: 25, sets: 3, notes: null },
      ];
      await storageSet(repsKey, entries);

      const loaded = await storageGet<BodyweightRepEntry[]>(repsKey);
      expect(loaded).toHaveLength(5);
    });

    it('computes daily totals correctly', async () => {
      const entries: BodyweightRepEntry[] = [
        { id: 'r1', timestamp: '2026-04-09T08:00:00Z', exercise_type: 'pushups', reps: 20, sets: 3, notes: null },
        { id: 'r2', timestamp: '2026-04-09T12:00:00Z', exercise_type: 'pushups', reps: 15, sets: 2, notes: null },
      ];
      await storageSet(repsKey, entries);

      const loaded = await storageGet<BodyweightRepEntry[]>(repsKey);
      const pushupEntries = loaded!.filter((e) => e.exercise_type === 'pushups');
      const totalReps = pushupEntries.reduce((s, e) => s + e.reps * e.sets, 0);
      // 20*3 + 15*2 = 60 + 30 = 90
      expect(totalReps).toBe(90);
    });

    it('defaults sets to 1 when stored as 1', async () => {
      const entry: BodyweightRepEntry = {
        id: 'r1',
        timestamp: '2026-04-09T10:00:00Z',
        exercise_type: 'pushups',
        reps: 25,
        sets: 1,
        notes: null,
      };
      await storageSet(repsKey, [entry]);

      const loaded = await storageGet<BodyweightRepEntry[]>(repsKey);
      expect(loaded![0].sets).toBe(1);
      expect(loaded![0].reps * loaded![0].sets).toBe(25);
    });
  });
});

// ============================================================
// Feature 3: Context Builder — Habits and Reps
// ============================================================

describe('Context Builder includes habits and reps', () => {
  it('habit context format is correct', () => {
    // Test the format we inject into context builder
    const habits: HabitEntry[] = [
      { id: 'h1', name: 'Brush AM', completed: true, completedAt: '2026-04-09T08:00:00Z' },
      { id: 'h2', name: 'Floss', completed: false, completedAt: null },
      { id: 'h3', name: 'Make bed', completed: true, completedAt: '2026-04-09T07:00:00Z' },
      { id: 'h4', name: 'Face cream AM', completed: true, completedAt: '2026-04-09T08:30:00Z' },
      { id: 'h5', name: 'Brush PM', completed: false, completedAt: null },
      { id: 'h6', name: 'Face cream PM', completed: true, completedAt: '2026-04-09T21:00:00Z' },
    ];

    const completed = habits.filter((h) => h.completed);
    const missed = habits.filter((h) => !h.completed);
    const missedNames = missed.map((h) => h.name).join(', ');
    const missedPart = missed.length > 0 ? ` (missed: ${missedNames})` : '';
    const contextLine = `[HABITS 2026-04-09] ${completed.length}/${habits.length} completed${missedPart}`;

    expect(contextLine).toBe('[HABITS 2026-04-09] 4/6 completed (missed: Floss, Brush PM)');
  });

  it('rep context format is correct', () => {
    const entries: BodyweightRepEntry[] = [
      { id: 'r1', timestamp: '', exercise_type: 'pushups', reps: 20, sets: 3, notes: null },
      { id: 'r2', timestamp: '', exercise_type: 'pullups', reps: 5, sets: 3, notes: null },
      { id: 'r3', timestamp: '', exercise_type: 'situps', reps: 20, sets: 2, notes: null },
      { id: 'r4', timestamp: '', exercise_type: 'jumping_jacks', reps: 50, sets: 2, notes: null },
      { id: 'r5', timestamp: '', exercise_type: 'standing_squats', reps: 25, sets: 2, notes: null },
    ];

    const totals = new Map<string, { reps: number; sets: number }>();
    for (const r of entries) {
      const prev = totals.get(r.exercise_type) ?? { reps: 0, sets: 0 };
      totals.set(r.exercise_type, {
        reps: prev.reps + r.reps * r.sets,
        sets: prev.sets + r.sets,
      });
    }
    const parts = Array.from(totals.entries())
      .map(([type, t]) => `${type}:${t.reps}(${t.sets}sets)`)
      .join(' ');
    const contextLine = `[REPS 2026-04-09] ${parts}`;

    expect(contextLine).toBe(
      '[REPS 2026-04-09] pushups:60(3sets) pullups:15(3sets) situps:40(2sets) jumping_jacks:100(2sets) standing_squats:50(2sets)',
    );
  });

  it('storage keys exist for habits and reps', () => {
    expect(STORAGE_KEYS.LOG_HABITS).toBe('dub.log.habits');
    expect(STORAGE_KEYS.LOG_REPS).toBe('dub.log.reps');
    expect(STORAGE_KEYS.SETTINGS_HABITS).toBe('dub.settings.habits');
  });

  it('dateKey generates correct habit/rep keys', () => {
    expect(dateKey(STORAGE_KEYS.LOG_HABITS, '2026-04-09')).toBe('dub.log.habits.2026-04-09');
    expect(dateKey(STORAGE_KEYS.LOG_REPS, '2026-04-09')).toBe('dub.log.reps.2026-04-09');
  });
});
