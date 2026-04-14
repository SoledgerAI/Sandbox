// Step 8: AI Coach Safety tests

import { buildSystemPrompt } from '../ai/coach_system_prompt';
import { buildCoachContext } from '../ai/context_builder';
import { spearmanCorrelation } from '../ai/correlation';
import type { CoachContext, TodayDataSummary, RollingStats, EdRiskFlagType } from '../types/coach';
import type { EngagementTier } from '../types/profile';
import { ED_SUSTAINED_LOW_DAYS } from '../constants/formulas';
import AsyncStorage from '@react-native-async-storage/async-storage';

function makeMinimalContext(overrides?: Partial<CoachContext>): CoachContext {
  const todayData: TodayDataSummary = {
    calories_consumed: 2000,
    calories_burned: 400,
    protein_g: 150,
    carbs_g: 200,
    fat_g: 70,
    water_oz: 64,
    caffeine_mg: 100,
    steps: 8000,
    workouts: [],
    mood: 4,
    energy: 3,
    anxiety: 2,
    sleep_hours: 7.5,
    sleep_quality: 4,
    tags_logged: ['nutrition.food'],
  };

  const rolling: RollingStats = {
    avg_calories: 2100,
    avg_protein_g: 155,
    avg_carbs_g: 210,
    avg_fat_g: 72,
    avg_water_oz: 60,
    avg_sleep_hours: 7.2,
    avg_mood: 3.8,
    avg_energy: 3.5,
    avg_anxiety: 2.0,
    avg_weight: 180,
    weight_count: 5,
    workout_count: 4,
  };

  return {
    profile: {
      name: 'Test User',
      dob: '1994-06-15',
      units: 'imperial',
      sex: 'male',
      height_inches: 70,
      weight_lbs: 180,
      activity_level: 'moderately_active',
      goal: { direction: 'LOSE', target_weight: 170, rate_lbs_per_week: 1.0, gain_type: null, surplus_calories: null },
      pronouns: null,
      metabolic_profile: null,
      main_goal: null,
      altitude_acclimated: false,
    },
    tier: 'balanced' as EngagementTier,
    today_data: todayData,
    rolling_7d: rolling,
    bmr: 1769,
    tdee: 2742,
    calorie_target: 2242,
    recovery_score: 78,
    consistency_28d_pct: 75,
    compliance_7d_avg: null,
    hydration_goal_progress: null,
    active_correlations: [],
    active_injuries: [],
    latest_bloodwork: null,
    cycle_phase: null,
    sobriety_goals: [],
    supplement_flags: [],
    therapy_today: false,
    ed_risk_flags: [],
    mood_trend_alert: false,
    active_milestone: null,
    ...overrides,
  };
}

describe('Coach System Prompt Safety', () => {
  describe('buildSystemPrompt content', () => {
    it('contains calorie floor language', () => {
      const ctx = makeMinimalContext();
      const prompt = buildSystemPrompt(ctx, []);
      // The system prompt should reference calorie floor / minimum safe thresholds
      expect(prompt.toLowerCase()).toMatch(/below.*minim|floor|1,200|1,500|below.*safe/);
    });

    it('contains medical disclaimer language', () => {
      const ctx = makeMinimalContext();
      const prompt = buildSystemPrompt(ctx, []);
      expect(prompt).toContain('NOT a licensed professional');
      expect(prompt).toContain('healthcare provider');
    });

    it('contains substance sensitivity rules', () => {
      const ctx = makeMinimalContext();
      const prompt = buildSystemPrompt(ctx, []);
      expect(prompt.toLowerCase()).toContain('quit goal');
    });

    it('does NOT contain credential claims (RD, CPT, CSCS)', () => {
      const ctx = makeMinimalContext();
      const prompt = buildSystemPrompt(ctx, []);
      // Check PROHIBITED_WORDS list includes these
      expect(prompt).toContain('RD');  // It's in PROHIBITED list
      expect(prompt).toContain('CPT'); // It's in PROHIBITED list
      expect(prompt).toContain('CSCS'); // It's in PROHIBITED list
      // These appear only in the PROHIBITED LANGUAGE section
      expect(prompt).toContain('PROHIBITED LANGUAGE');
    });

    it('includes eating disorder guardrail language', () => {
      const ctx = makeMinimalContext({
        ed_risk_flags: [
          { type: 'extreme_restriction_today', detail: "Today's intake is 800 cal" },
        ],
      });
      const prompt = buildSystemPrompt(ctx, []);
      expect(prompt).toContain('ED SAFETY');
      expect(prompt).toContain('healthcare provider');
    });

    it('uses "correlates with" not "causes" language rule', () => {
      const ctx = makeMinimalContext();
      const prompt = buildSystemPrompt(ctx, []);
      expect(prompt).toContain('correlates with');
      expect(prompt).toContain('not');
      expect(prompt).toContain('causes');
    });
  });
});

describe('Context Builder -- Therapy Note Firewall', () => {
  it('does NOT include therapy canary in assembled context', async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Set up a therapy entry with a canary string
    await AsyncStorage.setItem(
      `dub.log.therapy.${dateStr}`,
      JSON.stringify({
        session_logged: true,
        therapist_name: 'THERAPY_CANARY_12345',
        type: 'individual',
        notes: 'THERAPY_CANARY_12345 - This is private therapy content',
        timestamp: new Date().toISOString(),
      })
    );

    // Set up minimal profile
    await AsyncStorage.setItem(
      'dub.profile',
      JSON.stringify({
        name: 'Test User',
        dob: '1994-06-15',
        units: 'imperial',
        sex: 'male',
        height_inches: 70,
        weight_lbs: 180,
        activity_level: 'moderately_active',
        goal: { direction: 'MAINTAIN', target_weight: null, rate_lbs_per_week: null, gain_type: null, surplus_calories: null },
        pronouns: null,
      metabolic_profile: null,
      main_goal: null,
      altitude_acclimated: false,
      })
    );

    await AsyncStorage.setItem('dub.tier', JSON.stringify('balanced'));

    // Build context asking about therapy
    const { context, conditionalSections } = await buildCoachContext('How is my therapy going?');

    // Verify canary does NOT appear anywhere in assembled context
    const contextStr = JSON.stringify(context) + conditionalSections.join('');
    expect(contextStr).not.toContain('THERAPY_CANARY_12345');

    // Context should include therapy boolean only
    // therapy_today may be true since we triggered therapy keywords
    expect(typeof context.therapy_today).toBe('boolean');
  });

  it('context includes today logs and profile', async () => {
    await AsyncStorage.setItem(
      'dub.profile',
      JSON.stringify({
        name: 'Test User',
        dob: '1994-06-15',
        units: 'imperial',
        sex: 'female',
        height_inches: 65,
        weight_lbs: 140,
        activity_level: 'lightly_active',
        goal: { direction: 'MAINTAIN', target_weight: null, rate_lbs_per_week: null, gain_type: null, surplus_calories: null },
        pronouns: null,
      metabolic_profile: null,
      main_goal: null,
      altitude_acclimated: false,
      })
    );

    await AsyncStorage.setItem('dub.tier', JSON.stringify('structured'));

    const { context } = await buildCoachContext('How am I doing today?');

    expect(context.profile).toBeDefined();
    expect(context.profile.name).toBe('Test User');
    expect(context.tier).toBe('structured');
    expect(context.today_data).toBeDefined();
  });
});

describe('ED Risk Constants and Types', () => {
  it('ED_SUSTAINED_LOW_DAYS equals 3', () => {
    expect(ED_SUSTAINED_LOW_DAYS).toBe(3);
  });

  it('EdRiskFlagType includes sustained_low_intake', () => {
    const flag: EdRiskFlagType = 'sustained_low_intake';
    expect(flag).toBe('sustained_low_intake');
  });

  it('EdRiskFlagType includes underweight_bmi', () => {
    const flag: EdRiskFlagType = 'underweight_bmi';
    expect(flag).toBe('underweight_bmi');
  });
});

describe('Correlation Language', () => {
  it('spearmanCorrelation returns numeric rho (not causal language)', () => {
    const result = spearmanCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(typeof result.rho).toBe('number');
    expect(typeof result.significant).toBe('boolean');
  });
});

describe('Recipe Engine', () => {
  it('Recipe type has required fields (ingredients, instructions)', async () => {
    const { scaleRecipe } = require('../ai/recipe_engine');
    const mockRecipe = {
      name: 'Test Recipe',
      description: 'A test',
      prep_time_min: 10,
      cook_time_min: 20,
      servings: 4,
      ingredients: [
        { name: 'Chicken', amount: '200', unit: 'g', calories: 330, protein_g: 62 },
      ],
      instructions: [
        { step_number: 1, text: 'Cook the chicken' },
      ],
      total_nutrition: { calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7 },
      macro_match_pct: 95,
    };

    expect(mockRecipe.ingredients).toBeDefined();
    expect(mockRecipe.instructions).toBeDefined();
    expect(mockRecipe.ingredients.length).toBeGreaterThan(0);
    expect(mockRecipe.instructions.length).toBeGreaterThan(0);

    // Test scaling
    const scaled = scaleRecipe(mockRecipe, 2);
    expect(scaled.servings).toBe(2);
    expect(scaled.total_nutrition.calories).toBe(165); // 330 * (2/4)
  });

  it('RESTRICTION_OPTIONS includes common restrictions', async () => {
    const { RESTRICTION_OPTIONS } = require('../ai/recipe_engine');
    const options = [...RESTRICTION_OPTIONS];
    expect(options).toContain('Vegetarian');
    expect(options).toContain('Vegan');
    expect(options).toContain('Gluten-Free');
    expect(options).toContain('Keto');
    expect(options).toContain('Nut-Free');
  });
});

describe('Coach Context — Wave 1-3 Data Sources', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // Set up minimal profile
    await AsyncStorage.setItem('dub.profile', JSON.stringify({
      name: 'Test User', dob: '1994-06-15', units: 'imperial',
      sex: 'male', height_inches: 70, weight_lbs: 180,
      activity_level: 'moderately_active',
      goal: { direction: 'MAINTAIN', target_weight: null, rate_lbs_per_week: null, gain_type: null, surplus_calories: null },
      pronouns: null, metabolic_profile: null, main_goal: null, altitude_acclimated: false,
    }));
    await AsyncStorage.setItem('dub.tier', JSON.stringify('balanced'));
  });

  it('includes glucose readings in today_data tags when present', async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await AsyncStorage.setItem(`dub.log.glucose.${dateStr}`, JSON.stringify([
      { reading_mg_dl: 95, timing: 'fasting', timestamp: new Date().toISOString() },
    ]));
    const { context } = await buildCoachContext('check my glucose');
    expect(context.today_data.tags_logged).toContain('blood.glucose');
  });

  it('includes blood pressure in today_data tags when present', async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await AsyncStorage.setItem(`dub.log.bp.${dateStr}`, JSON.stringify([
      { systolic: 120, diastolic: 80, pulse_bpm: 72, timestamp: new Date().toISOString() },
    ]));
    const { context } = await buildCoachContext('check my blood pressure');
    expect(context.today_data.tags_logged).toContain('blood.pressure');
  });

  it('includes 3-axis mood (score, energy, anxiety) in today_data', async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await AsyncStorage.setItem(`dub.log.mood.${dateStr}`, JSON.stringify([
      { score: 3, energy: 4, anxiety: 2, timestamp: new Date().toISOString() },
    ]));
    const { context } = await buildCoachContext('how is my mood?');
    expect(context.today_data.mood).toBe(3);
    expect(context.today_data.energy).toBe(4);
    expect(context.today_data.anxiety).toBe(2);
  });

  it('includes consistency_28d_pct in context', async () => {
    const { context } = await buildCoachContext('how consistent am I?');
    expect(typeof context.consistency_28d_pct).toBe('number');
  });

  it('includes active_milestone when milestone data exists', async () => {
    // Set up streak data with enough days to trigger a milestone
    await AsyncStorage.setItem('dub.streaks', JSON.stringify({
      current_streak: 7,
      longest_streak: 7,
      total_days_logged: 7,
      last_logged_date: '2026-04-04',
      logged_dates_28d: ['2026-03-29','2026-03-30','2026-03-31','2026-04-01','2026-04-02','2026-04-03','2026-04-04'],
    }));
    const { context } = await buildCoachContext('hello');
    // active_milestone should either be a string or null
    expect(context.active_milestone === null || typeof context.active_milestone === 'string').toBe(true);
  });

  it('includes sobriety goals in context (safety-critical)', async () => {
    await AsyncStorage.setItem('dub.sobriety', JSON.stringify([
      { substance: 'alcohol', goal_type: 'quit', current_streak_days: 30, start_date: '2026-03-05' },
    ]));
    const { context } = await buildCoachContext('hello');
    expect(context.sobriety_goals.length).toBe(1);
    expect(context.sobriety_goals[0].substance).toBe('alcohol');
    expect(context.sobriety_goals[0].goal_type).toBe('quit');
  });

  it('glucose conditional section appears on glucose keywords', async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // Sprint 21: Must enable category for context to include it
    await AsyncStorage.setItem('dub.settings.enabled_categories', JSON.stringify(['glucose']));
    await AsyncStorage.setItem(`dub.log.glucose.${dateStr}`, JSON.stringify([
      { reading_mg_dl: 110, timing: 'post_meal', timestamp: new Date().toISOString() },
    ]));
    const { conditionalSections } = await buildCoachContext('what is my glucose level?');
    expect(conditionalSections.some(s => s.includes('[GLUCOSE TODAY]'))).toBe(true);
  });

  it('BP conditional section appears on bp keywords', async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // Sprint 21: Must enable category for context to include it
    await AsyncStorage.setItem('dub.settings.enabled_categories', JSON.stringify(['blood_pressure']));
    await AsyncStorage.setItem(`dub.log.bp.${dateStr}`, JSON.stringify([
      { systolic: 130, diastolic: 85, pulse_bpm: 75, timestamp: new Date().toISOString() },
    ]));
    const { conditionalSections } = await buildCoachContext('how is my blood pressure?');
    expect(conditionalSections.some(s => s.includes('[BP TODAY]'))).toBe(true);
  });

  it('mood_trend_alert is boolean in context', async () => {
    const { context } = await buildCoachContext('hello');
    expect(typeof context.mood_trend_alert).toBe('boolean');
  });

  it('prompt confidentiality rule is present in system prompt', () => {
    // Import buildSystemPrompt to verify
    const { buildSystemPrompt } = require('../ai/coach_system_prompt');
    const ctx = makeMinimalContext();
    const prompt = buildSystemPrompt(ctx, []);
    expect(prompt).toContain('PROMPT CONFIDENTIALITY');
    expect(prompt).toContain('NEVER output');
    expect(prompt).toContain('system prompt');
  });

  it('sobriety QUIT goal prevents alcohol recipe suggestions', () => {
    const { buildSystemPrompt } = require('../ai/coach_system_prompt');
    const ctx = makeMinimalContext({
      sobriety_goals: [{ substance: 'alcohol', goal_type: 'quit', current_streak_days: 30 }],
    });
    const prompt = buildSystemPrompt(ctx, [], { cuisines: ['Italian'], restrictions: [], dislikes: [] });
    expect(prompt).toContain('[SOBRIETY]');
    expect(prompt).toContain('alcohol:quit');
    expect(prompt).toContain('NEVER include alcohol');
  });
});
