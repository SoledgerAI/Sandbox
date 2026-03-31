// Step 2: AsyncStorage wrapper tests

import {
  storageGet,
  storageSet,
  storageDelete,
  storageList,
  storageGetMultiple,
  STORAGE_KEYS,
  dateKey,
  StorageError,
} from '../utils/storage';

describe('Storage Wrapper', () => {
  describe('storageSet and storageGet round-trip', () => {
    it('stores and retrieves a typed object', async () => {
      const data = { name: 'Test', value: 42 };
      await storageSet('test.key', data);
      const result = await storageGet<{ name: string; value: number }>('test.key');
      expect(result).toEqual(data);
    });

    it('stores and retrieves a string', async () => {
      await storageSet('test.string', 'hello');
      const result = await storageGet<string>('test.string');
      expect(result).toBe('hello');
    });

    it('stores and retrieves an array', async () => {
      const arr = [1, 2, 3];
      await storageSet('test.array', arr);
      const result = await storageGet<number[]>('test.array');
      expect(result).toEqual(arr);
    });
  });

  describe('storageDelete', () => {
    it('removes a key', async () => {
      await storageSet('test.del', 'value');
      await storageDelete('test.del');
      const result = await storageGet<string>('test.del');
      expect(result).toBeNull();
    });
  });

  describe('storageGet non-existent key', () => {
    it('returns null for missing key', async () => {
      const result = await storageGet<string>('nonexistent.key');
      expect(result).toBeNull();
    });
  });

  describe('storageList', () => {
    it('lists keys matching a prefix', async () => {
      await storageSet('dub.log.food.2026-03-27', []);
      await storageSet('dub.log.food.2026-03-26', []);
      await storageSet('dub.log.water.2026-03-27', []);
      const foodKeys = await storageList('dub.log.food');
      expect(foodKeys).toHaveLength(2);
      expect(foodKeys.every((k: string) => k.startsWith('dub.log.food'))).toBe(true);
    });
  });

  describe('storageGetMultiple', () => {
    it('retrieves multiple keys', async () => {
      await storageSet('multi.a', { val: 1 });
      await storageSet('multi.b', { val: 2 });
      const result = await storageGetMultiple<{ val: number }>(['multi.a', 'multi.b', 'multi.c']);
      expect(result.get('multi.a')).toEqual({ val: 1 });
      expect(result.get('multi.b')).toEqual({ val: 2 });
      expect(result.get('multi.c')).toBeNull();
    });
  });

  describe('STORAGE_KEYS constants', () => {
    it('has profile key', () => {
      expect(STORAGE_KEYS.PROFILE).toBe('dub.profile');
    });

    it('has dot-delimited key format', () => {
      const keys = Object.values(STORAGE_KEYS);
      for (const key of keys) {
        expect(key).toMatch(/^dub\./);
      }
    });

    it('has all major log keys', () => {
      expect(STORAGE_KEYS.LOG_FOOD).toBeDefined();
      expect(STORAGE_KEYS.LOG_WATER).toBeDefined();
      expect(STORAGE_KEYS.LOG_SLEEP).toBeDefined();
      expect(STORAGE_KEYS.LOG_MOOD).toBeDefined();
      expect(STORAGE_KEYS.LOG_BODY).toBeDefined();
      expect(STORAGE_KEYS.LOG_WORKOUT).toBeDefined();
      expect(STORAGE_KEYS.LOG_SUPPLEMENTS).toBeDefined();
      expect(STORAGE_KEYS.LOG_SUBSTANCES).toBeDefined();
      expect(STORAGE_KEYS.LOG_THERAPY).toBeDefined();
    });
  });

  describe('dateKey helper', () => {
    it('creates correctly formatted date key', () => {
      const key = dateKey('dub.log.food', '2026-03-27');
      expect(key).toBe('dub.log.food.2026-03-27');
    });
  });

  describe('StorageError', () => {
    it('has correct name and properties', () => {
      const err = new StorageError('test', 'key', 'get');
      expect(err.name).toBe('StorageError');
      expect(err.key).toBe('key');
      expect(err.operation).toBe('get');
    });
  });
});
