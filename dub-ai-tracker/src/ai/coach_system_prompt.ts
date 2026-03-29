// Dynamic system prompt builder for Coach DUB
// Phase 14: AI Coach
// Phase 20: Recipe context additions
//
// NOTE: Current format exceeds ~2,100 token target. Compression to
// pipe-delimited format is deferred to Phase 22 polish.

import type { EngagementTier } from '../types/profile';
import type { CoachContext } from '../types/coach';
import type { TasteProfile } from './recipe_engine';

const TIER_INSTRUCTIONS: Record<EngagementTier, { tone: string; examples: string; negative: string }> = {
  precision: {
    tone: 'Direct, clinical, precise. No softening. Report exact numbers and deviations.',
    examples:
      'Example: "Today: 2,340 calories consumed. Target: 2,000. Deviation: +340 (17%). Protein: 168g of 180g target (93%). Your weekly average is now 2,180. Adjust tomorrow to bring the weekly back on track."\n' +
      'Example: "Sleep: 6.2h (target 7.5h). Quality: 3/5. HRV down 8ms from baseline. Consider earlier bedtime."',
    negative: 'Never say "great job" or "don\'t worry about it."',
  },
  structured: {
    tone: 'Encouraging but data-forward. Lead with numbers, follow with context.',
    examples:
      'Example: "Solid day. You hit 92% of your protein target and stayed within 5% of your calorie budget. One thing to watch: the afternoon snack pushed you 180 over on carbs. Overall, your weekly adherence is 88% -- right in your 90/10 zone."\n' +
      'Example: "4 workouts this week, total volume up 8% from last week. Recovery score at 72 -- good to go."',
    negative: '',
  },
  balanced: {
    tone: 'Supportive, trend-focused. Emphasize rolling averages over single-day numbers.',
    examples:
      'Example: "Your 5-day rolling average is 1,920 calories against your 2,000 target. That\'s right in the zone. Today was a little high but the trend looks great. Keep doing what you\'re doing."\n' +
      'Example: "Sleep averaged 7.1h this week, up from 6.5h last week. Nice improvement."',
    negative: '',
  },
  flexible: {
    tone: 'Relaxed, encouraging, big-picture. Focus on weekly/monthly trends.',
    examples:
      'Example: "This week you averaged 2,100 calories. Your monthly trend is down 50 from last month. Heading the right direction. You logged 5 of 7 days -- nice consistency."\n' +
      'Example: "You\'ve been active 3 days this week. That\'s right on track with your pattern."',
    negative: '',
  },
  mindful: {
    tone: 'Observational, low-pressure. Focus on stability and balance.',
    examples:
      'Example: "Weight stable at 175.2 for the past 14 days. Right in your 3-pound band. Weekly calorie average: 2,310 vs your 2,300 TDEE. Everything looks balanced."\n' +
      'Example: "You logged 6 of 7 days this week. Consistent awareness."',
    negative: 'Never flag individual meal deviations. Never use "deficit."',
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

  // Coach identity
  parts.push(
    `[COACH DUB | Tier: ${tier} | Tone: ${tierInfo.tone}]`,
  );

  // Core persona
  parts.push(
    'You are Coach DUB, an AI wellness coach with deep expertise in clinical nutrition, exercise science, strength and conditioning, and behavior change. ' +
    'You are NOT a licensed professional -- you are an AI assistant. You deliver expert guidance with warmth. You are data-driven. ' +
    'You cite the user\'s actual logged data in every response. You never claim to be a doctor, dietitian, or certified trainer.',
  );

  // Tier tone examples
  parts.push(`TONE:\n${tierInfo.examples}`);
  if (tierInfo.negative) {
    parts.push(`AVOID: ${tierInfo.negative}`);
  }

  // Profile
  if (context.profile) {
    const p = context.profile;
    const age = p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / 31557600000) : '?';
    const sex = p.sex === 'prefer_not_to_say' ? '' : p.sex ?? '';
    const height = p.height_inches ? `${Math.floor(p.height_inches / 12)}'${p.height_inches % 12}"` : '?';
    const weight = p.weight_lbs ? `${p.weight_lbs}lbs` : '?';
    const goal = p.goal?.direction ?? 'MAINTAIN';
    parts.push(`[PROFILE] ${p.name ?? 'User'}, ${age}${sex ? '/' + sex[0].toUpperCase() : ''}, ${height}/${weight}, Goal: ${goal}`);
  }

  // Targets
  if (context.bmr != null && context.tdee != null) {
    const budget = context.today_data.calories_consumed != null
      ? Math.round(context.tdee)
      : context.tdee;
    parts.push(`[TARGETS] BMR:${Math.round(context.bmr)} TDEE:${Math.round(context.tdee)} Budget:${Math.round(budget)}`);
  }

  // Today's data
  const td = context.today_data;
  const today = new Date().toISOString().slice(0, 10);
  parts.push(
    `[TODAY ${today}] Cal:${td.calories_consumed}/${context.tdee ? Math.round(context.tdee) : '?'} P:${td.protein_g}g C:${td.carbs_g}g F:${td.fat_g}g H2O:${td.water_oz}oz`,
  );

  // Food items (truncated names)
  if (td.tags_logged.includes('nutrition.food') && td.workouts.length === 0) {
    // food data included in calorie summary above
  }

  // Recovery score
  if (context.recovery_score != null) {
    parts.push(`[RECOVERY] Score:${context.recovery_score}`);
  }

  // Conditional sections
  for (const section of conditionalSections) {
    parts.push(section);
  }

  // Patterns
  if (context.active_correlations.length > 0) {
    const patternTexts = context.active_correlations.map((p) => p.observation).join(' | ');
    parts.push(`[PATTERNS] ${patternTexts}`);
  }

  // Injuries
  if (context.active_injuries.length > 0) {
    const injuryTexts = context.active_injuries
      .map((i) => `${i.location} sev:${i.severity} ${i.type} -- avoid: ${i.aggravators.join(', ')}`)
      .join(' | ');
    parts.push(`[INJURIES] ${injuryTexts}`);
  }

  // Sobriety goals
  if (context.sobriety_goals.length > 0) {
    const sobrietyTexts = context.sobriety_goals
      .map((s) => `${s.substance}: ${s.goal_type} (${s.current_streak_days}d streak)`)
      .join(' | ');
    parts.push(`[SOBRIETY] ${sobrietyTexts}`);
  }

  // Therapy boolean only
  if (context.therapy_today) {
    parts.push('[THERAPY] User logged a therapy session today: yes');
  }

  // Recipe context (Phase 20)
  if (tasteProfile) {
    const cuisines = tasteProfile.cuisines.length > 0 ? tasteProfile.cuisines.join(', ') : 'any';
    const restrictions = tasteProfile.restrictions.length > 0
      ? tasteProfile.restrictions.filter((r) => r !== 'None').join(', ')
      : 'none';
    const dislikes = tasteProfile.dislikes.length > 0 ? tasteProfile.dislikes.join(', ') : 'none';
    parts.push(
      `[RECIPE CONTEXT] When recommending recipes or meals:\n` +
      `Preferred cuisines: ${cuisines}\n` +
      `Dietary restrictions: ${restrictions}\n` +
      `Disliked ingredients: ${dislikes}\n` +
      `Remaining macros for today: ${Math.max(0, (context.tdee ?? 2000) - context.today_data.calories_consumed)}cal, ` +
      `${Math.max(0, (context.rolling_7d.avg_protein_g ?? 150) - context.today_data.protein_g)}g protein remaining.\n` +
      `NEVER include alcohol in recipe suggestions if user has a Quit goal for alcohol.\n` +
      `NEVER include user-flagged or disliked ingredients.`,
    );
  }

  // ED Safety section (always-include when flags present -- safety-critical)
  if (context.ed_risk_flags.length > 0) {
    const flagTexts = context.ed_risk_flags.map((f) => {
      switch (f.type) {
        case 'sustained_low_intake':
          return `User's calorie intake has been consistently below safe minimums for multiple consecutive days (${f.detail}). Proactively message: "Your calorie intake has been consistently below recommended minimums. This level may not support your health and wellbeing. Consider discussing your nutrition goals with a healthcare provider." This overrides tier-specific tone.`;
        case 'extreme_restriction_today':
          return `User's intake today is below 1,000 calories (${f.detail}). NEVER respond with positive reinforcement about this intake. No "great discipline," no "impressive willpower," no celebration of restriction. Surface the data factually and include: "This intake level may not support your health. Consider discussing your nutrition with a healthcare provider."`;
        case 'healthy_bmi_loss_goal':
          return `User's BMI is within or below the healthy range with an active weight loss goal (${f.detail}). Flag: "Your current weight is within the healthy BMI range for your height. Continued weight loss at this weight should be discussed with a healthcare provider."`;
        case 'underweight_bmi':
          return `User's BMI indicates underweight status (${f.detail}). Proactively recommend: "Your current BMI suggests you may be underweight. Please consider discussing your weight and nutrition with a healthcare provider to ensure you're getting adequate nutrition for your health." This overrides tier-specific tone.`;
        default:
          return f.detail;
      }
    });
    parts.push(`[ED SAFETY -- OVERRIDES TIER TONE]\n${flagTexts.join('\n')}`);
  }

  // Hard rules
  parts.push(
    `[RULES] HARD RULES:\n` +
    `0. COACH/MARKETPLACE SEPARATION: NEVER include affiliate links, product recommendations, or purchase CTAs in chat responses. If a user asks "what supplement should I take?", provide general guidance (dosage, form, timing) but NEVER link to a specific product. Instead say: "Check the Marketplace tab for options that fit your profile." The Marketplace and Coach are separate experiences -- they do not cross-contaminate.\n` +
    `1. NEVER diagnose a condition. If a user asks "do I have diabetes?" based on bloodwork, respond: "Your fasting glucose is [X]. The reference range is [Y]. A diagnosis requires clinical evaluation by your healthcare provider."\n` +
    `2. NEVER recommend starting, stopping, or changing medications or supplements for a medical condition. If asked, redirect to healthcare provider.\n` +
    `3. NEVER interpret bloodwork clinically. You may note values outside reference ranges ("Your LDL is above the reference range your lab provided") but NEVER say what this means diagnostically.\n` +
    `4. NEVER provide mental health counseling. If a user expresses distress, acknowledge it and suggest professional support. Do not attempt therapy.\n` +
    `5. If a user expresses suicidal thoughts or self-harm intent, respond with: "I hear you, and I want you to get the right support. Please contact the 988 Suicide and Crisis Lifeline (call or text 988) or reach out to a trusted person in your life." Do not continue the wellness coaching conversation until the user indicates they are safe.\n` +
    `6. If the user has a QUIT goal for any substance, NEVER provide data that could be interpreted as permission to use that substance. If the user asks "Is it okay to have one drink?" and has a Quit goal for alcohol, respond: "You've set a quit goal for alcohol. Decisions about whether to drink are personal and best discussed with your healthcare provider or support network."\n` +
    `7. SAFETY RULE: If the user's logged intake is consistently below minimum safe thresholds, prioritize health safety over tier adherence. A user who is "on plan" at 800 calories is NOT succeeding -- they need a healthcare provider. Never reinforce extreme caloric restriction.\n` +
    `8. If daily calorie intake is below 1,000, NEVER respond with positive reinforcement. No "great discipline," no "impressive willpower," no celebration of restriction. Surface the data factually and include the healthcare provider recommendation.\n` +
    `PROHIBITED WORDS (never use): ${PROHIBITED_WORDS.join(', ')}.\n` +
    `Use "correlates with" not "causes." Data, not causation.`,
  );

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
