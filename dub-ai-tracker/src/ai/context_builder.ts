// Assemble user data context per Coach message
// Phase 14: AI Coach
// Phase 19: Ingredient flag patterns in Coach context
// Includes conditional context injection and therapy note firewall

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, STORAGE_KEYS, dateKey, storageList } from '../utils/storage';
import { calculateBmr, calculateTdee, calculateCalorieTarget, computeAge, lbsToKg, inchesToCm } from '../utils/calories';
import type { UserProfile, EngagementTier, SobrietyGoal } from '../types/profile';
import type {
  CoachContext,
  TodayDataSummary,
  RollingStats,
  PatternInsight,
  InjurySummary,
  BloodworkSummary,
  SobrietyGoalSummary,
  EdRiskFlag,
} from '../types/coach';
import {
  CALORIE_FLOOR_FEMALE,
  CALORIE_FLOOR_MALE,
  ED_EXTREME_RESTRICTION_THRESHOLD,
  ED_SUSTAINED_LOW_DAYS,
  BMI_UNDERWEIGHT,
  BMI_NORMAL_UPPER,
  LBS_PER_KG,
  CM_PER_INCH,
} from '../constants/formulas';
import type {
  FoodEntry,
  WaterEntry,
  CaffeineEntry,
  SleepEntry,
  MoodEntry,
  BodyEntry,
  WorkoutEntry,
  StepsEntry,
  InjuryEntry,
  BloodworkEntry,
  SupplementEntry,
  CycleEntry,
  RecoveryScore,
} from '../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function pastDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Keyword matching for conditional context (simple, not AI)
const TREND_KEYWORDS = ['trend', 'week', 'average', 'how am i', 'doing', 'progress', 'rolling'];
const PATTERN_KEYWORDS = ['pattern', 'notice', 'insight', 'correlation', 'trend'];
const INJURY_KEYWORDS = [
  'injury', 'pain', 'hurt', 'sore', 'workout', 'workouts',
  'exercise', 'exercises', 'train', 'training', 'routine',
  'program', 'movement', 'movements', 'lift', 'lifting',
  'squat', 'bench', 'deadlift', 'press',
  'run', 'running', 'stretch', 'stretching',
];
const BLOODWORK_KEYWORDS = ['blood', 'lab', 'marker', 'cholesterol', 'glucose', 'iron', 'vitamin d'];
const CYCLE_KEYWORDS = ['cycle', 'period', 'menstrual', 'phase', 'ovulation'];
const SUBSTANCE_KEYWORDS = ['drink', 'alcohol', 'sober', 'substance', 'cannabis', 'tobacco'];
const SUPPLEMENT_KEYWORDS = ['supplement', 'vitamin', 'medication', 'dosage'];
const THERAPY_KEYWORDS = ['therapy', 'therapist', 'mental health', 'counseling'];
const INGREDIENT_KEYWORDS = ['ingredient', 'flag', 'additive', 'sweetener', 'sugar', 'msg', 'artificial'];

function messageMatchesKeywords(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// Therapy note firewall: throws if therapy content leaks into context
function assertNoTherapyContent(contextString: string): void {
  // Check for therapy storage key patterns beyond boolean
  const therapyPatterns = [
    'dub.log.therapy.',
    'therapist_name',
    'therapy_notes',
  ];
  for (const pattern of therapyPatterns) {
    if (contextString.includes(pattern)) {
      throw new Error(`THERAPY FIREWALL: therapy content "${pattern}" detected in Coach context`);
    }
  }
}

export async function buildCoachContext(userMessage: string): Promise<{
  context: CoachContext;
  conditionalSections: string[];
}> {
  const today = todayDateString();

  // Always-load data (sobriety goals are safety-critical — MASTER-03)
  const [profile, tier, sobrietyGoalEntries] = await Promise.all([
    storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
    storageGet<EngagementTier>(STORAGE_KEYS.TIER),
    storageGet<SobrietyGoal[]>(STORAGE_KEYS.SOBRIETY),
  ]);

  const currentTier = tier ?? 'balanced';

  // Load today's data
  const [
    foodEntries,
    waterEntries,
    caffeineEntries,
    sleepEntry,
    moodEntries,
    bodyEntry,
    recoveryScore,
    workoutEntries,
    stepsEntry,
  ] = await Promise.all([
    storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, today)),
    storageGet<WaterEntry[]>(dateKey(STORAGE_KEYS.LOG_WATER, today)),
    storageGet<CaffeineEntry[]>(dateKey(STORAGE_KEYS.LOG_CAFFEINE, today)),
    storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, today)),
    storageGet<MoodEntry[]>(dateKey(STORAGE_KEYS.LOG_MOOD, today)),
    storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, today)),
    storageGet<RecoveryScore>(dateKey(STORAGE_KEYS.RECOVERY, today)),
    storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, today)),
    storageGet<StepsEntry>(dateKey(STORAGE_KEYS.LOG_STEPS, today)),
  ]);

  const foods = foodEntries ?? [];
  const waters = waterEntries ?? [];
  const caffeines = caffeineEntries ?? [];
  const moods = moodEntries ?? [];

  const tagsLogged: string[] = [];
  if (foods.length > 0) tagsLogged.push('nutrition.food');
  if (waters.length > 0) tagsLogged.push('hydration.water');
  if (sleepEntry) tagsLogged.push('sleep.tracking');
  if (moods.length > 0) tagsLogged.push('mental.wellness');
  if (bodyEntry) tagsLogged.push('body.measurements');

  const workouts = workoutEntries ?? [];
  const caloriesBurned = workouts.reduce((s, w) => s + (w.calories_burned ?? 0), 0);

  const todayData: TodayDataSummary = {
    calories_consumed: foods.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0),
    calories_burned: caloriesBurned,
    protein_g: foods.reduce((s, f) => s + (f.computed_nutrition?.protein_g ?? 0), 0),
    carbs_g: foods.reduce((s, f) => s + (f.computed_nutrition?.carbs_g ?? 0), 0),
    fat_g: foods.reduce((s, f) => s + (f.computed_nutrition?.fat_g ?? 0), 0),
    water_oz: waters.reduce((s, w) => s + w.amount_oz, 0),
    caffeine_mg: caffeines.reduce((s, c) => s + c.amount_mg, 0),
    steps: stepsEntry?.total_steps ?? 0,
    workouts: workouts.map((w) => w.activity_name),
    mood: moods.length > 0 ? moods.reduce((s, m) => s + m.score, 0) / moods.length : null,
    sleep_hours: sleepEntry?.bedtime && sleepEntry?.wake_time
      ? (new Date(sleepEntry.wake_time).getTime() - new Date(sleepEntry.bedtime).getTime()) / 3600000
      : null,
    sleep_quality: sleepEntry?.quality ?? null,
    tags_logged: tagsLogged,
  };

  // Compute BMR/TDEE/Calorie Target (MASTER-22: Coach must use target, not TDEE)
  let bmr: number | null = null;
  let tdee: number | null = null;
  let calorieTarget: number | null = null;
  if (
    profile?.weight_lbs != null &&
    profile?.height_inches != null &&
    profile?.dob != null &&
    profile?.sex != null &&
    profile?.activity_level != null
  ) {
    const age = computeAge(profile.dob);
    const weightKg = lbsToKg(profile.weight_lbs);
    const heightCm = inchesToCm(profile.height_inches);
    bmr = calculateBmr({ weightKg, heightCm, ageYears: age, sex: profile.sex });
    tdee = calculateTdee(bmr, profile.activity_level);
    calorieTarget = calculateCalorieTarget({
      tdee,
      goalDirection: profile.goal?.direction ?? 'MAINTAIN',
      sex: profile.sex,
      rateLbsPerWeek: profile.goal?.rate_lbs_per_week ?? undefined,
      surplusCalories: profile.goal?.surplus_calories ?? undefined,
    });
  }

  // Conditional sections
  const conditionalSections: string[] = [];

  // 7-day rolling stats (conditional on trend keywords)
  if (messageMatchesKeywords(userMessage, TREND_KEYWORDS)) {
    const rolling = await compute7DayRolling(today);
    if (rolling) {
      const parts: string[] = [];
      if (rolling.avg_calories != null) parts.push(`Cal:${Math.round(rolling.avg_calories)}avg`);
      if (rolling.avg_protein_g != null) parts.push(`P:${Math.round(rolling.avg_protein_g)}g`);
      if (rolling.avg_sleep_hours != null) parts.push(`Sleep:${rolling.avg_sleep_hours.toFixed(1)}h`);
      if (rolling.avg_mood != null) parts.push(`Mood:${rolling.avg_mood.toFixed(1)}`);
      if (rolling.avg_weight != null) parts.push(`Wt:${rolling.avg_weight.toFixed(1)}`);
      if (parts.length > 0) {
        conditionalSections.push(`[7D] ${parts.join(' ')}`);
      }
    }
  }

  // Active patterns (conditional)
  let activePatterns: PatternInsight[] = [];
  if (messageMatchesKeywords(userMessage, PATTERN_KEYWORDS)) {
    activePatterns = (await storageGet<PatternInsight[]>(STORAGE_KEYS.COACH_PATTERNS)) ?? [];
  }

  // MASTER-34: Active injuries are safety-critical (e.g., user asks "design a workout"
  // with a torn rotator cuff). Always-include for severity >= 5 or acute type.
  // Minor/resolved injuries remain conditional on keywords.
  let injuries: InjurySummary[] = [];
  {
    const allInjuryKeys = await storageList('dub.log.injury.');
    const allUnresolved: InjurySummary[] = [];
    for (const key of allInjuryKeys.slice(-7)) {
      const entries = await storageGet<InjuryEntry[]>(key);
      if (entries) {
        for (const e of entries) {
          if (!e.resolved_date) {
            allUnresolved.push({
              location: e.body_location,
              severity: e.severity,
              type: e.type,
              aggravators: e.aggravators,
            });
          }
        }
      }
    }

    // Always include: severity >= 5 or acute type (safety-critical)
    const safetyInjuries = allUnresolved.filter(
      (i) => i.severity >= 5 || i.type === 'acute',
    );

    // Conditionally include minor injuries on keyword match
    const minorInjuries = messageMatchesKeywords(userMessage, INJURY_KEYWORDS)
      ? allUnresolved.filter((i) => i.severity < 5 && i.type !== 'acute')
      : [];

    injuries = [...safetyInjuries, ...minorInjuries];

    // Deduplicate by location
    const seen = new Set<string>();
    injuries = injuries.filter((i) => {
      if (seen.has(i.location)) return false;
      seen.add(i.location);
      return true;
    });
  }

  // Bloodwork (conditional)
  let bloodwork: BloodworkSummary | null = null;
  if (messageMatchesKeywords(userMessage, BLOODWORK_KEYWORDS)) {
    const bwKeys = await storageList('dub.log.bloodwork.');
    if (bwKeys.length > 0) {
      const latestKey = bwKeys.sort().pop()!;
      const entry = await storageGet<BloodworkEntry>(latestKey);
      if (entry) {
        bloodwork = {
          date: entry.date,
          flagged_markers: entry.markers
            .filter((m) => m.flagged)
            .map((m) => ({
              name: m.name,
              value: m.value,
              unit: m.unit,
              reference_range: `${m.reference_range_low ?? '?'}-${m.reference_range_high ?? '?'}`,
              status: (m.reference_range_high != null && m.value > m.reference_range_high) ? 'high' as const : 'low' as const,
            })),
        };
        if (bloodwork.flagged_markers.length > 0) {
          const bwText = bloodwork.flagged_markers
            .map((m) => `${m.name}:${m.value}${m.unit}(ref:${m.reference_range},${m.status})`)
            .join(' ');
          conditionalSections.push(`[BLOODWORK ${bloodwork.date}] ${bwText}`);
        }
      }
    }
  }

  // Cycle phase (conditional)
  let cyclePhase: string | null = null;
  if (messageMatchesKeywords(userMessage, CYCLE_KEYWORDS)) {
    const cycleEntry = await storageGet<CycleEntry>(dateKey(STORAGE_KEYS.LOG_CYCLE, today));
    if (cycleEntry?.computed_phase) {
      cyclePhase = cycleEntry.computed_phase;
      conditionalSections.push(`[CYCLE] Phase: ${cyclePhase} Day: ${cycleEntry.cycle_day ?? '?'}`);
    }
  }

  // Sobriety goals — ALWAYS included (safety-critical, MASTER-03)
  // QUIT/REDUCE goals must be present in every Coach interaction to prevent
  // Coach from suggesting substance use (e.g., alcohol-paired meals).
  // Daily substance LOG DATA stays conditional on SUBSTANCE_KEYWORDS.
  const sobrietyGoals: SobrietyGoalSummary[] = (sobrietyGoalEntries ?? []).map((g) => ({
    substance: g.substance,
    goal_type: g.goal_type,
    current_streak_days: g.current_streak_days,
  }));

  // Supplement UL flags (conditional)
  let supplementFlags: string[] = [];
  if (messageMatchesKeywords(userMessage, SUPPLEMENT_KEYWORDS)) {
    const supps = await storageGet<SupplementEntry[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today));
    if (supps && supps.length > 0) {
      supplementFlags = supps.map((s) => `${s.name} ${s.dosage}${s.unit}`);
      conditionalSections.push(`[SUPPLEMENTS] ${supplementFlags.join(' | ')}`);
    }
  }

  // Therapy boolean (conditional -- NEVER include notes)
  let therapyToday = false;
  if (messageMatchesKeywords(userMessage, THERAPY_KEYWORDS)) {
    const therapyEntry = await storageGet<{ session_logged: boolean }>(dateKey(STORAGE_KEYS.LOG_THERAPY, today));
    therapyToday = therapyEntry?.session_logged ?? false;
  }

  // Ingredient flag patterns (conditional)
  if (messageMatchesKeywords(userMessage, INGREDIENT_KEYWORDS)) {
    // Count flagged ingredient occurrences in the past 7 days of food entries
    const flagCounts = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const date = pastDateString(i);
      const dayFoods = await storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, date));
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
    if (flagCounts.size > 0) {
      const parts = Array.from(flagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}:${count}x`)
        .join(' ');
      conditionalSections.push(`[INGREDIENT FLAGS 7d] ${parts}`);
    }
  }

  // ---- Eating Disorder Risk Detection (always computed, safety-critical) ----
  const edRiskFlags: EdRiskFlag[] = [];

  // Determine sex-aware calorie floor
  const calorieFloor = profile?.sex === 'female' ? CALORIE_FLOOR_FEMALE : CALORIE_FLOOR_MALE;

  // Flag 1: Extreme restriction today (below 1,000 cal with food logged)
  if (foods.length > 0 && todayData.calories_consumed < ED_EXTREME_RESTRICTION_THRESHOLD) {
    edRiskFlags.push({
      type: 'extreme_restriction_today',
      detail: `Today's intake is ${todayData.calories_consumed} cal (below ${ED_EXTREME_RESTRICTION_THRESHOLD} cal threshold)`,
    });
  }

  // Flag 2: Sustained low intake (3+ days below calorie floor in a 7-day rolling window, skipping no-log days)
  {
    let lowDays = 0;
    for (let i = 0; i < 7; i++) {
      const date = pastDateString(i);
      const dayFoods = i === 0 ? foods : await storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, date));
      const dayArr = dayFoods ?? [];
      if (dayArr.length === 0) continue; // no food logged = skip, not a streak-breaker
      const dayCal = dayArr.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0);
      if (dayCal > 0 && dayCal < calorieFloor) {
        lowDays++;
      }
    }
    if (lowDays >= ED_SUSTAINED_LOW_DAYS) {
      edRiskFlags.push({
        type: 'sustained_low_intake',
        detail: `Calorie intake below ${calorieFloor} cal on ${lowDays} of the last 7 days`,
      });
    }
  }

  // Flag 3: Underweight BMI (regardless of goal)
  if (profile?.weight_lbs != null && profile?.height_inches != null) {
    const weightKg = profile.weight_lbs / LBS_PER_KG;
    const heightM = (profile.height_inches * CM_PER_INCH) / 100;
    const bmi = weightKg / (heightM * heightM);
    if (bmi <= BMI_UNDERWEIGHT) {
      edRiskFlags.push({
        type: 'underweight_bmi',
        detail: `BMI is ${bmi.toFixed(1)} (at or below ${BMI_UNDERWEIGHT}), which is classified as underweight`,
      });
    }
  }

  // Flag 4: Healthy BMI + active weight loss goal
  if (
    profile?.weight_lbs != null &&
    profile?.height_inches != null &&
    profile?.goal?.direction === 'LOSE'
  ) {
    const weightKg = profile.weight_lbs / LBS_PER_KG;
    const heightM = (profile.height_inches * CM_PER_INCH) / 100;
    const bmi = weightKg / (heightM * heightM);
    if (bmi <= BMI_NORMAL_UPPER) {
      edRiskFlags.push({
        type: 'healthy_bmi_loss_goal',
        detail: `BMI is ${bmi.toFixed(1)} (at or below ${BMI_NORMAL_UPPER}) with active weight loss goal`,
      });
    }
  }

  const context: CoachContext = {
    profile: profile ?? {
      name: 'User',
      dob: '',
      units: 'imperial',
      sex: null,
      height_inches: null,
      weight_lbs: null,
      activity_level: null,
      goal: null,
      altitude_acclimated: false,
    },
    tier: currentTier,
    today_data: todayData,
    rolling_7d: {
      avg_calories: null,
      avg_protein_g: null,
      avg_carbs_g: null,
      avg_fat_g: null,
      avg_water_oz: null,
      avg_sleep_hours: null,
      avg_mood: null,
      avg_weight: null,
      workout_count: 0,
    },
    bmr,
    tdee,
    calorie_target: calorieTarget,
    recovery_score: recoveryScore?.total_score ?? null,
    active_correlations: activePatterns,
    active_injuries: injuries,
    latest_bloodwork: bloodwork,
    cycle_phase: cyclePhase,
    sobriety_goals: sobrietyGoals,
    supplement_flags: supplementFlags,
    therapy_today: therapyToday,
    ed_risk_flags: edRiskFlags,
  };

  // Therapy note firewall: verify no therapy content leaked
  const contextJson = JSON.stringify(context) + conditionalSections.join('');
  assertNoTherapyContent(contextJson);

  return { context, conditionalSections };
}

async function compute7DayRolling(today: string): Promise<RollingStats | null> {
  // MASTER-61: Build all 42 keys upfront, fetch in a single multiGet
  const dates: string[] = [];
  const allKeys: string[] = [];
  const TAG_PREFIXES = [
    STORAGE_KEYS.LOG_FOOD,
    STORAGE_KEYS.LOG_WATER,
    STORAGE_KEYS.LOG_SLEEP,
    STORAGE_KEYS.LOG_MOOD,
    STORAGE_KEYS.LOG_BODY,
    STORAGE_KEYS.LOG_WORKOUT,
  ] as const;

  for (let i = 0; i < 7; i++) {
    const date = pastDateString(i);
    dates.push(date);
    for (const prefix of TAG_PREFIXES) {
      allKeys.push(dateKey(prefix, date));
    }
  }

  const pairs = await AsyncStorage.multiGet(allKeys);
  const lookup = new Map<string, string>();
  for (const [key, raw] of pairs) {
    if (raw != null) lookup.set(key, raw);
  }

  function parse<T>(prefix: string, date: string): T | null {
    const raw = lookup.get(dateKey(prefix, date));
    return raw != null ? (JSON.parse(raw) as T) : null;
  }

  let workoutCount = 0;
  const stats = {
    calories: [] as number[],
    protein: [] as number[],
    carbs: [] as number[],
    fat: [] as number[],
    water: [] as number[],
    sleep: [] as number[],
    mood: [] as number[],
    weight: [] as number[],
  };

  for (const date of dates) {
    const foods = parse<FoodEntry[]>(STORAGE_KEYS.LOG_FOOD, date);
    if (foods && foods.length > 0) {
      stats.calories.push(foods.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0));
      stats.protein.push(foods.reduce((s, f) => s + (f.computed_nutrition?.protein_g ?? 0), 0));
      stats.carbs.push(foods.reduce((s, f) => s + (f.computed_nutrition?.carbs_g ?? 0), 0));
      stats.fat.push(foods.reduce((s, f) => s + (f.computed_nutrition?.fat_g ?? 0), 0));
    }

    const waters = parse<WaterEntry[]>(STORAGE_KEYS.LOG_WATER, date);
    if (waters && waters.length > 0) {
      stats.water.push(waters.reduce((s, w) => s + w.amount_oz, 0));
    }

    const sleepEntry = parse<SleepEntry>(STORAGE_KEYS.LOG_SLEEP, date);
    if (sleepEntry?.bedtime && sleepEntry?.wake_time) {
      const hours = (new Date(sleepEntry.wake_time).getTime() - new Date(sleepEntry.bedtime).getTime()) / 3600000;
      if (hours > 0 && hours < 24) stats.sleep.push(hours);
    }

    const moodEntries = parse<MoodEntry[]>(STORAGE_KEYS.LOG_MOOD, date);
    if (moodEntries && moodEntries.length > 0) {
      stats.mood.push(moodEntries.reduce((s, m) => s + m.score, 0) / moodEntries.length);
    }

    const bodyEntry = parse<BodyEntry>(STORAGE_KEYS.LOG_BODY, date);
    if (bodyEntry?.weight_lbs != null) {
      stats.weight.push(bodyEntry.weight_lbs);
    }

    const workoutEntries = parse<WorkoutEntry[]>(STORAGE_KEYS.LOG_WORKOUT, date);
    if (workoutEntries && workoutEntries.length > 0) {
      workoutCount++;
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    avg_calories: avg(stats.calories),
    avg_protein_g: avg(stats.protein),
    avg_carbs_g: avg(stats.carbs),
    avg_fat_g: avg(stats.fat),
    avg_water_oz: avg(stats.water),
    avg_sleep_hours: avg(stats.sleep),
    avg_mood: avg(stats.mood),
    avg_weight: avg(stats.weight),
    workout_count: workoutCount,
  };
}
