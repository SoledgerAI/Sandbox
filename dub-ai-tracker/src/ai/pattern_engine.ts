// Proactive pattern recognition engine
// Phase 14: AI Coach
// Runs on app open and end-of-day

import { storageGet, storageSet, STORAGE_KEYS, dateKey, storageList } from '../utils/storage';
import { thresholdCount, groupComparison, spearmanCorrelation } from './correlation';
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

const MAX_NEW_PATTERNS_PER_WEEK = 3;

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

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
    alcohol_drinks: alcoholDrinks,
    substance_count: substanceArr.length,
  };
}

function confidenceLabel(sampleSize: number): string {
  if (sampleSize >= 60) return 'Strong pattern (60+ days):';
  if (sampleSize >= 30) return 'Established pattern (30+ days):';
  return 'Early pattern (14 days of data):';
}

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
  const hydrationMoodDays = days.filter((d) => d.water_oz > 0 && d.mood != null);
  if (hydrationMoodDays.length >= 14) {
    const highWater = hydrationMoodDays.filter((d) => d.water_oz >= 64);
    const lowWater = hydrationMoodDays.filter((d) => d.water_oz < 32);

    if (highWater.length >= 3 && lowWater.length >= 3) {
      const comp = groupComparison(
        highWater.map((d) => d.mood!),
        lowWater.map((d) => d.mood!),
      );
      if (comp && Math.abs(comp.diffPct) >= 15) {
        newPatterns.push({
          id: generateId(),
          category: 'hydration-mood',
          observation: `Days with 64+ oz water correlate with mood scores of ${comp.group1Avg.toFixed(1)} vs ${comp.group2Avg.toFixed(1)} on days below 32 oz`,
          data_range: `${hydrationMoodDays[hydrationMoodDays.length - 1].date} to ${hydrationMoodDays[0].date}`,
          sample_size: hydrationMoodDays.length,
          correlation_note: `${confidenceLabel(hydrationMoodDays.length)} ${statisticalTier(hydrationMoodDays.length)}`,
          detected_at: new Date().toISOString(),
        });
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
      if (comp && Math.abs(comp.diffPct) >= 15) {
        newPatterns.push({
          id: generateId(),
          category: 'time-of-day',
          observation: `Your mood scores average ${comp.group1Avg.toFixed(1)} when you exercise before 10 AM vs ${comp.group2Avg.toFixed(1)} when you don't exercise by 10 AM`,
          data_range: `${exerciseMoodDays[exerciseMoodDays.length - 1].date} to ${exerciseMoodDays[0].date}`,
          sample_size: exerciseMoodDays.length,
          correlation_note: `${confidenceLabel(exerciseMoodDays.length)} ${statisticalTier(exerciseMoodDays.length)}`,
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
      // Use calories burned as proxy for volume/performance
      const noDrinkAvg = withoutPriorAlcohol.reduce((s, d) => s + d.calories, 0) / withoutPriorAlcohol.length;
      const drinkAvg = withPriorAlcohol.reduce((s, d) => s + d.calories, 0) / withPriorAlcohol.length;
      const diffPct = noDrinkAvg > 0 ? ((noDrinkAvg - drinkAvg) / noDrinkAvg) * 100 : 0;

      if (Math.abs(diffPct) >= 15) {
        newPatterns.push({
          id: generateId(),
          category: 'substance-performance',
          observation: `Your workout performance correlates with ${Math.abs(diffPct).toFixed(0)}% difference on days following zero alcohol vs days following 2+ drinks`,
          data_range: `${substanceDays[substanceDays.length - 1].date} to ${substanceDays[0].date}`,
          sample_size: substanceDays.length,
          correlation_note: `${confidenceLabel(substanceDays.length)} ${statisticalTier(substanceDays.length)}`,
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  // Pattern 4: Consistency-weight (28+ days, 4 weeks)
  const weightDays = days.filter((d) => d.weight != null);
  if (weightDays.length >= 28) {
    // Split into weeks and check consistency
    const weeks: { loggedDays: number; weightChange: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekDays = days.slice(w * 7, (w + 1) * 7);
      const loggedDays = weekDays.filter((d) => d.calories > 0).length;
      const weekWeights = weekDays.filter((d) => d.weight != null).map((d) => d.weight!);
      const weightChange = weekWeights.length >= 2
        ? weekWeights[0] - weekWeights[weekWeights.length - 1]
        : 0;
      weeks.push({ loggedDays, weightChange });
    }

    const highLogWeeks = weeks.filter((w) => w.loggedDays >= 5);
    const lowLogWeeks = weeks.filter((w) => w.loggedDays < 3);

    if (highLogWeeks.length >= 1 && lowLogWeeks.length >= 1) {
      const highAvgChange = highLogWeeks.reduce((s, w) => s + Math.abs(w.weightChange), 0) / highLogWeeks.length;
      const lowAvgChange = lowLogWeeks.reduce((s, w) => s + Math.abs(w.weightChange), 0) / lowLogWeeks.length;

      if (highAvgChange > lowAvgChange) {
        newPatterns.push({
          id: generateId(),
          category: 'consistency-weight',
          observation: `During weeks with 5+ logging days, your weight trend moves toward goal at ${highAvgChange.toFixed(1)} lbs/week vs ${lowAvgChange.toFixed(1)} lbs/week in weeks with fewer than 3 logging days`,
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

  // Filter: avoid duplicating existing pattern categories
  const existingCategories = new Set(existingPatterns.map((p) => p.category));
  const trulyNew = newPatterns.filter((p) => !existingCategories.has(p.category));

  // Limit to MAX_NEW_PATTERNS_PER_WEEK
  const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recentExisting = existingPatterns.filter(
    (p) => new Date(p.detected_at).getTime() > oneWeekAgo,
  );
  const slotsAvailable = Math.max(0, MAX_NEW_PATTERNS_PER_WEEK - recentExisting.length);
  const toAdd = trulyNew.slice(0, slotsAvailable);

  // Merge and save
  const allPatterns = [...existingPatterns, ...toAdd];
  await storageSet(STORAGE_KEYS.COACH_PATTERNS, allPatterns);

  return allPatterns;
}
