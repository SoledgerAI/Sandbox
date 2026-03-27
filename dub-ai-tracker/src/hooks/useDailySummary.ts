// Compute daily summary from stored logs
// Phase 5: Dashboard Layout

import { useState, useEffect, useCallback } from 'react';
import { storageGet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { calculateBmr, calculateTdee, calculateCalorieTarget, computeAge } from '../utils/calories';
import type { UserProfile, StreakData, EngagementTier } from '../types/profile';
import type { DailySummary, FoodEntry, WaterEntry, CaffeineEntry } from '../types';

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
  streak: StreakData;
  enabledTags: string[];
  tagOrder: string[];
  tier: EngagementTier | null;
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

  const load = useCallback(async () => {
    try {
      const today = todayDateString();

      const [p, t, tags, order, streakData, foodEntries, waterEntries, caffeineEntries] =
        await Promise.all([
          storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE),
          storageGet<EngagementTier>(STORAGE_KEYS.TIER),
          storageGet<string[]>(STORAGE_KEYS.TAGS_ENABLED),
          storageGet<string[]>(STORAGE_KEYS.TAGS_ORDER),
          storageGet<StreakData>(STORAGE_KEYS.STREAKS),
          storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, today)),
          storageGet<WaterEntry[]>(dateKey(STORAGE_KEYS.LOG_WATER, today)),
          storageGet<CaffeineEntry[]>(dateKey(STORAGE_KEYS.LOG_CAFFEINE, today)),
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

      if (
        p?.weight_lbs != null &&
        p?.height_inches != null &&
        p?.dob != null &&
        p?.sex != null &&
        p?.activity_level != null
      ) {
        const age = computeAge(p.dob);
        const weightKg = p.weight_lbs / 2.20462;
        const heightCm = p.height_inches * 2.54;

        computedBmr = calculateBmr({
          weightKg,
          heightCm,
          ageYears: age,
          sex: p.sex,
        });
        computedTdee = calculateTdee(computedBmr, p.activity_level);
        computedTarget = calculateCalorieTarget({
          tdee: computedTdee,
          goalDirection: p.goal?.direction ?? 'MAINTAIN',
          sex: p.sex,
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

      const caloriesBurned = 0; // Will be computed from workout logs in later phases
      const caloriesNet = caloriesConsumed - caloriesBurned;
      const caloriesRemaining = computedTarget - caloriesNet;

      setSummary({
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
        active_minutes: 0,
        sleep_hours: null,
        sleep_quality: null,
        mood_avg: null,
        weight_lbs: p?.weight_lbs ?? null,
        tags_logged: [],
        recovery_score: null,
      });
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
    streak,
    enabledTags,
    tagOrder,
    tier,
    refresh: load,
  };
}
