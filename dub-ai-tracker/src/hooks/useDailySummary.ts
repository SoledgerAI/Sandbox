// Compute daily summary from stored logs
// Phase 5: Dashboard Layout

import { useState, useEffect, useCallback } from 'react';
import { storageGet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { calculateBmr, calculateTdee, calculateCalorieTarget, computeAge, lbsToKg, inchesToCm } from '../utils/calories';
import { computeDailyScore, DailyScoreBreakdown } from '../utils/dailyScore';
import type { UserProfile, StreakData, EngagementTier } from '../types/profile';
import type { DailySummary, FoodEntry, WaterEntry, CaffeineEntry } from '../types';
import type { WorkoutEntry } from '../types/workout';

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getGreetingTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

interface DailySummaryResult {
  loading: boolean;
  greeting: string;
  dateDisplay: string;
  summary: DailySummary;
  bmr: number;
  tdee: number;
  calorieTarget: number;
  profileComplete: boolean;
  streak: StreakData;
  enabledTags: string[];
  tagOrder: string[];
  tier: EngagementTier | null;
  dailyScore: DailyScoreBreakdown;
  refresh: () => Promise<void>;
}

const DEFAULT_STREAK: StreakData = {
  current_streak: 0,
  longest_streak: 0,
  total_days_logged: 0,
  last_logged_date: null,
};

const DEFAULT_SUMMARY: DailySummary = {
  date: todayDateString(),
  calories_consumed: 0,
  calories_burned: 0,
  calories_net: 0,
  calories_remaining: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  sugar_g: 0,
  water_oz: 0,
  caffeine_mg: 0,
  steps: 0,
  active_minutes: 0,
  sleep_hours: null,
  sleep_quality: null,
  mood_avg: null,
  weight_lbs: null,
  glucose_avg_mg_dl: null,
  bp_systolic_avg: null,
  bp_diastolic_avg: null,
  tags_logged: [],
  recovery_score: null,
};

export function useDailySummary(): DailySummaryResult {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [tier, setTier] = useState<EngagementTier | null>(null);
  const [enabledTags, setEnabledTags] = useState<string[]>([]);
  const [tagOrder, setTagOrder] = useState<string[]>([]);
  const [streak, setStreak] = useState<StreakData>(DEFAULT_STREAK);
  const [summary, setSummary] = useState<DailySummary>(DEFAULT_SUMMARY);
  const [bmr, setBmr] = useState(0);
  const [tdee, setTdee] = useState(0);
  const [calorieTarget, setCalorieTarget] = useState(0);
  const [profileComplete, setProfileComplete] = useState(false);
  const [dailyScore, setDailyScore] = useState<DailyScoreBreakdown>({
    total: 0, calorieAccuracy: 0, macroAccuracy: 0, tagCompletion: 0,
    consistency: 0, trendAlignment: 0, loggingConsistency: 0,
    weeklyTrend: 0, weightStability: 0, caloricTdeeAlignment: 0,
  });

  const load = useCallback(async () => {
    try {
      const today = todayDateString();

      const [p, t, tags, order, streakData, foodEntries, waterEntries, caffeineEntries, workoutEntries] =
        await Promise.all([
          storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE),
          storageGet<EngagementTier>(STORAGE_KEYS.TIER),
          storageGet<string[]>(STORAGE_KEYS.TAGS_ENABLED),
          storageGet<string[]>(STORAGE_KEYS.TAGS_ORDER),
          storageGet<StreakData>(STORAGE_KEYS.STREAKS),
          storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, today)),
          storageGet<WaterEntry[]>(dateKey(STORAGE_KEYS.LOG_WATER, today)),
          storageGet<CaffeineEntry[]>(dateKey(STORAGE_KEYS.LOG_CAFFEINE, today)),
          storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, today)),
        ]);

      setProfile(p);
      setTier(t);
      setEnabledTags(tags ?? []);
      setTagOrder(order ?? tags ?? []);
      setStreak(streakData ?? DEFAULT_STREAK);

      // Compute BMR/TDEE from profile
      let computedBmr = 0;
      let computedTdee = 0;
      let computedTarget = 0;
      const hasRequiredFields =
        p?.weight_lbs != null &&
        p?.height_inches != null &&
        p?.dob != null &&
        p?.sex != null;

      setProfileComplete(hasRequiredFields);

      if (hasRequiredFields) {
        const age = computeAge(p.dob!);
        const weightKg = lbsToKg(p.weight_lbs!);
        const heightCm = inchesToCm(p.height_inches!);

        computedBmr = calculateBmr({
          weightKg,
          heightCm,
          ageYears: age,
          sex: p.sex!,
        });
        // Default to lightly_active (1.375) when activity level not set
        const activityLevel = p.activity_level ?? 'lightly_active';
        computedTdee = calculateTdee(computedBmr, activityLevel);
        computedTarget = calculateCalorieTarget({
          tdee: computedTdee,
          goalDirection: p.goal?.direction ?? 'MAINTAIN',
          sex: p.sex!,
          rateLbsPerWeek: p.goal?.rate_lbs_per_week ?? undefined,
          surplusCalories: p.goal?.surplus_calories ?? undefined,
        });
      }

      setBmr(computedBmr);
      setTdee(computedTdee);
      setCalorieTarget(computedTarget);

      // Aggregate today's log data
      const foods = foodEntries ?? [];
      const waters = waterEntries ?? [];
      const caffeines = caffeineEntries ?? [];

      const caloriesConsumed = foods.reduce(
        (sum, f) => sum + (f.computed_nutrition?.calories ?? 0),
        0,
      );
      const proteinG = foods.reduce(
        (sum, f) => sum + (f.computed_nutrition?.protein_g ?? 0),
        0,
      );
      const carbsG = foods.reduce(
        (sum, f) => sum + (f.computed_nutrition?.carbs_g ?? 0),
        0,
      );
      const fatG = foods.reduce(
        (sum, f) => sum + (f.computed_nutrition?.fat_g ?? 0),
        0,
      );
      const fiberG = foods.reduce(
        (sum, f) => sum + (f.computed_nutrition?.fiber_g ?? 0),
        0,
      );
      const sugarG = foods.reduce(
        (sum, f) => sum + (f.computed_nutrition?.sugar_g ?? 0),
        0,
      );
      const waterOz = waters.reduce((sum, w) => sum + w.amount_oz, 0);
      const caffeineMg = caffeines.reduce((sum, c) => sum + c.amount_mg, 0);

      const caloriesBurned = (workoutEntries ?? []).reduce(
        (sum, w) => sum + (w.calories_burned ?? 0),
        0,
      );
      const caloriesNet = caloriesConsumed - caloriesBurned;
      const caloriesRemaining = computedTarget - caloriesConsumed + caloriesBurned;

      // Count tags logged today: check which enabled tags have data
      const tagLogKeys = (tags ?? []).map((tagId: string) => {
        const logKeyMap: Record<string, string> = {
          'nutrition.food': STORAGE_KEYS.LOG_FOOD,
          'hydration.water': STORAGE_KEYS.LOG_WATER,
          'fitness.workout': STORAGE_KEYS.LOG_WORKOUT,
          'strength.training': STORAGE_KEYS.LOG_STRENGTH,
          'body.measurements': STORAGE_KEYS.LOG_BODY,
          'sleep.tracking': STORAGE_KEYS.LOG_SLEEP,
          'recovery.score': STORAGE_KEYS.RECOVERY,
          'supplements.daily': STORAGE_KEYS.LOG_SUPPLEMENTS,
          'health.markers': STORAGE_KEYS.LOG_BLOODWORK,
          'mental.wellness': STORAGE_KEYS.LOG_MOOD,
          'substances.tracking': STORAGE_KEYS.LOG_SUBSTANCES,
          'sexual.activity': STORAGE_KEYS.LOG_SEXUAL,
          'digestive.health': STORAGE_KEYS.LOG_DIGESTIVE,
          'personal.care': STORAGE_KEYS.LOG_PERSONALCARE,
          'womens.health': STORAGE_KEYS.LOG_CYCLE,
          'injury.pain': STORAGE_KEYS.LOG_INJURY,
          'custom.tag': STORAGE_KEYS.LOG_CUSTOM,
        };
        return { tagId, storageKey: logKeyMap[tagId] };
      });

      let tagsLoggedCount = 0;
      // Food and water already loaded, count them directly
      if (foods.length > 0) tagsLoggedCount++;
      if (waters.length > 0) tagsLoggedCount++;
      if ((workoutEntries ?? []).length > 0) tagsLoggedCount++;
      // For other tags, quick-check via storage
      for (const { tagId, storageKey } of tagLogKeys) {
        if (!storageKey) continue;
        if (tagId === 'nutrition.food' || tagId === 'hydration.water' || tagId === 'fitness.workout') continue;
        const val = await storageGet(dateKey(storageKey, today));
        if (val != null && (Array.isArray(val) ? val.length > 0 : true)) {
          tagsLoggedCount++;
        }
      }

      // Consistency: count days in last 7 that have any food log
      let daysLoggedLast7 = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayFood = await storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, ds));
        if (dayFood && dayFood.length > 0) daysLoggedLast7++;
      }

      // 5-day calorie average for trend alignment
      let fiveDayCalAvg: number | null = null;
      {
        const cals: number[] = [];
        for (let i = 1; i <= 5; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const dayFood = await storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, ds));
          if (dayFood && dayFood.length > 0) {
            cals.push(dayFood.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0));
          }
        }
        if (cals.length >= 3) {
          fiveDayCalAvg = cals.reduce((a, b) => a + b, 0) / cals.length;
        }
      }

      // Macro targets (approximate from calorie target using standard splits)
      const proteinTarget = computedTarget > 0 ? computedTarget * 0.3 / 4 : 0;
      const carbsTarget = computedTarget > 0 ? computedTarget * 0.4 / 4 : 0;
      const fatTarget = computedTarget > 0 ? computedTarget * 0.3 / 9 : 0;

      const todaySummary: DailySummary = {
        date: today,
        calories_consumed: caloriesConsumed,
        calories_burned: caloriesBurned,
        calories_net: caloriesNet,
        calories_remaining: caloriesRemaining,
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
        fiber_g: fiberG,
        sugar_g: sugarG,
        water_oz: waterOz,
        caffeine_mg: caffeineMg,
        steps: 0,
        active_minutes: (workoutEntries ?? []).reduce((sum, w) => sum + (w.duration_minutes ?? 0), 0),
        sleep_hours: null,
        sleep_quality: null,
        mood_avg: null,
        weight_lbs: p?.weight_lbs ?? null,
        glucose_avg_mg_dl: null,
        bp_systolic_avg: null,
        bp_diastolic_avg: null,
        tags_logged: [],
        recovery_score: null,
      };

      setSummary(todaySummary);

      // MASTER-48: Compute multi-factor daily score
      const score = computeDailyScore(t, {
        summary: todaySummary,
        calorieTarget: computedTarget,
        tdee: computedTdee,
        proteinTarget,
        carbsTarget,
        fatTarget,
        enabledTagCount: (tags ?? []).length,
        tagsLoggedToday: tagsLoggedCount,
        daysLoggedLast7,
        fiveDayCalorieAvg: fiveDayCalAvg,
        currentWeight: p?.weight_lbs ?? null,
        goalWeight: p?.goal?.target_weight ?? null,
      });
      setDailyScore(score);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const name = profile?.name ?? 'there';
  const greeting = `Good ${getGreetingTimeOfDay()}, ${name}`;

  const now = new Date();
  const dateDisplay = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return {
    loading,
    greeting,
    dateDisplay,
    summary,
    bmr,
    tdee,
    calorieTarget,
    profileComplete,
    streak,
    enabledTags,
    tagOrder,
    tier,
    dailyScore,
    refresh: load,
  };
}
