// Tag visibility rules — DECOUPLED from biological sex (P0-08)
// All tags are visible to all users. Tag selection is user's choice.

import { TagCategory } from '../types/tags';

// No tags hidden by sex — anyone can select any category
export const MALE_HIDDEN_CATEGORIES: TagCategory[] = [];

export const MALE_HIDDEN_TAG_IDS: string[] = [];

export const FEMALE_HIDDEN_CATEGORIES: TagCategory[] = [];

export const FEMALE_HIDDEN_TAG_IDS: string[] = [];
