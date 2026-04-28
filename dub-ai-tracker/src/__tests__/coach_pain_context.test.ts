// S33-A: Coach context — pain_areas_last_14d, persistent_pain_areas,
// chronic_pain_areas. Threshold semantics + LOCAL-time ISO week boundary.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePainEntry, buildPainContext, isoWeekKey } from '../services/painLogService';
import {
  PAIN_PERSISTENT_THRESHOLD_COUNT,
  PAIN_PERSISTENT_THRESHOLD_DAYS,
  PAIN_CHRONIC_THRESHOLD_WEEKS,
  PAIN_CHRONIC_THRESHOLD_WINDOW,
} from '../constants/painChips';

beforeEach(async () => {
  await AsyncStorage.clear();
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Coach pain context', () => {
  it('pain_areas_last_14d returns distinct areas, frequency-sorted', async () => {
    const now = Date.now();
    await savePainEntry({ areas: ['knees'], severity: 2, timestamp: now - 1 * DAY_MS });
    await savePainEntry({ areas: ['knees'], severity: 2, timestamp: now - 3 * DAY_MS });
    await savePainEntry({ areas: ['hips'], severity: 2, timestamp: now - 5 * DAY_MS });
    const ctx = await buildPainContext(new Date());
    expect(ctx.pain_areas_last_14d[0]).toBe('knees'); // 2 occurrences
    expect(ctx.pain_areas_last_14d).toContain('hips');
  });

  it('persistent_pain_areas hits at threshold (3 entries / 14d)', async () => {
    const now = Date.now();
    for (let i = 0; i < PAIN_PERSISTENT_THRESHOLD_COUNT; i += 1) {
      await savePainEntry({ areas: ['back'], severity: 2, timestamp: now - i * DAY_MS });
    }
    const ctx = await buildPainContext(new Date());
    expect(ctx.persistent_pain_areas).toContain('back');
  });

  it('persistent_pain_areas misses at 2 entries / 14d', async () => {
    const now = Date.now();
    await savePainEntry({ areas: ['back'], severity: 2, timestamp: now - 1 * DAY_MS });
    await savePainEntry({ areas: ['back'], severity: 2, timestamp: now - 3 * DAY_MS });
    const ctx = await buildPainContext(new Date());
    expect(ctx.persistent_pain_areas).not.toContain('back');
  });

  it('chronic_pain_areas hits at 4 of 6 weeks', async () => {
    const now = Date.now();
    // One entry in each of 4 distinct weeks (0, 7, 14, 21 days back)
    for (let i = 0; i < PAIN_CHRONIC_THRESHOLD_WEEKS; i += 1) {
      await savePainEntry({ areas: ['knees'], severity: 2, timestamp: now - i * 7 * DAY_MS });
    }
    const ctx = await buildPainContext(new Date());
    expect(ctx.chronic_pain_areas).toContain('knees');
  });

  it('chronic_pain_areas misses at 3 of 6 weeks', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) {
      await savePainEntry({ areas: ['hips'], severity: 2, timestamp: now - i * 7 * DAY_MS });
    }
    const ctx = await buildPainContext(new Date());
    expect(ctx.chronic_pain_areas).not.toContain('hips');
  });

  it('ISO week boundary handled correctly (LOCAL time)', () => {
    // 2026-04-26 = Sunday (W17), 2026-04-27 = Monday (W18)
    const sunday = new Date(2026, 3, 26, 12, 0, 0);
    const monday = new Date(2026, 3, 27, 12, 0, 0);
    expect(isoWeekKey(sunday)).not.toBe(isoWeekKey(monday));
  });

  it('empty pain log → all three context arrays empty', async () => {
    const ctx = await buildPainContext(new Date());
    expect(ctx.pain_areas_last_14d).toEqual([]);
    expect(ctx.persistent_pain_areas).toEqual([]);
    expect(ctx.chronic_pain_areas).toEqual([]);
  });

  it('14-day cutoff excludes entries older than threshold days', async () => {
    const now = Date.now();
    // 1 entry yesterday, 1 entry well outside the 14d window.
    await savePainEntry({ areas: ['feet'], severity: 2, timestamp: now - 1 * DAY_MS });
    await savePainEntry({
      areas: ['feet'],
      severity: 2,
      timestamp: now - (PAIN_PERSISTENT_THRESHOLD_DAYS + 5) * DAY_MS,
    });
    const ctx = await buildPainContext(new Date());
    expect(ctx.pain_areas_last_14d).toContain('feet');
    // Only 1 entry within window → not persistent.
    expect(ctx.persistent_pain_areas).not.toContain('feet');
  });

  it('threshold constants are imported from painChips (not magic numbers)', () => {
    expect(PAIN_PERSISTENT_THRESHOLD_COUNT).toBe(3);
    expect(PAIN_PERSISTENT_THRESHOLD_DAYS).toBe(14);
    expect(PAIN_CHRONIC_THRESHOLD_WEEKS).toBe(4);
    expect(PAIN_CHRONIC_THRESHOLD_WINDOW).toBe(6);
  });
});
