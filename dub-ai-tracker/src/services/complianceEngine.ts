// Sprint 18: Daily Compliance Engine
// Calculates daily goal compliance based on user-defined goals

import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { calculateCalorieTarget, calculateBmr, calculateTdee, computeAge, lbsToKg, inchesToCm } from '../utils/calories';
import { todayDateString } from '../utils/dayBoundary';
import type { UserProfile, EngagementTier } from '../types/profile';
import type {
  ComplianceResult,
  ComplianceItem,
  DailyGoalId,
  FoodEntry,
  WaterEntry,
  BodyEntry,
  SleepEntry,
  SupplementEntry,
  HabitEntry,
  BodyweightRepEntry,
  AllergyLogEntry,
  MeditationEntry,
  SocialConnectionEntry,
  SunlightEntry,
  MobilityEntry,
  JournalEntry,
  BreastfeedingEntry,
  PerimenopauseEntry,
} from '../types';
import { isCategoryEnabled } from '../utils/categoryElection';
import {
  ALL_DAILY_GOALS as GOAL_DEFS,
  DEFAULT_DAILY_GOALS as DEFAULT_GOALS,
  NON_HYDRATING_BEVERAGES,
} from '../types';
import type { WorkoutEntry, StepsEntry } from '../types/workout';
import { calculateSleepAdherence } from '../utils/sleepAdherence';

/**
 * Load the user's enabled daily goals. Falls back to defaults if not set.
 */
export async function getEnabledGoals(): Promise<DailyGoalId[]> {
  const stored = await storageGet<DailyGoalId[]>(STORAGE_KEYS.SETTINGS_DAILY_GOALS);
  return stored ?? DEFAULT_GOALS;
}

/**
 * Save the user's enabled daily goals.
 */
export async function setEnabledGoals(goals: DailyGoalId[]): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS_DAILY_GOALS, goals);
}

/**
 * Calculate daily compliance for a given date.
 * Checks each enabled goal against stored log data.
 */
export async function calculateDailyCompliance(date: string): Promise<ComplianceResult> {
  const enabledGoals = await getEnabledGoals();

  if (enabledGoals.length === 0) {
    return { completed: 0, total: 0, percentage: 0, items: [] };
  }

  // Load profile for calorie/protein targets and water goal
  const [profile, tier] = await Promise.all([
    storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
    storageGet<EngagementTier>(STORAGE_KEYS.TIER),
  ]);

  // Pre-compute calorie and protein targets
  let calorieTarget = 0;
  let proteinTarget = 0;
  let waterGoalOz = 64; // default

  if (profile?.weight_lbs && profile?.height_inches && profile?.dob && profile?.sex && profile?.activity_level) {
    const age = computeAge(profile.dob);
    const weightKg = lbsToKg(profile.weight_lbs);
    const heightCm = inchesToCm(profile.height_inches);
    const bmr = calculateBmr({ weightKg, heightCm, ageYears: age, sex: profile.sex!, metabolicProfile: profile.metabolic_profile });
    const rawTdee = calculateTdee(bmr, profile.activity_level);
    const tdee = profile.custom_tdee ? profile.custom_tdee : Math.round(rawTdee * 0.95);
    calorieTarget = calculateCalorieTarget({
      tdee,
      goalDirection: profile.goal?.direction ?? 'MAINTAIN',
      sex: profile.sex!,
      rateLbsPerWeek: profile.goal?.rate_lbs_per_week ?? undefined,
      surplusCalories: profile.goal?.surplus_calories ?? undefined,
    });
    proteinTarget = calorieTarget > 0 ? Math.round(calorieTarget * 0.3 / 4) : 0;
  }

  if (profile?.weight_lbs) {
    waterGoalOz = Math.round(profile.weight_lbs / 2);
  }

  // Load all data needed for compliance checks in parallel
  const [
    foodEntries,
    waterEntries,
    workoutEntries,
    bodyEntry,
    sleepEntry,
    supplementEntries,
    habitEntries,
    repEntries,
    allergyEntry,
    stepsEntry,
    selectedSupplements,
    meditationEntries,
    socialEntries,
    sunlightEntries,
    mobilityEntries,
    journalEntries,
    breastfeedingEntries,
    perimenopauseEntry,
  ] = await Promise.all([
    storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, date)),
    storageGet<WaterEntry[]>(dateKey(STORAGE_KEYS.LOG_WATER, date)),
    storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, date)),
    storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, date)),
    storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, date)),
    storageGet<SupplementEntry[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, date)),
    storageGet<HabitEntry[]>(dateKey(STORAGE_KEYS.LOG_HABITS, date)),
    storageGet<BodyweightRepEntry[]>(dateKey(STORAGE_KEYS.LOG_REPS, date)),
    storageGet<AllergyLogEntry>(dateKey(STORAGE_KEYS.LOG_ALLERGIES, date)),
    storageGet<StepsEntry>(dateKey(STORAGE_KEYS.LOG_STEPS, date)),
    storageGet<string[]>(STORAGE_KEYS.MY_SUPPLEMENTS),
    storageGet<MeditationEntry[]>(dateKey(STORAGE_KEYS.LOG_MEDITATION, date)),
    storageGet<SocialConnectionEntry[]>(dateKey(STORAGE_KEYS.LOG_SOCIAL, date)),
    storageGet<SunlightEntry[]>(dateKey(STORAGE_KEYS.LOG_SUNLIGHT, date)),
    storageGet<MobilityEntry[]>(dateKey(STORAGE_KEYS.LOG_MOBILITY, date)),
    storageGet<JournalEntry[]>(dateKey(STORAGE_KEYS.LOG_JOURNAL, date)),
    storageGet<BreastfeedingEntry[]>(dateKey(STORAGE_KEYS.LOG_BREASTFEEDING, date)),
    storageGet<PerimenopauseEntry>(dateKey(STORAGE_KEYS.LOG_PERIMENOPAUSE, date)),
  ]);

  const foods = foodEntries ?? [];
  const waters = waterEntries ?? [];
  const workouts = workoutEntries ?? [];
  const supplements = supplementEntries ?? [];
  const habits = habitEntries ?? [];
  const reps = repEntries ?? [];

  const items: ComplianceItem[] = [];

  for (const goalId of enabledGoals) {
    const goalDef = GOAL_DEFS.find((g) => g.id === goalId);
    if (!goalDef) continue;

    const item: ComplianceItem = {
      id: goalId,
      label: goalDef.label,
      completed: false,
    };

    switch (goalId) {
      case 'log_food': {
        item.completed = foods.length > 0;
        item.detail = foods.length > 0 ? `${foods.length} entries` : 'No food logged';
        break;
      }
      case 'hit_calorie_target': {
        if (calorieTarget <= 0) {
          item.completed = false;
          item.detail = 'No calorie target set';
        } else {
          const totalCal = foods.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0);
          const pct = totalCal / calorieTarget;
          item.completed = pct >= 0.9 && pct <= 1.1;
          item.detail = `${Math.round(totalCal)} / ${Math.round(calorieTarget)} cal`;
        }
        break;
      }
      case 'hit_protein_target': {
        if (proteinTarget <= 0) {
          item.completed = false;
          item.detail = 'No protein target set';
        } else {
          const totalProtein = foods.reduce((s, f) => s + (f.computed_nutrition?.protein_g ?? 0), 0);
          const pct = totalProtein / proteinTarget;
          item.completed = pct >= 0.9 && pct <= 1.1;
          item.detail = `${Math.round(totalProtein)} / ${proteinTarget}g`;
        }
        break;
      }
      case 'log_water': {
        const hydratingOz = waters
          .filter((w) => !w.beverage || !NON_HYDRATING_BEVERAGES.includes(w.beverage))
          .reduce((s, w) => s + w.amount_oz, 0);
        item.completed = hydratingOz >= waterGoalOz;
        item.detail = `${Math.round(hydratingOz)} / ${waterGoalOz} oz`;
        break;
      }
      case 'exercise': {
        item.completed = workouts.length > 0;
        item.detail = workouts.length > 0
          ? workouts.map((w) => w.activity_name).join(', ')
          : 'No workout logged';
        break;
      }
      case 'pushups': {
        const pushupReps = reps.filter((r) => r.exercise_type === 'pushups');
        const totalReps = pushupReps.reduce((s, r) => s + r.reps, 0);
        item.completed = totalReps > 0;
        item.detail = totalReps > 0 ? `${totalReps} reps` : 'None logged';
        break;
      }
      case 'pullups': {
        const pullupReps = reps.filter((r) => r.exercise_type === 'pullups');
        const totalReps = pullupReps.reduce((s, r) => s + r.reps, 0);
        item.completed = totalReps > 0;
        item.detail = totalReps > 0 ? `${totalReps} reps` : 'None logged';
        break;
      }
      case 'situps': {
        const situpReps = reps.filter((r) => r.exercise_type === 'situps');
        const totalReps = situpReps.reduce((s, r) => s + r.reps, 0);
        item.completed = totalReps > 0;
        item.detail = totalReps > 0 ? `${totalReps} reps` : 'None logged';
        break;
      }
      case 'log_weight': {
        item.completed = bodyEntry?.weight_lbs != null;
        item.detail = bodyEntry?.weight_lbs != null
          ? `${bodyEntry.weight_lbs} lbs`
          : 'Not logged';
        break;
      }
      case 'log_sleep': {
        item.completed = sleepEntry != null;
        item.detail = sleepEntry?.bedtime && sleepEntry?.wake_time
          ? 'Logged'
          : sleepEntry ? 'Partial' : 'Not logged';
        break;
      }
      case 'take_supplements': {
        // Check if all scheduled (selected) supplements have been taken
        const scheduled = selectedSupplements ?? [];
        if (scheduled.length === 0) {
          item.completed = supplements.length > 0 && supplements.every((s) => s.taken);
          item.detail = supplements.length > 0
            ? `${supplements.filter((s) => s.taken).length}/${supplements.length} taken`
            : 'No supplements scheduled';
        } else {
          const takenNames = supplements.filter((s) => s.taken).map((s) => s.name.toLowerCase());
          const allTaken = scheduled.every((name) => takenNames.includes(name.toLowerCase()));
          item.completed = allTaken && scheduled.length > 0;
          item.detail = `${takenNames.length}/${scheduled.length} taken`;
        }
        break;
      }
      case 'complete_habits': {
        if (habits.length === 0) {
          item.completed = false;
          item.detail = 'No habits defined';
        } else {
          const completedCount = habits.filter((h) => h.completed).length;
          item.completed = completedCount === habits.length;
          item.detail = `${completedCount}/${habits.length} completed`;
        }
        break;
      }
      case 'log_allergy_status': {
        item.completed = allergyEntry != null;
        item.detail = allergyEntry
          ? `Severity: ${allergyEntry.severity}`
          : 'Not logged';
        break;
      }
      case 'steps_goal': {
        const steps = stepsEntry?.total_steps ?? 0;
        const stepsGoal = 10000; // Default step goal
        item.completed = steps >= stepsGoal;
        item.detail = `${steps.toLocaleString()} / ${stepsGoal.toLocaleString()} steps`;
        break;
      }
      case 'meditate': {
        const meds = meditationEntries ?? [];
        // Handle both old single-object and new array format
        const medArray = Array.isArray(meds) ? meds : (meds ? [meds] : []);
        item.completed = medArray.length > 0;
        if (medArray.length > 0) {
          const totalMin = medArray.reduce((s: number, m: MeditationEntry) => s + m.duration_minutes, 0);
          item.detail = `${totalMin} min (${medArray.length} session${medArray.length > 1 ? 's' : ''})`;
        } else {
          item.detail = 'No session logged';
        }
        break;
      }
      case 'social_connection': {
        const socials = socialEntries ?? [];
        item.completed = socials.length > 0;
        item.detail = socials.length > 0
          ? `${socials.length} connection${socials.length > 1 ? 's' : ''}`
          : 'No connection logged';
        break;
      }
      case 'sunlight': {
        const suns = sunlightEntries ?? [];
        const totalSunMin = suns.reduce((s, e) => s + e.duration_minutes, 0);
        item.completed = totalSunMin >= 15;
        item.detail = totalSunMin > 0 ? `${totalSunMin} min outdoors` : 'No outdoor time';
        break;
      }
      case 'mobility': {
        const mobs = mobilityEntries ?? [];
        item.completed = mobs.length > 0;
        if (mobs.length > 0) {
          const totalMobMin = mobs.reduce((s, e) => s + e.duration_minutes, 0);
          item.detail = `${totalMobMin} min (${mobs.length} session${mobs.length > 1 ? 's' : ''})`;
        } else {
          item.detail = 'No session logged';
        }
        break;
      }
      case 'journal': {
        const journals = journalEntries ?? [];
        item.completed = journals.length > 0;
        item.detail = journals.length > 0
          ? `${journals.length} entr${journals.length > 1 ? 'ies' : 'y'}`
          : 'Not journaled';
        break;
      }
      case 'sleep_adherence': {
        if (sleepEntry?.bedtime || sleepEntry?.wake_time) {
          const adh = await calculateSleepAdherence(sleepEntry?.bedtime ?? null, sleepEntry?.wake_time ?? null);
          if (adh) {
            item.completed = adh.overallScore >= 75;
            item.detail = `${adh.overallScore}% adherence`;
          } else {
            item.completed = false;
            item.detail = 'No schedule set';
          }
        } else {
          item.completed = false;
          item.detail = 'No sleep logged';
        }
        break;
      }
      case 'breastfeeding_logged': {
        // Only evaluate if category is enabled; skip silently if not
        const bfEnabled = await isCategoryEnabled('breastfeeding');
        if (!bfEnabled) continue; // skip this goal entirely
        const bfSessions = breastfeedingEntries ?? [];
        item.completed = bfSessions.length > 0;
        item.detail = bfSessions.length > 0
          ? `${bfSessions.length} session${bfSessions.length > 1 ? 's' : ''}`
          : 'No session logged';
        break;
      }
      case 'perimenopause_logged': {
        const periEnabled = await isCategoryEnabled('perimenopause');
        if (!periEnabled) continue;
        item.completed = perimenopauseEntry != null;
        item.detail = perimenopauseEntry ? 'Entry completed' : 'Not logged';
        break;
      }
    }

    items.push(item);
  }

  const completedCount = items.filter((i) => i.completed).length;
  const total = items.length;
  const percentage = total > 0 ? Math.round((completedCount / total) * 10000) / 100 : 0;

  return {
    completed: completedCount,
    total,
    percentage,
    items,
  };
}

/**
 * Calculate and cache daily compliance for a given date.
 * Returns cached result if available, recalculates otherwise.
 */
export async function getCachedCompliance(date: string): Promise<ComplianceResult> {
  const cacheKey = dateKey(STORAGE_KEYS.COMPLIANCE, date);
  const cached = await storageGet<ComplianceResult>(cacheKey);
  if (cached) return cached;

  const result = await calculateDailyCompliance(date);
  await storageSet(cacheKey, result);
  return result;
}

/**
 * Force recalculate compliance for a given date (ignores cache).
 */
export async function refreshCompliance(date: string): Promise<ComplianceResult> {
  const result = await calculateDailyCompliance(date);
  const cacheKey = dateKey(STORAGE_KEYS.COMPLIANCE, date);
  await storageSet(cacheKey, result);
  return result;
}

/**
 * Get compliance for multiple dates (for trend charts).
 * Uses cached values where available.
 */
export async function getComplianceRange(
  startDate: string,
  endDate: string,
): Promise<Array<{ date: string; percentage: number }>> {
  const results: Array<{ date: string; percentage: number }> = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const today = todayDateString();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cacheKey = dateKey(STORAGE_KEYS.COMPLIANCE, dateStr);
    const cached = await storageGet<ComplianceResult>(cacheKey);

    if (cached) {
      results.push({ date: dateStr, percentage: cached.percentage });
    } else if (dateStr <= today) {
      // Only calculate for past/current dates
      const result = await calculateDailyCompliance(dateStr);
      await storageSet(cacheKey, result);
      results.push({ date: dateStr, percentage: result.percentage });
    }
  }

  return results;
}

/**
 * Get compliance trend: improving, declining, or stable.
 * Compares current 7-day average vs prior 7-day average.
 */
export async function getComplianceTrend(): Promise<{
  current7dAvg: number;
  prior7dAvg: number;
  trend: 'improving' | 'declining' | 'stable';
  delta: number;
}> {
  const today = new Date();

  // Current 7 days
  const currentScores: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cached = await storageGet<ComplianceResult>(dateKey(STORAGE_KEYS.COMPLIANCE, dateStr));
    if (cached && cached.total > 0) {
      currentScores.push(cached.percentage);
    }
  }

  // Prior 7 days (days 7-13 ago)
  const priorScores: number[] = [];
  for (let i = 7; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cached = await storageGet<ComplianceResult>(dateKey(STORAGE_KEYS.COMPLIANCE, dateStr));
    if (cached && cached.total > 0) {
      priorScores.push(cached.percentage);
    }
  }

  const current7dAvg = currentScores.length > 0
    ? Math.round(currentScores.reduce((s, v) => s + v, 0) / currentScores.length * 100) / 100
    : 0;
  const prior7dAvg = priorScores.length > 0
    ? Math.round(priorScores.reduce((s, v) => s + v, 0) / priorScores.length * 100) / 100
    : 0;
  const delta = Math.round((current7dAvg - prior7dAvg) * 100) / 100;

  let trend: 'improving' | 'declining' | 'stable';
  if (delta > 3) trend = 'improving';
  else if (delta < -3) trend = 'declining';
  else trend = 'stable';

  return { current7dAvg, prior7dAvg, trend, delta };
}
