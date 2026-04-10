// Hook to load trend data from pre-computed summary keys
// Phase 16: Trends and Charts
// CRITICAL: Reads from dub.daily.summary.*, dub.weekly.summary.*, dub.monthly.summary.*
// NEVER from raw dub.log.* keys per Chart Performance Strategy.

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageList, dateKey, STORAGE_KEYS } from '../utils/storage';
import type { DailySummary, WeeklySummary, ComplianceResult } from '../types';
import type { TimeRange, ChartDataPoint } from '../components/charts/types';

// Monthly summary mirrors weekly but at month granularity
interface MonthlySummary {
  month: string; // YYYY-MM
  avg_calories_consumed: number;
  avg_calories_burned: number;
  avg_protein_g: number;
  avg_carbs_g: number;
  avg_fat_g: number;
  avg_water_oz: number;
  avg_sleep_hours: number | null;
  avg_mood: number | null;
  avg_energy: number | null;
  avg_anxiety: number | null;
  avg_weight: number | null;
  workout_count: number;
  days_logged: number;
}

export interface TrendDataSet {
  calories: ChartDataPoint[];
  protein: ChartDataPoint[];
  carbs: ChartDataPoint[];
  fat: ChartDataPoint[];
  caloriesBurned: ChartDataPoint[];
  water: ChartDataPoint[];
  caffeine: ChartDataPoint[];
  steps: ChartDataPoint[];
  activeMinutes: ChartDataPoint[];
  sleepHours: ChartDataPoint[];
  sleepQuality: ChartDataPoint[];
  mood: ChartDataPoint[];
  energy: ChartDataPoint[];
  anxiety: ChartDataPoint[];
  weight: ChartDataPoint[];
  recovery: ChartDataPoint[];
  workoutCount: ChartDataPoint[];
  glucose: ChartDataPoint[];
  bpSystolic: ChartDataPoint[];
  compliance: ChartDataPoint[];
  // Year-over-year data (same fields, last year's period)
  yoyCalories: ChartDataPoint[];
  yoyWeight: ChartDataPoint[];
  yoySleep: ChartDataPoint[];
  yoyMood: ChartDataPoint[];
  hasYoYData: boolean;
}

const EMPTY_DATASET: TrendDataSet = {
  calories: [], protein: [], carbs: [], fat: [],
  caloriesBurned: [], water: [], caffeine: [], steps: [],
  activeMinutes: [], sleepHours: [], sleepQuality: [],
  mood: [], energy: [], anxiety: [], weight: [], recovery: [], workoutCount: [], glucose: [], bpSystolic: [], compliance: [],
  yoyCalories: [], yoyWeight: [], yoySleep: [], yoyMood: [],
  hasYoYData: false,
};

function shortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
}

function shortWeek(weekStr: string): string {
  // weekStr might be the start_date of the week
  return shortDate(weekStr);
}

function shortMonth(monthStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = monthStr.split('-');
  const mi = parseInt(parts[1], 10) - 1;
  return months[mi] ?? monthStr;
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function dailyToChartPoint(s: DailySummary, field: keyof DailySummary): ChartDataPoint | null {
  const val = s[field];
  if (val == null) return null;
  return { label: shortDate(s.date), value: val as number, date: s.date };
}

function weeklyToChartPoint(s: WeeklySummary, field: keyof WeeklySummary): ChartDataPoint | null {
  const val = s[field];
  if (val == null) return null;
  return { label: shortWeek(s.start_date), value: val as number, date: s.start_date };
}

function monthlyToChartPoint(s: MonthlySummary, field: keyof MonthlySummary): ChartDataPoint | null {
  const val = s[field];
  if (val == null) return null;
  return { label: shortMonth(s.month), value: val as number, date: s.month };
}

export function useTrendsData(timeRange: TimeRange, _enabledTags: string[]) {
  const [data, setData] = useState<TrendDataSet>(EMPTY_DATASET);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (timeRange === '7d' || timeRange === '30d') {
        await loadDailyData(timeRange, setData);
      } else if (timeRange === '90d' || timeRange === '6mo' || timeRange === '1yr') {
        await loadWeeklyData(timeRange, setData);
      } else {
        await loadMonthlyData(setData);
      }
    } catch {
      setError('Unable to load trends. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, reload: loadData };
}

async function loadDailyData(
  range: '7d' | '30d',
  setData: (d: TrendDataSet) => void,
) {
  const days = range === '7d' ? 7 : 30;
  const cutoff = getDaysAgo(days);
  const yoyCutoff = getDaysAgo(days + 365);
  const yoyEnd = getDaysAgo(365);

  const keys = await storageList(STORAGE_KEYS.DAILY_SUMMARY + '.');
  const sorted = keys.sort();

  const result: TrendDataSet = { ...EMPTY_DATASET };
  const yoyDailies: DailySummary[] = [];

  for (const key of sorted) {
    const date = key.replace(STORAGE_KEYS.DAILY_SUMMARY + '.', '');
    const summary = await storageGet<DailySummary>(key);
    if (!summary) continue;

    if (date >= cutoff) {
      pushIfNotNull(result.calories, dailyToChartPoint(summary, 'calories_consumed'));
      pushIfNotNull(result.protein, dailyToChartPoint(summary, 'protein_g'));
      pushIfNotNull(result.carbs, dailyToChartPoint(summary, 'carbs_g'));
      pushIfNotNull(result.fat, dailyToChartPoint(summary, 'fat_g'));
      pushIfNotNull(result.caloriesBurned, dailyToChartPoint(summary, 'calories_burned'));
      pushIfNotNull(result.water, dailyToChartPoint(summary, 'water_oz'));
      pushIfNotNull(result.caffeine, dailyToChartPoint(summary, 'caffeine_mg'));
      pushIfNotNull(result.steps, dailyToChartPoint(summary, 'steps'));
      pushIfNotNull(result.activeMinutes, dailyToChartPoint(summary, 'active_minutes'));
      pushIfNotNull(result.sleepHours, dailyToChartPoint(summary, 'sleep_hours'));
      pushIfNotNull(result.sleepQuality, dailyToChartPoint(summary, 'sleep_quality'));
      pushIfNotNull(result.mood, dailyToChartPoint(summary, 'mood_avg'));
      pushIfNotNull(result.energy, dailyToChartPoint(summary, 'energy_avg'));
      pushIfNotNull(result.anxiety, dailyToChartPoint(summary, 'anxiety_avg'));
      pushIfNotNull(result.weight, dailyToChartPoint(summary, 'weight_lbs'));
      pushIfNotNull(result.recovery, dailyToChartPoint(summary, 'recovery_score'));
      pushIfNotNull(result.glucose, dailyToChartPoint(summary, 'glucose_avg_mg_dl'));
      pushIfNotNull(result.bpSystolic, dailyToChartPoint(summary, 'bp_systolic_avg'));

      // Load compliance score for this date
      const complianceData = await storageGet<ComplianceResult>(dateKey(STORAGE_KEYS.COMPLIANCE, date));
      if (complianceData && complianceData.total > 0) {
        result.compliance.push({
          label: shortDate(date),
          value: complianceData.percentage,
          date,
        });
      }
    }

    // Collect YoY data
    if (date >= yoyCutoff && date < yoyEnd) {
      yoyDailies.push(summary);
    }
  }

  if (yoyDailies.length > 0) {
    result.hasYoYData = true;
    for (const s of yoyDailies) {
      pushIfNotNull(result.yoyCalories, dailyToChartPoint(s, 'calories_consumed'));
      pushIfNotNull(result.yoyWeight, dailyToChartPoint(s, 'weight_lbs'));
      pushIfNotNull(result.yoySleep, dailyToChartPoint(s, 'sleep_hours'));
      pushIfNotNull(result.yoyMood, dailyToChartPoint(s, 'mood_avg'));
    }
  }

  setData(result);
}

async function loadWeeklyData(
  range: '90d' | '6mo' | '1yr',
  setData: (d: TrendDataSet) => void,
) {
  const keys = await storageList(STORAGE_KEYS.WEEKLY_SUMMARY + '.');
  const sorted = keys.sort();

  const weeksBack = range === '90d' ? 13 : range === '6mo' ? 26 : 52;
  const cutoffDate = getDaysAgo(weeksBack * 7);
  const yoyCutoff = getDaysAgo(weeksBack * 7 + 365);
  const yoyEnd = getDaysAgo(365);

  const result: TrendDataSet = { ...EMPTY_DATASET };
  const yoyWeeklies: WeeklySummary[] = [];

  for (const key of sorted) {
    const summary = await storageGet<WeeklySummary>(key);
    if (!summary) continue;

    if (summary.start_date >= cutoffDate) {
      pushIfNotNull(result.calories, weeklyToChartPoint(summary, 'avg_calories_consumed'));
      pushIfNotNull(result.protein, weeklyToChartPoint(summary, 'avg_protein_g'));
      pushIfNotNull(result.carbs, weeklyToChartPoint(summary, 'avg_carbs_g'));
      pushIfNotNull(result.fat, weeklyToChartPoint(summary, 'avg_fat_g'));
      pushIfNotNull(result.caloriesBurned, weeklyToChartPoint(summary, 'avg_calories_burned'));
      pushIfNotNull(result.water, weeklyToChartPoint(summary, 'avg_water_oz'));
      pushIfNotNull(result.sleepHours, weeklyToChartPoint(summary, 'avg_sleep_hours'));
      pushIfNotNull(result.mood, weeklyToChartPoint(summary, 'avg_mood'));
      pushIfNotNull(result.energy, weeklyToChartPoint(summary, 'avg_energy'));
      pushIfNotNull(result.anxiety, weeklyToChartPoint(summary, 'avg_anxiety'));
      pushIfNotNull(result.weight, weeklyToChartPoint(summary, 'avg_weight'));
      if (summary.workout_count != null) {
        result.workoutCount.push({
          label: shortWeek(summary.start_date),
          value: summary.workout_count,
          date: summary.start_date,
        });
      }
    }

    if (summary.start_date >= yoyCutoff && summary.start_date < yoyEnd) {
      yoyWeeklies.push(summary);
    }
  }

  if (yoyWeeklies.length > 0) {
    result.hasYoYData = true;
    for (const s of yoyWeeklies) {
      pushIfNotNull(result.yoyCalories, weeklyToChartPoint(s, 'avg_calories_consumed'));
      pushIfNotNull(result.yoyWeight, weeklyToChartPoint(s, 'avg_weight'));
      pushIfNotNull(result.yoySleep, weeklyToChartPoint(s, 'avg_sleep_hours'));
      pushIfNotNull(result.yoyMood, weeklyToChartPoint(s, 'avg_mood'));
    }
  }

  setData(result);
}

async function loadMonthlyData(
  setData: (d: TrendDataSet) => void,
) {
  const keys = await storageList(STORAGE_KEYS.MONTHLY_SUMMARY + '.');
  const sorted = keys.sort();

  const result: TrendDataSet = { ...EMPTY_DATASET };

  for (const key of sorted) {
    const summary = await storageGet<MonthlySummary>(key);
    if (!summary) continue;

    pushIfNotNull(result.calories, monthlyToChartPoint(summary, 'avg_calories_consumed'));
    pushIfNotNull(result.protein, monthlyToChartPoint(summary, 'avg_protein_g'));
    pushIfNotNull(result.carbs, monthlyToChartPoint(summary, 'avg_carbs_g'));
    pushIfNotNull(result.fat, monthlyToChartPoint(summary, 'avg_fat_g'));
    pushIfNotNull(result.caloriesBurned, monthlyToChartPoint(summary, 'avg_calories_burned'));
    pushIfNotNull(result.water, monthlyToChartPoint(summary, 'avg_water_oz'));
    pushIfNotNull(result.sleepHours, monthlyToChartPoint(summary, 'avg_sleep_hours'));
    pushIfNotNull(result.mood, monthlyToChartPoint(summary, 'avg_mood'));
    pushIfNotNull(result.energy, monthlyToChartPoint(summary, 'avg_energy'));
    pushIfNotNull(result.anxiety, monthlyToChartPoint(summary, 'avg_anxiety'));
    pushIfNotNull(result.weight, monthlyToChartPoint(summary, 'avg_weight'));
    if (summary.workout_count != null) {
      result.workoutCount.push({
        label: shortMonth(summary.month),
        value: summary.workout_count,
        date: summary.month,
      });
    }
  }

  setData(result);
}

function pushIfNotNull(arr: ChartDataPoint[], point: ChartDataPoint | null) {
  if (point != null) arr.push(point);
}
