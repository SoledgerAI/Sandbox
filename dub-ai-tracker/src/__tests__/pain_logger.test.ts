// S33-A: Pain log persistence + index population + validation.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, STORAGE_KEYS } from '../utils/storage';
import {
  savePainEntry,
  getPainEntry,
  deletePainEntry,
  localDateKey,
} from '../services/painLogService';
import type { PainEntry } from '../types';

const dateIdx = (k: string) => `${STORAGE_KEYS.PAIN_LOG_INDEX_BY_DATE}.${k}`;
const areaIdx = (k: string) => `${STORAGE_KEYS.PAIN_LOG_INDEX_BY_AREA}.${k}`;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('pain logger', () => {
  it('PainEntry persists with all required fields', async () => {
    const entry = await savePainEntry({
      areas: ['knees'],
      severity: 3,
      duration_days: 5,
      notes: 'Stiffer in the mornings.',
    });
    const round = await getPainEntry(entry.id);
    expect(round?.areas).toEqual(['knees']);
    expect(round?.severity).toBe(3);
    expect(round?.duration_days).toBe(5);
    expect(round?.notes).toBe('Stiffer in the mornings.');
  });

  it('multi-area selection persists as a deduplicated array', async () => {
    const entry = await savePainEntry({
      areas: ['knees', 'hips', 'knees'],
      severity: 2,
    });
    const round = await getPainEntry(entry.id);
    expect(round?.areas.sort()).toEqual(['hips', 'knees']);
  });

  it('by_date index populated on save (LOCAL-time key)', async () => {
    const ts = new Date(2026, 3, 28, 14, 0, 0).getTime(); // Apr 28 2026 local
    const entry = await savePainEntry({ areas: ['back'], severity: 2, timestamp: ts });
    const expectedKey = localDateKey(new Date(ts));
    const list = await storageGet<string[]>(dateIdx(expectedKey));
    expect(list).toContain(entry.id);
  });

  it('by_area index populated on save (one row per selected area)', async () => {
    const entry = await savePainEntry({ areas: ['knees', 'hips'], severity: 2 });
    const knees = await storageGet<string[]>(areaIdx('knees'));
    const hips = await storageGet<string[]>(areaIdx('hips'));
    const back = await storageGet<string[]>(areaIdx('back'));
    expect(knees).toContain(entry.id);
    expect(hips).toContain(entry.id);
    expect(back).toBeNull();
  });

  it('duration_days is optional', async () => {
    const entry = await savePainEntry({ areas: ['feet'], severity: 1 });
    expect(entry.duration_days).toBeUndefined();
  });

  it('notes optional, 500-char max enforced', async () => {
    await expect(
      savePainEntry({ areas: ['back'], severity: 2, notes: 'x'.repeat(501) }),
    ).rejects.toThrow();
  });

  it('manual timestamp override applies (LOCAL-derived day key)', async () => {
    const ts = new Date(2026, 0, 5, 10, 0, 0).getTime(); // Jan 5 2026 local
    const entry = await savePainEntry({ areas: ['back'], severity: 2, timestamp: ts });
    expect(entry.timestamp).toBe(ts);
    const list = await storageGet<string[]>(dateIdx('2026-01-05'));
    expect(list).toContain(entry.id);
  });

  it('empty area selection rejected (cannot save)', async () => {
    await expect(
      savePainEntry({ areas: [], severity: 2 }),
    ).rejects.toThrow();
  });

  it('delete removes from primary key AND both indexes', async () => {
    const entry = await savePainEntry({
      areas: ['knees', 'hips'],
      severity: 3,
      timestamp: new Date(2026, 3, 28).getTime(),
    });
    await deletePainEntry(entry.id);

    expect(await getPainEntry(entry.id)).toBeNull();
    const dateList = await storageGet<string[]>(dateIdx(localDateKey(new Date(entry.timestamp))));
    expect(dateList ?? []).not.toContain(entry.id);
    const kneesList = await storageGet<string[]>(areaIdx('knees'));
    expect(kneesList ?? []).not.toContain(entry.id);
    const hipsList = await storageGet<string[]>(areaIdx('hips'));
    expect(hipsList ?? []).not.toContain(entry.id);
  });

  it('storage key prefix matches PAIN_LOG_PREFIX const', () => {
    expect(STORAGE_KEYS.PAIN_LOG_PREFIX).toBe('dub.log.pain');
    expect(STORAGE_KEYS.PAIN_LOG_INDEX_BY_DATE).toBe('dub.log.pain.index.by_date');
    expect(STORAGE_KEYS.PAIN_LOG_INDEX_BY_AREA).toBe('dub.log.pain.index.by_area');
  });
});
