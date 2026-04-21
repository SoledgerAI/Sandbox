// Schema migration framework tests (H2)

import {
  runMigrations,
  renameStorageKey,
  transformStorageValue,
  addFieldToEntries,
  SCHEMA_VERSION_KEY,
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  type Migration,
} from '../utils/schemaMigration';
import { storageGet, storageSet, storageList } from '../utils/storage';

describe('schemaMigration', () => {
  describe('runMigrations — default registry', () => {
    it('runs on fresh install (version 0 → CURRENT)', async () => {
      const result = await runMigrations();
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.migrationsRun).toBe(MIGRATIONS.length);
    });

    it('is a no-op on an already-current install', async () => {
      await storageSet(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
      const result = await runMigrations();
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.migrationsRun).toBe(0);
    });

    it('persists the schema version after a successful run', async () => {
      await runMigrations();
      const stored = await storageGet<number>(SCHEMA_VERSION_KEY);
      expect(stored).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('does nothing if stored version is ahead of code (downgrade scenario)', async () => {
      await storageSet(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION + 5);
      const result = await runMigrations();
      expect(result.success).toBe(true);
      expect(result.migrationsRun).toBe(0);
      const stored = await storageGet<number>(SCHEMA_VERSION_KEY);
      expect(stored).toBe(CURRENT_SCHEMA_VERSION + 5);
    });
  });

  describe('runMigrations — injected migrations', () => {
    it('runs migrations in ascending order of version', async () => {
      const order: number[] = [];
      const migrations: Migration[] = [
        { version: 3, description: 'third', migrate: async () => { order.push(3); } },
        { version: 1, description: 'first', migrate: async () => { order.push(1); } },
        { version: 2, description: 'second', migrate: async () => { order.push(2); } },
      ];
      const result = await runMigrations({ migrations, targetVersion: 3 });
      expect(result.success).toBe(true);
      expect(result.migrationsRun).toBe(3);
      expect(order).toEqual([1, 2, 3]);
    });

    it('stops on failure and does not run later migrations', async () => {
      const ran: number[] = [];
      const migrations: Migration[] = [
        { version: 1, description: 'ok', migrate: async () => { ran.push(1); } },
        { version: 2, description: 'boom', migrate: async () => { throw new Error('kaboom'); } },
        { version: 3, description: 'should not run', migrate: async () => { ran.push(3); } },
      ];
      const result = await runMigrations({ migrations, targetVersion: 3 });
      expect(result.success).toBe(false);
      expect(result.migrationsRun).toBe(1);
      expect(result.toVersion).toBe(1); // last successful
      expect(result.error).toContain('v2');
      expect(ran).toEqual([1]);
    });

    it('does NOT advance schema version past the failed migration', async () => {
      const migrations: Migration[] = [
        { version: 1, description: 'ok', migrate: async () => {} },
        { version: 2, description: 'fail', migrate: async () => { throw new Error('x'); } },
      ];
      await runMigrations({ migrations, targetVersion: 2 });
      const stored = await storageGet<number>(SCHEMA_VERSION_KEY);
      expect(stored).toBe(1); // NOT 2
    });

    it('resumes from last-known-good version on next run', async () => {
      let failFirst = true;
      const migrations: Migration[] = [
        { version: 1, description: 'ok', migrate: async () => {} },
        {
          version: 2,
          description: 'flaky',
          migrate: async () => {
            if (failFirst) {
              failFirst = false;
              throw new Error('transient');
            }
          },
        },
        { version: 3, description: 'depends on v2', migrate: async () => {} },
      ];

      // First run: v1 succeeds, v2 fails, v3 skipped
      const r1 = await runMigrations({ migrations, targetVersion: 3 });
      expect(r1.success).toBe(false);
      expect(await storageGet<number>(SCHEMA_VERSION_KEY)).toBe(1);

      // Second run: starts from v1, re-runs v2 (now succeeds), then v3
      const r2 = await runMigrations({ migrations, targetVersion: 3 });
      expect(r2.success).toBe(true);
      expect(r2.fromVersion).toBe(1);
      expect(r2.toVersion).toBe(3);
      expect(r2.migrationsRun).toBe(2);
      expect(await storageGet<number>(SCHEMA_VERSION_KEY)).toBe(3);
    });

    it('returns migrationsRun === 0 when no migrations pending', async () => {
      const migrations: Migration[] = [
        { version: 1, description: 'x', migrate: async () => {} },
      ];
      await storageSet(SCHEMA_VERSION_KEY, 1);
      const result = await runMigrations({ migrations, targetVersion: 1 });
      expect(result.migrationsRun).toBe(0);
      expect(result.success).toBe(true);
    });
  });

  describe('renameStorageKey', () => {
    it('moves the value from old key to new key', async () => {
      await storageSet('old.key', { hello: 'world' });
      await renameStorageKey('old.key', 'new.key');
      expect(await storageGet<unknown>('old.key')).toBeNull();
      expect(await storageGet<{ hello: string }>('new.key')).toEqual({ hello: 'world' });
    });

    it('is a no-op when the old key does not exist', async () => {
      await renameStorageKey('missing.key', 'new.key');
      expect(await storageGet<unknown>('new.key')).toBeNull();
    });

    it('preserves primitive values', async () => {
      await storageSet('old.str', 'value');
      await renameStorageKey('old.str', 'new.str');
      expect(await storageGet<string>('new.str')).toBe('value');
    });
  });

  describe('transformStorageValue', () => {
    it('applies the transform function and writes the result', async () => {
      await storageSet('t.key', { count: 5 });
      await transformStorageValue('t.key', (old) => {
        const o = old as { count: number };
        return { count: o.count * 2 };
      });
      expect(await storageGet<{ count: number }>('t.key')).toEqual({ count: 10 });
    });

    it('is a no-op when the key does not exist', async () => {
      const spy = jest.fn();
      await transformStorageValue('missing.key', spy);
      expect(spy).not.toHaveBeenCalled();
    });

    it('deletes the key when transform returns null', async () => {
      await storageSet('t.del', { a: 1 });
      await transformStorageValue('t.del', () => null);
      expect(await storageGet<unknown>('t.del')).toBeNull();
    });
  });

  describe('addFieldToEntries', () => {
    it('adds a field with default value to every entry across matching keys', async () => {
      await storageSet('dub.log.food.2026-04-18', [
        { id: 'a', name: 'apple' },
        { id: 'b', name: 'banana' },
      ]);
      await storageSet('dub.log.food.2026-04-19', [
        { id: 'c', name: 'carrot' },
      ]);

      await addFieldToEntries('dub.log.food', 'category', 'snack');

      const d18 = await storageGet<Array<{ id: string; category: string }>>('dub.log.food.2026-04-18');
      const d19 = await storageGet<Array<{ id: string; category: string }>>('dub.log.food.2026-04-19');
      expect(d18?.every((e) => e.category === 'snack')).toBe(true);
      expect(d19?.every((e) => e.category === 'snack')).toBe(true);
    });

    it('does not overwrite an existing field value', async () => {
      await storageSet('dub.log.food.2026-04-20', [
        { id: 'a', category: 'fruit' },
        { id: 'b' },
      ]);
      await addFieldToEntries('dub.log.food', 'category', 'default');
      const entries = await storageGet<Array<{ id: string; category: string }>>('dub.log.food.2026-04-20');
      expect(entries?.[0].category).toBe('fruit');
      expect(entries?.[1].category).toBe('default');
    });

    it('skips non-array values gracefully', async () => {
      await storageSet('dub.log.food.settings', { not: 'an array' });
      // Should not throw
      await expect(
        addFieldToEntries('dub.log.food', 'foo', 'bar'),
      ).resolves.toBeUndefined();
      const untouched = await storageGet<{ not: string }>('dub.log.food.settings');
      expect(untouched).toEqual({ not: 'an array' });
    });

    it('is a no-op when no keys match the prefix', async () => {
      await expect(
        addFieldToEntries('dub.nothing.matches', 'f', 'v'),
      ).resolves.toBeUndefined();
    });
  });

  describe('end-to-end example (documentation)', () => {
    it('a rename-field migration using transformStorageValue behaves as expected', async () => {
      await storageSet('dub.profile', { weight: 180, height: 72 });

      const migrations: Migration[] = [
        {
          version: 1,
          description: 'rename profile.weight to profile.body_weight',
          migrate: async () => {
            await transformStorageValue('dub.profile', (old) => {
              if (old && typeof old === 'object' && 'weight' in old) {
                const p = old as Record<string, unknown>;
                p.body_weight = p.weight;
                delete p.weight;
                return p;
              }
              return old as Record<string, unknown>;
            });
          },
        },
      ];

      const result = await runMigrations({ migrations, targetVersion: 1 });
      expect(result.success).toBe(true);

      const profile = await storageGet<{ body_weight: number; weight?: number; height: number }>(
        'dub.profile',
      );
      expect(profile?.body_weight).toBe(180);
      expect(profile?.weight).toBeUndefined();
      expect(profile?.height).toBe(72);
    });
  });

  describe('storageList cache (sanity)', () => {
    it('finds the keys that addFieldToEntries needs to iterate', async () => {
      await storageSet('dub.log.water.2026-04-18', [{ id: '1' }]);
      await storageSet('dub.log.water.2026-04-19', [{ id: '2' }]);
      const keys = await storageList('dub.log.water');
      expect(keys).toHaveLength(2);
    });
  });
});
