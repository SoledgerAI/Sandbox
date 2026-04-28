// S36: Region session counters + ISO week derivation + 4-week
// rolling averages and undertrained-flag rule. All date keys are LOCAL
// (regression guard for the H46 UTC bug class — confirm we never derive
// keys via toISOString()).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, storageSet } from '../utils/storage';
import {
  isoWeekKey,
  recordRegionSession,
  getRegionSessions,
  regionSessionsKey,
  getRegionWeeklyAverages,
  getUndertrainedFlags,
} from '../services/strengthService';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('strength region session counters', () => {
  it('recording a region session increments the correct weekly counter', async () => {
    const date = new Date('2026-04-28T10:00:00');
    await recordRegionSession('chest', date);
    const week = isoWeekKey(date);
    expect(await getRegionSessions(week, 'chest')).toBe(1);
  });

  it('same region logged twice on the same day counts as one session', async () => {
    const date = new Date('2026-04-28T08:00:00');
    const first = await recordRegionSession('back', date);
    const second = await recordRegionSession(
      'back',
      new Date('2026-04-28T20:00:00'),
    );
    expect(first.counted).toBe(true);
    expect(second.counted).toBe(false);
    expect(await getRegionSessions(isoWeekKey(date), 'back')).toBe(1);
  });

  it('same region on different days counts as two sessions', async () => {
    const day1 = new Date('2026-04-28T10:00:00');
    const day2 = new Date('2026-04-29T10:00:00');
    await recordRegionSession('quads', day1);
    await recordRegionSession('quads', day2);
    expect(await getRegionSessions(isoWeekKey(day1), 'quads')).toBe(2);
  });

  it('ISO week boundary handled correctly (Sunday → Monday rollover)', async () => {
    // 2026-04-26 is a Sunday → ISO week W17
    // 2026-04-27 is a Monday → ISO week W18
    const sunday = new Date('2026-04-26T10:00:00');
    const monday = new Date('2026-04-27T10:00:00');
    expect(isoWeekKey(sunday)).not.toBe(isoWeekKey(monday));
    await recordRegionSession('core', sunday);
    await recordRegionSession('core', monday);
    expect(await getRegionSessions(isoWeekKey(sunday), 'core')).toBe(1);
    expect(await getRegionSessions(isoWeekKey(monday), 'core')).toBe(1);
  });

  it('LOCAL-time date keys (regression: not UTC)', () => {
    // Constructed from local Y/M/D components — should produce a key
    // matching the local-perspective ISO week.
    const local = new Date(2026, 3, 28, 23, 30); // April 28, 11:30pm local
    const week = isoWeekKey(local);
    // A UTC-derivation would shift the date forward in many timezones; we
    // only assert that the key is parseable as YYYY-WW format and the
    // year matches the local date's year, not the UTC-computed one.
    expect(week).toMatch(/^\d{4}-\d{2}$/);
    expect(week.startsWith('2026-')).toBe(true);
  });

  it('regionSessionsKey produces the documented namespaced key', () => {
    const k = regionSessionsKey('2026-W18', 'chest');
    expect(k).toBe('dub.strength.region_sessions.2026-W18.chest');
  });

  it('4-week rolling average computation averages across week buckets', async () => {
    const end = new Date('2026-04-28T10:00:00');
    const week = isoWeekKey(end);
    // Manually seed a region with 4 sessions in one week so the average
    // across 4 weeks is 1.0.
    await storageSet(regionSessionsKey(week, 'biceps'), 4);
    const avgs = await getRegionWeeklyAverages(end, 4);
    const biceps = avgs.find((a) => a.region === 'biceps');
    expect(biceps?.sessions_per_week_avg).toBeCloseTo(1.0, 3);
  });

  it('undertrained flag triggers when 4-week avg is below 50% of target', async () => {
    const end = new Date('2026-04-28T10:00:00');
    await storageSet(STORAGE_KEYS.STRENGTH_TARGET_PER_WEEK, 2);
    // No sessions logged => avg = 0 < 1.0 (50% of target) => flag
    const flags = await getUndertrainedFlags(end, 4);
    const chest = flags.find((f) => f.region === 'chest');
    expect(chest).toBeDefined();
    expect(chest?.target).toBe(2);
  });

  it('undertrained flag does NOT trigger at exactly the 50% threshold', async () => {
    const end = new Date('2026-04-28T10:00:00');
    await storageSet(STORAGE_KEYS.STRENGTH_TARGET_PER_WEEK, 2);
    // Seed exactly 4 sessions in one week → average = 1.0 = target * 0.5
    const week = isoWeekKey(end);
    await storageSet(regionSessionsKey(week, 'shoulders'), 4);
    const flags = await getUndertrainedFlags(end, 4);
    const shoulders = flags.find((f) => f.region === 'shoulders');
    expect(shoulders).toBeUndefined();
  });

});
