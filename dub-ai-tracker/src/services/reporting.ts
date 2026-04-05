// Report generation service for all cadences
// Phase 21: Reporting, Health Report PDF, and Celebrations

import {
  storageGet,
  storageSet,
  storageList,
  dateKey,
  STORAGE_KEYS,
} from '../utils/storage';
import type {
  DailySummary,
  WeeklySummary,
  WaterEntry,
  SleepEntry,
  MoodEntry,
  BodyEntry,
} from '../types';
import type { UserProfile } from '../types/profile';
import { calculateBmr, calculateTdee, calculateCalorieTarget, computeAge, lbsToKg, inchesToCm } from '../utils/calories';

// ============================================================
// Types
// ============================================================

export interface MonthlySummary {
  month: string; // YYYY-MM
  start_date: string;
  end_date: string;
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
  avg_recovery: number | null;
  start_weight: number | null;
  end_weight: number | null;
  weight_change: number | null;
  workout_count: number;
  days_logged: number;
  adherence_pct: number;
  pr_count: number;
}

export interface QuarterlyReport {
  quarter: string; // e.g. "2026-Q1"
  start_date: string;
  end_date: string;
  monthly_summaries: MonthlySummary[];
  overall_weight_change: number | null;
  avg_adherence_pct: number;
  total_workouts: number;
  avg_recovery: number | null;
  trend_direction: 'improving' | 'stable' | 'declining';
}

export interface AnnualReport {
  year: string;
  start_date: string;
  end_date: string;
  quarterly_reports: QuarterlyReport[];
  total_days_logged: number;
  total_workouts: number;
  overall_weight_change: number | null;
  avg_adherence_pct: number;
  best_week: string | null;
  worst_week: string | null;
  pr_count: number;
}

export type ReportCadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'yoy';

// ============================================================
// Date Helpers
// ============================================================

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekNumber(d: Date): string {
  const tempDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tempDate.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function getDaysInRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ============================================================
// Daily Summary Generation
// ============================================================

/**
 * Generate and store a daily summary for the given date.
 * Aggregates data from all log keys for that date.
 */
export async function generateDailySummary(dateStr: string): Promise<DailySummary> {
  // Check for cached summary
  const existingKey = dateKey(STORAGE_KEYS.DAILY_SUMMARY, dateStr);
  const existing = await storageGet<DailySummary>(existingKey);
  if (existing) return existing;

  // Gather data from log keys
  const foodEntries = await storageGet<Array<{ calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sugar_g: number }>>(dateKey(STORAGE_KEYS.LOG_FOOD, dateStr));
  const waterEntries = await storageGet<WaterEntry[]>(dateKey(STORAGE_KEYS.LOG_WATER, dateStr));
  const sleepEntry = await storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, dateStr));
  const moodEntries = await storageGet<MoodEntry[]>(dateKey(STORAGE_KEYS.LOG_MOOD, dateStr));
  const bodyEntry = await storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, dateStr));
  const workoutEntries = await storageGet<Array<{ calories_burned: number; duration_minutes: number }>>(dateKey(STORAGE_KEYS.LOG_WORKOUT, dateStr));
  const recoveryEntry = await storageGet<{ total_score: number }>(dateKey(STORAGE_KEYS.RECOVERY, dateStr));
  const glucoseEntries = await storageGet<Array<{ reading_mg_dl: number }>>(dateKey(STORAGE_KEYS.LOG_GLUCOSE, dateStr));
  const bpEntries = await storageGet<Array<{ systolic: number; diastolic: number }>>(dateKey(STORAGE_KEYS.LOG_BP, dateStr));

  // Calculate food totals
  const foods = foodEntries ?? [];
  const totalCals = foods.reduce((sum, f) => sum + (f.calories ?? 0), 0);
  const totalProtein = foods.reduce((sum, f) => sum + (f.protein_g ?? 0), 0);
  const totalCarbs = foods.reduce((sum, f) => sum + (f.carbs_g ?? 0), 0);
  const totalFat = foods.reduce((sum, f) => sum + (f.fat_g ?? 0), 0);
  const totalFiber = foods.reduce((sum, f) => sum + (f.fiber_g ?? 0), 0);
  const totalSugar = foods.reduce((sum, f) => sum + (f.sugar_g ?? 0), 0);

  // Calculate workout calories
  const workoutCals = (workoutEntries ?? []).reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
  const totalBurned = workoutCals;
  const activeMin = (workoutEntries ?? []).reduce((sum, w) => sum + (w.duration_minutes ?? 0), 0);

  // Water
  const totalWater = (waterEntries ?? []).reduce((sum, w) => sum + (w.amount_oz ?? 0), 0);

  // Sleep
  let sleepHours: number | null = null;
  if (sleepEntry?.bedtime && sleepEntry?.wake_time) {
    const bed = new Date(sleepEntry.bedtime);
    const wake = new Date(sleepEntry.wake_time);
    sleepHours = Math.round(((wake.getTime() - bed.getTime()) / 3600000) * 10) / 10;
  }

  // Mood averages (3-axis: mood, energy, anxiety)
  let moodAvg: number | null = null;
  let energyAvg: number | null = null;
  let anxietyAvg: number | null = null;
  if (moodEntries && moodEntries.length > 0) {
    moodAvg = Math.round((moodEntries.reduce((s, m) => s + m.score, 0) / moodEntries.length) * 10) / 10;
    const withEnergy = moodEntries.filter((m) => m.energy != null);
    if (withEnergy.length > 0) {
      energyAvg = Math.round((withEnergy.reduce((s, m) => s + m.energy!, 0) / withEnergy.length) * 10) / 10;
    }
    const withAnxiety = moodEntries.filter((m) => m.anxiety != null);
    if (withAnxiety.length > 0) {
      anxietyAvg = Math.round((withAnxiety.reduce((s, m) => s + m.anxiety!, 0) / withAnxiety.length) * 10) / 10;
    }
  }

  // Determine which tags were logged
  const tagsLogged: string[] = [];
  if (foods.length > 0) tagsLogged.push('nutrition.food');
  if (waterEntries && waterEntries.length > 0) tagsLogged.push('hydration.water');
  if (workoutEntries && workoutEntries.length > 0) tagsLogged.push('fitness.workout');
  if (bodyEntry) tagsLogged.push('body.measurements');
  if (sleepEntry) tagsLogged.push('sleep.tracking');
  if (moodEntries && moodEntries.length > 0) tagsLogged.push('mental.wellness');

  // Compute calorie target from profile; fall back to 2000 if data is incomplete
  const profile = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
  let calorieTarget = 2000;
  if (
    profile?.weight_lbs != null &&
    profile?.height_inches != null &&
    profile?.dob != null &&
    profile?.sex != null &&
    profile?.activity_level != null
  ) {
    const age = computeAge(profile.dob);
    const bmr = calculateBmr({
      weightKg: lbsToKg(profile.weight_lbs),
      heightCm: inchesToCm(profile.height_inches),
      ageYears: age,
      sex: profile.sex,
    });
    const tdee = calculateTdee(bmr, profile.activity_level);
    calorieTarget = calculateCalorieTarget({
      tdee,
      goalDirection: profile.goal?.direction ?? 'MAINTAIN',
      sex: profile.sex,
      rateLbsPerWeek: profile.goal?.rate_lbs_per_week ?? undefined,
      surplusCalories: profile.goal?.surplus_calories ?? undefined,
    });
  }

  const summary: DailySummary = {
    date: dateStr,
    calories_consumed: totalCals,
    calories_burned: totalBurned,
    calories_net: totalCals - totalBurned,
    calories_remaining: Math.max(0, calorieTarget - totalCals),
    protein_g: totalProtein,
    carbs_g: totalCarbs,
    fat_g: totalFat,
    fiber_g: totalFiber,
    sugar_g: totalSugar,
    water_oz: totalWater,
    caffeine_mg: 0, // Aggregated separately if caffeine entries exist
    steps: 0, // From device integrations
    active_minutes: activeMin,
    sleep_hours: sleepHours,
    sleep_quality: sleepEntry?.quality ?? null,
    mood_avg: moodAvg,
    energy_avg: energyAvg,
    anxiety_avg: anxietyAvg,
    weight_lbs: bodyEntry?.weight_lbs ?? null,
    glucose_avg_mg_dl: glucoseEntries && glucoseEntries.length > 0
      ? Math.round(glucoseEntries.reduce((s, g) => s + g.reading_mg_dl, 0) / glucoseEntries.length)
      : null,
    bp_systolic_avg: bpEntries && bpEntries.length > 0
      ? Math.round(bpEntries.reduce((s, b) => s + b.systolic, 0) / bpEntries.length)
      : null,
    bp_diastolic_avg: bpEntries && bpEntries.length > 0
      ? Math.round(bpEntries.reduce((s, b) => s + b.diastolic, 0) / bpEntries.length)
      : null,
    tags_logged: tagsLogged,
    recovery_score: recoveryEntry?.total_score ?? null,
  };

  // Store the summary
  await storageSet(existingKey, summary);
  return summary;
}

// ============================================================
// Weekly Summary Generation
// ============================================================

/**
 * Generate and store a weekly summary.
 * Aggregates 7 days of daily summaries into averages and totals.
 */
export async function generateWeeklySummary(
  weekStartDate: Date,
): Promise<WeeklySummary> {
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekStr = getWeekNumber(weekStartDate);
  const existingKey = dateKey(STORAGE_KEYS.WEEKLY_SUMMARY, weekStr);
  const existing = await storageGet<WeeklySummary>(existingKey);
  if (existing) return existing;

  const dates = getDaysInRange(weekStartDate, weekEnd);
  const dailySummaries: DailySummary[] = [];

  for (const dateStr of dates) {
    const summary = await generateDailySummary(dateStr);
    if (summary.tags_logged.length > 0) {
      dailySummaries.push(summary);
    }
  }

  const n = dailySummaries.length || 1;
  const weights = dailySummaries.filter((d) => d.weight_lbs !== null).map((d) => d.weight_lbs!);
  const sleeps = dailySummaries.filter((d) => d.sleep_hours !== null).map((d) => d.sleep_hours!);
  const moods = dailySummaries.filter((d) => d.mood_avg !== null).map((d) => d.mood_avg!);
  const energies = dailySummaries.filter((d) => d.energy_avg !== null).map((d) => d.energy_avg!);
  const anxieties = dailySummaries.filter((d) => d.anxiety_avg !== null).map((d) => d.anxiety_avg!);
  const workoutDays = dailySummaries.filter(
    (d) => d.tags_logged.includes('fitness.workout') || d.tags_logged.includes('strength.training'),
  ).length;

  const summary: WeeklySummary = {
    week: weekStr,
    start_date: formatDate(weekStartDate),
    end_date: formatDate(weekEnd),
    avg_calories_consumed: Math.round(dailySummaries.reduce((s, d) => s + d.calories_consumed, 0) / n),
    avg_calories_burned: Math.round(dailySummaries.reduce((s, d) => s + d.calories_burned, 0) / n),
    avg_protein_g: Math.round(dailySummaries.reduce((s, d) => s + d.protein_g, 0) / n),
    avg_carbs_g: Math.round(dailySummaries.reduce((s, d) => s + d.carbs_g, 0) / n),
    avg_fat_g: Math.round(dailySummaries.reduce((s, d) => s + d.fat_g, 0) / n),
    avg_water_oz: Math.round(dailySummaries.reduce((s, d) => s + d.water_oz, 0) / n),
    avg_sleep_hours: sleeps.length > 0 ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10 : null,
    avg_mood: moods.length > 0 ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
    avg_energy: energies.length > 0 ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10 : null,
    avg_anxiety: anxieties.length > 0 ? Math.round((anxieties.reduce((a, b) => a + b, 0) / anxieties.length) * 10) / 10 : null,
    avg_weight: weights.length > 0 ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10 : null,
    weight_change: weights.length >= 2 ? Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10 : null,
    workout_count: workoutDays,
    days_logged: dailySummaries.length,
    adherence_pct: Math.round((dailySummaries.length / 7) * 100),
  };

  await storageSet(existingKey, summary);
  return summary;
}

// ============================================================
// Monthly Summary Generation
// ============================================================

/**
 * Generate and store a monthly summary.
 * CRITICAL: Stores aggregated statistics only, NOT full daily data arrays.
 */
export async function generateMonthlySummary(
  year: number,
  month: number,
): Promise<MonthlySummary> {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const existingKey = dateKey(STORAGE_KEYS.MONTHLY_SUMMARY, monthStr);
  const existing = await storageGet<MonthlySummary>(existingKey);
  if (existing) return existing;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // last day of month
  const dates = getDaysInRange(startDate, endDate);

  const dailySummaries: DailySummary[] = [];
  for (const dateStr of dates) {
    const key = dateKey(STORAGE_KEYS.DAILY_SUMMARY, dateStr);
    const summary = await storageGet<DailySummary>(key);
    if (summary && summary.tags_logged.length > 0) {
      dailySummaries.push(summary);
    }
  }

  const n = dailySummaries.length || 1;
  const weights = dailySummaries.filter((d) => d.weight_lbs !== null).map((d) => d.weight_lbs!);
  const sleeps = dailySummaries.filter((d) => d.sleep_hours !== null).map((d) => d.sleep_hours!);
  const moods = dailySummaries.filter((d) => d.mood_avg !== null).map((d) => d.mood_avg!);
  const mEnergies = dailySummaries.filter((d) => d.energy_avg !== null).map((d) => d.energy_avg!);
  const mAnxieties = dailySummaries.filter((d) => d.anxiety_avg !== null).map((d) => d.anxiety_avg!);
  const recoveries = dailySummaries.filter((d) => d.recovery_score !== null).map((d) => d.recovery_score!);
  const workoutDays = dailySummaries.filter(
    (d) => d.tags_logged.includes('fitness.workout') || d.tags_logged.includes('strength.training'),
  ).length;

  const summary: MonthlySummary = {
    month: monthStr,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    avg_calories_consumed: Math.round(dailySummaries.reduce((s, d) => s + d.calories_consumed, 0) / n),
    avg_calories_burned: Math.round(dailySummaries.reduce((s, d) => s + d.calories_burned, 0) / n),
    avg_protein_g: Math.round(dailySummaries.reduce((s, d) => s + d.protein_g, 0) / n),
    avg_carbs_g: Math.round(dailySummaries.reduce((s, d) => s + d.carbs_g, 0) / n),
    avg_fat_g: Math.round(dailySummaries.reduce((s, d) => s + d.fat_g, 0) / n),
    avg_water_oz: Math.round(dailySummaries.reduce((s, d) => s + d.water_oz, 0) / n),
    avg_sleep_hours: sleeps.length > 0 ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10 : null,
    avg_mood: moods.length > 0 ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
    avg_energy: mEnergies.length > 0 ? Math.round((mEnergies.reduce((a, b) => a + b, 0) / mEnergies.length) * 10) / 10 : null,
    avg_anxiety: mAnxieties.length > 0 ? Math.round((mAnxieties.reduce((a, b) => a + b, 0) / mAnxieties.length) * 10) / 10 : null,
    avg_recovery: recoveries.length > 0 ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length) : null,
    start_weight: weights.length > 0 ? weights[0] : null,
    end_weight: weights.length > 0 ? weights[weights.length - 1] : null,
    weight_change: weights.length >= 2 ? Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10 : null,
    workout_count: workoutDays,
    days_logged: dailySummaries.length,
    adherence_pct: Math.round((dailySummaries.length / dates.length) * 100),
    pr_count: 0, // Counted from strength logs in a real implementation
  };

  await storageSet(existingKey, summary);
  return summary;
}

// ============================================================
// Quarterly Report Generation
// ============================================================

export async function generateQuarterlyReport(
  year: number,
  quarter: number,
): Promise<QuarterlyReport> {
  const startMonth = (quarter - 1) * 3 + 1;
  const months = [startMonth, startMonth + 1, startMonth + 2];
  const monthlySummaries: MonthlySummary[] = [];

  for (const m of months) {
    const summary = await generateMonthlySummary(year, m);
    monthlySummaries.push(summary);
  }

  const startDate = new Date(year, startMonth - 1, 1);
  const endDate = new Date(year, startMonth + 2, 0);

  const totalWorkouts = monthlySummaries.reduce((s, m) => s + m.workout_count, 0);
  const adherences = monthlySummaries.map((m) => m.adherence_pct);
  const avgAdherence = Math.round(adherences.reduce((a, b) => a + b, 0) / adherences.length);

  const weights = monthlySummaries.filter((m) => m.start_weight !== null || m.end_weight !== null);
  const firstWeight = weights.length > 0 ? weights[0].start_weight : null;
  const lastWeight = weights.length > 0 ? weights[weights.length - 1].end_weight : null;

  const recoveries = monthlySummaries.filter((m) => m.avg_recovery !== null).map((m) => m.avg_recovery!);

  // Determine trend from adherence trajectory
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (adherences.length >= 2) {
    const diff = adherences[adherences.length - 1] - adherences[0];
    if (diff > 5) trend = 'improving';
    else if (diff < -5) trend = 'declining';
  }

  return {
    quarter: `${year}-Q${quarter}`,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    monthly_summaries: monthlySummaries,
    overall_weight_change: firstWeight !== null && lastWeight !== null
      ? Math.round((lastWeight - firstWeight) * 10) / 10
      : null,
    avg_adherence_pct: avgAdherence,
    total_workouts: totalWorkouts,
    avg_recovery: recoveries.length > 0 ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length) : null,
    trend_direction: trend,
  };
}

// ============================================================
// Semi-Annual Report
// ============================================================

export async function generateSemiAnnualReport(
  year: number,
  half: 1 | 2,
): Promise<{ half: string; quarterly_reports: QuarterlyReport[] }> {
  const q1 = half === 1 ? 1 : 3;
  const q2 = half === 1 ? 2 : 4;

  const [report1, report2] = await Promise.all([
    generateQuarterlyReport(year, q1),
    generateQuarterlyReport(year, q2),
  ]);

  return {
    half: `${year}-H${half}`,
    quarterly_reports: [report1, report2],
  };
}

// ============================================================
// Annual Report
// ============================================================

export async function generateAnnualReport(year: number): Promise<AnnualReport> {
  const quarterlyReports: QuarterlyReport[] = [];
  for (let q = 1; q <= 4; q++) {
    quarterlyReports.push(await generateQuarterlyReport(year, q));
  }

  const allMonthly = quarterlyReports.flatMap((q) => q.monthly_summaries);
  const totalDays = allMonthly.reduce((s, m) => s + m.days_logged, 0);
  const totalWorkouts = allMonthly.reduce((s, m) => s + m.workout_count, 0);
  const totalPRs = allMonthly.reduce((s, m) => s + m.pr_count, 0);
  const adherences = allMonthly.map((m) => m.adherence_pct);
  const avgAdherence = adherences.length > 0
    ? Math.round(adherences.reduce((a, b) => a + b, 0) / adherences.length)
    : 0;

  // Weight change across year
  const weights = allMonthly.filter((m) => m.start_weight !== null || m.end_weight !== null);
  const firstWeight = weights.length > 0 ? weights[0].start_weight : null;
  const lastWeight = weights.length > 0 ? weights[weights.length - 1].end_weight : null;

  // Find best/worst weeks by adherence
  const weekKeys = await storageList(STORAGE_KEYS.WEEKLY_SUMMARY + '.');
  const yearPrefix = `${STORAGE_KEYS.WEEKLY_SUMMARY}.${year}-`;
  const yearWeekKeys = weekKeys.filter((k) => k.startsWith(yearPrefix));

  let bestWeek: string | null = null;
  let worstWeek: string | null = null;
  let bestAdherence = -1;
  let worstAdherence = 101;

  for (const wk of yearWeekKeys) {
    const ws = await storageGet<WeeklySummary>(wk);
    if (ws) {
      if (ws.adherence_pct > bestAdherence) {
        bestAdherence = ws.adherence_pct;
        bestWeek = ws.week;
      }
      if (ws.adherence_pct < worstAdherence) {
        worstAdherence = ws.adherence_pct;
        worstWeek = ws.week;
      }
    }
  }

  return {
    year: String(year),
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    quarterly_reports: quarterlyReports,
    total_days_logged: totalDays,
    total_workouts: totalWorkouts,
    overall_weight_change: firstWeight !== null && lastWeight !== null
      ? Math.round((lastWeight - firstWeight) * 10) / 10
      : null,
    avg_adherence_pct: avgAdherence,
    best_week: bestWeek,
    worst_week: worstWeek,
    pr_count: totalPRs,
  };
}

// ============================================================
// Year-over-Year Comparison
// ============================================================

export interface YoYComparison {
  current_year: string;
  previous_year: string;
  metrics: Array<{
    label: string;
    current: number | null;
    previous: number | null;
    change_pct: number | null;
  }>;
}

export async function generateYoYComparison(
  currentYear: number,
): Promise<YoYComparison | null> {
  const previousYear = currentYear - 1;

  // Check if previous year data exists
  const prevKeys = await storageList(`${STORAGE_KEYS.MONTHLY_SUMMARY}.${previousYear}-`);
  if (prevKeys.length === 0) return null;

  const [current, previous] = await Promise.all([
    generateAnnualReport(currentYear),
    generateAnnualReport(previousYear),
  ]);

  const calcChange = (cur: number | null, prev: number | null): number | null => {
    if (cur === null || prev === null || prev === 0) return null;
    return Math.round(((cur - prev) / Math.abs(prev)) * 100);
  };

  return {
    current_year: String(currentYear),
    previous_year: String(previousYear),
    metrics: [
      {
        label: 'Days Logged',
        current: current.total_days_logged,
        previous: previous.total_days_logged,
        change_pct: calcChange(current.total_days_logged, previous.total_days_logged),
      },
      {
        label: 'Total Workouts',
        current: current.total_workouts,
        previous: previous.total_workouts,
        change_pct: calcChange(current.total_workouts, previous.total_workouts),
      },
      {
        label: 'Adherence %',
        current: current.avg_adherence_pct,
        previous: previous.avg_adherence_pct,
        change_pct: calcChange(current.avg_adherence_pct, previous.avg_adherence_pct),
      },
      {
        label: 'Weight Change (lbs)',
        current: current.overall_weight_change,
        previous: previous.overall_weight_change,
        change_pct: null, // Not meaningful as percentage
      },
      {
        label: 'Personal Records',
        current: current.pr_count,
        previous: previous.pr_count,
        change_pct: calcChange(current.pr_count, previous.pr_count),
      },
    ],
  };
}

// ============================================================
// Report Schedule Checker
// ============================================================

/**
 * Check which reports are due based on current date and onboarding date.
 * Called from notification triggers to determine what to generate.
 */
export async function checkDueReports(): Promise<ReportCadence[]> {
  const now = new Date();
  const due: ReportCadence[] = [];

  // Daily is always due (for yesterday)
  due.push('daily');

  // Weekly: check day of week against user preference
  const settings = await storageGet<{ weekly_report_day?: 'sunday' | 'monday' }>('dub.settings');
  const weeklyDay = settings?.weekly_report_day ?? 'sunday';
  const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday
  if ((weeklyDay === 'sunday' && dayOfWeek === 0) || (weeklyDay === 'monday' && dayOfWeek === 1)) {
    due.push('weekly');
  }

  // Monthly: 1st of month
  if (now.getDate() === 1) {
    due.push('monthly');
  }

  // Quarterly, semi-annual, annual: based on onboarding date
  const onboardingDateStr = await storageGet<string>(STORAGE_KEYS.ONBOARDING_DATE);
  if (onboardingDateStr) {
    const onboardingDate = new Date(onboardingDateStr);
    const daysSinceOnboarding = Math.floor(
      (now.getTime() - onboardingDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceOnboarding > 0 && daysSinceOnboarding % 90 === 0) {
      due.push('quarterly');
    }
    if (daysSinceOnboarding > 0 && daysSinceOnboarding % 180 === 0) {
      due.push('semi_annual');
    }
    if (daysSinceOnboarding > 0 && daysSinceOnboarding % 365 === 0) {
      due.push('annual');
    }

    // YoY available after 365+ days
    if (daysSinceOnboarding >= 365 && now.getDate() === 1 && now.getMonth() === 0) {
      due.push('yoy');
    }
  }

  return due;
}
