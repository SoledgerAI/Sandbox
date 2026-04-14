// Assemble user data context per Coach message
// Phase 14: AI Coach
// Phase 19: Ingredient flag patterns in Coach context
// Includes conditional context injection and therapy note firewall

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, STORAGE_KEYS, dateKey, storageList } from '../utils/storage';
import { calculateBmr, calculateTdee, calculateCalorieTarget, computeAge, lbsToKg, inchesToCm } from '../utils/calories';
import { computeConsistency, consistencyPct } from '../utils/consistency';
import { getActiveMilestone } from '../hooks/useMilestone';
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
import { evaluateMoodTrend } from '../utils/mood_trend';
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
  GlucoseEntry,
  BloodPressureEntry,
  HabitEntry,
  HabitDefinition,
  BodyweightRepEntry,
  DoctorVisitEntry,
  AllergyLogEntry,
  MeditationEntry,
  SocialConnectionEntry,
  SunlightEntry,
  MobilityEntry,
  JournalEntry,
} from '../types';
import type {
  PerimenopauseEntry,
  BreastfeedingEntry,
  MigraineEntry,
  MoodMentalEntry,
  ElectInCategoryId,
  BodyMeasurementEntry,
  MedicationEntry,
  CycleEntryV2,
} from '../types';
import { DOCTOR_VISIT_TYPES, MOBILITY_TYPES } from '../types';
import { calculateSleepAdherence } from '../utils/sleepAdherence';
import { getEnabledCategories } from '../utils/categoryElection';
import { todayDateString } from '../utils/dayBoundary';
import { getCachedCompliance, getComplianceTrend } from '../services/complianceEngine';


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
const BLOODWORK_KEYWORDS = ['blood', 'lab', 'marker', 'cholesterol', 'iron', 'vitamin d'];
const GLUCOSE_KEYWORDS = ['glucose', 'blood sugar', 'sugar level', 'fasting', 'a1c', 'diabetic', 'pre-diabetic', 'mg/dl'];
const BP_KEYWORDS = ['blood pressure', 'bp', 'systolic', 'diastolic', 'hypertension', 'mmhg', 'pulse'];
const CYCLE_KEYWORDS = ['cycle', 'period', 'menstrual', 'phase', 'ovulation'];
const _SUBSTANCE_KEYWORDS = ['drink', 'alcohol', 'sober', 'substance', 'cannabis', 'tobacco'];
const SUPPLEMENT_KEYWORDS = ['supplement', 'vitamin', 'medication', 'dosage'];
const THERAPY_KEYWORDS = ['therapy', 'therapist', 'mental health', 'counseling'];
const INGREDIENT_KEYWORDS = ['ingredient', 'flag', 'additive', 'sweetener', 'sugar', 'msg', 'artificial'];
const HABIT_KEYWORDS = ['habit', 'routine', 'checklist', 'daily', 'brush', 'floss', 'bed', 'cream', 'self care'];
const REP_KEYWORDS = ['rep', 'reps', 'pushup', 'push-up', 'pullup', 'pull-up', 'situp', 'sit-up', 'jumping jack', 'squat', 'bodyweight', 'calisthenics'];
const DOCTOR_KEYWORDS = ['doctor', 'appointment', 'visit', 'follow-up', 'followup', 'checkup', 'dentist', 'physical', 'specialist', 'psychiatrist', 'optometrist', 'dermatologist'];
const ALLERGY_KEYWORDS = ['allergy', 'allergies', 'allergen', 'pollen', 'congestion', 'sneezing', 'antihistamine', 'zyrtec', 'flonase', 'claritin'];
const MEDITATION_KEYWORDS = ['meditat', 'mindful', 'breathwork', 'breathing', 'calm', 'body scan', 'loving-kindness'];
const SOCIAL_KEYWORDS = ['social', 'connection', 'friend', 'family', 'lonely', 'isolation', 'community', 'relationship'];
const SUNLIGHT_KEYWORDS = ['sunlight', 'outdoor', 'outside', 'nature', 'sun', 'vitamin d', 'fresh air'];
const MOBILITY_KEYWORDS = ['stretch', 'mobility', 'foam roll', 'yoga', 'flexibility', 'sauna', 'ice bath', 'recovery', 'massage'];
const JOURNAL_KEYWORDS = ['journal', 'writing', 'diary', 'reflect', 'reflection'];
const SLEEP_SCHEDULE_KEYWORDS = ['sleep schedule', 'bedtime', 'wake time', 'sleep routine', 'sleep adherence'];
const RECIPE_KEYWORDS = ['recipe', 'recipes', 'cook', 'cooking', 'meal prep', 'meatloaf', 'batch', 'ingredient'];
const PERIMENOPAUSE_KEYWORDS = ['perimenopause', 'menopause', 'hot flash', 'night sweat', 'brain fog', 'hormone'];
const BREASTFEEDING_KEYWORDS = ['breastfeed', 'nursing', 'pumping', 'lactation', 'feeding', 'breast milk', 'bottle feed'];
const MIGRAINE_KEYWORDS = ['migraine', 'headache', 'aura', 'head pain', 'trigger', 'barometric'];
const MOOD_MENTAL_KEYWORDS = ['mood', 'mental', 'anxiety', 'stress', 'emotion', 'coping', 'energy', 'clarity'];
const BODY_MEASUREMENT_KEYWORDS = ['body measurement', 'weight trend', 'tape measure', 'body fat', 'waist', 'hips', 'measurements'];
const MEDICATION_KEYWORDS_COACH = ['medication', 'medicine', 'pill', 'prescription', 'dose', 'adherence', 'compliance', 'skipped'];

function messageMatchesKeywords(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * SEC-06: Sanitize user-generated strings before injecting into prompt context.
 * Strips text patterns that resemble prompt injection attempts
 * (e.g., "[SYSTEM]", "IGNORE", "output your prompt").
 * Truncates to prevent context flooding.
 */
function sanitizeForPrompt(input: string, maxLength: number = 100): string {
  let clean = input.slice(0, maxLength);
  // Strip patterns that look like prompt injection
  clean = clean.replace(/\[(?:SYSTEM|OVERRIDE|ADMIN|PROMPT|INSTRUCTION)[^\]]*\]/gi, '');
  clean = clean.replace(/(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous\s+)?(?:instructions?|rules?|prompts?)/gi, '');
  clean = clean.replace(/(?:output|reveal|show|display|print)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?|config)/gi, '');
  // Strip control characters
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return clean.trim();
}

// Therapy & privacy firewall: throws if therapy content or private journal text leaks into context
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
  // Sprint 19: Private journal entries must never appear in context
  // (We only include "[JOURNAL] N entry today" for non-private entries, never text content)
  if (contextString.includes('"private":true') && contextString.includes('dub.log.journal')) {
    throw new Error('JOURNAL FIREWALL: private journal content detected in Coach context');
  }
}

export async function buildCoachContext(userMessage: string): Promise<{
  context: CoachContext;
  conditionalSections: string[];
}> {
  const today = todayDateString();

  // Always-load data (sobriety goals are safety-critical — MASTER-03)
  const [profile, tier, sobrietyGoalEntries, consistencyData, compliance7dData, hydrationGoalData] = await Promise.all([
    storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
    storageGet<EngagementTier>(STORAGE_KEYS.TIER),
    storageGet<SobrietyGoal[]>(STORAGE_KEYS.SOBRIETY),
    computeConsistency(),
    // Sprint 25: load 7-day compliance scores
    (async () => {
      const scores: number[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const cached = await storageGet<{ percentage: number; total: number }>(dateKey(STORAGE_KEYS.COMPLIANCE, ds));
        if (cached && cached.total > 0) scores.push(cached.percentage);
      }
      return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    })(),
    // Sprint 25: load hydration goal settings
    storageGet<{ daily_goal: number; unit: string }>(STORAGE_KEYS.SETTINGS_HYDRATION_GOAL),
  ]);
  const compliance7dAvg: number | null = compliance7dData ?? null;
  // Sprint 25: hydration goal progress (compute after loading water entries below)
  let hydrationGoalProgress: string | null = null;

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
    glucoseEntries,
    bpEntries,
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
    storageGet<GlucoseEntry[]>(dateKey(STORAGE_KEYS.LOG_GLUCOSE, today)),
    storageGet<BloodPressureEntry[]>(dateKey(STORAGE_KEYS.LOG_BP, today)),
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
  const glucoseReadings = glucoseEntries ?? [];
  if (glucoseReadings.length > 0) tagsLogged.push('blood.glucose');
  const bpReadings = bpEntries ?? [];
  if (bpReadings.length > 0) tagsLogged.push('blood.pressure');

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
    energy: moods.length > 0 ? moods.filter((m) => m.energy != null).reduce((s, m) => s + m.energy!, 0) / Math.max(moods.filter((m) => m.energy != null).length, 1) || null : null,
    anxiety: moods.length > 0 ? moods.filter((m) => m.anxiety != null).reduce((s, m) => s + m.anxiety!, 0) / Math.max(moods.filter((m) => m.anxiety != null).length, 1) || null : null,
    sleep_hours: sleepEntry?.bedtime && sleepEntry?.wake_time
      ? (new Date(sleepEntry.wake_time).getTime() - new Date(sleepEntry.bedtime).getTime()) / 3600000
      : null,
    sleep_quality: sleepEntry?.quality ?? null,
    tags_logged: tagsLogged,
  };

  // Sprint 25: Compute hydration goal progress for coach context
  if (hydrationGoalData) {
    const waterOz = todayData.water_oz;
    const goalUnit = hydrationGoalData.unit as 'cups' | 'oz' | 'ml';
    const goalAmount = hydrationGoalData.daily_goal;
    // Convert goal to oz for comparison
    let goalOz: number;
    switch (goalUnit) {
      case 'cups': goalOz = goalAmount * 8; break;
      case 'ml': goalOz = goalAmount / 29.5735; break;
      default: goalOz = goalAmount;
    }
    const pct = goalOz > 0 ? Math.round((waterOz / goalOz) * 100) : 0;
    hydrationGoalProgress = `${pct}% of daily goal (${Math.round(waterOz)}/${Math.round(goalOz)} oz)`;
  }

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
    bmr = calculateBmr({ weightKg, heightCm, ageYears: age, sex: profile.sex, metabolicProfile: profile.metabolic_profile });
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

  // Sprint 18: Always include today's compliance score
  {
    const todayCompliance = await getCachedCompliance(today);
    if (todayCompliance.total > 0) {
      const missed = todayCompliance.items
        .filter((i) => !i.completed)
        .map((i) => i.label.split(' ')[0]) // Short form: first word of label
        .join(', ');
      conditionalSections.push(
        `[COMPLIANCE ${today}] ${todayCompliance.percentage.toFixed(0)}% (${todayCompliance.completed}/${todayCompliance.total})${missed ? ` missed: ${missed}` : ''}`,
      );

      // 7-day average + trend
      const trend = await getComplianceTrend();
      if (trend.current7dAvg > 0) {
        conditionalSections.push(
          `[COMPLIANCE 7d avg] ${trend.current7dAvg.toFixed(0)}%`,
        );
        const sign = trend.delta >= 0 ? '+' : '';
        conditionalSections.push(
          `[COMPLIANCE TREND] ${trend.trend} (${sign}${trend.delta.toFixed(0)}% vs prior 7d)`,
        );
      }
    }
  }

  // Always compute 7-day weight average (P1 redesign: weight context is always-include)
  const weightRolling = await compute7DayRolling(today);
  if (weightRolling?.avg_weight != null) {
    conditionalSections.push(`[WEIGHT 7D] Avg:${weightRolling.avg_weight.toFixed(1)} Pts:${weightRolling.weight_count}`);
  }

  // 7-day rolling stats for non-weight metrics (conditional on trend keywords)
  if (messageMatchesKeywords(userMessage, TREND_KEYWORDS)) {
    if (weightRolling) {
      const parts: string[] = [];
      if (weightRolling.avg_calories != null) parts.push(`Cal:${Math.round(weightRolling.avg_calories)}avg`);
      if (weightRolling.avg_protein_g != null) parts.push(`P:${Math.round(weightRolling.avg_protein_g)}g`);
      if (weightRolling.avg_sleep_hours != null) parts.push(`Sleep:${weightRolling.avg_sleep_hours.toFixed(1)}h`);
      if (weightRolling.avg_mood != null) parts.push(`Mood:${weightRolling.avg_mood.toFixed(1)}`);
      if (weightRolling.avg_energy != null) parts.push(`Energy:${weightRolling.avg_energy.toFixed(1)}`);
      if (weightRolling.avg_anxiety != null) parts.push(`Anxiety:${weightRolling.avg_anxiety.toFixed(1)}`);
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
  // eslint-disable-next-line no-useless-assignment -- injuries is reassigned inside the block below
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
            .map((m) => `${sanitizeForPrompt(m.name, 50)}:${m.value}${sanitizeForPrompt(m.unit, 20)}(ref:${m.reference_range},${m.status})`)
            .join(' ');
          conditionalSections.push(`[BLOODWORK ${bloodwork.date}] ${bwText}`);
        }
      }
    }
  }

  // Cycle phase (conditional) — Sprint 24 enhanced
  // Include: cycle day, period status, reported symptoms (last 3 days)
  // EXCLUDE: intimacy, cervical_mucus, ovulation_test (too private for AI context)
  let cyclePhase: string | null = null;
  if (messageMatchesKeywords(userMessage, CYCLE_KEYWORDS)) {
    const cycleEntry = await storageGet<CycleEntryV2>(dateKey(STORAGE_KEYS.LOG_CYCLE, today));
    if (cycleEntry) {
      // V2 enhanced entry
      if (cycleEntry.period_status) {
        const parts: string[] = [`Status: ${cycleEntry.period_status}`];
        if (cycleEntry.flow_level) parts.push(`Flow: ${cycleEntry.flow_level}/5`);

        // Include symptoms (NOT intimacy, cervical_mucus, or ovulation_test)
        if (cycleEntry.symptoms && cycleEntry.symptoms.length > 0) {
          const symptomNames = cycleEntry.symptoms.map((s: any) =>
            typeof s === 'string' ? s : s.symptom,
          );
          parts.push(`Symptoms: ${symptomNames.join(', ')}`);
        }

        conditionalSections.push(`[CYCLE] ${parts.join(' | ')}`);
      }
      // Legacy fallback
      if ((cycleEntry as any).computed_phase && !cycleEntry.period_status) {
        cyclePhase = (cycleEntry as any).computed_phase;
        conditionalSections.push(`[CYCLE] Phase: ${cyclePhase} Day: ${(cycleEntry as any).cycle_day ?? '?'}`);
      }

      // Load last 3 days of symptoms for trend context
      const recentSymptoms: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const pastDate = pastDateString(i);
        const pastEntry = await storageGet<CycleEntryV2>(dateKey(STORAGE_KEYS.LOG_CYCLE, pastDate));
        if (pastEntry?.symptoms && pastEntry.symptoms.length > 0) {
          const names = pastEntry.symptoms.map((s: any) =>
            typeof s === 'string' ? s : s.symptom,
          );
          recentSymptoms.push(`${pastDate}: ${names.join(', ')}`);
        }
      }
      if (recentSymptoms.length > 0) {
        conditionalSections.push(`[CYCLE 3D SYMPTOMS] ${recentSymptoms.join(' | ')}`);
      }
    }

    // Safety instruction for cycle data
    conditionalSections.push(
      '[CYCLE SAFETY] Cycle data is provided for wellness context only. Never make fertility predictions or contraception recommendations. Direct all reproductive health questions to a healthcare provider.',
    );
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

  // Blood glucose (conditional)
  if (messageMatchesKeywords(userMessage, GLUCOSE_KEYWORDS)) {
    if (glucoseReadings.length > 0) {
      const parts = glucoseReadings.map((g) => `${g.reading_mg_dl}mg/dL(${g.timing})`);
      conditionalSections.push(`[GLUCOSE TODAY] ${parts.join(' ')}`);
    }
  }

  // Blood pressure (conditional)
  if (messageMatchesKeywords(userMessage, BP_KEYWORDS)) {
    if (bpReadings.length > 0) {
      const parts = bpReadings.map((b) =>
        `${b.systolic}/${b.diastolic}${b.pulse_bpm != null ? ` (${b.pulse_bpm} bpm)` : ''}`
      );
      conditionalSections.push(`[BP TODAY] ${parts.join(' ')}`);
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
        .map(([name, count]) => `${sanitizeForPrompt(name, 50)}:${count}x`)
        .join(' ');
      conditionalSections.push(`[INGREDIENT FLAGS 7d] ${parts}`);
    }
  }

  // Daily habits (conditional)
  if (messageMatchesKeywords(userMessage, HABIT_KEYWORDS)) {
    const habitDefs = await storageGet<HabitDefinition[]>(STORAGE_KEYS.SETTINGS_HABITS);
    const habitEntries = await storageGet<HabitEntry[]>(dateKey(STORAGE_KEYS.LOG_HABITS, today));
    if (habitEntries && habitEntries.length > 0 && habitDefs) {
      const completed = habitEntries.filter((h) => h.completed);
      const missed = habitEntries.filter((h) => !h.completed);
      const missedNames = missed
        .map((h) => sanitizeForPrompt(h.name, 50))
        .join(', ');
      const missedPart = missed.length > 0 ? ` (missed: ${missedNames})` : '';
      conditionalSections.push(
        `[HABITS ${today}] ${completed.length}/${habitEntries.length} completed${missedPart}`,
      );
    }
  }

  // Bodyweight reps (conditional)
  if (messageMatchesKeywords(userMessage, REP_KEYWORDS)) {
    const repEntries = await storageGet<BodyweightRepEntry[]>(dateKey(STORAGE_KEYS.LOG_REPS, today));
    if (repEntries && repEntries.length > 0) {
      const totals = new Map<string, { reps: number; sets: number }>();
      for (const r of repEntries) {
        const prev = totals.get(r.exercise_type) ?? { reps: 0, sets: 0 };
        totals.set(r.exercise_type, {
          reps: prev.reps + r.reps * r.sets,
          sets: prev.sets + r.sets,
        });
      }
      const parts = Array.from(totals.entries())
        .map(([type, t]) => `${type}:${t.reps}(${t.sets}sets)`)
        .join(' ');
      conditionalSections.push(`[REPS ${today}] ${parts}`);
    }
  }

  // ---- Eating Disorder Risk Detection (always computed, safety-critical) ----
  const edRiskFlags: EdRiskFlag[] = [];

  // Determine sex-aware calorie floor (uses metabolic_profile for intersex)
  const effectiveSexForFloor =
    profile?.sex === 'intersex' && profile?.metabolic_profile
      ? profile.metabolic_profile
      : profile?.sex;
  const calorieFloor =
    effectiveSexForFloor === 'female' ? CALORIE_FLOOR_FEMALE :
    effectiveSexForFloor === 'male' ? CALORIE_FLOOR_MALE :
    Math.round((CALORIE_FLOOR_FEMALE + CALORIE_FLOOR_MALE) / 2);

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

  // Mood trend detection — safety-critical, always computed
  const moodTrend = await evaluateMoodTrend();

  // Doctor visits — follow-ups always included, last visits conditional
  {
    const doctorVisits = await storageGet<DoctorVisitEntry[]>(STORAGE_KEYS.LOG_DOCTOR_VISITS);
    if (doctorVisits && doctorVisits.length > 0) {
      // Always include upcoming follow-ups (within 30 days)
      const todayDate = new Date(today + 'T00:00:00');
      const followUps = doctorVisits
        .filter((v) => {
          if (!v.follow_up_date) return false;
          const fuDate = new Date(v.follow_up_date + 'T00:00:00');
          const diffDays = Math.ceil((fuDate.getTime() - todayDate.getTime()) / 86400000);
          return diffDays >= 0 && diffDays <= 30;
        })
        .map((v) => {
          const typeDef = DOCTOR_VISIT_TYPES.find((t) => t.type === v.visit_type);
          const label = v.visit_type === 'specialist' && v.specialist_type
            ? sanitizeForPrompt(v.specialist_type, 50)
            : typeDef?.label ?? v.visit_type;
          return `[DOCTOR FOLLOWUP] ${label} due ${v.follow_up_date}`;
        });
      for (const fu of followUps) {
        conditionalSections.push(fu);
      }

      // Conditional: last visit per type
      if (messageMatchesKeywords(userMessage, DOCTOR_KEYWORDS)) {
        const lastPerType = new Map<string, string>();
        for (const v of doctorVisits) {
          const typeDef = DOCTOR_VISIT_TYPES.find((t) => t.type === v.visit_type);
          const label = typeDef?.label?.split(' ')[0] ?? v.visit_type;
          const existing = lastPerType.get(label);
          if (!existing || v.visit_date > existing) {
            lastPerType.set(label, v.visit_date);
          }
        }
        const parts = Array.from(lastPerType.entries())
          .map(([type, date]) => `${type}:${date}`)
          .join(' ');
        if (parts) {
          conditionalSections.push(`[LAST VISITS] ${parts}`);
        }
      }
    }
  }

  // Allergy status — today's log always included if exists, profile conditional
  {
    const allergyLog = await storageGet<AllergyLogEntry>(dateKey(STORAGE_KEYS.LOG_ALLERGIES, today));
    if (allergyLog) {
      const symptomList = allergyLog.symptoms
        .map((s) => s.replace(/_/g, ' '))
        .join(',');
      const medPart = allergyLog.medication_taken && allergyLog.medication_name
        ? ` — took ${sanitizeForPrompt(allergyLog.medication_name, 100)}`
        : allergyLog.medication_taken ? ' — took medication' : '';
      conditionalSections.push(
        `[ALLERGIES] ${allergyLog.severity}${symptomList ? ` — ${symptomList}` : ''}${medPart}`,
      );
    }

    if (messageMatchesKeywords(userMessage, ALLERGY_KEYWORDS)) {
      const allergyProfile = await storageGet<string[]>(STORAGE_KEYS.PROFILE_ALLERGIES);
      if (allergyProfile && allergyProfile.length > 0) {
        const sanitized = allergyProfile.map((a) => sanitizeForPrompt(a, 50)).join(',');
        conditionalSections.push(`[ALLERGY PROFILE] ${sanitized}`);
      }
    }
  }

  // Sprint 19: Meditation context
  {
    const medEntries = await storageGet<MeditationEntry[]>(dateKey(STORAGE_KEYS.LOG_MEDITATION, today));
    if (medEntries && medEntries.length > 0) {
      const totalMin = medEntries.reduce((s, e) => s + e.duration_minutes, 0);
      const types = [...new Set(medEntries.map((e) => e.type === 'custom' && e.custom_type ? sanitizeForPrompt(e.custom_type, 30) : e.type))];
      // Calculate streak
      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const date = pastDateString(i);
        const dayData = i === 0 ? medEntries : await storageGet<MeditationEntry[]>(dateKey(STORAGE_KEYS.LOG_MEDITATION, date));
        if (dayData && (Array.isArray(dayData) ? dayData.length > 0 : true)) {
          streak++;
        } else {
          break;
        }
      }
      conditionalSections.push(
        `[MEDITATION ${today}] ${totalMin}min ${types.join(',')}${streak > 1 ? `, streak:${streak}d` : ''}`,
      );
    }
  }

  // Sprint 19: Social connection context (7-day window)
  if (messageMatchesKeywords(userMessage, SOCIAL_KEYWORDS)) {
    let totalConnections = 0;
    let qualitySum = 0;
    for (let i = 0; i < 7; i++) {
      const date = pastDateString(i);
      const dayData = await storageGet<SocialConnectionEntry[]>(dateKey(STORAGE_KEYS.LOG_SOCIAL, date));
      if (dayData && dayData.length > 0) {
        totalConnections += dayData.length;
        qualitySum += dayData.reduce((s, e) => s + e.quality, 0);
      }
    }
    if (totalConnections > 0) {
      const avgQuality = (qualitySum / totalConnections).toFixed(1);
      conditionalSections.push(
        `[SOCIAL 7d] ${totalConnections} connections, avg quality:${avgQuality}`,
      );
    }
  }

  // Sprint 19: Sunlight context
  {
    const sunEntries = await storageGet<SunlightEntry[]>(dateKey(STORAGE_KEYS.LOG_SUNLIGHT, today));
    if (sunEntries && sunEntries.length > 0) {
      const totalMin = sunEntries.reduce((s, e) => s + e.duration_minutes, 0);
      const hasNature = sunEntries.some((e) => e.nature);
      conditionalSections.push(
        `[SUNLIGHT ${today}] ${totalMin}min outdoors (nature:${hasNature ? 'yes' : 'no'})`,
      );
    }
  }

  // Sprint 19: Mobility context (7-day window)
  if (messageMatchesKeywords(userMessage, MOBILITY_KEYWORDS)) {
    let totalSessions = 0;
    let totalMin = 0;
    const allTypes = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const date = pastDateString(i);
      const dayData = await storageGet<MobilityEntry[]>(dateKey(STORAGE_KEYS.LOG_MOBILITY, date));
      if (dayData && dayData.length > 0) {
        totalSessions += dayData.length;
        totalMin += dayData.reduce((s, e) => s + e.duration_minutes, 0);
        for (const e of dayData) {
          const label = e.type === 'custom' && e.custom_type
            ? sanitizeForPrompt(e.custom_type, 30)
            : (MOBILITY_TYPES.find((t) => t.value === e.type)?.label ?? e.type);
          allTypes.add(label.toLowerCase());
        }
      }
    }
    if (totalSessions > 0) {
      conditionalSections.push(
        `[MOBILITY 7d] ${totalSessions} sessions, ${totalMin}min total (${[...allTypes].join(',')})`,
      );
    }
  }

  // Sprint 19: Journal context — ONLY non-private entries, firewalled
  {
    const journalEntries = await storageGet<JournalEntry[]>(dateKey(STORAGE_KEYS.LOG_JOURNAL, today));
    if (journalEntries && journalEntries.length > 0) {
      // Only mention that journaling happened — never include content
      // Private entries: completely invisible to Coach
      const nonPrivateCount = journalEntries.filter((e) => !e.private).length;
      const privateCount = journalEntries.filter((e) => e.private).length;
      if (nonPrivateCount > 0) {
        conditionalSections.push(
          `[JOURNAL] ${nonPrivateCount} entry today (content NOT included in context)`,
        );
      }
      // Private entries are NEVER mentioned — same firewall as therapy notes
    }
  }

  // Sprint 19: Sleep schedule adherence
  {
    if (sleepEntry?.bedtime || sleepEntry?.wake_time) {
      const adh = await calculateSleepAdherence(sleepEntry?.bedtime ?? null, sleepEntry?.wake_time ?? null);
      if (adh) {
        const bedPart = adh.bedtimeAdherence
          ? `bedtime:${adh.bedtimeAdherence.diffMinutes > 0 ? '+' : ''}${adh.bedtimeAdherence.diffMinutes}min(${adh.bedtimeAdherence.label})`
          : '';
        const wakePart = adh.wakeAdherence
          ? `wake:${adh.wakeAdherence.diffMinutes > 0 ? '+' : ''}${adh.wakeAdherence.diffMinutes}min(${adh.wakeAdherence.label})`
          : '';
        conditionalSections.push(
          `[SLEEP SCHEDULE] ${[bedPart, wakePart].filter(Boolean).join(' ')}`,
        );
      }
    }
  }

  // Sprint 20: Recipe awareness
  {
    // Show recipe entries logged today
    const todayFoods = foods.filter((f) => f.source === 'recipe');
    if (todayFoods.length > 0) {
      for (const rf of todayFoods) {
        const n = rf.computed_nutrition;
        conditionalSections.push(
          `[RECIPE ${today}] ${sanitizeForPrompt(rf.food_item.name, 80)}(${n?.calories ?? 0}cal,${Math.round(n?.protein_g ?? 0)}p,${Math.round(n?.carbs_g ?? 0)}c,${Math.round(n?.fat_g ?? 0)}f)`,
        );
      }
    }

    // Show recipe library summary when relevant
    if (messageMatchesKeywords(userMessage, RECIPE_KEYWORDS)) {
      const { getMyRecipes } = require('../utils/recipeLibrary');
      const allRecipes = await getMyRecipes();
      if (allRecipes.length > 0) {
        const top3 = allRecipes
          .filter((r: any) => r.timesLogged > 0)
          .sort((a: any, b: any) => b.timesLogged - a.timesLogged)
          .slice(0, 3)
          .map((r: any) => `${sanitizeForPrompt(r.name, 40)}(${r.timesLogged}x)`)
          .join(', ');
        const topPart = top3 ? `, top: ${top3}` : '';
        conditionalSections.push(`[RECIPES] ${allRecipes.length} saved${topPart}`);
      }
    }
  }

  // Sprint 21: Category-aware context — only include elect-in data if enabled
  const enabledCats = await getEnabledCategories();
  const isCatEnabled = (id: ElectInCategoryId) => enabledCats.includes(id);

  // Sprint 21: Perimenopause context (only if enabled and logged)
  if (isCatEnabled('perimenopause')) {
    const periEntry = await storageGet<PerimenopauseEntry>(dateKey(STORAGE_KEYS.LOG_PERIMENOPAUSE, today));
    if (periEntry) {
      const sevLabel = (flashes: { severity: string }[]) => {
        if (flashes.length === 0) return '';
        const counts: Record<string, number> = {};
        for (const f of flashes) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
        const dom = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return `(${dom[0]})`;
      };
      const parts = [
        `hot flashes:${periEntry.hot_flashes_count}${sevLabel(periEntry.hot_flashes)}`,
        `night sweats:${periEntry.night_sweats ? `yes(${periEntry.night_sweats_severity})` : 'no'}`,
        `brain fog:${periEntry.brain_fog}/5`,
        `joint pain:${periEntry.joint_pain}/5${periEntry.joint_pain_areas.length > 0 ? `(${periEntry.joint_pain_areas.join(',')})` : ''}`,
        `energy:${periEntry.energy_level}/5`,
      ];
      conditionalSections.push(`[PERIMENOPAUSE ${today}] ${parts.join(' ')}`);
    }

    // 7-day trend
    if (messageMatchesKeywords(userMessage, PERIMENOPAUSE_KEYWORDS)) {
      let totalFlashes = 0;
      let daysWithData = 0;
      for (let i = 0; i < 7; i++) {
        const d = pastDateString(i);
        const entry = await storageGet<PerimenopauseEntry>(dateKey(STORAGE_KEYS.LOG_PERIMENOPAUSE, d));
        if (entry) {
          totalFlashes += entry.hot_flashes_count;
          daysWithData++;
        }
      }
      if (daysWithData > 1) {
        const avg = (totalFlashes / daysWithData).toFixed(1);
        conditionalSections.push(`[PERIMENOPAUSE 7d] hot flash avg:${avg}/day, ${daysWithData} days logged`);
      }
    }
  }

  // Sprint 21: Breastfeeding context (only if enabled and logged)
  if (isCatEnabled('breastfeeding')) {
    const bfEntries = await storageGet<BreastfeedingEntry[]>(dateKey(STORAGE_KEYS.LOG_BREASTFEEDING, today));
    if (bfEntries && bfEntries.length > 0) {
      const totalMin = bfEntries.reduce((s, e) => s + e.duration_minutes, 0);
      const pumpedOz = bfEntries
        .filter((e) => e.type === 'pumping' && e.output_amount != null)
        .reduce((s, e) => s + (e.output_amount ?? 0), 0);
      const lastFeed = bfEntries[bfEntries.length - 1];
      const hoursAgo = ((Date.now() - new Date(lastFeed.timestamp).getTime()) / 3600000).toFixed(1);
      const parts = [
        `${bfEntries.length} sessions`,
        `${totalMin}min total`,
        pumpedOz > 0 ? `pumped:${pumpedOz.toFixed(1)}oz` : null,
        `last feed:${hoursAgo}h ago`,
      ].filter(Boolean);
      conditionalSections.push(`[BREASTFEEDING ${today}] ${parts.join(', ')}`);
    }

    // 7-day trend
    if (messageMatchesKeywords(userMessage, BREASTFEEDING_KEYWORDS)) {
      let totalSessions = 0;
      let totalPumped = 0;
      let daysWithData = 0;
      for (let i = 0; i < 7; i++) {
        const d = pastDateString(i);
        const entries = await storageGet<BreastfeedingEntry[]>(dateKey(STORAGE_KEYS.LOG_BREASTFEEDING, d));
        if (entries && entries.length > 0) {
          totalSessions += entries.length;
          totalPumped += entries
            .filter((e) => e.type === 'pumping' && e.output_amount != null)
            .reduce((s, e) => s + (e.output_amount ?? 0), 0);
          daysWithData++;
        }
      }
      if (daysWithData > 0) {
        const avgSessions = (totalSessions / daysWithData).toFixed(0);
        const avgPumped = (totalPumped / daysWithData).toFixed(1);
        conditionalSections.push(
          `[BREASTFEEDING 7d] avg ${avgSessions} sessions/day${totalPumped > 0 ? `, ${avgPumped}oz pumped/day` : ''}`,
        );
      }
    }
  }

  // Sprint 22: Migraine context (only if enabled and logged)
  if (isCatEnabled('migraine_tracking')) {
    const migEntry = await storageGet<MigraineEntry>(dateKey(STORAGE_KEYS.LOG_MIGRAINE, today));
    if (migEntry) {
      if (migEntry.occurred) {
        const parts = [
          `severity:${migEntry.severity}/10`,
          migEntry.symptoms.length > 0 ? `symptoms:${migEntry.symptoms.join(',')}` : null,
          migEntry.triggers.length > 0 ? `triggers:${migEntry.triggers.join(',')}` : null,
          migEntry.medication_taken ? `meds:${migEntry.medication_name ?? 'yes'}(relief:${migEntry.relief_rating}/5)` : null,
          migEntry.zip_code ? `zip:${migEntry.zip_code}` : null,
        ].filter(Boolean);
        conditionalSections.push(`[MIGRAINE ${today}] ${parts.join(' ')}`);
      } else {
        conditionalSections.push(`[MIGRAINE ${today}] no migraine`);
      }
    }

    // 7-day summary
    if (messageMatchesKeywords(userMessage, MIGRAINE_KEYWORDS)) {
      let count = 0;
      let totalSeverity = 0;
      const allTriggers = new Map<string, number>();
      const allSymptoms = new Map<string, number>();
      let lastZip: string | null = null;
      for (let i = 0; i < 7; i++) {
        const d = pastDateString(i);
        const entry = await storageGet<MigraineEntry>(dateKey(STORAGE_KEYS.LOG_MIGRAINE, d));
        if (entry?.occurred) {
          count++;
          totalSeverity += entry.severity ?? 0;
          for (const t of entry.triggers) allTriggers.set(t, (allTriggers.get(t) ?? 0) + 1);
          for (const s of entry.symptoms) allSymptoms.set(s, (allSymptoms.get(s) ?? 0) + 1);
          if (entry.zip_code) lastZip = entry.zip_code;
        }
      }
      if (count > 0) {
        const avgSev = (totalSeverity / count).toFixed(1);
        const topTriggers = [...allTriggers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t).join(',');
        const topSymptoms = [...allSymptoms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s).join(',');
        const zipPart = lastZip ? ` zip:${lastZip}` : '';
        conditionalSections.push(
          `[MIGRAINE 7d] ${count} migraines, avg severity:${avgSev}${topTriggers ? ` top triggers:${topTriggers}` : ''}${topSymptoms ? ` top symptoms:${topSymptoms}` : ''}${zipPart}`,
        );
      }
    }
  }

  // Sprint 22: Mood & Mental Health context — CORE, always included when logged
  {
    const moodMentalEntry = await storageGet<MoodMentalEntry>(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today));
    if (moodMentalEntry) {
      // PRIVACY: Never include raw notes in Coach context
      const parts = [
        `mood:${moodMentalEntry.overall_mood}/10`,
        `energy:${moodMentalEntry.energy_level}/5`,
        `anxiety:${moodMentalEntry.anxiety_level}/5`,
        `stress:${moodMentalEntry.stress_level}/5`,
        `clarity:${moodMentalEntry.mental_clarity}/5`,
        moodMentalEntry.emotions.length > 0 ? `emotions:${moodMentalEntry.emotions.join(',')}` : null,
        moodMentalEntry.triggers.length > 0 ? `triggers:${moodMentalEntry.triggers.join(',')}` : null,
        moodMentalEntry.coping_used.length > 0 ? `coping:${moodMentalEntry.coping_used.join(',')}` : null,
      ].filter(Boolean);
      conditionalSections.push(`[MOOD_MENTAL ${today}] ${parts.join(' ')}`);
      tagsLogged.push('mood.mental');
    }

    // 7-day trend
    if (messageMatchesKeywords(userMessage, MOOD_MENTAL_KEYWORDS)) {
      let totalMood = 0;
      let daysWithData = 0;
      const allEmotions = new Map<string, number>();
      const allMoodTriggers = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = pastDateString(i);
        const entry = await storageGet<MoodMentalEntry>(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, d));
        if (entry) {
          totalMood += entry.overall_mood;
          daysWithData++;
          for (const e of entry.emotions) allEmotions.set(e, (allEmotions.get(e) ?? 0) + 1);
          for (const t of entry.triggers) allMoodTriggers.set(t, (allMoodTriggers.get(t) ?? 0) + 1);
        }
      }
      if (daysWithData > 1) {
        const avgMood = (totalMood / daysWithData).toFixed(1);
        const topEmotions = [...allEmotions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e]) => e).join(',');
        const topTriggers = [...allMoodTriggers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t).join(',');
        conditionalSections.push(
          `[MOOD_MENTAL 7d] avg mood:${avgMood}/10, ${daysWithData} days${topEmotions ? ` top emotions:${topEmotions}` : ''}${topTriggers ? ` top triggers:${topTriggers}` : ''}`,
        );
      }
    }
  }

  // Sprint 23: Enhanced sleep context (CORE — always included when logged)
  {
    if (sleepEntry) {
      const parts: (string | null)[] = [];
      if (sleepEntry.total_duration_hours != null) parts.push(`duration:${sleepEntry.total_duration_hours}h`);
      if (sleepEntry.quality != null) parts.push(`quality:${sleepEntry.quality}/5`);
      if (sleepEntry.wake_ups != null && sleepEntry.wake_ups > 0) parts.push(`wake-ups:${sleepEntry.wake_ups}`);
      if (sleepEntry.disturbances && sleepEntry.disturbances.length > 0) parts.push(`disturbances:${sleepEntry.disturbances.join(',')}`);
      if (sleepEntry.nap) parts.push(`nap:${sleepEntry.nap_duration_minutes ?? 0}min`);
      const filtered = parts.filter(Boolean);
      if (filtered.length > 0) {
        conditionalSections.push(`[SLEEP ${today}] ${filtered.join(' ')}`);
      }
    }

    // 7-day averages
    if (messageMatchesKeywords(userMessage, SLEEP_SCHEDULE_KEYWORDS) || messageMatchesKeywords(userMessage, ['sleep', 'rest', 'tired', 'insomnia'])) {
      let totalDuration = 0;
      let totalQuality = 0;
      let daysWithData = 0;
      const disturbanceCounts = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = pastDateString(i);
        const entry = await storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, d));
        if (entry) {
          daysWithData++;
          if (entry.total_duration_hours != null) totalDuration += entry.total_duration_hours;
          else if (entry.bedtime && entry.wake_time) {
            const bed = new Date(entry.bedtime).getTime();
            let wake = new Date(entry.wake_time).getTime();
            if (wake <= bed) wake += 24 * 60 * 60 * 1000;
            totalDuration += (wake - bed) / 3600000;
          }
          if (entry.quality != null) totalQuality += entry.quality;
          if (entry.disturbances) {
            for (const d2 of entry.disturbances) disturbanceCounts.set(d2, (disturbanceCounts.get(d2) ?? 0) + 1);
          }
        }
      }
      if (daysWithData > 1) {
        const avgDur = (totalDuration / daysWithData).toFixed(1);
        const avgQual = (totalQuality / daysWithData).toFixed(1);
        const topDist = [...disturbanceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d2]) => d2).join(',');
        conditionalSections.push(
          `[SLEEP 7d] avg duration:${avgDur}h, avg quality:${avgQual}/5, ${daysWithData} days${topDist ? ` top disturbances:${topDist}` : ''}`,
        );
      }
    }
  }

  // Sprint 23: Body Measurements context (category-gated)
  if (isCatEnabled('body_measurements')) {
    const bmEntry = await storageGet<BodyMeasurementEntry>(dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today));
    if (bmEntry) {
      const parts: (string | null)[] = [
        bmEntry.weight != null ? `weight:${bmEntry.weight}${bmEntry.weight_unit}` : null,
        bmEntry.body_fat_percentage != null ? `bf:${bmEntry.body_fat_percentage}%` : null,
      ].filter(Boolean);
      if (parts.length > 0) {
        conditionalSections.push(`[BODY_MEAS ${today}] ${parts.join(' ')}`);
      }
    }

    // Weight trend: last 4 entries
    if (messageMatchesKeywords(userMessage, BODY_MEASUREMENT_KEYWORDS)) {
      const allKeys = await storageList(STORAGE_KEYS.LOG_BODY_MEASUREMENTS);
      const sortedKeys = allKeys.sort().reverse().slice(0, 4);
      const weights: string[] = [];
      for (const k of sortedKeys) {
        const entry = await storageGet<BodyMeasurementEntry>(k);
        if (entry?.weight != null) {
          weights.push(`${entry.date}:${entry.weight}${entry.weight_unit}`);
        }
      }
      if (weights.length > 1) {
        conditionalSections.push(`[BODY_MEAS trend] ${weights.join(', ')}`);
      }
    }
  }

  // Sprint 23: Medication context (category-gated)
  if (isCatEnabled('medication_tracking')) {
    const medEntry = await storageGet<MedicationEntry>(dateKey(STORAGE_KEYS.LOG_MEDICATIONS, today));
    if (medEntry && medEntry.medications.length > 0) {
      const taken = medEntry.medications.filter((m) => m.taken).length;
      const skipped = medEntry.medications.filter((m) => m.skipped_reason != null).length;
      conditionalSections.push(`[MEDICATIONS ${today}] ${taken}/${medEntry.medications.length} taken${skipped > 0 ? `, ${skipped} skipped` : ''}`);
    }
  }

  // Sprint 21: Filter out elect-in category data from conditionalSections if category is disabled
  // Blood pressure context (already conditional on BP_KEYWORDS, but now also gated on category)
  if (!isCatEnabled('blood_pressure')) {
    const bpIdx = conditionalSections.findIndex((s) => s.startsWith('[BP TODAY]'));
    if (bpIdx >= 0) conditionalSections.splice(bpIdx, 1);
  }
  if (!isCatEnabled('glucose')) {
    const gIdx = conditionalSections.findIndex((s) => s.startsWith('[GLUCOSE TODAY]'));
    if (gIdx >= 0) conditionalSections.splice(gIdx, 1);
  }
  if (!isCatEnabled('bloodwork')) {
    const bwIdx = conditionalSections.findIndex((s) => s.startsWith('[BLOODWORK'));
    if (bwIdx >= 0) conditionalSections.splice(bwIdx, 1);
  }
  if (!isCatEnabled('allergies')) {
    const aIdx = conditionalSections.findIndex((s) => s.startsWith('[ALLERGIES]'));
    if (aIdx >= 0) conditionalSections.splice(aIdx, 1);
    const apIdx = conditionalSections.findIndex((s) => s.startsWith('[ALLERGY PROFILE]'));
    if (apIdx >= 0) conditionalSections.splice(apIdx, 1);
  }
  if (!isCatEnabled('cycle_tracking')) {
    const cIdx = conditionalSections.findIndex((s) => s.startsWith('[CYCLE]'));
    if (cIdx >= 0) conditionalSections.splice(cIdx, 1);
  }
  if (!isCatEnabled('migraine_tracking')) {
    for (let idx = conditionalSections.length - 1; idx >= 0; idx--) {
      if (conditionalSections[idx].startsWith('[MIGRAINE')) {
        conditionalSections.splice(idx, 1);
      }
    }
  }

  // Sprint 22: SAFETY GUARDRAIL — always present in Coach context
  conditionalSections.push(
    '[SAFETY] If the user expresses thoughts of self-harm, suicide, or crisis, do NOT attempt to counsel them. Respond with empathy and immediately direct them to the 988 Suicide & Crisis Lifeline (call or text 988, or chat at 988lifeline.org). You are a wellness tracker, not a therapist.',
  );

  // P2-05: Active milestone for coach context
  const activeMilestone = await getActiveMilestone(consistencyData);
  if (activeMilestone) {
    conditionalSections.push(`[${activeMilestone.toUpperCase()}]`);
  }

  const context: CoachContext = {
    profile: profile ?? {
      name: 'User',
      dob: '',
      units: 'imperial',
      sex: null,
      pronouns: null,
      metabolic_profile: null,
      main_goal: null,
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
      avg_energy: null,
      avg_anxiety: null,
      avg_weight: null,
      weight_count: 0,
      workout_count: 0,
    },
    bmr,
    tdee,
    calorie_target: calorieTarget,
    recovery_score: recoveryScore?.total_score ?? null,
    consistency_28d_pct: consistencyPct(consistencyData),
    // Sprint 25: trend summaries for enhanced coach context
    compliance_7d_avg: compliance7dAvg,
    hydration_goal_progress: hydrationGoalProgress,
    active_correlations: activePatterns,
    active_injuries: injuries,
    latest_bloodwork: bloodwork,
    cycle_phase: cyclePhase,
    sobriety_goals: sobrietyGoals,
    supplement_flags: supplementFlags,
    therapy_today: therapyToday,
    ed_risk_flags: edRiskFlags,
    mood_trend_alert: moodTrend.triggered,
    active_milestone: activeMilestone,
  };

  // Therapy note firewall: verify no therapy content leaked
  const contextJson = JSON.stringify(context) + conditionalSections.join('');
  assertNoTherapyContent(contextJson);

  return { context, conditionalSections };
}

async function compute7DayRolling(_today: string): Promise<RollingStats | null> {
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
    energy: [] as number[],
    anxiety: [] as number[],
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
      const withEnergy = moodEntries.filter((m) => m.energy != null);
      if (withEnergy.length > 0) {
        stats.energy.push(withEnergy.reduce((s, m) => s + m.energy!, 0) / withEnergy.length);
      }
      const withAnxiety = moodEntries.filter((m) => m.anxiety != null);
      if (withAnxiety.length > 0) {
        stats.anxiety.push(withAnxiety.reduce((s, m) => s + m.anxiety!, 0) / withAnxiety.length);
      }
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
    avg_energy: avg(stats.energy),
    avg_anxiety: avg(stats.anxiety),
    avg_weight: avg(stats.weight),
    weight_count: stats.weight.length,
    workout_count: workoutCount,
  };
}
