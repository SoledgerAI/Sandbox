// Sex-based tag visibility rules
// Prompt 03 v2: Smart Onboarding — Tag Filtering

import { TagCategory } from '../types/tags';

// Tags hidden for male users
export const MALE_HIDDEN_CATEGORIES: TagCategory[] = [
  TagCategory.WOMENS_HEALTH,
];

export const MALE_HIDDEN_TAG_IDS: string[] = [
  'womens.health',
];

// Tags hidden for female users (none currently defined in the tag system,
// but the structure is here for future use like prostate health)
export const FEMALE_HIDDEN_CATEGORIES: TagCategory[] = [];

export const FEMALE_HIDDEN_TAG_IDS: string[] = [];
