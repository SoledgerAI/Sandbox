// Sprint 31: Token usage circular buffer tests

import {
  logTokenUsage,
  getTokenLog,
  clearTokenLog,
  getTokenLogSummary,
  type TokenLogEntry,
} from '../utils/tokenLog';
import { STORAGE_KEYS, storageGet, storageSet } from '../utils/storage';

describe('tokenLog — Sprint 31', () => {
  describe('logTokenUsage', () => {
    it('appends to an empty buffer', async () => {
      await logTokenUsage({ feature: 'wearable_scan', input_tokens: 100, output_tokens: 50 });
      const buf = await getTokenLog();
      expect(buf).toHaveLength(1);
      expect(buf[0].feature).toBe('wearable_scan');
      expect(buf[0].input_tokens).toBe(100);
      expect(buf[0].output_tokens).toBe(50);
      expect(typeof buf[0].timestamp).toBe('number');
    });

    it('appends to an existing buffer', async () => {
      await logTokenUsage({ feature: 'scale_scan', input_tokens: 10, output_tokens: 5 });
      await logTokenUsage({ feature: 'recipe_scan', input_tokens: 20, output_tokens: 10 });
      const buf = await getTokenLog();
      expect(buf).toHaveLength(2);
      expect(buf[0].feature).toBe('scale_scan');
      expect(buf[1].feature).toBe('recipe_scan');
    });

    it('trims to last 1000 entries when 1001st is added', async () => {
      // Pre-seed 1000 entries directly to the buffer to keep the test fast.
      const seed: TokenLogEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        seed.push({ timestamp: i, feature: 'food_scan', input_tokens: 1, output_tokens: 1 });
      }
      await storageSet(STORAGE_KEYS.TOKEN_LOG_BUFFER, seed);

      await logTokenUsage({ feature: 'wearable_scan', input_tokens: 999, output_tokens: 999 });

      const buf = await getTokenLog();
      expect(buf).toHaveLength(1000);
      // Oldest entry (timestamp 0) should be trimmed; newest should be the wearable_scan one.
      expect(buf[0].timestamp).toBe(1);
      expect(buf[buf.length - 1].feature).toBe('wearable_scan');
      expect(buf[buf.length - 1].input_tokens).toBe(999);
    });

    it('swallows AsyncStorage write failures and warns', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // Force storageSet to throw by spying on AsyncStorage.setItem
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.setItem.mockImplementationOnce(() => Promise.reject(new Error('disk full')));

      await expect(
        logTokenUsage({ feature: 'wearable_scan', input_tokens: 1, output_tokens: 1 }),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('getTokenLog', () => {
    it('returns [] when key is missing', async () => {
      const buf = await getTokenLog();
      expect(buf).toEqual([]);
    });

    it('returns [] when stored value is corrupt JSON', async () => {
      // Inject corrupt JSON directly into AsyncStorage mock
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockImplementationOnce(() => Promise.resolve('this is not json'));
      const buf = await getTokenLog();
      expect(buf).toEqual([]);
    });
  });

  describe('getTokenLogSummary', () => {
    it('aggregates correctly across features', async () => {
      await logTokenUsage({ feature: 'wearable_scan', input_tokens: 100, output_tokens: 50 });
      await logTokenUsage({ feature: 'wearable_scan', input_tokens: 200, output_tokens: 80 });
      await logTokenUsage({ feature: 'scale_scan', input_tokens: 30, output_tokens: 15 });

      const sum = await getTokenLogSummary();
      expect(sum.total_input).toBe(330);
      expect(sum.total_output).toBe(145);
      expect(sum.by_feature.wearable_scan).toEqual({ input: 300, output: 130, count: 2 });
      expect(sum.by_feature.scale_scan).toEqual({ input: 30, output: 15, count: 1 });
      expect(sum.by_feature.recipe_scan).toEqual({ input: 0, output: 0, count: 0 });
    });

    it('filters by sinceMs', async () => {
      const earlier: TokenLogEntry[] = [
        { timestamp: 1000, feature: 'wearable_scan', input_tokens: 50, output_tokens: 25 },
        { timestamp: 2000, feature: 'wearable_scan', input_tokens: 60, output_tokens: 30 },
        { timestamp: 3000, feature: 'scale_scan', input_tokens: 10, output_tokens: 5 },
      ];
      await storageSet(STORAGE_KEYS.TOKEN_LOG_BUFFER, earlier);

      const sum = await getTokenLogSummary({ sinceMs: 2000 });
      // Only entries with timestamp >= 2000 count.
      expect(sum.total_input).toBe(70);
      expect(sum.total_output).toBe(35);
      expect(sum.by_feature.wearable_scan.count).toBe(1);
      expect(sum.by_feature.scale_scan.count).toBe(1);
    });

    it('returns zero-initialized summary for empty buffer', async () => {
      const sum = await getTokenLogSummary();
      expect(sum.total_input).toBe(0);
      expect(sum.total_output).toBe(0);
      expect(sum.by_feature.coach_chat.count).toBe(0);
    });
  });

  describe('clearTokenLog', () => {
    it('removes the key', async () => {
      await logTokenUsage({ feature: 'food_scan', input_tokens: 1, output_tokens: 1 });
      let buf = await getTokenLog();
      expect(buf.length).toBeGreaterThan(0);

      await clearTokenLog();

      buf = await getTokenLog();
      expect(buf).toEqual([]);

      // Storage key is actually removed (not just emptied)
      const raw = await storageGet<unknown>(STORAGE_KEYS.TOKEN_LOG_BUFFER);
      expect(raw).toBeNull();
    });
  });
});
