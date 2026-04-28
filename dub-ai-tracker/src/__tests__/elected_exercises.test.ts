// S36: Elected exercises (favorites) persistence and sort behavior.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, STORAGE_KEYS } from '../utils/storage';
import {
  getElectedExercises,
  setElectedExercises,
  toggleElectedExercise,
} from '../services/strengthService';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('elected exercises', () => {
  it('electing an exercise persists to settings', async () => {
    await toggleElectedExercise('barbell-bench-press');
    const stored = await storageGet<string[]>(STORAGE_KEYS.SETTINGS_ELECTED_EXERCISES);
    expect(stored).toContain('barbell-bench-press');
  });

  it('un-electing removes from settings', async () => {
    await toggleElectedExercise('squat-id');
    await toggleElectedExercise('squat-id');
    const stored = await storageGet<string[]>(STORAGE_KEYS.SETTINGS_ELECTED_EXERCISES);
    expect(stored).toEqual([]);
  });

  it('elected exercises survive a fresh getElectedExercises call', async () => {
    await setElectedExercises(['a', 'b', 'c']);
    const list = await getElectedExercises();
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('electing same exercise twice produces a single entry (dedupe)', async () => {
    await setElectedExercises(['a', 'a', 'a']);
    const list = await getElectedExercises();
    expect(list).toEqual(['a']);
  });

  it('toggle returns the resulting list', async () => {
    const after1 = await toggleElectedExercise('x');
    expect(after1).toEqual(['x']);
    const after2 = await toggleElectedExercise('x');
    expect(after2).toEqual([]);
  });

  it('default electedExercises is empty array when nothing stored', async () => {
    const list = await getElectedExercises();
    expect(list).toEqual([]);
  });
});
