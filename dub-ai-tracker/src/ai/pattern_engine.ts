// Proactive pattern recognition engine
// Phase 14: AI Coach
// Phase 19: Ingredient frequency detection
// Runs on app open and end-of-day

import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { groupComparison, spearmanCorrelation } from './correlation';
import type { PatternInsight } from '../types/coach';
import type {
  FoodEntry,
  WaterEntry,
  SleepEntry,
  MoodEntry,
  BodyEntry,
  SubstanceEntry,
  WorkoutEntry,
} from '../types';

import type { UserProfile } from '../types/profile';
import { CALORIE_FLOOR_FEMALE, CALORIE_FLOOR_MALE, ED_SUSTAINED_LOW_DAYS } from '../constants/formulas';

const MAX_NEW_PATTERNS_PER_WEEK = 3;

function pastDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface DayData {
  date: string;
  calories: number;
  protein: number;
  water_oz: number;
  sleep_hours: number | null;
  sleep_quality: number | null;
  mood: number | null;
  weight: number | null;
  had_workout: boolean;
  workout_early: boolean; // before 10am
  workout_calories_burned: number;
  workout_duration_min: number;
  alcohol_drinks: number;
  substance_count: number;
}

async function loadDayData(date: string): Promise<DayData | null> {
  const [foods, waters, sleep, moods, body, substances, workouts] = await Promise.all([
    storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, date)),
    storageGet<WaterEntry[]>(dateKey(STORAGE_KEYS.LOG_WATER, date)),
    storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, date)),
    storageGet<MoodEntry[]>(dateKey(STORAGE_KEYS.LOG_MOOD, date)),
    storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, date)),
    storageGet<SubstanceEntry[]>(dateKey(STORAGE_KEYS.LOG_SUBSTANCES, date)),
    storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, date)),
  ]);

  const foodArr = foods ?? [];
  const waterArr = waters ?? [];
  const moodArr = moods ?? [];
  const substanceArr = substances ?? [];
  const workoutArr = workouts ?? [];

  let sleepHours: number | null = null;
  if (sleep?.bedtime && sleep?.wake_time) {
    const h = (new Date(sleep.wake_time).getTime() - new Date(sleep.bedtime).getTime()) / 3600000;
    if (h > 0 && h < 24) sleepHours = h;
  }

  const hasWorkout = workoutArr.length > 0;
  const workoutEarly = workoutArr.some((w) => {
    const hour = new Date(w.timestamp).getHours();
    return hour < 10;
  });

  const alcoholDrinks = substanceArr
    .filter((s) => s.substance === 'alcohol')
    .reduce((sum, s) => sum + s.amount, 0);

  const workoutCalsBurned = workoutArr.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
  const workoutDurationMin = workoutArr.reduce((s, w) => s + (w.duration_minutes ?? 0), 0);

  return {
    date,
    calories: foodArr.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0),
    protein: foodArr.reduce((s, f) => s + (f.computed_nutrition?.protein_g ?? 0), 0),
    water_oz: waterArr.reduce((s, w) => s + w.amount_oz, 0),
    sleep_hours: sleepHours,
    sleep_quality: sleep?.quality ?? null,
    mood: moodArr.length > 0 ? moodArr.reduce((s, m) => s + m.score, 0) / moodArr.length : null,
    weight: body?.weight_lbs ?? null,
    had_workout: hasWorkout,
    workout_early: workoutEarly,
    workout_calories_burned: workoutCalsBurned,
    workout_duration_min: workoutDurationMin,
    alcohol_drinks: alcoholDrinks,
    substance_count: substanceArr.length,
  };
}

function confidenceLabel(sampleSize: number): string {
  if (sampleSize >= 60) return 'Strong pattern (60+ days):';
  if (sampleSize >= 30) return 'Established pattern (30+ days):';
  return 'Early pattern (14 days of data):';
}

// MASTER-86: Tier label now set per-pattern based on actual method used,
// not just sample size. This function is kept for backward compat in
// patterns that don't override their tier label.
function statisticalTier(sampleSize: number): string {
  if (sampleSize >= 30) return 'Tier 3 (correlation)';
  if (sampleSize >= 14) return 'Tier 2 (rolling average)';
  return 'Tier 1 (threshold counting)';
}

export async function runPatternEngine(): Promise<PatternInsight[]> {
  // Load up to 60 days of data
  const days: DayData[] = [];
  for (let i = 0; i < 60; i++) {
    const date = pastDateString(i);
    const data = await loadDayData(date);
    if (data) days.push(data);
  }

  if (days.length < 7) return [];

  const existingPatterns = (await storageGet<PatternInsight[]>(STORAGE_KEYS.COACH_PATTERNS)) ?? [];
  const newPatterns: PatternInsight[] = [];

  // Pattern 1: Hydration-mood (14+ data points)
  // MASTER-25: Use tertile approach instead of arbitrary 64/32 thresholds.
  // Use Spearman correlation when 30+ data points available.
  const hydrationMoodDays = days.filter((d) => d.water_oz > 0 && d.mood != null);
  if (hydrationMoodDays.length >= 14) {
    if (hydrationMoodDays.length >= 30) {
      // Tier 3: Spearman correlation for continuous variables
      const { rho, significant } = spearmanCorrelation(
        hydrationMoodDays.map((d) => d.water_oz),
        hydrationMoodDays.map((d) => d.mood!),
      );
      if (significant) {
        const direction = rho > 0 ? 'higher' : 'lower';
        newPatterns.push({
          id: generateId(),
          category: 'hydration-mood',
          observation: `Your mood correlates with ${direction} water intake (rho=${rho.toFixed(2)}, ${hydrationMoodDays.length} days of data)`,
          data_range: `${hydrationMoodDays[hydrationMoodDays.length - 1].date} to ${hydrationMoodDays[0].date}`,
          sample_size: hydrationMoodDays.length,
          correlation_note: `${confidenceLabel(hydrationMoodDays.length)} Tier 3 (correlation)`,
          detected_at: new Date().toISOString(),
        });
      }
    } else {
      // Tier 2: Tertile group comparison (no arbitrary thresholds)
      const sorted = [...hydrationMoodDays].sort((a, b) => a.water_oz - b.water_oz);
      const third = Math.floor(sorted.length / 3);
      const lowTertile = sorted.slice(0, third);
      const highTertile = sorted.slice(sorted.length - third);

      if (lowTertile.length >= 3 && highTertile.length >= 3) {
        const comp = groupComparison(
          highTertile.map((d) => d.mood!),
          lowTertile.map((d) => d.mood!),
        );
        // MASTER-87: Use scale-aware threshold for bounded mood scale (1-5)
        const moodRange = 4; // 5 - 1
        if (comp && Math.abs(comp.diff) / moodRange >= 0.10) {
          newPatterns.push({
            id: generateId(),
            category: 'hydration-mood',
            observation: `Your mood averages ${comp.group1Avg.toFixed(1)} on high-hydration days vs ${comp.group2Avg.toFixed(1)} on low-hydration days`,
            data_range: `${hydrationMoodDays[hydrationMoodDays.length - 1].date} to ${hydrationMoodDays[0].date}`,
            sample_size: hydrationMoodDays.length,
            correlation_note: `${confidenceLabel(hydrationMoodDays.length)} Tier 2 (group means)`,
            detected_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Pattern 2: Time-of-day exercise-mood correlation (14+)
  const exerciseMoodDays = days.filter((d) => d.mood != null);
  if (exerciseMoodDays.length >= 14) {
    const earlyExercise = exerciseMoodDays.filter((d) => d.workout_early);
    const noEarlyExercise = exerciseMoodDays.filter((d) => !d.workout_early && !d.had_workout);

    if (earlyExercise.length >= 3 && noEarlyExercise.length >= 3) {
      const comp = groupComparison(
        earlyExercise.map((d) => d.mood!),
        noEarlyExercise.map((d) => d.mood!),
      );
      // MASTER-87: Use scale-aware threshold for bounded mood scale (1-5)
      const moodRange = 4; // 5 - 1
      if (comp && Math.abs(comp.diff) / moodRange >= 0.10) {
        newPatterns.push({
          id: generateId(),
          category: 'time-of-day',
          observation: `Your mood scores average ${comp.group1Avg.toFixed(1)} when you exercise before 10 AM vs ${comp.group2Avg.toFixed(1)} when you don't exercise by 10 AM`,
          data_range: `${exerciseMoodDays[exerciseMoodDays.length - 1].date} to ${exerciseMoodDays[0].date}`,
          sample_size: exerciseMoodDays.length,
          // MASTER-86: Binary variable (exercised vs didn't) — group comparison is correct
          correlation_note: `${confidenceLabel(exerciseMoodDays.length)} Tier 2 (group means)`,
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  // Pattern 3: Substance-performance (14+)
  const substanceDays = days.filter((d) => d.had_workout);
  if (substanceDays.length >= 14) {
    // Compare workout days after 0 alcohol vs 2+ alcohol (previous day)
    const withPriorAlcohol: DayData[] = [];
    const withoutPriorAlcohol: DayData[] = [];

    for (let i = 0; i < substanceDays.length; i++) {
      const dayIndex = days.indexOf(substanceDays[i]);
      if (dayIndex < days.length - 1) {
        const prevDay = days[dayIndex + 1]; // previous day (array sorted newest first)
        if (prevDay.alcohol_drinks >= 2) {
          withPriorAlcohol.push(substanceDays[i]);
        } else if (prevDay.alcohol_drinks === 0) {
          withoutPriorAlcohol.push(substanceDays[i]);
        }
      }
    }

    if (withPriorAlcohol.length >= 3 && withoutPriorAlcohol.length >= 3) {
      // MASTER-26: Use actual workout calories_burned, not total food calories
      const noDrinkAvg = withoutPriorAlcohol.reduce((s, d) => s + d.workout_calories_burned, 0) / withoutPriorAlcohol.length;
      const drinkAvg = withPriorAlcohol.reduce((s, d) => s + d.workout_calories_burned, 0) / withPriorAlcohol.length;
      const diffPct = noDrinkAvg > 0 ? ((noDrinkAvg - drinkAvg) / noDrinkAvg) * 100 : 0;

      if (Math.abs(diffPct) >= 15) {
        newPatterns.push({
          id: generateId(),
          category: 'substance-performance',
          observation: `Your workout calories burned average ${Math.round(noDrinkAvg)} on days following zero alcohol vs ${Math.round(drinkAvg)} following 2+ drinks (${Math.abs(diffPct).toFixed(0)}% difference)`,
          data_range: `${substanceDays[substanceDays.length - 1].date} to ${substanceDays[0].date}`,
          sample_size: substanceDays.length,
          correlation_note: `${confidenceLabel(substanceDays.length)} ${statisticalTier(substanceDays.length)}`,
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  // Pattern 4: Consistency-weight (28+ days, 4 weeks)
  // MASTER-28: Preserve weight change direction; compare against goal direction.
  const weightDays = days.filter((d) => d.weight != null);
  if (weightDays.length >= 28) {
    const profile = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
    const goalDirection = profile?.goal?.direction ?? 'MAINTAIN';

    const weeks: { loggedDays: number; weightChange: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekDays = days.slice(w * 7, (w + 1) * 7);
      const loggedDays = weekDays.filter((d) => d.calories > 0).length;
      const weekWeights = weekDays.filter((d) => d.weight != null).map((d) => d.weight!);
      // weightChange: positive = weight went up, negative = weight went down
      const weightChange = weekWeights.length >= 2
        ? weekWeights[0] - weekWeights[weekWeights.length - 1]
        : 0;
      weeks.push({ loggedDays, weightChange });
    }

    const highLogWeeks = weeks.filter((w) => w.loggedDays >= 5);
    const lowLogWeeks = weeks.filter((w) => w.loggedDays < 3);

    if (highLogWeeks.length >= 1 && lowLogWeeks.length >= 1) {
      // Score how well weight moved toward goal (positive = toward goal)
      const goalScore = (change: number): number => {
        if (goalDirection === 'LOSE') return -change; // weight down is good
        if (goalDirection === 'GAIN') return change;  // weight up is good
        return -Math.abs(change); // MAINTAIN: less change is better
      };

      const highAvgScore = highLogWeeks.reduce((s, w) => s + goalScore(w.weightChange), 0) / highLogWeeks.length;
      const lowAvgScore = lowLogWeeks.reduce((s, w) => s + goalScore(w.weightChange), 0) / lowLogWeeks.length;

      // Only surface when consistent logging weeks show BETTER goal-aligned progress
      if (highAvgScore > lowAvgScore && highAvgScore > 0) {
        const directionLabel =
          goalDirection === 'LOSE' ? 'weight loss' :
          goalDirection === 'GAIN' ? 'weight gain' : 'weight stability';
        const highAvgChange = highLogWeeks.reduce((s, w) => s + Math.abs(w.weightChange), 0) / highLogWeeks.length;

        newPatterns.push({
          id: generateId(),
          category: 'consistency-weight',
          observation: `During weeks with 5+ logging days, your ${directionLabel} aligns with your goal (avg ${highAvgChange.toFixed(1)} lbs/week toward target) vs inconsistent weeks`,
          data_range: `${days[days.length - 1].date} to ${days[0].date}`,
          sample_size: days.length,
          correlation_note: `${confidenceLabel(days.length)} ${statisticalTier(days.length)}`,
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  // Pattern 5: Food-sleep correlation (21+ days, Tier 2/3)
  const foodSleepDays = days.filter((d) => d.calories > 0 && d.sleep_quality != null);
  if (foodSleepDays.length >= 21) {
    // Use Spearman correlation between calories and sleep quality
    const { rho, significant } = spearmanCorrelation(
      foodSleepDays.map((d) => d.calories),
      foodSleepDays.map((d) => d.sleep_quality!),
    );

    if (significant) {
      const direction = rho > 0 ? 'higher calorie' : 'lower calorie';
      newPatterns.push({
        id: generateId(),
        category: 'food-sleep',
        observation: `Your sleep quality correlates with ${direction} days (rho=${rho.toFixed(2)}, ${foodSleepDays.length} days of data)`,
        data_range: `${foodSleepDays[foodSleepDays.length - 1].date} to ${foodSleepDays[0].date}`,
        sample_size: foodSleepDays.length,
        correlation_note: `${confidenceLabel(foodSleepDays.length)} ${statisticalTier(foodSleepDays.length)}`,
        detected_at: new Date().toISOString(),
      });
    }
  }

  // Pattern 6: Ingredient flag frequency (7-day rolling)
  // Detects 3+ occurrences of same flagged ingredient per week
  {
    const flagCounts = new Map<string, number>();
    const recentDays = days.slice(0, 7); // last 7 days
    for (const day of recentDays) {
      // Load food entries to check flagged ingredients
      const dayFoods = await storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, day.date));
      if (dayFoods) {
        for (const f of dayFoods) {
          if (f.flagged_ingredients) {
            for (const flag of f.flagged_ingredients) {
              flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
            }
          }
        }
      }
    }

    for (const [ingredientName, count] of flagCounts) {
      if (count >= 3) {
        newPatterns.push({
          id: generateId(),
          category: `ingredient-frequency-${ingredientName.toLowerCase().replace(/\s+/g, '-')}`,
          observation: `You've logged foods containing ${ingredientName} ${count} times this week. No judgment -- just making sure you see the pattern.`,
          data_range: `${recentDays[recentDays.length - 1]?.date ?? 'N/A'} to ${recentDays[0]?.date ?? 'N/A'}`,
          sample_size: recentDays.length,
          correlation_note: 'Ingredient frequency (7-day count)',
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  // Pattern 7: Sustained low calorie intake (eating safety)
  // This is a SAFETY pattern -- bypasses the normal 3-per-week limit.
  const safetyPatterns: PatternInsight[] = [];
  {
    const profile = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
    const calorieFloor = profile?.sex === 'female' ? CALORIE_FLOOR_FEMALE : CALORIE_FLOOR_MALE;
    const recentDays = days.slice(0, 7); // newest first
    // MASTER-88: Filter out days with 0 total calories (no data logged, not actual fasting).
    // Don't let non-logging days break or extend the streak.
    const daysWithFood = recentDays.filter((d) => d.calories > 0);

    // Find longest streak of consecutive low-calorie LOGGED days (from most recent)
    let consecutiveLow = 0;
    for (const d of daysWithFood) {
      if (d.calories < calorieFloor) {
        consecutiveLow++;
      } else {
        break;
      }
    }

    if (consecutiveLow >= ED_SUSTAINED_LOW_DAYS) {
      safetyPatterns.push({
        id: generateId(),
        category: 'eating_safety',
        observation: `Your calorie intake has been below ${calorieFloor} cal for ${consecutiveLow} consecutive days. This level may not support your health and wellbeing. Consider discussing your nutrition goals with a healthcare provider.`,
        data_range: `${daysWithFood[consecutiveLow - 1]?.date ?? 'N/A'} to ${daysWithFood[0]?.date ?? 'N/A'}`,
        sample_size: consecutiveLow,
        correlation_note: 'Safety alert -- eating disorder risk guardrail',
        detected_at: new Date().toISOString(),
      });
    }
  }

  // MASTER-85: Pattern expiration — remove patterns older than 30 days that
  // were not re-confirmed. Allow re-detection after 30 days.
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const freshExistingPatterns = existingPatterns.filter(
    (p) => new Date(p.detected_at).getTime() > thirtyDaysAgo,
  );

  // Filter: avoid duplicating existing pattern categories (using fresh set only)
  const existingCategories = new Set(freshExistingPatterns.map((p) => p.category));
  const trulyNew = newPatterns.filter((p) => !existingCategories.has(p.category));

  // Limit to MAX_NEW_PATTERNS_PER_WEEK (safety patterns bypass this limit)
  const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recentExisting = freshExistingPatterns.filter(
    (p) => new Date(p.detected_at).getTime() > oneWeekAgo,
  );
  const slotsAvailable = Math.max(0, MAX_NEW_PATTERNS_PER_WEEK - recentExisting.length);
  const toAdd = trulyNew.slice(0, slotsAvailable);

  // Safety patterns always added (not subject to weekly limit or dedup)
  const trulyNewSafety = safetyPatterns.filter((p) => !existingCategories.has(p.category));

  // Merge and save (expired patterns are dropped via freshExistingPatterns)
  const allPatterns = [...freshExistingPatterns, ...toAdd, ...trulyNewSafety];
  await storageSet(STORAGE_KEYS.COACH_PATTERNS, allPatterns);

  return allPatterns;
}
