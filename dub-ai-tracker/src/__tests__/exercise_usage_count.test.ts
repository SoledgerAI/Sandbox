// S36: Per-exercise usage_count behavior + sort precedence.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  incrementUsageCount,
  getUsageCount,
  usageCountKey,
} from '../services/strengthService';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('exercise usage_count', () => {
  it('incrementUsageCount creates the key on first call and persists', async () => {
    expect(await getUsageCount('bench')).toBe(0);
    await incrementUsageCount('bench');
    expect(await getUsageCount('bench')).toBe(1);
  });

  it('subsequent increments accumulate', async () => {
    await incrementUsageCount('squat');
    await incrementUsageCount('squat');
    await incrementUsageCount('squat');
    expect(await getUsageCount('squat')).toBe(3);
  });

  it('counts for different exercises are independent', async () => {
    await incrementUsageCount('a');
    await incrementUsageCount('b');
    await incrementUsageCount('b');
    expect(await getUsageCount('a')).toBe(1);
    expect(await getUsageCount('b')).toBe(2);
  });

  it('usageCountKey is namespaced under dub.exercise.usage_count', () => {
    expect(usageCountKey('bench')).toBe('dub.exercise.usage_count.bench');
  });

  it('usage_count survives across "sessions" (separate getUsageCount reads)', async () => {
    await incrementUsageCount('persistent');
    // simulate a fresh read path
    const a = await getUsageCount('persistent');
    const b = await getUsageCount('persistent');
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});
