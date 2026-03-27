// Engagement Tier definitions for DUB_AI Tracker
// Phase 3: Onboarding Flow
// Per Section 9: Engagement Tier System -- Five Tiers

import type { EngagementTier } from '../types/profile';

export interface TierDefinition {
  id: EngagementTier;
  name: string;
  label: string; // e.g., "100%", "90/10"
  description: string;
  adherenceTarget: string;
  flexMeals: string;
  coachTonePreview: string;
  notificationCadence: string;
  notificationsPerDay: [number, number]; // [min, max]
  scoreWeighting: {
    calorieAccuracy: number;
    macroAccuracy: number;
    tagCompletion: number;
    consistency: number;
    trendAlignment: number;
    loggingConsistency: number;
    weeklyTrend: number;
    weightStability: number;
    caloricTdeeAlignment: number;
  };
}

export const TIER_DEFINITIONS: TierDefinition[] = [
  {
    id: 'precision',
    name: 'Precision',
    label: '100%',
    description:
      'Every calorie counted. Maximum accountability. For competitive athletes and people who thrive on exact tracking.',
    adherenceTarget: '100% of planned calories and macros daily',
    flexMeals: '0 per month',
    coachTonePreview:
      'Direct, clinical, precise. No softening.',
    notificationCadence: '6-8 per day',
    notificationsPerDay: [6, 8],
    scoreWeighting: {
      calorieAccuracy: 0.40,
      macroAccuracy: 0.25,
      tagCompletion: 0.20,
      consistency: 0.15,
      trendAlignment: 0,
      loggingConsistency: 0,
      weeklyTrend: 0,
      weightStability: 0,
      caloricTdeeAlignment: 0,
    },
  },
  {
    id: 'structured',
    name: 'Structured',
    label: '90/10',
    description:
      '90% on plan with some flexibility. Weekly adherence tracking. For serious goal-chasers.',
    adherenceTarget: '90% of days fully on plan per month',
    flexMeals: '~3 per month',
    coachTonePreview:
      'Encouraging but data-forward.',
    notificationCadence: '3-5 per day',
    notificationsPerDay: [3, 5],
    scoreWeighting: {
      calorieAccuracy: 0.35,
      macroAccuracy: 0.20,
      tagCompletion: 0.25,
      consistency: 0.20,
      trendAlignment: 0,
      loggingConsistency: 0,
      weeklyTrend: 0,
      weightStability: 0,
      caloricTdeeAlignment: 0,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    label: '85/15',
    description:
      '5-day rolling averages over daily perfection. Accountability without obsession.',
    adherenceTarget: '85% of days on plan per month',
    flexMeals: 'Flexible — Coach tracks 5-day rolling average',
    coachTonePreview:
      'Supportive, trend-focused.',
    notificationCadence: '3-5 per day',
    notificationsPerDay: [3, 5],
    scoreWeighting: {
      calorieAccuracy: 0.15,
      macroAccuracy: 0,
      tagCompletion: 0.25,
      consistency: 0.25,
      trendAlignment: 0.35,
      loggingConsistency: 0,
      weeklyTrend: 0,
      weightStability: 0,
      caloricTdeeAlignment: 0,
    },
  },
  {
    id: 'flexible',
    name: 'Flexible',
    label: '80/20',
    description:
      'Weekly and monthly trends, not daily numbers. For sustainable long-term habits.',
    adherenceTarget: '80% of days with some logging activity',
    flexMeals: 'Not tracked individually — trends only',
    coachTonePreview:
      'Relaxed, encouraging, big-picture.',
    notificationCadence: '1-3 per day',
    notificationsPerDay: [1, 3],
    scoreWeighting: {
      calorieAccuracy: 0.10,
      macroAccuracy: 0,
      tagCompletion: 0.20,
      consistency: 0,
      trendAlignment: 0,
      loggingConsistency: 0.40,
      weeklyTrend: 0.30,
      weightStability: 0,
      caloricTdeeAlignment: 0,
    },
  },
  {
    id: 'mindful',
    name: 'Mindful',
    label: 'Maintain',
    description:
      'Awareness without restriction. Weight stability focus.',
    adherenceTarget: 'TDEE = daily calorie target. No deficit, no surplus.',
    flexMeals: 'N/A — maintenance mode',
    coachTonePreview:
      'Observational, low-pressure.',
    notificationCadence: '1-3 per day',
    notificationsPerDay: [1, 3],
    scoreWeighting: {
      calorieAccuracy: 0,
      macroAccuracy: 0,
      tagCompletion: 0.10,
      consistency: 0,
      trendAlignment: 0,
      loggingConsistency: 0.20,
      weeklyTrend: 0,
      weightStability: 0.40,
      caloricTdeeAlignment: 0.30,
    },
  },
];

export const DEFAULT_TIER: EngagementTier = 'balanced';

export function getTierDefinition(tierId: EngagementTier): TierDefinition {
  const tier = TIER_DEFINITIONS.find((t) => t.id === tierId);
  if (!tier) {
    return TIER_DEFINITIONS.find((t) => t.id === DEFAULT_TIER)!;
  }
  return tier;
}
