// Default tag definitions for DUB_AI Tracker
// Phase 3: Onboarding Flow
// Per Section 8 Step 3 and Section 10: Tag System

import { TagCategory } from '../types/tags';
import type { EngagementTier } from '../types/profile';

export interface TagDefault {
  id: string;
  category: TagCategory;
  name: string;
  icon: string;
  description: string;
  sensitive: boolean;
  defaultEnabledForTiers: EngagementTier[];
}

// Sub-tag IDs for routing from Log tab to specific screens
export const HYDRATION_SUB_TAGS = {
  WATER: 'hydration.water',
  CAFFEINE: 'hydration.caffeine',
} as const;

export const SUBSTANCE_SUB_TAGS = {
  ALCOHOL: 'substances.alcohol',
  CANNABIS: 'substances.cannabis',
  TOBACCO: 'substances.tobacco',
  CAFFEINE: 'substances.caffeine',
} as const;

// Section 1: Health and Fitness (non-sensitive)
export const HEALTH_FITNESS_TAGS: TagDefault[] = [
  {
    id: 'hydration.water',
    category: TagCategory.HYDRATION,
    name: 'Hydration',
    icon: 'water-outline',
    description: 'Track daily water and caffeine intake',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured', 'balanced', 'flexible', 'mindful'],
  },
  {
    id: 'nutrition.food',
    category: TagCategory.NUTRITION,
    name: 'Nutrition',
    icon: 'nutrition-outline',
    description: 'Log meals, calories, and macros',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured', 'balanced', 'flexible', 'mindful'],
  },
  {
    id: 'fitness.workout',
    category: TagCategory.FITNESS,
    name: 'Fitness',
    icon: 'fitness-outline',
    description: 'Track cardio and general workouts',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured', 'balanced', 'flexible'],
  },
  {
    id: 'strength.training',
    category: TagCategory.STRENGTH,
    name: 'Strength',
    icon: 'barbell-outline',
    description: 'Log weight training, sets, reps, and 1RM',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured', 'balanced'],
  },
  {
    id: 'body.measurements',
    category: TagCategory.BODY,
    name: 'Body',
    icon: 'body-outline',
    description: 'Weight, measurements, and body composition',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured', 'balanced', 'flexible', 'mindful'],
  },
  {
    id: 'sleep.tracking',
    category: TagCategory.SLEEP,
    name: 'Sleep',
    icon: 'moon-outline',
    description: 'Log sleep duration, quality, and patterns',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured', 'balanced'],
  },
  {
    id: 'recovery.score',
    category: TagCategory.RECOVERY,
    name: 'Recovery',
    icon: 'pulse-outline',
    description: 'Track recovery metrics and readiness',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured'],
  },
  {
    id: 'supplements.daily',
    category: TagCategory.SUPPLEMENTS,
    name: 'Supplements',
    icon: 'medkit-outline',
    description: 'Track vitamins, medications, and supplements',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured', 'balanced'],
  },
  {
    id: 'health.markers',
    category: TagCategory.HEALTH_MARKERS,
    name: 'Health Markers',
    icon: 'heart-outline',
    description: 'Bloodwork, vitals, and health screenings',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured'],
  },
  {
    id: 'blood.glucose',
    category: TagCategory.BLOOD_GLUCOSE,
    name: 'Blood Glucose',
    icon: 'water-outline',
    description: 'Track blood sugar readings with timing context',
    sensitive: false,
    defaultEnabledForTiers: ['precision', 'structured'],
  },
];

// Section 2: Personal and Private (sensitive) — NEVER pre-selected
export const PERSONAL_PRIVATE_TAGS: TagDefault[] = [
  {
    id: 'mental.wellness',
    category: TagCategory.MENTAL_WELLNESS,
    name: 'Mental Wellness',
    icon: 'happy-outline',
    description: 'Mood, gratitude, meditation, and stress',
    sensitive: true,
    defaultEnabledForTiers: [],
  },
  {
    id: 'substances.tracking',
    category: TagCategory.SUBSTANCES,
    name: 'Substances',
    icon: 'wine-outline',
    description: 'Alcohol, cannabis, and tobacco tracking',
    sensitive: true,
    defaultEnabledForTiers: [],
  },
  {
    id: 'sexual.activity',
    category: TagCategory.SEXUAL_ACTIVITY,
    name: 'Sexual Activity',
    icon: 'flame-outline',
    description: 'Activity logging with calorie burn',
    sensitive: true,
    defaultEnabledForTiers: [],
  },
  {
    id: 'digestive.health',
    category: TagCategory.DIGESTIVE,
    name: 'Digestive Health',
    icon: 'leaf-outline',
    description: 'Bristol stool chart and digestive tracking',
    sensitive: true,
    defaultEnabledForTiers: [],
  },
  {
    id: 'personal.care',
    category: TagCategory.PERSONAL_CARE,
    name: 'Personal Care',
    icon: 'sparkles-outline',
    description: 'Hygiene, skincare, and grooming routines',
    sensitive: true,
    defaultEnabledForTiers: [],
  },
  {
    id: 'womens.health',
    category: TagCategory.WOMENS_HEALTH,
    name: "Women's Health",
    icon: 'flower-outline',
    description: 'Cycle tracking and reproductive health',
    sensitive: true,
    defaultEnabledForTiers: [],
  },
  {
    id: 'injury.pain',
    category: TagCategory.INJURY,
    name: 'Injury / Pain',
    icon: 'bandage-outline',
    description: 'Track injuries, pain levels, and recovery',
    sensitive: true,
    defaultEnabledForTiers: [],
  },
  {
    id: 'custom.tag',
    category: TagCategory.CUSTOM,
    name: 'Custom',
    icon: 'create-outline',
    description: 'Create your own tracking tags',
    sensitive: true,
    defaultEnabledForTiers: [],
  },
];

export const ALL_DEFAULT_TAGS: TagDefault[] = [...HEALTH_FITNESS_TAGS, ...PERSONAL_PRIVATE_TAGS];

export function getDefaultTagsForTier(tier: EngagementTier): string[] {
  return HEALTH_FITNESS_TAGS
    .filter((tag) => tag.defaultEnabledForTiers.includes(tier))
    .map((tag) => tag.id);
}
