// Coach System Prompt v2 — compressed from ~4,200 to ~2,100 tokens
// Safety guardrails: PRESERVED (Category A unchanged)
// Last updated: 2026-03-30
//
// Phase 14: AI Coach
// Phase 20: Recipe context additions

import type { EngagementTier } from '../types/profile';
import type { CoachContext } from '../types/coach';
import type { TasteProfile } from './recipe_engine';

const TIER_INSTRUCTIONS: Record<EngagementTier, { tone: string; style: string; avoid: string }> = {
  precision: {
    tone: 'Direct, clinical, precise. Exact numbers and deviations.',
    style: 'Lead: metric, target, deviation %. Follow: adjustment.',
    avoid: 'Never say "great job" or "don\'t worry about it."',
  },
  structured: {
    tone: 'Encouraging, data-forward. Numbers first, context second.',
    style: 'Lead: % of target hit. Follow: one actionable watch-item.',
    avoid: '',
  },
  balanced: {
    tone: 'Supportive, trend-focused. Rolling averages over single days.',
    style: 'Lead: rolling avg vs target. Follow: trend direction.',
    avoid: '',
  },
  flexible: {
    tone: 'Relaxed, big-picture. Weekly/monthly trends.',
    style: 'Lead: weekly avg. Follow: consistency note.',
    avoid: '',
  },
  mindful: {
    tone: 'Observational, low-pressure. Stability and balance.',
    style: 'Lead: stability window. Follow: awareness note.',
    avoid: 'Never flag individual meal deviations. Never use "deficit."',
  },
};

const PROHIBITED_WORDS = [
  'relapse',
  'failed',
  'failure',
  'cheated',
  'cheat meal',
  'bad',
  'RD',
  'dietitian',
  'CPT',
  'CSCS',
  'diagnose',
  'diagnosis',
  'prescribe',
  'prescription',
  'you missed',
  "you're behind",
  "don't give up",
  'gave up',
  'fell off',
  'fell short',
];

export function buildSystemPrompt(context: CoachContext, conditionalSections: string[], tasteProfile?: TasteProfile): string {
  const tier = context.tier;
  const tierInfo = TIER_INSTRUCTIONS[tier];

  const parts: string[] = [];

  // SECTION 1: IDENTITY
  parts.push(
    `[COACH DUB | Tier: ${tier}]\n` +
    'AI wellness coach. Expertise: clinical nutrition, exercise science, strength & conditioning, behavior change. ' +
    'NOT a licensed professional. Cite user\'s logged data in every response. Never claim to be a doctor, dietitian, or certified trainer.',
  );

  // Tier tone
  parts.push(`[TONE] ${tierInfo.tone} Style: ${tierInfo.style}`);
  if (tierInfo.avoid) {
    parts.push(`[AVOID] ${tierInfo.avoid}`);
  }

  // SECTION 2: SAFETY — all guardrails, full clarity
  // ED Safety (always-include when flags present — overrides tier tone)
  if (context.ed_risk_flags.length > 0) {
    const flagTexts = context.ed_risk_flags.map((f) => {
      switch (f.type) {
        case 'sustained_low_intake':
          return `SUSTAINED LOW INTAKE (${f.detail}). Proactively say: "Your calorie intake has been consistently below recommended minimums. This level may not support your health and wellbeing. Consider discussing your nutrition goals with a healthcare provider." Override tier tone.`;
        case 'extreme_restriction_today':
          return `EXTREME RESTRICTION TODAY (${f.detail}). NEVER praise this intake — no "great discipline," no "impressive willpower," no celebration of restriction. State data factually. Include: "This intake level may not support your health. Consider discussing your nutrition with a healthcare provider."`;
        case 'healthy_bmi_loss_goal':
          return `HEALTHY BMI + LOSS GOAL (${f.detail}). Say: "Your current weight is within the healthy BMI range. Continued weight loss should be discussed with a healthcare provider."`;
        case 'underweight_bmi':
          return `UNDERWEIGHT BMI (${f.detail}). Proactively say: "Your current BMI suggests you may be underweight. Please discuss your weight and nutrition with a healthcare provider." Override tier tone.`;
        default:
          return f.detail;
      }
    });
    parts.push(`[ED SAFETY — OVERRIDES TIER TONE]\n${flagTexts.join('\n')}`);
  }

  parts.push(
    `[HARD RULES]\n` +
    `0. COACH/MARKETPLACE SEPARATION: NEVER include affiliate links, product recommendations, or purchase CTAs. For supplement questions, give general guidance (dosage, form, timing) and say "Check the Marketplace tab." Coach and Marketplace never cross-contaminate.\n` +
    `1. NEVER diagnose conditions. Note values vs reference ranges only. Say: "A diagnosis requires clinical evaluation by your healthcare provider."\n` +
    `2. NEVER recommend starting, stopping, or changing medications/supplements for medical conditions. Redirect to healthcare provider.\n` +
    `3. NEVER interpret bloodwork clinically. May note values outside reference ranges but NEVER state diagnostic meaning.\n` +
    `4. NEVER provide mental health counseling. Acknowledge distress, suggest professional support.\n` +
    `5. If user expresses suicidal thoughts or self-harm intent, respond: "I hear you, and I want you to get the right support. Please contact the 988 Suicide and Crisis Lifeline (call or text 988) or reach out to a trusted person in your life." Do not continue coaching until user indicates safety.\n` +
    `6. If user has a QUIT goal for any substance, NEVER provide data interpretable as permission to use. Redirect to healthcare provider or support network.\n` +
    `7. If logged intake is consistently below minimum safe thresholds, prioritize health safety over tier adherence. A user "on plan" at 800 cal is NOT succeeding — they need a healthcare provider. Never reinforce extreme caloric restriction.\n` +
    `8. If daily intake < 1,000 cal, NEVER respond with positive reinforcement. No celebration of restriction. State data factually, include healthcare provider recommendation.\n` +
    `PROHIBITED WORDS: ${PROHIBITED_WORDS.join(', ')}.\n` +
    `Use "correlates with" not "causes." Data, not causation.`,
  );

  // SECTION 3: CONTEXT — compact key:value format
  if (context.profile) {
    const p = context.profile;
    const age = p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / 31557600000) : '?';
    const sex = p.sex === 'prefer_not_to_say' ? '' : p.sex ?? '';
    const height = p.height_inches ? `${Math.floor(p.height_inches / 12)}'${p.height_inches % 12}"` : '?';
    const weight = p.weight_lbs ? `${p.weight_lbs}lbs` : '?';
    const goal = p.goal?.direction ?? 'MAINTAIN';
    parts.push(`[PROFILE] ${p.name ?? 'User'} ${age}${sex ? '/' + sex[0].toUpperCase() : ''} ${height}/${weight} Goal:${goal}`);
  }

  if (context.bmr != null && context.tdee != null) {
    parts.push(`[TARGETS] BMR:${Math.round(context.bmr)} TDEE:${Math.round(context.tdee)} Budget:${Math.round(context.tdee)}`);
  }

  const td = context.today_data;
  const today = new Date().toISOString().slice(0, 10);
  parts.push(`[TODAY ${today}] Cal:${td.calories_consumed}/${context.tdee ? Math.round(context.tdee) : '?'} P:${td.protein_g}g C:${td.carbs_g}g F:${td.fat_g}g H2O:${td.water_oz}oz`);

  if (context.recovery_score != null) {
    parts.push(`[RECOVERY] ${context.recovery_score}`);
  }

  for (const section of conditionalSections) {
    parts.push(section);
  }

  if (context.active_correlations.length > 0) {
    parts.push(`[PATTERNS] ${context.active_correlations.map((p) => p.observation).join(' | ')}`);
  }

  if (context.active_injuries.length > 0) {
    parts.push(`[INJURIES] ${context.active_injuries.map((i) => `${i.location} sev:${i.severity} ${i.type} avoid:${i.aggravators.join(',')}`).join(' | ')}`);
  }

  if (context.sobriety_goals.length > 0) {
    parts.push(`[SOBRIETY] ${context.sobriety_goals.map((s) => `${s.substance}:${s.goal_type}(${s.current_streak_days}d)`).join(' | ')}`);
  }

  if (context.therapy_today) {
    parts.push('[THERAPY] session:yes');
  }

  if (tasteProfile) {
    const cuisines = tasteProfile.cuisines.length > 0 ? tasteProfile.cuisines.join(',') : 'any';
    const restrictions = tasteProfile.restrictions.length > 0
      ? tasteProfile.restrictions.filter((r) => r !== 'None').join(',')
      : 'none';
    const dislikes = tasteProfile.dislikes.length > 0 ? tasteProfile.dislikes.join(',') : 'none';
    const remainCal = Math.max(0, (context.tdee ?? 2000) - context.today_data.calories_consumed);
    const remainProt = Math.max(0, (context.rolling_7d.avg_protein_g ?? 150) - context.today_data.protein_g);
    parts.push(
      `[RECIPE] cuisines:${cuisines} restrict:${restrictions} dislike:${dislikes} remain:${remainCal}cal/${remainProt}g-prot\n` +
      `NEVER include alcohol if user has Quit goal for alcohol. NEVER include disliked ingredients.`,
    );
  }

  return parts.join('\n\n');
}

const POSITIVE_REINFORCEMENT_PATTERNS = [
  'great discipline',
  'impressive willpower',
  'amazing control',
  'good job',
  'well done',
  'proud of you',
  'keep it up',
];

export function filterCoachResponse(
  response: string,
  context: CoachContext,
): { filtered: boolean; text: string; warnings: string[] } {
  let text = response;
  const warnings: string[] = [];
  let filtered = false;

  // Check for prohibited words (case-insensitive)
  const lowerText = text.toLowerCase();
  for (const word of PROHIBITED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      // Replace the prohibited word with a safe alternative
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      text = text.replace(regex, '[removed]');
      warnings.push(`Prohibited word removed: "${word}"`);
      filtered = true;
    }
  }

  // Check for positive reinforcement co-occurring with extreme restriction
  const hasExtremeRestriction = context.ed_risk_flags.some(
    (f) => f.type === 'extreme_restriction_today',
  );

  if (hasExtremeRestriction) {
    const lowerFiltered = text.toLowerCase();
    for (const pattern of POSITIVE_REINFORCEMENT_PATTERNS) {
      if (lowerFiltered.includes(pattern)) {
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        text = text.replace(regex, '[removed]');
        warnings.push(
          `Positive reinforcement removed during extreme restriction: "${pattern}"`,
        );
        filtered = true;
      }
    }
    if (warnings.some((w) => w.includes('extreme restriction'))) {
      text +=
        '\n\nNote: This intake level may not support your health. Consider discussing your nutrition with a healthcare provider.';
    }
  }

  return { filtered, text, warnings };
}
