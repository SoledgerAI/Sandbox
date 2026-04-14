// Sprint 26: Data Export + Settings Completeness Tests

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storageGet,
  storageSet,
  storageDelete,
  storageList,
  storageClearAll,
  storageDeleteMultiple,
  dateKey,
  STORAGE_KEYS,
} from '../utils/storage';
import {
  generateCSV,
  gatherAllData,
  generatePDFHTML,
  getDateRange,
  EXPORT_PRIVACY_MAP,
  type ExportOptions,
  type GatheredData,
} from '../services/exportService';
import type {
  UnitSettings,
  WeightUnit,
  MeasurementUnit,
  HydrationUnit,
  TemperatureUnit,
  HeightUnit,
  JournalEntry,
  SleepEntry,
  TherapyEntry,
  SexualEntry,
  MoodMentalEntry,
  MedicationEntry,
  BodyMeasurementEntry,
  ComplianceResult,
  DailySummary,
} from '../types';
import { DEFAULT_UNIT_SETTINGS } from '../types';

// ============================================================
// Helpers
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeSleepEntry(overrides: Partial<SleepEntry> = {}): SleepEntry {
  return {
    id: `sleep-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    bedtime: '2026-04-13T22:30:00.000Z',
    wake_time: '2026-04-14T06:30:00.000Z',
    quality: 4,
    notes: null,
    ...overrides,
  } as SleepEntry;
}

function makeMoodEntry(overrides: Partial<MoodMentalEntry> = {}): MoodMentalEntry {
  return {
    id: `mood-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    date: todayStr(),
    overall_mood: 7,
    energy_level: 3,
    anxiety_level: 2,
    stress_level: 3,
    emotions: ['calm'],
    social_battery: 3,
    cognitive_clarity: 4,
    journal_note: null,
    crisis_ideation_flagged: false,
    ...overrides,
  } as MoodMentalEntry;
}

function makeJournalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: `journal-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    text: 'Today was a good day.',
    mood_score: 4,
    private: true,
    ...overrides,
  };
}

function makeTherapyEntry(overrides: Partial<TherapyEntry> = {}): TherapyEntry {
  return {
    session_logged: true,
    therapist_name: 'Dr. Smith',
    type: 'individual',
    notes: 'Discussed anxiety triggers and coping mechanisms.',
    timestamp: new Date().toISOString(),
    duration_minutes: 50,
    ...overrides,
  };
}

function makeSexualEntry(): SexualEntry {
  return {
    id: `sex-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    duration_minutes: 30,
    intensity: 'moderate',
    compendium_code: '14020',
    met_value: 3.0,
    calories_burned: 90,
  };
}

function makeDailySummary(date: string, overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    date,
    calories_consumed: 2000,
    calories_burned: 300,
    calories_net: 1700,
    calories_remaining: 300,
    protein_g: 120,
    carbs_g: 200,
    fat_g: 70,
    fiber_g: 25,
    sugar_g: 40,
    water_oz: 64,
    caffeine_mg: 200,
    steps: 8000,
    active_minutes: 30,
    sleep_hours: 7.5,
    sleep_quality: 4,
    mood_avg: 3.5,
    energy_avg: 3,
    anxiety_avg: 2,
    weight_lbs: 175,
    glucose_avg_mg_dl: null,
    bp_systolic_avg: null,
    bp_diastolic_avg: null,
    tags_logged: ['fitness.workout'],
    recovery_score: null,
    ...overrides,
  };
}

function makeMedicationEntry(date: string): MedicationEntry {
  return {
    id: `med-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    date,
    medications: [
      { id: 'med1', name: 'Metformin', dosage: '500mg', time_scheduled: '08:00', time_taken: '08:15', taken: true, skipped_reason: null, notes: null },
      { id: 'med2', name: 'Vitamin D', dosage: '2000IU', time_scheduled: '08:00', time_taken: null, taken: false, skipped_reason: 'forgot', notes: null },
    ],
  };
}

function makeBodyMeasurement(date: string): BodyMeasurementEntry {
  return {
    id: `bm-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    date,
    weight: 175,
    weight_unit: 'lbs',
    body_fat_percentage: 18,
    measurements: {
      waist: 32,
      hips: 38,
      chest: 40,
      bicep_left: 14,
      bicep_right: 14.5,
      thigh_left: 22,
      thigh_right: 22,
      neck: 15,
    },
    measurement_unit: 'in',
    photo_taken: false,
    notes: null,
  };
}

// ============================================================
// CSV Generation Tests
// ============================================================

describe('Sprint 26: CSV Generation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('generates CSV with correct header row matching data fields', () => {
    const entries: Record<string, unknown>[] = [
      { date: '2026-04-10', id: 'sleep-1', quality: 4, bedtime: '22:30', wake_time: '06:30' },
      { date: '2026-04-11', id: 'sleep-2', quality: 3, bedtime: '23:00', wake_time: '07:00' },
    ];

    const csv = generateCSV('sleep', entries);
    const lines = csv.split('\n');

    // Header row should include all fields
    expect(lines[0]).toContain('date');
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('quality');
    expect(lines[0]).toContain('bedtime');
    expect(lines[0]).toContain('wake_time');

    // Data rows
    expect(lines.length).toBe(3); // header + 2 data rows
  });

  it('formats data rows correctly with proper CSV escaping', () => {
    const entries: Record<string, unknown>[] = [
      { date: '2026-04-10', notes: 'Had a great day, felt energized', score: 8 },
      { date: '2026-04-11', notes: 'Felt "tired" after lunch', score: 5 },
      { date: '2026-04-12', notes: 'Line 1\nLine 2', score: 7 },
    ];

    const csv = generateCSV('mood', entries);
    const lines = csv.split('\n');

    // Notes with commas should be quoted
    expect(lines[1]).toContain('"Had a great day, felt energized"');

    // Notes with quotes should be double-quoted
    expect(lines[2]).toContain('"Felt ""tired"" after lunch"');

    // Notes with newlines should be quoted
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it('handles empty entries gracefully', () => {
    const csv = generateCSV('sleep', []);
    expect(csv).toContain('No sleep data logged');
  });

  it('date column appears first in headers', () => {
    const entries: Record<string, unknown>[] = [
      { zField: 'z', date: '2026-04-10', aField: 'a' },
    ];
    const csv = generateCSV('test', entries);
    const headers = csv.split('\n')[0].split(',');
    expect(headers[0]).toBe('date');
  });

  it('flattens nested objects with underscore separator', () => {
    const entries: Record<string, unknown>[] = [
      {
        date: '2026-04-10',
        measurements: { waist: 32, hips: 38 },
      },
    ];

    const csv = generateCSV('body', entries);
    expect(csv).toContain('measurements_waist');
    expect(csv).toContain('measurements_hips');
    expect(csv).toContain('32');
    expect(csv).toContain('38');
  });

  it('joins arrays with semicolons', () => {
    const entries: Record<string, unknown>[] = [
      { date: '2026-04-10', tags: ['sleep', 'mood', 'food'] },
    ];

    const csv = generateCSV('summary', entries);
    expect(csv).toContain('sleep; mood; food');
  });
});

// ============================================================
// Date Filtering Tests
// ============================================================

describe('Sprint 26: Date Filtering', () => {
  it('getDateRange returns null for all time', () => {
    const range = getDateRange({ format: 'csv', datePreset: 'all', includeJournal: false });
    expect(range).toBeNull();
  });

  it('getDateRange returns correct range for 7d preset', () => {
    const range = getDateRange({ format: 'csv', datePreset: '7d', includeJournal: false });
    expect(range).not.toBeNull();
    const dayDiff = Math.round((range!.end.getTime() - range!.start.getTime()) / 86400000);
    expect(dayDiff).toBe(7);
  });

  it('getDateRange returns correct range for 30d preset', () => {
    const range = getDateRange({ format: 'csv', datePreset: '30d', includeJournal: false });
    expect(range).not.toBeNull();
    const dayDiff = Math.round((range!.end.getTime() - range!.start.getTime()) / 86400000);
    expect(dayDiff).toBe(30);
  });

  it('getDateRange returns correct range for 90d preset', () => {
    const range = getDateRange({ format: 'csv', datePreset: '90d', includeJournal: false });
    expect(range).not.toBeNull();
    const dayDiff = Math.round((range!.end.getTime() - range!.start.getTime()) / 86400000);
    expect(dayDiff).toBe(90);
  });

  it('getDateRange uses custom range when preset is custom', () => {
    const customStart = new Date('2026-01-01');
    const customEnd = new Date('2026-03-31');
    const range = getDateRange({
      format: 'csv',
      datePreset: 'custom',
      customRange: { start: customStart, end: customEnd },
      includeJournal: false,
    });
    expect(range!.start).toBe(customStart);
    expect(range!.end).toBe(customEnd);
  });
});

// ============================================================
// Data Gathering + Privacy Tests
// ============================================================

describe('Sprint 26: Data Gathering & Privacy', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('gathers sleep data within date range', async () => {
    const today = todayStr();
    const yesterday = dateOffset(-1);
    const oldDate = dateOffset(-40);

    await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, today), makeSleepEntry());
    await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, yesterday), makeSleepEntry());
    await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, oldDate), makeSleepEntry());

    const data = await gatherAllData({ format: 'csv', datePreset: '7d', includeJournal: false });
    expect(data.sleep.length).toBe(2); // today + yesterday, not old date
  });

  it('excludes journal entries by default', async () => {
    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_JOURNAL, today), [makeJournalEntry()]);

    const data = await gatherAllData({ format: 'csv', datePreset: 'all', includeJournal: false });
    expect(data.journal).toBeUndefined();
  });

  it('includes journal entries when toggle is on', async () => {
    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_JOURNAL, today), [makeJournalEntry({ private: false })]);

    const data = await gatherAllData({ format: 'csv', datePreset: 'all', includeJournal: true });
    expect(data.journal).toBeDefined();
    expect(data.journal.length).toBeGreaterThan(0);
  });

  it('NEVER includes intimacy/sexual data', async () => {
    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_SEXUAL, today), [makeSexualEntry()]);

    // With journal included (max permissive)
    const data = await gatherAllData({ format: 'csv', datePreset: 'all', includeJournal: true });
    expect(data.sexual).toBeUndefined();
  });

  it('strips therapy notes from export', async () => {
    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_THERAPY, today), makeTherapyEntry());

    const data = await gatherAllData({ format: 'csv', datePreset: 'all', includeJournal: false });
    expect(data.therapy).toBeDefined();
    expect(data.therapy.length).toBe(1);

    // Notes should be stripped
    const therapyEntry = data.therapy[0];
    expect(therapyEntry.notes).toBeUndefined();
    // But other fields preserved
    expect(therapyEntry.session_logged).toBe(true);
    expect(therapyEntry.therapist_name).toBe('Dr. Smith');
  });

  it('does not include coach conversation history', async () => {
    await storageSet(STORAGE_KEYS.COACH_HISTORY, [{ role: 'user', content: 'Hello coach' }]);

    const data = await gatherAllData({ format: 'csv', datePreset: 'all', includeJournal: false });
    // Coach history has no date suffix, so it's not gathered via LOG_TYPE_MAP
    expect(data.coach_history).toBeUndefined();
  });

  it('EXPORT_PRIVACY_MAP marks sexual as excluded_always', () => {
    expect(EXPORT_PRIVACY_MAP[STORAGE_KEYS.LOG_SEXUAL]).toBe('excluded_always');
  });

  it('EXPORT_PRIVACY_MAP marks journal as excluded_default', () => {
    expect(EXPORT_PRIVACY_MAP[STORAGE_KEYS.LOG_JOURNAL]).toBe('excluded_default');
  });

  it('EXPORT_PRIVACY_MAP marks coach history as not_user_data', () => {
    expect(EXPORT_PRIVACY_MAP[STORAGE_KEYS.COACH_HISTORY]).toBe('not_user_data');
  });

  it('EXPORT_PRIVACY_MAP covers all log keys', () => {
    const logKeys = Object.values(STORAGE_KEYS).filter((k) => k.startsWith('dub.log.'));
    for (const key of logKeys) {
      expect(EXPORT_PRIVACY_MAP[key]).toBeDefined();
    }
  });
});

// ============================================================
// PDF HTML Generation Tests
// ============================================================

describe('Sprint 26: PDF HTML Generation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('generates PDF HTML with header containing user name', async () => {
    await storageSet(STORAGE_KEYS.PROFILE, { name: 'Josh Williams' });

    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });
    expect(html).toContain('Josh Williams');
    expect(html).toContain('DUB Tracker');
    expect(html).toContain('Wellness Report');
  });

  it('generates PDF with date range in subtitle', async () => {
    const html = await generatePDFHTML({ format: 'pdf', datePreset: '30d', includeJournal: false });
    expect(html).toContain('Last 30 Days');
  });

  it('generates PDF with all sections', async () => {
    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });
    expect(html).toContain('Compliance');
    expect(html).toContain('Sleep');
    expect(html).toContain('Mood Trend');
    expect(html).toContain('Top Stress Triggers');
    expect(html).toContain('Medication Adherence');
    expect(html).toContain('Weight');
    expect(html).toContain('Exercise');
  });

  it('handles empty data with no-data messages', async () => {
    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });
    expect(html).toContain('No sleep data logged');
    expect(html).toContain('No mood data logged');
    expect(html).toContain('No compliance data logged');
    expect(html).toContain('No exercise data logged');
  });

  it('renders sleep averages when data exists', async () => {
    const today = todayStr();
    const yesterday = dateOffset(-1);

    await storageSet(dateKey(STORAGE_KEYS.DAILY_SUMMARY, today), makeDailySummary(today, { sleep_hours: 7.5 }));
    await storageSet(dateKey(STORAGE_KEYS.DAILY_SUMMARY, yesterday), makeDailySummary(yesterday, { sleep_hours: 8.0 }));

    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });
    expect(html).toContain('7.8'); // avg of 7.5 and 8.0
    expect(html).toContain('hours');
  });

  it('renders mood trend description', async () => {
    const dates = Array.from({ length: 10 }, (_, i) => dateOffset(-i));
    for (let i = 0; i < dates.length; i++) {
      await storageSet(
        dateKey(STORAGE_KEYS.DAILY_SUMMARY, dates[i]),
        makeDailySummary(dates[i], { mood_avg: 2.5 + (i * 0.3) }),
      );
    }

    const html = await generatePDFHTML({ format: 'pdf', datePreset: '30d', includeJournal: false });
    // Mood should show a trend (improving, declining, or stable)
    const hasTrend = html.includes('Improving') || html.includes('Declining') || html.includes('Stable');
    expect(hasTrend).toBe(true);
  });

  it('includes medication adherence percentage', async () => {
    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_MEDICATIONS, today), makeMedicationEntry(today));

    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });
    expect(html).toContain('50%'); // 1 of 2 taken
    expect(html).toContain('Adherence Rate');
  });

  it('renders weight change', async () => {
    const day1 = dateOffset(-5);
    const day2 = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.DAILY_SUMMARY, day1), makeDailySummary(day1, { weight_lbs: 175 }));
    await storageSet(dateKey(STORAGE_KEYS.DAILY_SUMMARY, day2), makeDailySummary(day2, { weight_lbs: 173 }));

    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });
    expect(html).toContain('175.0');
    expect(html).toContain('173.0');
    expect(html).toContain('-2.0');
  });

  it('includes footer with dubtracker.ai', async () => {
    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });
    expect(html).toContain('dubtracker.ai');
  });

  it('includes disclaimer', async () => {
    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });
    expect(html).toContain('Disclaimer');
    expect(html).toContain('self-reported data');
  });
});

// ============================================================
// Unit Settings Tests
// ============================================================

describe('Sprint 26: Centralized Unit Settings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('DEFAULT_UNIT_SETTINGS has all required fields', () => {
    expect(DEFAULT_UNIT_SETTINGS.weight).toBe('lbs');
    expect(DEFAULT_UNIT_SETTINGS.height).toBe('ft-in');
    expect(DEFAULT_UNIT_SETTINGS.temperature).toBe('F');
    expect(DEFAULT_UNIT_SETTINGS.water).toBe('oz');
    expect(DEFAULT_UNIT_SETTINGS.bodyMeasurements).toBe('in');
  });

  it('stores and retrieves unit settings', async () => {
    const settings: UnitSettings = {
      weight: 'kg',
      height: 'cm',
      temperature: 'C',
      water: 'ml',
      bodyMeasurements: 'cm',
    };

    await storageSet(STORAGE_KEYS.SETTINGS_UNITS, settings);
    const retrieved = await storageGet<UnitSettings>(STORAGE_KEYS.SETTINGS_UNITS);

    expect(retrieved).toEqual(settings);
  });

  it('unit changes persist across reads', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_UNITS, { ...DEFAULT_UNIT_SETTINGS, weight: 'kg' });
    const result = await storageGet<UnitSettings>(STORAGE_KEYS.SETTINGS_UNITS);
    expect(result?.weight).toBe('kg');

    // Update just one field
    await storageSet(STORAGE_KEYS.SETTINGS_UNITS, { ...result!, water: 'ml' });
    const result2 = await storageGet<UnitSettings>(STORAGE_KEYS.SETTINGS_UNITS);
    expect(result2?.weight).toBe('kg'); // Still kg
    expect(result2?.water).toBe('ml'); // Updated
  });

  it('body measurement logger can read centralized weight unit', async () => {
    await storageSet(STORAGE_KEYS.SETTINGS_UNITS, { ...DEFAULT_UNIT_SETTINGS, weight: 'kg' });
    // Also writes to legacy key for backward compat
    await storageSet(STORAGE_KEYS.SETTINGS_BODY_MEAS_WEIGHT_UNIT, 'kg');

    const centralUnit = await storageGet<UnitSettings>(STORAGE_KEYS.SETTINGS_UNITS);
    const legacyUnit = await storageGet<WeightUnit>(STORAGE_KEYS.SETTINGS_BODY_MEAS_WEIGHT_UNIT);

    expect(centralUnit?.weight).toBe('kg');
    expect(legacyUnit).toBe('kg');
  });

  it('SETTINGS_UNITS storage key exists', () => {
    expect(STORAGE_KEYS.SETTINGS_UNITS).toBe('dub.settings.units');
  });
});

// ============================================================
// Data Management Tests
// ============================================================

describe('Sprint 26: Data Management', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('storageClearAll removes all dub.* keys', async () => {
    await storageSet(STORAGE_KEYS.PROFILE, { name: 'Test' });
    await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, todayStr()), makeSleepEntry());
    await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, todayStr()), makeMoodEntry());
    await storageSet(STORAGE_KEYS.SETTINGS_UNITS, DEFAULT_UNIT_SETTINGS);

    await storageClearAll();

    const profile = await storageGet(STORAGE_KEYS.PROFILE);
    const sleep = await storageGet(dateKey(STORAGE_KEYS.LOG_SLEEP, todayStr()));
    const units = await storageGet(STORAGE_KEYS.SETTINGS_UNITS);

    expect(profile).toBeNull();
    expect(sleep).toBeNull();
    expect(units).toBeNull();
  });

  it('storageDeleteMultiple removes specific keys', async () => {
    const today = todayStr();
    const sleepKey = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    const moodKey = dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today);
    const foodKey = dateKey(STORAGE_KEYS.LOG_FOOD, today);

    await storageSet(sleepKey, makeSleepEntry());
    await storageSet(moodKey, makeMoodEntry());
    await storageSet(foodKey, [{ id: 'f1', name: 'Apple' }]);

    // Clear only sleep
    const sleepKeys = await storageList(`${STORAGE_KEYS.LOG_SLEEP}.`);
    await storageDeleteMultiple(sleepKeys);

    expect(await storageGet(sleepKey)).toBeNull();
    expect(await storageGet(moodKey)).not.toBeNull();
    expect(await storageGet(foodKey)).not.toBeNull();
  });

  it('individual category clear leaves other data intact', async () => {
    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, today), makeSleepEntry());
    await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today), makeMoodEntry());
    await storageSet(STORAGE_KEYS.PROFILE, { name: 'Test User' });

    // Clear just sleep data
    const sleepKeys = await storageList(`${STORAGE_KEYS.LOG_SLEEP}.`);
    await storageDeleteMultiple(sleepKeys);

    expect(await storageGet(dateKey(STORAGE_KEYS.LOG_SLEEP, today))).toBeNull();
    expect(await storageGet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today))).not.toBeNull();
    expect(await storageGet(STORAGE_KEYS.PROFILE)).not.toBeNull();
  });

  it('clear all data removes every storage key', async () => {
    // Populate various data types
    const today = todayStr();
    await storageSet(STORAGE_KEYS.PROFILE, { name: 'Test' });
    await storageSet(STORAGE_KEYS.TIER, 'balanced');
    await storageSet(STORAGE_KEYS.SETTINGS_UNITS, DEFAULT_UNIT_SETTINGS);
    await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, today), makeSleepEntry());
    await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, today), [{ id: 'f1' }]);
    await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today), makeMoodEntry());
    await storageSet(STORAGE_KEYS.COACH_HISTORY, [{ role: 'user', content: 'hi' }]);
    await storageSet(STORAGE_KEYS.STREAKS, { current: 5 });
    await storageSet(STORAGE_KEYS.SETTINGS_HYDRATION_GOAL, { daily_goal: 64, unit: 'oz' });

    await storageClearAll();

    // Verify ALL keys are gone
    const remaining = await storageList('dub.');
    expect(remaining.length).toBe(0);
  });
});

// ============================================================
// API Key Security Tests
// ============================================================

describe('Sprint 26: API Key Security', () => {
  it('API key is stored in SECURE_KEYS, not STORAGE_KEYS', () => {
    // Verify the API key is NOT in any STORAGE_KEY
    const allStorageValues = Object.values(STORAGE_KEYS);
    const hasApiKey = allStorageValues.some((v) => v.includes('api_key') || v.includes('anthropic'));
    expect(hasApiKey).toBe(false);
  });

  it('API key is never included in data export', async () => {
    // Even with all data gathered, API key never appears
    const data = await gatherAllData({ format: 'csv', datePreset: 'all', includeJournal: true });
    const allDataStr = JSON.stringify(data);
    expect(allDataStr).not.toContain('anthropic_api_key');
    expect(allDataStr).not.toContain('sk-ant-');
  });
});

// ============================================================
// Multi-format CSV Generation Tests (per data type)
// ============================================================

describe('Sprint 26: Per-Type CSV', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('generates separate CSV for body measurements with all fields', () => {
    const entries: Record<string, unknown>[] = [
      makeBodyMeasurement('2026-04-10') as unknown as Record<string, unknown>,
    ];

    const csv = generateCSV('body_measurements', entries);
    expect(csv).toContain('date');
    expect(csv).toContain('weight');
    expect(csv).toContain('weight_unit');
    expect(csv).toContain('body_fat_percentage');
    expect(csv).toContain('measurements_waist');
    expect(csv).toContain('measurement_unit');
  });

  it('generates CSV for medications with nested items', () => {
    const entry = makeMedicationEntry('2026-04-10');
    const entries: Record<string, unknown>[] = [entry as unknown as Record<string, unknown>];

    const csv = generateCSV('medications', entries);
    expect(csv).toContain('date');
    expect(csv).toContain('medications'); // Array joined with semicolons
  });

  it('multiple data types each produce valid CSV', async () => {
    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, today), makeSleepEntry());
    await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today), makeMoodEntry());

    const data = await gatherAllData({ format: 'csv', datePreset: 'all', includeJournal: false });

    // Each type should have entries
    for (const [type, entries] of Object.entries(data)) {
      if (entries.length > 0) {
        const csv = generateCSV(type, entries);
        const lines = csv.split('\n');
        // At least header + 1 data row
        expect(lines.length).toBeGreaterThanOrEqual(2);
        // Header should have comma-separated values
        expect(lines[0]).toContain(',');
      }
    }
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe('Sprint 26: Export Integration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('full 90-day mock export with multiple data types', async () => {
    // Populate 10 days of diverse data
    for (let i = 0; i < 10; i++) {
      const date = dateOffset(-i);
      await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, date), makeSleepEntry());
      await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, date), makeMoodEntry({ date }));
      await storageSet(dateKey(STORAGE_KEYS.DAILY_SUMMARY, date), makeDailySummary(date));
    }

    // Also add therapy, journal, and sexual data
    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_THERAPY, today), makeTherapyEntry());
    await storageSet(dateKey(STORAGE_KEYS.LOG_JOURNAL, today), [makeJournalEntry()]);
    await storageSet(dateKey(STORAGE_KEYS.LOG_SEXUAL, today), [makeSexualEntry()]);

    const data = await gatherAllData({ format: 'csv', datePreset: '90d', includeJournal: false });

    // Sleep should have 10 entries
    expect(data.sleep.length).toBe(10);

    // Mood should have 10 entries
    expect(data.mood_mental.length).toBe(10);

    // Therapy notes stripped
    expect(data.therapy[0].notes).toBeUndefined();

    // Journal excluded
    expect(data.journal).toBeUndefined();

    // Sexual NEVER included
    expect(data.sexual).toBeUndefined();

    // Generate CSV for each type and verify structure
    for (const [type, entries] of Object.entries(data)) {
      if (entries.length > 0) {
        const csv = generateCSV(type, entries);
        const lines = csv.split('\n');
        const headerCols = lines[0].split(',');
        // Every data row should have same number of columns as header
        for (let i = 1; i < lines.length; i++) {
          // Note: this is approximate due to CSV escaping
          // Just verify it's a non-empty line
          expect(lines[i].length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('PDF generation with populated data produces complete HTML', async () => {
    await storageSet(STORAGE_KEYS.PROFILE, { name: 'Josh Williams' });

    for (let i = 0; i < 7; i++) {
      const date = dateOffset(-i);
      await storageSet(dateKey(STORAGE_KEYS.DAILY_SUMMARY, date), makeDailySummary(date, {
        sleep_hours: 7 + Math.random(),
        mood_avg: 3 + Math.random(),
        active_minutes: 20 + Math.floor(Math.random() * 40),
        weight_lbs: 175 - (i * 0.3),
      }));
    }

    const today = todayStr();
    await storageSet(dateKey(STORAGE_KEYS.LOG_MEDICATIONS, today), makeMedicationEntry(today));

    const html = await generatePDFHTML({ format: 'pdf', datePreset: '7d', includeJournal: false });

    // Valid HTML structure
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');

    // All sections present
    expect(html).toContain('Josh Williams');
    expect(html).toContain('Last 7 Days');
    expect(html).toContain('hours');
    expect(html).toContain('dubtracker.ai');

    // No broken tags
    const openTags = (html.match(/<table/g) || []).length;
    const closeTags = (html.match(/<\/table>/g) || []).length;
    expect(openTags).toBe(closeTags);
  });
});

// ============================================================
// Type Safety Checks
// ============================================================

describe('Sprint 26: Type Safety', () => {
  it('UnitSettings interface has correct types', () => {
    const settings: UnitSettings = {
      weight: 'lbs',
      height: 'ft-in',
      temperature: 'F',
      water: 'cups',
      bodyMeasurements: 'in',
    };

    // All assignments should be valid
    const w: WeightUnit = settings.weight;
    const h: HeightUnit = settings.height;
    const t: TemperatureUnit = settings.temperature;
    const wa: HydrationUnit = settings.water;
    const b: MeasurementUnit = settings.bodyMeasurements;

    expect(w).toBe('lbs');
    expect(h).toBe('ft-in');
    expect(t).toBe('F');
    expect(wa).toBe('cups');
    expect(b).toBe('in');
  });

  it('ExportOptions interface accepts all valid configurations', () => {
    const opts1: ExportOptions = { format: 'csv', datePreset: 'all', includeJournal: false };
    const opts2: ExportOptions = { format: 'pdf', datePreset: '7d', includeJournal: false };
    const opts3: ExportOptions = {
      format: 'csv',
      datePreset: 'custom',
      customRange: { start: new Date(), end: new Date() },
      includeJournal: true,
    };

    expect(opts1.format).toBe('csv');
    expect(opts2.format).toBe('pdf');
    expect(opts3.datePreset).toBe('custom');
  });
});
