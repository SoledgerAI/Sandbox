// Tag System types for DUB_AI Tracker
// Phase 2: Type System and Storage Layer
// Per Section 10: Tag System -- Core Architecture

import type { EngagementTier } from './profile';

export enum TagCategory {
  HYDRATION = 'HYDRATION',
  NUTRITION = 'NUTRITION',
  FITNESS = 'FITNESS',
  STRENGTH = 'STRENGTH',
  BODY = 'BODY',
  RECOVERY = 'RECOVERY',
  SUPPLEMENTS = 'SUPPLEMENTS',
  SUBSTANCES = 'SUBSTANCES',
  MENTAL_WELLNESS = 'MENTAL_WELLNESS',
  SLEEP = 'SLEEP',
  HEALTH_MARKERS = 'HEALTH_MARKERS',
  INJURY = 'INJURY',
  WOMENS_HEALTH = 'WOMENS_HEALTH',
  DIGESTIVE = 'DIGESTIVE',
  PERSONAL_CARE = 'PERSONAL_CARE',
  SEXUAL_ACTIVITY = 'SEXUAL_ACTIVITY',
  CUSTOM = 'CUSTOM',
}

export type TagDataType = 'checkbox' | 'numeric' | 'scale_1_5' | 'scale_1_10' | 'text' | 'duration';

export interface TagSchemaField {
  name: string;
  type: TagDataType;
  unit: string | null;
  required: boolean;
  default_value: string | number | boolean | null;
}

export interface TagSchema {
  fields: TagSchemaField[];
}

export interface Tag {
  id: string; // e.g., "nutrition.food"
  category: TagCategory;
  name: string; // display name
  icon: string; // icon identifier
  description: string; // brief description for onboarding
  enabled: boolean;
  order: number; // dashboard display order
  schema: TagSchema;
  defaultEnabledForTiers: EngagementTier[];
  sensitive: boolean; // true for Personal & Private tags
}

export interface CustomTag extends Tag {
  category: TagCategory.CUSTOM;
  user_created: true;
  data_type: TagDataType;
  custom_unit: string | null;
}
