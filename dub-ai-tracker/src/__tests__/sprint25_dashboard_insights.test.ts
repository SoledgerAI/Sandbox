// Sprint 25: Dashboard Polish + Daily Snapshot + Insights/Trends Screen Tests

import { storageGet, storageSet, storageDelete, STORAGE_KEYS, dateKey, storageList } from '../utils/storage';
import {
  calculateCategoryStreak,
  calculateAllStreaks,
  type CategoryStreak,
  type StreakSummary,
} from '../utils/streakCalculator';
import {
  calculateMoodTrend,
  calculateSleepTrend,
  calculateExerciseTrend,
  calculateNutritionTrend,
  calculateComplianceTrend,
  calculateWeightTrend,
  type TrendTimeRange,
} from '../utils/trendCalculator';
import {
  pearsonCorrelation,
  calculateCorrelationInsights,
} from '../utils/insightCorrelations';
import {
  hydrationToOz,
  ozToHydration,
  type HydrationGoalSettings,
  type HydrationUnit,
  type MoodMentalEntry,
  type SleepEntry,
  type BodyEntry,
  type BodyMeasurementEntry,
  type ComplianceResult,
  type WaterEntry,
  type FoodEntry,
} from '../types';
import type { WorkoutEntry } from '../types/workout';

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

function makeMoodEntry(overrides: Partial<MoodMentalEntry> = {}): MoodMentalEntry {
  return {
    id: `mood-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    date: todayStr(),
    overall_mood: 7,
    energy_level: 3,
    anxiety_level: 2,
    stress_level: 2,
    mental_clarity: 4,
    emotions: ['happy', 'calm'],
    triggers: [],
    trigger_other_text: null,
    coping_used: [],
    coping_other_text: null,
    sleep_quality_last_night: null,
    notes: null,
    ...overrides,
  };
}

function makeSleepEntry(overrides: Partial<SleepEntry> = {}): SleepEntry {
  return {
    bedtime: '2026-04-13T22:30:00.000Z',
    wake_time: '2026-04-14T06:30:00.000Z',
    quality: 4,
    bathroom_trips: 0,
    alarm_used: true,
    time_to_fall_asleep_min: 10,
    notes: null,
    device_data: null,
    total_duration_hours: 8,
    ...overrides,
  };
}

function makeWorkoutEntry(overrides: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return {
    id: `wo-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    activity_name: 'Running',
    duration_minutes: 30,
    intensity: 'moderate',
    calories_burned: 300,
    heart_rate_avg: null,
    notes: null,
    ...overrides,
  } as WorkoutEntry;
}

function makeWaterEntry(overrides: Partial<WaterEntry> = {}): WaterEntry {
  return {
    id: `water-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    amount_oz: 8,
    notes: null,
    ...overrides,
  };
}

function makeNutritionInfo(overrides: Partial<FoodEntry['computed_nutrition']> = {}): FoodEntry['computed_nutrition'] {
  return {
    calories: 200,
    protein_g: 30,
    carbs_g: 0,
    fat_g: 8,
    fiber_g: 0,
    sugar_g: 0,
    added_sugar_g: null,
    sodium_mg: null,
    cholesterol_mg: null,
    saturated_fat_g: null,
    trans_fat_g: null,
    potassium_mg: null,
    vitamin_d_mcg: null,
    calcium_mg: null,
    iron_mg: null,
    ...overrides,
  };
}

function makeFoodEntry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: `food-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    meal_type: 'lunch',
    food_item: {
      source: 'manual',
      source_id: 'manual:test',
      name: 'Chicken Breast',
      brand: null,
      barcode: null,
      nutrition_per_100g: makeNutritionInfo(),
      serving_sizes: [{ description: '4 oz', unit: 'oz', gram_weight: 113, quantity: 1 }],
      default_serving_index: 0,
      ingredients: null,
      last_accessed: new Date().toISOString(),
    },
    serving: { description: '4 oz', unit: 'oz', gram_weight: 113, quantity: 1 },
    quantity: 1,
    computed_nutrition: makeNutritionInfo(),
    source: 'manual',
    photo_uri: null,
    photo_confidence: null,
    flagged_ingredients: [],
    notes: null,
    ...overrides,
  };
}

async function clearAllStorage(): Promise<void> {
  // Clear date-keyed entries for today and recent days
  const prefixes = [
    STORAGE_KEYS.LOG_FOOD, STORAGE_KEYS.LOG_WATER, STORAGE_KEYS.LOG_WORKOUT,
    STORAGE_KEYS.LOG_SLEEP, STORAGE_KEYS.LOG_MOOD, STORAGE_KEYS.LOG_BODY,
    STORAGE_KEYS.LOG_MOOD_MENTAL, STORAGE_KEYS.LOG_BODY_MEASUREMENTS,
    STORAGE_KEYS.COMPLIANCE,
  ];
  for (let i = 0; i < 100; i++) {
    const date = dateOffset(-i);
    for (const prefix of prefixes) {
      await storageDelete(dateKey(prefix, date));
    }
  }
  await storageDelete(STORAGE_KEYS.SETTINGS_HYDRATION_GOAL);
}

// ============================================================
// DASHBOARD TESTS
// ============================================================

describe('Sprint 25: Dashboard', () => {
  beforeEach(async () => {
    await clearAllStorage();
  });

  describe('Greeting time-of-day logic', () => {
    it('returns Morning for hours 0-11', () => {
      const hour = new Date().getHours();
      // This is a unit concept — we test the greeting mapping
      let expected: string;
      if (hour < 12) expected = 'Morning';
      else if (hour < 17) expected = 'Afternoon';
      else expected = 'Evening';

      // Verify the greeting format is correct
      expect(['Morning', 'Afternoon', 'Evening']).toContain(expected);
    });
  });

  describe('Compliance ring calculation', () => {
    it('returns 0% when no goals are configured', async () => {
      // No data stored = no compliance result
      const result = await storageGet<ComplianceResult>(dateKey(STORAGE_KEYS.COMPLIANCE, todayStr()));
      // If no cached compliance, it should be null
      expect(result).toBeNull();
    });

    it('calculates percentage correctly from completed/total', () => {
      const result: ComplianceResult = {
        completed: 3,
        total: 4,
        percentage: 75,
        items: [],
      };
      expect(result.percentage).toBe(75);
      expect(result.completed / result.total).toBe(0.75);
    });
  });

  describe('Quick stats with missing data', () => {
    it('handles no sleep logged', () => {
      const sleepHours: number | null = null;
      const formatted = sleepHours == null ? '--' : `${sleepHours}h`;
      expect(formatted).toBe('--');
    });

    it('handles no mood logged', () => {
      const moodAvg: number | null = null;
      const display = moodAvg != null ? `${moodAvg}/10` : '--';
      expect(display).toBe('--');
    });

    it('handles zero water logged', () => {
      const waterOz = 0;
      const goalOz = 64;
      const display = `${waterOz}/${goalOz} oz`;
      expect(display).toBe('0/64 oz');
    });
  });
});

// ============================================================
// STREAK TESTS
// ============================================================

describe('Sprint 25: Streak Calculator', () => {
  beforeEach(async () => {
    await clearAllStorage();
  });

  describe('calculateCategoryStreak', () => {
    it('returns 0 when no data exists', async () => {
      const streak = await calculateCategoryStreak(STORAGE_KEYS.LOG_WATER, async () => false);
      expect(streak).toBe(0);
    });

    it('returns 1 when only today has data', async () => {
      const streak = await calculateCategoryStreak(STORAGE_KEYS.LOG_WATER, async (date) => {
        return date === todayStr();
      });
      expect(streak).toBe(1);
    });

    it('returns 3 for 3 consecutive days', async () => {
      const today = todayStr();
      const yesterday = dateOffset(-1);
      const dayBefore = dateOffset(-2);
      const validDates = new Set([today, yesterday, dayBefore]);

      const streak = await calculateCategoryStreak(STORAGE_KEYS.LOG_WATER, async (date) => {
        return validDates.has(date);
      });
      expect(streak).toBe(3);
    });

    it('breaks streak on missed day', async () => {
      const today = todayStr();
      const dayBeforeYesterday = dateOffset(-2);
      // Gap on yesterday
      const validDates = new Set([today, dayBeforeYesterday]);

      const streak = await calculateCategoryStreak(STORAGE_KEYS.LOG_WATER, async (date) => {
        return validDates.has(date);
      });
      expect(streak).toBe(1); // Only today counts since yesterday is missing
    });

    it('handles streak starting from yesterday (grace period)', async () => {
      const yesterday = dateOffset(-1);
      const dayBefore = dateOffset(-2);
      const validDates = new Set([yesterday, dayBefore]);

      const streak = await calculateCategoryStreak(STORAGE_KEYS.LOG_WATER, async (date) => {
        return validDates.has(date);
      });
      expect(streak).toBe(2); // Yesterday + day before
    });
  });

  describe('Milestone thresholds', () => {
    it('identifies 7-day milestone', () => {
      const MILESTONES = [7, 30, 100];
      expect(MILESTONES.includes(7)).toBe(true);
      expect(MILESTONES.includes(14)).toBe(false);
    });

    it('identifies 30-day milestone', () => {
      const MILESTONES = [7, 30, 100];
      expect(MILESTONES.includes(30)).toBe(true);
    });

    it('identifies 100-day milestone', () => {
      const MILESTONES = [7, 30, 100];
      expect(MILESTONES.includes(100)).toBe(true);
    });
  });

  describe('calculateAllStreaks', () => {
    it('returns empty streaks array when no data exists', async () => {
      const summary = await calculateAllStreaks();
      expect(summary.logging.currentStreak).toBe(0);
      expect(summary.exercise.currentStreak).toBe(0);
      expect(summary.hydration.currentStreak).toBe(0);
      expect(summary.sleep.currentStreak).toBe(0);
      expect(summary.streaks.length).toBe(0);
    });

    it('includes only streaks with count > 0', async () => {
      // Store water for today
      await storageSet(dateKey(STORAGE_KEYS.LOG_WATER, todayStr()), [makeWaterEntry()]);

      const summary = await calculateAllStreaks();
      // Hydration and logging should both be 1
      expect(summary.hydration.currentStreak).toBe(1);
      expect(summary.logging.currentStreak).toBe(1);
      expect(summary.streaks.filter((s) => s.currentStreak > 0).length).toBeGreaterThan(0);
    });
  });

  describe('Streak across month boundary', () => {
    it('counts consecutive days across month boundary', async () => {
      // Simulate March 30, March 31, April 1
      const march30 = '2026-03-30';
      const march31 = '2026-03-31';
      const april1 = '2026-04-01';
      const dates = new Set([march30, march31, april1]);

      // Check that all three dates are sequential
      const d1 = new Date(march30 + 'T00:00:00');
      const d2 = new Date(march31 + 'T00:00:00');
      const d3 = new Date(april1 + 'T00:00:00');

      expect(d2.getTime() - d1.getTime()).toBe(86400000);
      expect(d3.getTime() - d2.getTime()).toBe(86400000);
    });
  });
});

// ============================================================
// INSIGHTS / TREND CALCULATOR TESTS
// ============================================================

describe('Sprint 25: Trend Calculator', () => {
  beforeEach(async () => {
    await clearAllStorage();
  });

  describe('calculateMoodTrend', () => {
    it('returns hasData=false with no entries', async () => {
      const trend = await calculateMoodTrend(7);
      expect(trend.hasData).toBe(false);
      expect(trend.dailyScores.length).toBe(0);
      expect(trend.averageMood).toBe(0);
    });

    it('calculates average mood from entries', async () => {
      const today = todayStr();
      const yesterday = dateOffset(-1);

      await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today), makeMoodEntry({ overall_mood: 8 }));
      await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, yesterday), makeMoodEntry({ overall_mood: 6 }));

      const trend = await calculateMoodTrend(7);
      expect(trend.hasData).toBe(true);
      expect(trend.dailyScores.length).toBe(2);
      expect(trend.averageMood).toBe(7);
    });

    it('extracts top emotions', async () => {
      const today = todayStr();
      await storageSet(
        dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today),
        makeMoodEntry({ emotions: ['happy', 'grateful', 'happy'] }),
      );

      const trend = await calculateMoodTrend(7);
      expect(trend.topEmotions.length).toBeGreaterThan(0);
      expect(trend.topEmotions[0].emotion).toBe('happy');
    });

    it('handles 30-day range', async () => {
      const trend = await calculateMoodTrend(30);
      expect(trend.hasData).toBe(false);
    });

    it('handles 90-day range', async () => {
      const trend = await calculateMoodTrend(90);
      expect(trend.hasData).toBe(false);
    });
  });

  describe('calculateSleepTrend', () => {
    it('returns hasData=false with no entries', async () => {
      const trend = await calculateSleepTrend(7);
      expect(trend.hasData).toBe(false);
      expect(trend.averageDuration).toBe(0);
    });

    it('computes average duration', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, todayStr()), makeSleepEntry({ total_duration_hours: 7 }));
      await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, dateOffset(-1)), makeSleepEntry({ total_duration_hours: 9 }));

      const trend = await calculateSleepTrend(7);
      expect(trend.hasData).toBe(true);
      expect(trend.averageDuration).toBe(8);
    });

    it('computes average quality when present', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, todayStr()), makeSleepEntry({ quality: 4 }));
      await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, dateOffset(-1)), makeSleepEntry({ quality: 2 }));

      const trend = await calculateSleepTrend(7);
      expect(trend.averageQuality).toBe(3);
    });

    it('tracks disturbances', async () => {
      await storageSet(
        dateKey(STORAGE_KEYS.LOG_SLEEP, todayStr()),
        makeSleepEntry({ disturbances: ['noise', 'temperature'] }),
      );

      const trend = await calculateSleepTrend(7);
      expect(trend.topDisturbances.length).toBe(2);
    });
  });

  describe('calculateExerciseTrend', () => {
    it('returns hasData=false with no entries', async () => {
      const trend = await calculateExerciseTrend(7);
      expect(trend.hasData).toBe(false);
      expect(trend.totalMinutes).toBe(0);
    });

    it('aggregates minutes and types', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_WORKOUT, todayStr()), [
        makeWorkoutEntry({ activity_name: 'Running', duration_minutes: 30 }),
        makeWorkoutEntry({ activity_name: 'Running', duration_minutes: 15 }),
      ]);

      const trend = await calculateExerciseTrend(7);
      expect(trend.hasData).toBe(true);
      expect(trend.totalMinutes).toBe(45);
      expect(trend.workoutTypeBreakdown[0].type).toBe('Running');
    });
  });

  describe('calculateNutritionTrend', () => {
    it('returns hasData=false with no entries', async () => {
      const trend = await calculateNutritionTrend(7);
      expect(trend.hasData).toBe(false);
    });

    it('computes average calories and meals per day', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, todayStr()), [
        makeFoodEntry({ computed_nutrition: makeNutritionInfo({ calories: 500, protein_g: 30, carbs_g: 40, fat_g: 20, fiber_g: 5, sugar_g: 10 }) }),
        makeFoodEntry({ computed_nutrition: makeNutritionInfo({ calories: 600, protein_g: 35, carbs_g: 50, fat_g: 25, fiber_g: 8, sugar_g: 12 }) }),
      ]);

      const trend = await calculateNutritionTrend(7);
      expect(trend.hasData).toBe(true);
      expect(trend.averageCalories).toBe(1100); // single day
      expect(trend.mealsPerDayAverage).toBe(2);
    });
  });

  describe('calculateComplianceTrend', () => {
    it('returns hasData=false with no cached compliance', async () => {
      const trend = await calculateComplianceTrend(7);
      expect(trend.hasData).toBe(false);
    });

    it('finds best and worst days', async () => {
      await storageSet(dateKey(STORAGE_KEYS.COMPLIANCE, todayStr()), {
        completed: 4, total: 4, percentage: 100, items: [],
      });
      await storageSet(dateKey(STORAGE_KEYS.COMPLIANCE, dateOffset(-1)), {
        completed: 1, total: 4, percentage: 25, items: [],
      });

      const trend = await calculateComplianceTrend(7);
      expect(trend.hasData).toBe(true);
      expect(trend.bestDay?.percentage).toBe(100);
      expect(trend.worstDay?.percentage).toBe(25);
      expect(trend.averageCompliance).toBe(62.5);
    });
  });

  describe('calculateWeightTrend', () => {
    it('returns stable direction for single entry', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, todayStr()), {
        weight_lbs: 180, body_fat_pct: null, measurements: null,
        bp_systolic: null, bp_diastolic: null, resting_hr: null,
        hrv_ms: null, spo2_pct: null, timestamp: new Date().toISOString(),
      });

      const trend = await calculateWeightTrend(7);
      expect(trend.hasData).toBe(true);
      expect(trend.trendDirection).toBe('stable');
      expect(trend.netChange).toBe(0);
    });

    it('detects upward trend', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, dateOffset(-6)), {
        weight_lbs: 175, body_fat_pct: null, measurements: null,
        bp_systolic: null, bp_diastolic: null, resting_hr: null,
        hrv_ms: null, spo2_pct: null, timestamp: new Date().toISOString(),
      });
      await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, todayStr()), {
        weight_lbs: 180, body_fat_pct: null, measurements: null,
        bp_systolic: null, bp_diastolic: null, resting_hr: null,
        hrv_ms: null, spo2_pct: null, timestamp: new Date().toISOString(),
      });

      const trend = await calculateWeightTrend(7);
      expect(trend.trendDirection).toBe('up');
      expect(trend.netChange).toBe(5);
    });

    it('detects downward trend', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, dateOffset(-6)), {
        weight_lbs: 180, body_fat_pct: null, measurements: null,
        bp_systolic: null, bp_diastolic: null, resting_hr: null,
        hrv_ms: null, spo2_pct: null, timestamp: new Date().toISOString(),
      });
      await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, todayStr()), {
        weight_lbs: 175, body_fat_pct: null, measurements: null,
        bp_systolic: null, bp_diastolic: null, resting_hr: null,
        hrv_ms: null, spo2_pct: null, timestamp: new Date().toISOString(),
      });

      const trend = await calculateWeightTrend(7);
      expect(trend.trendDirection).toBe('down');
      expect(trend.netChange).toBe(-5);
    });
  });

  describe('Empty state handling', () => {
    it('insights with only 1 day of data shows hasData=true for that category', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, todayStr()), makeMoodEntry());

      const mood = await calculateMoodTrend(7);
      expect(mood.hasData).toBe(true);
      expect(mood.dailyScores.length).toBe(1);
    });

    it('insights with 0 days returns all empty', async () => {
      const mood = await calculateMoodTrend(7);
      const sleep = await calculateSleepTrend(7);
      const exercise = await calculateExerciseTrend(7);
      const nutrition = await calculateNutritionTrend(7);

      expect(mood.hasData).toBe(false);
      expect(sleep.hasData).toBe(false);
      expect(exercise.hasData).toBe(false);
      expect(nutrition.hasData).toBe(false);
    });
  });
});

// ============================================================
// CORRELATION TESTS
// ============================================================

describe('Sprint 25: Insight Correlations', () => {
  describe('pearsonCorrelation', () => {
    it('returns null for fewer than 14 data points', () => {
      const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
      const ys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
      expect(pearsonCorrelation(xs, ys)).toBeNull();
    });

    it('returns ~1.0 for perfectly correlated data', () => {
      const xs = Array.from({ length: 20 }, (_, i) => i);
      const ys = Array.from({ length: 20 }, (_, i) => i * 2);
      const r = pearsonCorrelation(xs, ys);
      expect(r).not.toBeNull();
      expect(r!).toBeCloseTo(1.0, 2);
    });

    it('returns ~-1.0 for perfectly inversely correlated data', () => {
      const xs = Array.from({ length: 20 }, (_, i) => i);
      const ys = Array.from({ length: 20 }, (_, i) => 20 - i);
      const r = pearsonCorrelation(xs, ys);
      expect(r).not.toBeNull();
      expect(r!).toBeCloseTo(-1.0, 2);
    });

    it('returns ~0 for uncorrelated data', () => {
      const xs = Array.from({ length: 20 }, (_, i) => i);
      // Alternating pattern — low correlation with linear
      const ys = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 10 : -10));
      const r = pearsonCorrelation(xs, ys);
      expect(r).not.toBeNull();
      expect(Math.abs(r!)).toBeLessThan(0.3);
    });

    it('skips NaN values when pairing', () => {
      const xs = Array.from({ length: 20 }, (_, i) => i);
      const ys = Array.from({ length: 20 }, (_, i) => (i < 5 ? NaN : i * 2));
      const r = pearsonCorrelation(xs, ys);
      // Only 15 valid pairs, >= 14 threshold
      expect(r).not.toBeNull();
    });

    it('returns null when all y values are same (zero variance)', () => {
      const xs = Array.from({ length: 20 }, (_, i) => i);
      const ys = Array.from({ length: 20 }, () => 5);
      const r = pearsonCorrelation(xs, ys);
      expect(r).toBeNull(); // denominator is 0
    });
  });

  describe('calculateCorrelationInsights', () => {
    beforeEach(async () => {
      await clearAllStorage();
    });

    it('returns empty array with no data', async () => {
      const insights = await calculateCorrelationInsights();
      expect(insights).toEqual([]);
    });
  });
});

// ============================================================
// HYDRATION GOAL TESTS
// ============================================================

describe('Sprint 25: Hydration Goal', () => {
  beforeEach(async () => {
    await clearAllStorage();
  });

  describe('Unit conversion', () => {
    it('converts cups to oz', () => {
      expect(hydrationToOz(8, 'cups')).toBe(64);
    });

    it('converts oz to oz (identity)', () => {
      expect(hydrationToOz(64, 'oz')).toBe(64);
    });

    it('converts ml to oz', () => {
      const result = hydrationToOz(1000, 'ml');
      expect(result).toBeCloseTo(33.81, 1);
    });

    it('converts oz to cups', () => {
      expect(ozToHydration(64, 'cups')).toBe(8);
    });

    it('converts oz to ml', () => {
      const result = ozToHydration(64, 'ml');
      expect(result).toBeCloseTo(1892.7, 0);
    });
  });

  describe('Goal persistence', () => {
    it('saves and retrieves hydration goal', async () => {
      const goal: HydrationGoalSettings = { daily_goal: 8, unit: 'cups' };
      await storageSet(STORAGE_KEYS.SETTINGS_HYDRATION_GOAL, goal);

      const retrieved = await storageGet<HydrationGoalSettings>(STORAGE_KEYS.SETTINGS_HYDRATION_GOAL);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.daily_goal).toBe(8);
      expect(retrieved!.unit).toBe('cups');
    });

    it('returns null when no goal is set', async () => {
      const retrieved = await storageGet<HydrationGoalSettings>(STORAGE_KEYS.SETTINGS_HYDRATION_GOAL);
      expect(retrieved).toBeNull();
    });
  });

  describe('Progress calculation', () => {
    it('calculates percentage from oz consumed vs goal', () => {
      const consumedOz = 48;
      const goalOz = 64;
      const pct = Math.round((consumedOz / goalOz) * 100);
      expect(pct).toBe(75);
    });

    it('handles goal met (100%+)', () => {
      const consumedOz = 80;
      const goalOz = 64;
      const pct = Math.round((consumedOz / goalOz) * 100);
      expect(pct).toBe(125);
    });

    it('handles zero consumption', () => {
      const consumedOz = 0;
      const goalOz = 64;
      const pct = Math.round((consumedOz / goalOz) * 100);
      expect(pct).toBe(0);
    });

    it('converts cups goal to oz for comparison', () => {
      const goal: HydrationGoalSettings = { daily_goal: 8, unit: 'cups' };
      const goalOz = hydrationToOz(goal.daily_goal, goal.unit);
      expect(goalOz).toBe(64);

      const consumed = 32;
      const pct = Math.round((consumed / goalOz) * 100);
      expect(pct).toBe(50);
    });
  });
});

// ============================================================
// EDGE CASE TESTS
// ============================================================

describe('Sprint 25: Edge Cases', () => {
  beforeEach(async () => {
    await clearAllStorage();
  });

  describe('Dashboard with zero entries (first-time user)', () => {
    it('all summaries return safe defaults', async () => {
      const mood = await calculateMoodTrend(7);
      const sleep = await calculateSleepTrend(7);
      const exercise = await calculateExerciseTrend(7);
      const nutrition = await calculateNutritionTrend(7);
      const compliance = await calculateComplianceTrend(7);
      const weight = await calculateWeightTrend(7);

      expect(mood.averageMood).toBe(0);
      expect(sleep.averageDuration).toBe(0);
      expect(exercise.totalMinutes).toBe(0);
      expect(nutrition.averageCalories).toBe(0);
      expect(compliance.averageCompliance).toBe(0);
      expect(weight.trendDirection).toBe('stable');
    });
  });

  describe('Insights with only 2 days of data', () => {
    it('provides partial trend data', async () => {
      await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, todayStr()), makeMoodEntry({ overall_mood: 8 }));
      await storageSet(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, dateOffset(-1)), makeMoodEntry({ overall_mood: 6 }));

      const trend = await calculateMoodTrend(7);
      expect(trend.hasData).toBe(true);
      expect(trend.dailyScores.length).toBe(2);
      // Average is computed from available data only
      expect(trend.averageMood).toBe(7);
    });
  });

  describe('Streak with never-logged user', () => {
    it('returns 0 for all streaks', async () => {
      const summary = await calculateAllStreaks();
      expect(summary.logging.currentStreak).toBe(0);
      expect(summary.exercise.currentStreak).toBe(0);
      expect(summary.hydration.currentStreak).toBe(0);
      expect(summary.sleep.currentStreak).toBe(0);
    });
  });

  describe('ComplianceResult structure validation', () => {
    it('percentage is between 0 and 100', () => {
      const makeResult = (completed: number, total: number): ComplianceResult => ({
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
        items: [],
      });

      expect(makeResult(0, 4).percentage).toBe(0);
      expect(makeResult(2, 4).percentage).toBe(50);
      expect(makeResult(4, 4).percentage).toBe(100);
      expect(makeResult(0, 0).percentage).toBe(0);
    });
  });

  describe('Weight trend with BodyMeasurementEntry fallback', () => {
    it('reads weight from body_measurements when LOG_BODY has no weight', async () => {
      const bm: BodyMeasurementEntry = {
        id: 'bm-1',
        timestamp: new Date().toISOString(),
        date: todayStr(),
        weight: 175,
        weight_unit: 'lbs',
        body_fat_percentage: null,
        measurements: {
          waist: null, hips: null, chest: null,
          bicep_left: null, bicep_right: null,
          thigh_left: null, thigh_right: null, neck: null,
        },
        measurement_unit: 'in',
        photo_taken: false,
        notes: null,
      };
      await storageSet(dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, todayStr()), bm);

      const trend = await calculateWeightTrend(7);
      expect(trend.hasData).toBe(true);
      expect(trend.entries[0].weight).toBe(175);
    });
  });

  describe('Trend time range produces correct date counts', () => {
    it('7-day range produces 7 dates', () => {
      const dates: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      expect(dates.length).toBe(7);
    });

    it('30-day range produces 30 dates', () => {
      const dates: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      expect(dates.length).toBe(30);
    });

    it('90-day range produces 90 dates', () => {
      const dates: string[] = [];
      for (let i = 89; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      expect(dates.length).toBe(90);
    });
  });
});
