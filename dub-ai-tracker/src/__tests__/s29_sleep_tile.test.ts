// S29-E: Sleep tile is anchored to yesterday.
// "Today's sleep" hasn't happened yet, so the dashboard tile should
// always display last night's entry (Josh's rule: "it should always be
// a day behind").

import * as fs from 'fs';
import * as path from 'path';
import { yesterdayDateString, todayDateString } from '../utils/dayBoundary';
import { storageGet, storageSet, storageDelete, STORAGE_KEYS, dateKey } from '../utils/storage';
import type { SleepEntry } from '../types';

const SNAPSHOT_PATH = path.join(
  __dirname,
  '../components/dashboard/DailySnapshotCard.tsx',
);

describe('S29-E: Sleep tile yesterday-anchored', () => {
  it('yesterdayDateString returns YYYY-MM-DD one day before today', () => {
    const today = new Date(todayDateString() + 'T12:00:00');
    const yesterday = new Date(yesterdayDateString() + 'T12:00:00');
    const diffMs = today.getTime() - yesterday.getTime();
    expect(diffMs).toBeCloseTo(24 * 60 * 60 * 1000, -2);
  });

  it('DailySnapshotCard imports yesterdayDateString', () => {
    const src = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
    expect(src).toContain('yesterdayDateString');
  });

  it('DailySnapshotCard reads dub.log.sleep keyed to yesterday', () => {
    const src = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
    expect(src).toMatch(/dateKey\(STORAGE_KEYS\.LOG_SLEEP,\s*yesterday\)/);
  });

  it('DailySnapshotCard shows "Log last night" prompt when sleep is missing', () => {
    const src = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
    expect(src).toContain('Log last night');
  });

  it('Sleep tile pre-fills yesterday into the date context before navigating', () => {
    const src = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
    expect(src).toContain('prefillDate: yesterday');
    expect(src).toContain('setActiveDate(stat.prefillDate)');
  });

  it('round-trips a SleepEntry under the yesterday-anchored key', async () => {
    const yesterday = yesterdayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, yesterday);
    const entry: SleepEntry = {
      bedtime: `${yesterday}T23:00:00.000Z`,
      wake_time: `${todayDateString()}T07:30:00.000Z`,
      quality: 4,
      bathroom_trips: 0,
      alarm_used: true,
      time_to_fall_asleep_min: 10,
      notes: null,
      device_data: null,
      total_duration_hours: 8.5,
    };
    await storageSet(key, entry);
    const round = await storageGet<SleepEntry>(key);
    expect(round?.total_duration_hours).toBe(8.5);
    await storageDelete(key);
  });
});
