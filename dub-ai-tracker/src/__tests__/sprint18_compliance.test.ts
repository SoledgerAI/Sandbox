// Sprint 18: Daily Compliance Scorecard + Trend Line tests

import {
  storageGet,
  storageSet,
  storageDelete,
  STORAGE_KEYS,
  dateKey,
} from '../utils/storage';
import type {
  ComplianceResult,
  DailyGoalId,
  FoodEntry,
  WaterEntry,
  BodyEntry,
  SleepEntry,
  SupplementEntry,
  HabitEntry,
  BodyweightRepEntry,
  AllergyLogEntry,
} from '../types';
import {
  ALL_DAILY_GOALS,
  DEFAULT_DAILY_GOALS,
} from '../types';
import type { WorkoutEntry } from '../types/workout';
import {
  calculateDailyCompliance,
  getEnabledGoals,
  setEnabledGoals,
  getCachedCompliance,
  refreshCompliance,
  getComplianceRange,
  getComplianceTrend,
} from '../services/complianceEngine';

const TEST_DATE = '2026-04-09';

// ============================================================
// Daily Goals Configuration
// ============================================================

describe('Daily Goals Configuration', () => {
  beforeEach(async () => {
    await storageDelete(STORAGE_KEYS.SETTINGS_DAILY_GOALS);
  });

  it('returns default goals when none configured', async () => {
    const goals = await getEnabledGoals();
    expect(goals).toEqual(DEFAULT_DAILY_GOALS);
    expect(goals).toContain('log_food');
    expect(goals).toContain('log_water');
    expect(goals).toContain('exercise');
    expect(goals).toContain('complete_habits');
  });

  it('saves and retrieves custom goals', async () => {
    const custom: DailyGoalId[] = ['log_food', 'log_weight', 'log_sleep'];
    await setEnabledGoals(custom);
    const result = await getEnabledGoals();
    expect(result).toEqual(custom);
    expect(result).toHaveLength(3);
  });

  it('ALL_DAILY_GOALS has 26 entries (Sprint 23: +body_measurement_logged, +medications_logged)', () => {
    expect(ALL_DAILY_GOALS).toHaveLength(26);
  });

  it('DEFAULT_DAILY_GOALS has 4 entries', () => {
    expect(DEFAULT_DAILY_GOALS).toHaveLength(4);
  });

  it('all default goals exist in ALL_DAILY_GOALS', () => {
    for (const goalId of DEFAULT_DAILY_GOALS) {
      expect(ALL_DAILY_GOALS.some((g) => g.id === goalId)).toBe(true);
    }
  });
});

// ============================================================
// Compliance Engine - Core Calculation
// ============================================================

describe('Compliance Engine', () => {
  beforeEach(async () => {
    // Clear all relevant storage
    await Promise.all([
      storageDelete(STORAGE_KEYS.SETTINGS_DAILY_GOALS),
      storageDelete(STORAGE_KEYS.PROFILE),
      storageDelete(STORAGE_KEYS.TIER),
      storageDelete(dateKey(STORAGE_KEYS.LOG_FOOD, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_WATER, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_WORKOUT, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_BODY, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_SLEEP, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_HABITS, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_REPS, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_ALLERGIES, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_STEPS, TEST_DATE)),
      storageDelete(STORAGE_KEYS.MY_SUPPLEMENTS),
      storageDelete(dateKey(STORAGE_KEYS.COMPLIANCE, TEST_DATE)),
    ]);
  });

  it('returns 0% when no goals are enabled', async () => {
    await setEnabledGoals([]);
    const result = await calculateDailyCompliance(TEST_DATE);
    expect(result.completed).toBe(0);
    expect(result.total).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('returns 0% when no data logged (default goals)', async () => {
    const result = await calculateDailyCompliance(TEST_DATE);
    // Default: food, water, exercise, habits — all should be incomplete
    expect(result.total).toBe(4);
    expect(result.completed).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.items.every((i) => !i.completed)).toBe(true);
  });

  it('returns 100% when all goals completed', async () => {
    await setEnabledGoals(['log_food', 'log_weight']);

    // Log food
    const food: FoodEntry[] = [{
      id: 'f1',
      timestamp: `${TEST_DATE}T12:00:00Z`,
      name: 'Chicken',
      computed_nutrition: { calories: 300, protein_g: 30, carbs_g: 0, fat_g: 10, fiber_g: 0, sugar_g: 0, sodium_mg: 200, cholesterol_mg: 80, serving_size_g: 150 },
    } as unknown as FoodEntry];
    await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, TEST_DATE), food);

    // Log weight
    const body: BodyEntry = {
      weight_lbs: 180,
      body_fat_pct: null,
      measurements: null,
      bp_systolic: null,
      bp_diastolic: null,
      resting_hr: null,
      hrv_ms: null,
      spo2_pct: null,
      timestamp: `${TEST_DATE}T08:00:00Z`,
    };
    await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, TEST_DATE), body);

    const result = await calculateDailyCompliance(TEST_DATE);
    expect(result.total).toBe(2);
    expect(result.completed).toBe(2);
    expect(result.percentage).toBe(100);
  });

  it('calculates partial compliance correctly', async () => {
    await setEnabledGoals(['log_food', 'exercise', 'log_weight']);

    // Only log food — exercise and weight missing
    const food: FoodEntry[] = [{
      id: 'f1',
      timestamp: `${TEST_DATE}T12:00:00Z`,
      name: 'Salad',
      computed_nutrition: { calories: 200, protein_g: 10, carbs_g: 20, fat_g: 5, fiber_g: 3, sugar_g: 2, sodium_mg: 100, cholesterol_mg: 0, serving_size_g: 200 },
    } as unknown as FoodEntry];
    await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, TEST_DATE), food);

    const result = await calculateDailyCompliance(TEST_DATE);
    expect(result.total).toBe(3);
    expect(result.completed).toBe(1);
    expect(result.percentage).toBeCloseTo(33.33, 1);
  });

  it('checks exercise goal correctly', async () => {
    await setEnabledGoals(['exercise']);

    const workouts: WorkoutEntry[] = [{
      id: 'w1',
      timestamp: `${TEST_DATE}T07:00:00Z`,
      activity_name: 'Running',
      compendium_code: null,
      met_value: null,
      duration_minutes: 30,
      calories_burned: 300,
      intensity: 'moderate',
      distance_miles: null,
      notes: null,
      heart_rate_data: null,
      environmental: null,
    } as unknown as WorkoutEntry];
    await storageSet(dateKey(STORAGE_KEYS.LOG_WORKOUT, TEST_DATE), workouts);

    const result = await calculateDailyCompliance(TEST_DATE);
    expect(result.items[0].completed).toBe(true);
    expect(result.items[0].detail).toBe('Running');
  });

  it('checks push-ups goal correctly', async () => {
    await setEnabledGoals(['pushups']);

    const reps: BodyweightRepEntry[] = [
      { id: 'r1', timestamp: `${TEST_DATE}T08:00:00Z`, exercise_type: 'pushups', reps: 25, sets: 1, notes: null },
      { id: 'r2', timestamp: `${TEST_DATE}T08:05:00Z`, exercise_type: 'pushups', reps: 20, sets: 1, notes: null },
    ];
    await storageSet(dateKey(STORAGE_KEYS.LOG_REPS, TEST_DATE), reps);

    const result = await calculateDailyCompliance(TEST_DATE);
    expect(result.items[0].completed).toBe(true);
    expect(result.items[0].detail).toBe('45 reps');
  });

  it('checks sleep goal correctly', async () => {
    await setEnabledGoals(['log_sleep']);

    const sleep: SleepEntry = {
      bedtime: `${TEST_DATE}T23:00:00Z`,
      wake_time: '2026-04-10T07:00:00Z',
      quality: 4,
      bathroom_trips: null,
      alarm_used: null,
      time_to_fall_asleep_min: null,
      notes: null,
      device_data: null,
    };
    await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, TEST_DATE), sleep);

    const result = await calculateDailyCompliance(TEST_DATE);
    expect(result.items[0].completed).toBe(true);
  });

  it('checks habits goal - all must be complete', async () => {
    await setEnabledGoals(['complete_habits']);

    // Partial completion
    const habits: HabitEntry[] = [
      { id: 'h1', name: 'Brush teeth', completed: true, completedAt: `${TEST_DATE}T08:00:00Z` },
      { id: 'h2', name: 'Floss', completed: false, completedAt: null },
    ];
    await storageSet(dateKey(STORAGE_KEYS.LOG_HABITS, TEST_DATE), habits);

    let result = await calculateDailyCompliance(TEST_DATE);
    expect(result.items[0].completed).toBe(false);
    expect(result.items[0].detail).toBe('1/2 completed');

    // Complete all
    habits[1].completed = true;
    habits[1].completedAt = `${TEST_DATE}T21:00:00Z`;
    await storageSet(dateKey(STORAGE_KEYS.LOG_HABITS, TEST_DATE), habits);

    result = await calculateDailyCompliance(TEST_DATE);
    expect(result.items[0].completed).toBe(true);
    expect(result.items[0].detail).toBe('2/2 completed');
  });

  it('checks allergy logging goal', async () => {
    await setEnabledGoals(['log_allergy_status']);

    const allergy: AllergyLogEntry = {
      id: 'a1',
      timestamp: `${TEST_DATE}T10:00:00Z`,
      severity: 'mild',
      symptoms: ['congestion', 'sneezing'],
      medication_taken: true,
      medication_name: 'Zyrtec',
      notes: null,
    };
    await storageSet(dateKey(STORAGE_KEYS.LOG_ALLERGIES, TEST_DATE), allergy);

    const result = await calculateDailyCompliance(TEST_DATE);
    expect(result.items[0].completed).toBe(true);
    expect(result.items[0].detail).toBe('Severity: mild');
  });

  it('handles all goals enabled with no data (category-gated goals skipped)', async () => {
    const allGoalIds = ALL_DAILY_GOALS.map((g) => g.id);
    await setEnabledGoals(allGoalIds);

    const result = await calculateDailyCompliance(TEST_DATE);
    // Category-gated goals (breastfeeding, perimenopause, migraine, body_measurements, medications) are skipped
    // when their categories aren't enabled, so total = ALL - 5 gated
    const expectedTotal = allGoalIds.length - 5; // 5 category-gated goals skipped
    expect(result.total).toBe(expectedTotal);
    expect(result.completed).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.items).toHaveLength(expectedTotal);
  });
});

// ============================================================
// Compliance Caching
// ============================================================

describe('Compliance Caching', () => {
  beforeEach(async () => {
    await Promise.all([
      storageDelete(STORAGE_KEYS.SETTINGS_DAILY_GOALS),
      storageDelete(dateKey(STORAGE_KEYS.COMPLIANCE, TEST_DATE)),
      storageDelete(dateKey(STORAGE_KEYS.LOG_FOOD, TEST_DATE)),
    ]);
  });

  it('caches compliance result', async () => {
    await setEnabledGoals(['log_food']);
    const result = await refreshCompliance(TEST_DATE);
    expect(result.total).toBe(1);

    // Read from cache
    const cached = await getCachedCompliance(TEST_DATE);
    expect(cached.total).toBe(1);
    expect(cached.percentage).toBe(result.percentage);
  });

  it('refreshCompliance overwrites cache', async () => {
    await setEnabledGoals(['log_food']);

    // First: no food
    await refreshCompliance(TEST_DATE);
    let cached = await getCachedCompliance(TEST_DATE);
    expect(cached.completed).toBe(0);

    // Add food
    const food: FoodEntry[] = [{
      id: 'f1',
      timestamp: `${TEST_DATE}T12:00:00Z`,
      name: 'Rice',
      computed_nutrition: { calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0.5, fiber_g: 1, sugar_g: 0, sodium_mg: 0, cholesterol_mg: 0, serving_size_g: 150 },
    } as unknown as FoodEntry];
    await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, TEST_DATE), food);

    // Refresh
    await refreshCompliance(TEST_DATE);
    cached = await getCachedCompliance(TEST_DATE);
    expect(cached.completed).toBe(1);
    expect(cached.percentage).toBe(100);
  });
});

// ============================================================
// Compliance Trend
// ============================================================

describe('Compliance Trend', () => {
  beforeEach(async () => {
    // Clear compliance cache for 14 days
    const deletes: Promise<void>[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      deletes.push(storageDelete(dateKey(STORAGE_KEYS.COMPLIANCE, dateStr)));
    }
    await Promise.all(deletes);
  });

  it('returns stable trend with no data', async () => {
    const trend = await getComplianceTrend();
    expect(trend.current7dAvg).toBe(0);
    expect(trend.prior7dAvg).toBe(0);
    expect(trend.trend).toBe('stable');
    expect(trend.delta).toBe(0);
  });

  it('calculates trend from cached compliance data', async () => {
    // Populate current week with high compliance
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const result: ComplianceResult = {
        completed: 9,
        total: 10,
        percentage: 90,
        items: [],
      };
      await storageSet(dateKey(STORAGE_KEYS.COMPLIANCE, dateStr), result);
    }

    // Populate prior week with lower compliance
    for (let i = 7; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const result: ComplianceResult = {
        completed: 7,
        total: 10,
        percentage: 70,
        items: [],
      };
      await storageSet(dateKey(STORAGE_KEYS.COMPLIANCE, dateStr), result);
    }

    const trend = await getComplianceTrend();
    expect(trend.current7dAvg).toBe(90);
    expect(trend.prior7dAvg).toBe(70);
    expect(trend.trend).toBe('improving');
    expect(trend.delta).toBe(20);
  });
});

// ============================================================
// Compliance Range (Chart Data)
// ============================================================

describe('Compliance Range', () => {
  beforeEach(async () => {
    await Promise.all([
      storageDelete(STORAGE_KEYS.SETTINGS_DAILY_GOALS),
      storageDelete(dateKey(STORAGE_KEYS.COMPLIANCE, '2026-04-07')),
      storageDelete(dateKey(STORAGE_KEYS.COMPLIANCE, '2026-04-08')),
      storageDelete(dateKey(STORAGE_KEYS.COMPLIANCE, '2026-04-09')),
    ]);
  });

  it('returns cached compliance for date range', async () => {
    // Pre-cache some compliance scores
    const score80: ComplianceResult = { completed: 8, total: 10, percentage: 80, items: [] };
    const score90: ComplianceResult = { completed: 9, total: 10, percentage: 90, items: [] };

    await storageSet(dateKey(STORAGE_KEYS.COMPLIANCE, '2026-04-07'), score80);
    await storageSet(dateKey(STORAGE_KEYS.COMPLIANCE, '2026-04-08'), score90);

    const range = await getComplianceRange('2026-04-07', '2026-04-08');
    expect(range).toHaveLength(2);
    expect(range[0]).toEqual({ date: '2026-04-07', percentage: 80 });
    expect(range[1]).toEqual({ date: '2026-04-08', percentage: 90 });
  });
});

// ============================================================
// Context Builder - Compliance Data
// ============================================================

describe('Context Builder includes compliance', () => {
  it('context_builder.ts imports complianceEngine', async () => {
    // Verify the context builder file references compliance
    const fs = require('fs');
    const path = require('path');
    const contextBuilderPath = path.resolve(__dirname, '..', 'ai', 'context_builder.ts');
    const source = fs.readFileSync(contextBuilderPath, 'utf-8');

    expect(source).toContain('complianceEngine');
    expect(source).toContain('[COMPLIANCE');
    expect(source).toContain('getCachedCompliance');
    expect(source).toContain('getComplianceTrend');
    expect(source).toContain('[COMPLIANCE 7d avg]');
    expect(source).toContain('[COMPLIANCE TREND]');
  });
});

// ============================================================
// Dashboard Card Rendering
// ============================================================

describe('ComplianceCard component file', () => {
  it('ComplianceCard component exists and uses required patterns', () => {
    const fs = require('fs');
    const path = require('path');
    const cardPath = path.resolve(__dirname, '..', 'components', 'dashboard', 'ComplianceCard.tsx');
    const source = fs.readFileSync(cardPath, 'utf-8');

    // Uses PremiumCard wrapper
    expect(source).toContain('PremiumCard');
    // Uses haptic feedback
    expect(source).toContain('hapticLight');
    // Uses animated circle (progress ring)
    expect(source).toContain('AnimatedCircle');
    // Shows percentage
    expect(source).toContain('pctText');
    // Expandable breakdown
    expect(source).toContain('expanded');
    // Shows completed/total
    expect(source).toContain('result.completed');
    expect(source).toContain('result.total');
    // Checkmark/close icons for items
    expect(source).toContain('checkmark-circle');
    expect(source).toContain('close-circle');
  });
});

// ============================================================
// Type Definitions
// ============================================================

describe('Compliance type definitions', () => {
  it('ComplianceResult has required fields', () => {
    const result: ComplianceResult = {
      completed: 5,
      total: 10,
      percentage: 50,
      items: [
        { id: 'log_food', label: 'Log food', completed: true },
        { id: 'log_water', label: 'Log water', completed: false, detail: '0/64 oz' },
      ],
    };
    expect(result.completed).toBe(5);
    expect(result.total).toBe(10);
    expect(result.percentage).toBe(50);
    expect(result.items[0].completed).toBe(true);
    expect(result.items[1].detail).toBe('0/64 oz');
  });

  it('DailyGoalId covers all 14 goal types', () => {
    const ids = ALL_DAILY_GOALS.map((g) => g.id);
    expect(ids).toContain('log_food');
    expect(ids).toContain('hit_calorie_target');
    expect(ids).toContain('hit_protein_target');
    expect(ids).toContain('log_water');
    expect(ids).toContain('exercise');
    expect(ids).toContain('pushups');
    expect(ids).toContain('pullups');
    expect(ids).toContain('situps');
    expect(ids).toContain('log_weight');
    expect(ids).toContain('log_sleep');
    expect(ids).toContain('take_supplements');
    expect(ids).toContain('complete_habits');
    expect(ids).toContain('log_allergy_status');
    expect(ids).toContain('steps_goal');
  });
});
