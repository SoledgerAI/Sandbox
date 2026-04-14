// Sprint 25: Trend Calculator for Insights Screen
// Aggregates daily entries by time range, computes averages, finds top items

import { storageGet, STORAGE_KEYS, dateKey } from './storage';
import { todayDateString } from './dayBoundary';
import { refreshCompliance } from '../services/complianceEngine';
import type {
  FoodEntry,
  WaterEntry,
  SleepEntry,
  MoodMentalEntry,
  MoodEmotion,
  MoodTrigger,
  SleepDisturbance,
  BodyEntry,
  BodyMeasurementEntry,
  ComplianceResult,
} from '../types';
import type { WorkoutEntry } from '../types/workout';

export type TrendTimeRange = 7 | 30 | 90;

export interface MoodTrendData {
  dailyScores: Array<{ date: string; score: number }>;
  averageMood: number;
  topEmotions: Array<{ emotion: MoodEmotion; count: number }>;
  topTriggers: Array<{ trigger: MoodTrigger; count: number }>;
  hasData: boolean;
}

export interface SleepTrendData {
  dailyDurations: Array<{ date: string; hours: number }>;
  averageDuration: number;
  averageQuality: number | null;
  topDisturbances: Array<{ disturbance: SleepDisturbance; count: number }>;
  hasData: boolean;
}

export interface ExerciseTrendData {
  dailyMinutes: Array<{ date: string; minutes: number }>;
  totalMinutes: number;
  workoutTypeBreakdown: Array<{ type: string; count: number }>;
  hasData: boolean;
}

export interface NutritionTrendData {
  dailyCalories: Array<{ date: string; calories: number }>;
  averageCalories: number;
  mealsPerDayAverage: number;
  topFoods: Array<{ name: string; count: number }>;
  hasData: boolean;
}

export interface ComplianceTrendData {
  dailyCompliance: Array<{ date: string; percentage: number }>;
  averageCompliance: number;
  bestDay: { date: string; percentage: number } | null;
  worstDay: { date: string; percentage: number } | null;
  hasData: boolean;
}

export interface WeightTrendData {
  entries: Array<{ date: string; weight: number }>;
  netChange: number;
  trendDirection: 'up' | 'down' | 'stable';
  hasData: boolean;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDatesInRange(days: TrendTimeRange): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates;
}

function topN<T extends string>(items: T[], n: number): Array<{ item: T; count: number }> {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item, count]) => ({ item, count }));
}

export async function calculateMoodTrend(days: TrendTimeRange): Promise<MoodTrendData> {
  const dates = getDatesInRange(days);
  const dailyScores: Array<{ date: string; score: number }> = [];
  const allEmotions: MoodEmotion[] = [];
  const allTriggers: MoodTrigger[] = [];

  const entries = await Promise.all(
    dates.map((date) => storageGet<MoodMentalEntry>(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, date)).then((e) => ({ date, entry: e }))),
  );

  for (const { date, entry } of entries) {
    if (entry) {
      dailyScores.push({ date, score: entry.overall_mood });
      allEmotions.push(...entry.emotions);
      allTriggers.push(...entry.triggers);
    }
  }

  const averageMood = dailyScores.length > 0
    ? Math.round((dailyScores.reduce((s, d) => s + d.score, 0) / dailyScores.length) * 10) / 10
    : 0;

  const topEmotionsRaw = topN(allEmotions, 3);
  const topTriggersRaw = topN(allTriggers, 3);

  return {
    dailyScores,
    averageMood,
    topEmotions: topEmotionsRaw.map((e) => ({ emotion: e.item, count: e.count })),
    topTriggers: topTriggersRaw.map((t) => ({ trigger: t.item, count: t.count })),
    hasData: dailyScores.length > 0,
  };
}

export async function calculateSleepTrend(days: TrendTimeRange): Promise<SleepTrendData> {
  const dates = getDatesInRange(days);
  const dailyDurations: Array<{ date: string; hours: number }> = [];
  const qualities: number[] = [];
  const allDisturbances: SleepDisturbance[] = [];

  const entries = await Promise.all(
    dates.map((date) => storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, date)).then((e) => ({ date, entry: e }))),
  );

  for (const { date, entry } of entries) {
    if (entry) {
      let hours = entry.total_duration_hours ?? null;
      if (hours == null && entry.bedtime && entry.wake_time) {
        const bed = new Date(entry.bedtime).getTime();
        const wake = new Date(entry.wake_time).getTime();
        if (wake > bed) {
          hours = (wake - bed) / (1000 * 60 * 60);
        }
      }
      if (hours != null) {
        dailyDurations.push({ date, hours: Math.round(hours * 10) / 10 });
      }
      if (entry.quality != null) qualities.push(entry.quality);
      if (entry.disturbances) allDisturbances.push(...entry.disturbances);
    }
  }

  const averageDuration = dailyDurations.length > 0
    ? Math.round((dailyDurations.reduce((s, d) => s + d.hours, 0) / dailyDurations.length) * 10) / 10
    : 0;

  const averageQuality = qualities.length > 0
    ? Math.round((qualities.reduce((s, q) => s + q, 0) / qualities.length) * 10) / 10
    : null;

  const topDisturbancesRaw = topN(allDisturbances, 3);

  return {
    dailyDurations,
    averageDuration,
    averageQuality,
    topDisturbances: topDisturbancesRaw.map((d) => ({ disturbance: d.item, count: d.count })),
    hasData: dailyDurations.length > 0,
  };
}

export async function calculateExerciseTrend(days: TrendTimeRange): Promise<ExerciseTrendData> {
  const dates = getDatesInRange(days);
  const dailyMinutes: Array<{ date: string; minutes: number }> = [];
  const allTypes: string[] = [];

  const entries = await Promise.all(
    dates.map((date) => storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, date)).then((e) => ({ date, entry: e }))),
  );

  for (const { date, entry } of entries) {
    if (entry && entry.length > 0) {
      const totalMin = entry.reduce((s, w) => s + (w.duration_minutes ?? 0), 0);
      dailyMinutes.push({ date, minutes: totalMin });
      for (const w of entry) {
        if (w.activity_name) allTypes.push(w.activity_name);
      }
    }
  }

  const totalMinutes = dailyMinutes.reduce((s, d) => s + d.minutes, 0);
  const typeBreakdown = topN(allTypes, 5);

  return {
    dailyMinutes,
    totalMinutes,
    workoutTypeBreakdown: typeBreakdown.map((t) => ({ type: t.item, count: t.count })),
    hasData: dailyMinutes.length > 0,
  };
}

export async function calculateNutritionTrend(days: TrendTimeRange): Promise<NutritionTrendData> {
  const dates = getDatesInRange(days);
  const dailyCalories: Array<{ date: string; calories: number }> = [];
  const allFoodNames: string[] = [];
  let totalMeals = 0;
  let daysWithData = 0;

  const entries = await Promise.all(
    dates.map((date) => storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, date)).then((e) => ({ date, entry: e }))),
  );

  for (const { date, entry } of entries) {
    if (entry && entry.length > 0) {
      const totalCal = entry.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0);
      dailyCalories.push({ date, calories: Math.round(totalCal) });
      totalMeals += entry.length;
      daysWithData++;
      for (const f of entry) {
        if (f.food_item?.name) allFoodNames.push(f.food_item.name);
      }
    }
  }

  const averageCalories = dailyCalories.length > 0
    ? Math.round(dailyCalories.reduce((s, d) => s + d.calories, 0) / dailyCalories.length)
    : 0;

  const mealsPerDayAverage = daysWithData > 0
    ? Math.round((totalMeals / daysWithData) * 10) / 10
    : 0;

  const topFoodsRaw = topN(allFoodNames, 5);

  return {
    dailyCalories,
    averageCalories,
    mealsPerDayAverage,
    topFoods: topFoodsRaw.map((f) => ({ name: f.item, count: f.count })),
    hasData: dailyCalories.length > 0,
  };
}

export async function calculateComplianceTrend(days: TrendTimeRange): Promise<ComplianceTrendData> {
  const dates = getDatesInRange(days);
  const dailyCompliance: Array<{ date: string; percentage: number }> = [];

  // Load compliance results in parallel
  const results = await Promise.all(
    dates.map((date) =>
      storageGet<ComplianceResult>(dateKey(STORAGE_KEYS.COMPLIANCE, date)).then((r) => ({ date, result: r })),
    ),
  );

  for (const { date, result } of results) {
    if (result && result.total > 0) {
      dailyCompliance.push({ date, percentage: result.percentage });
    }
  }

  const averageCompliance = dailyCompliance.length > 0
    ? Math.round((dailyCompliance.reduce((s, d) => s + d.percentage, 0) / dailyCompliance.length) * 10) / 10
    : 0;

  let bestDay: { date: string; percentage: number } | null = null;
  let worstDay: { date: string; percentage: number } | null = null;
  for (const d of dailyCompliance) {
    if (!bestDay || d.percentage > bestDay.percentage) bestDay = d;
    if (!worstDay || d.percentage < worstDay.percentage) worstDay = d;
  }

  return {
    dailyCompliance,
    averageCompliance,
    bestDay,
    worstDay,
    hasData: dailyCompliance.length > 0,
  };
}

export async function calculateWeightTrend(days: TrendTimeRange): Promise<WeightTrendData> {
  const dates = getDatesInRange(days);
  const entries: Array<{ date: string; weight: number }> = [];

  // Check both BodyEntry and BodyMeasurementEntry
  const results = await Promise.all(
    dates.map((date) =>
      Promise.all([
        storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, date)),
        storageGet<BodyMeasurementEntry>(dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, date)),
      ]).then(([body, bm]) => ({ date, body, bm })),
    ),
  );

  for (const { date, body, bm } of results) {
    const weight = body?.weight_lbs ?? (bm?.weight != null && bm.weight_unit === 'lbs' ? bm.weight : null);
    if (weight != null) {
      entries.push({ date, weight });
    }
  }

  if (entries.length < 2) {
    return {
      entries,
      netChange: 0,
      trendDirection: 'stable',
      hasData: entries.length > 0,
    };
  }

  const netChange = Math.round((entries[entries.length - 1].weight - entries[0].weight) * 10) / 10;

  let trendDirection: 'up' | 'down' | 'stable';
  if (netChange > 0.5) trendDirection = 'up';
  else if (netChange < -0.5) trendDirection = 'down';
  else trendDirection = 'stable';

  return { entries, netChange, trendDirection, hasData: true };
}
