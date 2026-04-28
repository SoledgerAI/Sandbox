// S33-A: Rep preset persistence + sort + idempotency.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, STORAGE_KEYS } from '../utils/storage';
import {
  getPresetsForExercise,
  savePreset,
  updatePreset,
  deletePreset,
  incrementPresetUsage,
} from '../services/repPresetService';
import type { RepPreset } from '../types';

const EX = 'barbell-bench-press';
const presetsKey = (id: string) => `${STORAGE_KEYS.REP_PRESETS_PREFIX}.${id}`;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('rep presets', () => {
  it('saving a preset persists to storage under correct key', async () => {
    await savePreset(EX, { sets: 5, reps: 5, weight_lb: 135 });
    const stored = await storageGet<RepPreset[]>(presetsKey(EX));
    expect(stored).not.toBeNull();
    expect(stored!.length).toBe(1);
    expect(stored![0]).toMatchObject({ sets: 5, reps: 5, weight_lb: 135, times_used: 0 });
  });

  it('REP_PRESETS_PREFIX matches the spec value', () => {
    expect(STORAGE_KEYS.REP_PRESETS_PREFIX).toBe('dub.strength.rep_presets');
  });

  it('incrementPresetUsage advances times_used by 1', async () => {
    const created = await savePreset(EX, { sets: 3, reps: 10 });
    await incrementPresetUsage(EX, created.id);
    const after = await getPresetsForExercise(EX);
    expect(after.find((p) => p.id === created.id)?.times_used).toBe(1);
  });

  it('sort by times_used desc is stable; created_at breaks ties', async () => {
    const a = await savePreset(EX, { sets: 3, reps: 10, label: 'A' });
    await new Promise((r) => setTimeout(r, 2));
    const b = await savePreset(EX, { sets: 5, reps: 5, label: 'B' });
    await incrementPresetUsage(EX, a.id);
    await incrementPresetUsage(EX, a.id);
    await incrementPresetUsage(EX, b.id);
    const sorted = await getPresetsForExercise(EX);
    // a has 2, b has 1 → a first
    expect(sorted[0].label).toBe('A');
    expect(sorted[1].label).toBe('B');
  });

  it('deletePreset removes from storage', async () => {
    const p = await savePreset(EX, { sets: 4, reps: 12 });
    await deletePreset(EX, p.id);
    const after = await getPresetsForExercise(EX);
    expect(after.length).toBe(0);
  });

  it('updatePreset preserves id + created_at, updates fields', async () => {
    const p = await savePreset(EX, { sets: 3, reps: 10, weight_lb: 100 });
    const updated = await updatePreset(EX, p.id, { weight_lb: 135, label: 'heavy' });
    expect(updated?.id).toBe(p.id);
    expect(updated?.created_at).toBe(p.created_at);
    expect(updated?.weight_lb).toBe(135);
    expect(updated?.label).toBe('heavy');
  });

  it('presets keyed by exercise_id (no cross-contamination)', async () => {
    await savePreset('squat', { sets: 5, reps: 5 });
    await savePreset('deadlift', { sets: 1, reps: 5 });
    const squat = await getPresetsForExercise('squat');
    const deadlift = await getPresetsForExercise('deadlift');
    expect(squat.length).toBe(1);
    expect(deadlift.length).toBe(1);
    expect(squat[0].sets).toBe(5);
    expect(deadlift[0].sets).toBe(1);
  });

  it('AMRAP rep value persists and round-trips', async () => {
    await savePreset(EX, { sets: 3, reps: 'AMRAP' });
    const list = await getPresetsForExercise(EX);
    expect(list[0].reps).toBe('AMRAP');
  });

  it('weight_lb optional — saving without weight succeeds', async () => {
    const p = await savePreset(EX, { sets: 3, reps: 10 });
    expect(p.weight_lb).toBeUndefined();
    const list = await getPresetsForExercise(EX);
    expect(list[0].weight_lb).toBeUndefined();
  });

  it('incrementPresetUsage on missing id is a no-op (returns null)', async () => {
    const result = await incrementPresetUsage(EX, 'nonexistent');
    expect(result).toBeNull();
  });
});
