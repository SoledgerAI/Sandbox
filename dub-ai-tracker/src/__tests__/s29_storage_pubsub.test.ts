// S29-C: Storage pub/sub broadcasts writes so live screens (dashboard,
// BodyCard, sleep tile) can re-query without a tab change. Fixes the
// "Coach DUB writes weight, dashboard doesn't update" bug.

import {
  storageSet,
  storageDelete,
  storageDeleteMultiple,
  storageAppend,
  storageSubscribe,
  _resetStorageListeners,
  STORAGE_KEYS,
  dateKey,
} from '../utils/storage';

describe('S29-C: Storage pub/sub', () => {
  beforeEach(() => {
    _resetStorageListeners();
  });

  it('notifies an exact-key subscriber on storageSet', async () => {
    const seen: string[] = [];
    storageSubscribe('dub.test.alpha', (k) => seen.push(k));
    await storageSet('dub.test.alpha', { v: 1 });
    expect(seen).toEqual(['dub.test.alpha']);
  });

  it('does not notify subscribers of unrelated keys', async () => {
    const seen: string[] = [];
    storageSubscribe('dub.test.alpha', (k) => seen.push(k));
    await storageSet('dub.test.beta', { v: 1 });
    expect(seen).toEqual([]);
  });

  it('unsubscribes cleanly', async () => {
    const seen: string[] = [];
    const unsub = storageSubscribe('dub.test.alpha', (k) => seen.push(k));
    unsub();
    await storageSet('dub.test.alpha', { v: 1 });
    expect(seen).toEqual([]);
  });

  it('supports prefix subscriptions for dated children', async () => {
    const seen: string[] = [];
    storageSubscribe(STORAGE_KEYS.LOG_BODY, (k) => seen.push(k), { prefix: true });
    await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, '2026-04-27'), [{ weight_lbs: 180 }]);
    expect(seen).toEqual([dateKey(STORAGE_KEYS.LOG_BODY, '2026-04-27')]);
  });

  it('prefix subscription does not match unrelated prefixes', async () => {
    const seen: string[] = [];
    storageSubscribe(STORAGE_KEYS.LOG_BODY, (k) => seen.push(k), { prefix: true });
    await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, '2026-04-27'), []);
    expect(seen).toEqual([]);
  });

  it('storageAppend triggers exactly one notification (cascades through storageSet)', async () => {
    const seen: string[] = [];
    const key = dateKey(STORAGE_KEYS.LOG_BODY, '2026-04-27');
    storageSubscribe(key, (k) => seen.push(k));
    await storageAppend(key, { weight_lbs: 180 });
    expect(seen).toEqual([key]);
  });

  it('storageDelete notifies subscribers', async () => {
    const seen: string[] = [];
    storageSubscribe('dub.test.alpha', (k) => seen.push(k));
    await storageSet('dub.test.alpha', 'v');
    await storageDelete('dub.test.alpha');
    expect(seen).toEqual(['dub.test.alpha', 'dub.test.alpha']);
  });

  it('storageDeleteMultiple notifies each affected key', async () => {
    const seen: string[] = [];
    storageSubscribe('dub.test.x', (k) => seen.push(k));
    storageSubscribe('dub.test.y', (k) => seen.push(k));
    await storageDeleteMultiple(['dub.test.x', 'dub.test.y']);
    expect(seen.sort()).toEqual(['dub.test.x', 'dub.test.y']);
  });

  it('one listener throwing does not stop others', async () => {
    const seen: string[] = [];
    storageSubscribe('dub.test.alpha', () => {
      throw new Error('boom');
    });
    storageSubscribe('dub.test.alpha', (k) => seen.push(k));
    await storageSet('dub.test.alpha', 'v');
    expect(seen).toEqual(['dub.test.alpha']);
  });
});
