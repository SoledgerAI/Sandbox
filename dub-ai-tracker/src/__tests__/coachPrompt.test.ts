// Coach Prompt Compression — Safety Preservation Tests
// Verifies compressed prompt retains all Category A safety guardrails

import { buildSystemPrompt } from '../ai/coach_system_prompt';
import { estimateTokens } from '../utils/tokenEstimator';
import type { CoachContext, TodayDataSummary, RollingStats } from '../types/coach';
import type { EngagementTier } from '../types/profile';

function makeContext(overrides?: Partial<CoachContext>): CoachContext {
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
    avg_weight: 180,
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
    active_correlations: [],
    active_injuries: [],
    latest_bloodwork: null,
    cycle_phase: null,
    sobriety_goals: [],
    supplement_flags: [],
    therapy_today: false,
    ed_risk_flags: [],
    ...overrides,
  };
}

describe('Coach Prompt Safety Preservation', () => {
  const basePrompt = buildSystemPrompt(makeContext(), []);

  // 1. EATING DISORDER GUARDRAILS
  describe('Eating disorder guardrails', () => {
    it('mentions eating disorder detection via ED safety section', () => {
      const ctx = makeContext({
        ed_risk_flags: [{ type: 'extreme_restriction_today', detail: '800 cal' }],
      });
      const prompt = buildSystemPrompt(ctx, []);
      expect(prompt).toContain('ED SAFETY');
    });

    it('prohibits praising caloric restriction', () => {
      expect(basePrompt).toMatch(/NEVER.*positive reinforcement|NEVER.*celebration of restriction/i);
    });

    it('frames deficits as health concern, not success', () => {
      expect(basePrompt).toContain('NOT succeeding');
      expect(basePrompt).toContain('healthcare provider');
    });
  });

  // 2. LOW INTAKE WARNING
  describe('Low intake warning', () => {
    it('specifies minimum caloric thresholds', () => {
      expect(basePrompt).toMatch(/below.*minimum.*safe|below.*1,000/i);
    });

    it('requires flagging dangerously low intake', () => {
      expect(basePrompt).toMatch(/800 cal/i);
      expect(basePrompt).toContain('healthcare provider');
    });
  });

  // 3. CELEBRATION SUPPRESSION
  describe('Celebration suppression', () => {
    it('prohibits celebrating restriction', () => {
      expect(basePrompt).toMatch(/no celebration of restriction|NEVER.*positive reinforcement/i);
    });

    it('ED flag prompt prohibits praise words', () => {
      const ctx = makeContext({
        ed_risk_flags: [{ type: 'extreme_restriction_today', detail: '500 cal' }],
      });
      const prompt = buildSystemPrompt(ctx, []);
      expect(prompt).toContain('great discipline');
      expect(prompt).toContain('impressive willpower');
    });
  });

  // 4. CONTENT FILTER
  describe('Content filter', () => {
    it('stays in health domain (no diagnosis)', () => {
      expect(basePrompt).toContain('NEVER diagnose');
    });

    it('prohibits medical diagnosis', () => {
      expect(basePrompt).toContain('clinical evaluation');
    });

    it('requires healthcare provider disclaimer', () => {
      expect(basePrompt).toContain('healthcare provider');
    });

    it('marketplace separation rule present', () => {
      expect(basePrompt).toContain('COACH/MARKETPLACE SEPARATION');
      expect(basePrompt).toContain('Marketplace tab');
    });
  });

  // 5. SELF-HARM PROTOCOL
  describe('Self-harm protocol', () => {
    it('includes 988 crisis lifeline', () => {
      expect(basePrompt).toContain('988');
      expect(basePrompt).toContain('Suicide and Crisis Lifeline');
    });

    it('requires crisis resources for self-harm', () => {
      expect(basePrompt).toMatch(/suicidal|self-harm/i);
    });

    it('stops coaching until user indicates safety', () => {
      expect(basePrompt).toContain('Do not continue wellness coaching until the user indicates they are safe');
    });
  });

  // 6. TOKEN SIZE CHECK
  describe('Token size', () => {
    it('base prompt (minimal context) is <= 2,500 estimated tokens', () => {
      // MASTER-35: Tier examples add ~200 tokens; MASTER-33: expanded prohibited words
      const tokens = estimateTokens(basePrompt);
      expect(tokens).toBeLessThanOrEqual(2500);
    });

    it('base prompt is >= 500 estimated tokens (safety floor — catches gutted prompts)', () => {
      const tokens = estimateTokens(basePrompt);
      expect(tokens).toBeGreaterThanOrEqual(500);
    });

    it('full-context prompt (with ED flags, injuries, sobriety) stays <= 2,500 tokens', () => {
      const ctx = makeContext({
        ed_risk_flags: [
          { type: 'extreme_restriction_today', detail: '800 cal' },
          { type: 'sustained_low_intake', detail: 'Below 1500 cal on 4 of 7 days' },
        ],
        active_injuries: [
          { location: 'left knee', severity: 7, type: 'acute', aggravators: ['squats', 'lunges'] },
        ],
        sobriety_goals: [
          { substance: 'alcohol', goal_type: 'quit', current_streak_days: 14 },
        ],
        active_correlations: [
          { id: 'corr-1', category: 'hydration', observation: 'Higher water intake correlates with better mood scores', data_range: '30d', sample_size: 28, correlation_note: 'rho=0.72', detected_at: '2026-03-01T00:00:00Z' },
        ],
      });
      const prompt = buildSystemPrompt(ctx, ['[7D] Cal:1800avg P:140g Sleep:7.1h']);
      const tokens = estimateTokens(prompt);
      expect(tokens).toBeLessThanOrEqual(2500);
    });
  });

  // Additional safety checks
  describe('Additional safety rules', () => {
    it('prohibits medication recommendations', () => {
      expect(basePrompt).toMatch(/NEVER.*medication/i);
    });

    it('prohibits clinical bloodwork interpretation', () => {
      expect(basePrompt).toMatch(/NEVER.*interpret.*bloodwork.*clinically/i);
    });

    it('prohibits mental health counseling', () => {
      expect(basePrompt).toMatch(/NEVER.*mental health counseling/i);
    });

    it('includes substance quit goal rule', () => {
      expect(basePrompt).toContain('QUIT goal');
    });

    it('includes prohibited words list', () => {
      expect(basePrompt).toContain('PROHIBITED LANGUAGE');
      expect(basePrompt).toContain('relapse');
      expect(basePrompt).toContain('cheated');
    });

    it('uses correlates-with not causes language', () => {
      expect(basePrompt).toContain('correlates with');
      expect(basePrompt).toContain('not');
      expect(basePrompt).toContain('causes');
    });

    it('declares NOT a licensed professional', () => {
      expect(basePrompt).toContain('NOT a licensed professional');
    });
  });
});
