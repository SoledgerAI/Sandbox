// Recipe recommendation engine
// Phase 20: Data Expansion and Recipe Engine
// Generates recipe recommendations via Coach API based on remaining macros,
// taste profile, dietary restrictions, and flagged ingredients.

import { sendMessage } from '../services/anthropic';
import { storageGet, STORAGE_KEYS } from '../utils/storage';
import type { EngagementTier } from '../types/profile';

// ============================================================================
// Types
// ============================================================================

export interface TasteProfile {
  cuisines: string[];
  restrictions: string[];
  dislikes: string[]; // free-form ingredient list
}

export interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein_g: number;
}

export interface RecipeInstruction {
  step_number: number;
  text: string;
}

export interface RecipeNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Recipe {
  name: string;
  description: string;
  prep_time_min: number;
  cook_time_min: number;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  total_nutrition: RecipeNutrition;
  macro_match_pct: number;
  relaxed_constraint?: string;
}

export interface RecipeRequest {
  remaining_calories: number;
  remaining_protein_g: number;
  remaining_carbs_g: number;
  remaining_fat_g: number;
  servings: number;
  no_alcohol: boolean;
  flagged_ingredients: string[];
}

// ============================================================================
// Cuisine and restriction options
// ============================================================================

export const CUISINE_OPTIONS = [
  'American',
  'Mexican',
  'Italian',
  'Chinese',
  'Japanese',
  'Indian',
  'Thai',
  'Mediterranean',
  'Korean',
  'Vietnamese',
  'Middle Eastern',
  'French',
  'Ethiopian',
  'Caribbean',
  'Other',
] as const;

export const RESTRICTION_OPTIONS = [
  'None',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Keto',
  'Low-Carb',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Halal',
  'Kosher',
] as const;

export type CuisineOption = typeof CUISINE_OPTIONS[number];
export type RestrictionOption = typeof RESTRICTION_OPTIONS[number];

// ============================================================================
// Default taste profile
// ============================================================================

export const DEFAULT_TASTE_PROFILE: TasteProfile = {
  cuisines: [],
  restrictions: [],
  dislikes: [],
};

// ============================================================================
// Taste profile storage
// ============================================================================

export async function getTasteProfile(): Promise<TasteProfile> {
  const settings = await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
  const taste = settings?.taste_profile as TasteProfile | undefined;
  return taste ?? DEFAULT_TASTE_PROFILE;
}

export async function saveTasteProfile(profile: TasteProfile): Promise<void> {
  const settings = await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS) ?? {};
  settings.taste_profile = profile;
  const { storageSet } = await import('../utils/storage');
  await storageSet(STORAGE_KEYS.SETTINGS, settings);
}

// ============================================================================
// Recipe prompt builder
// ============================================================================

function buildRecipePrompt(request: RecipeRequest, taste: TasteProfile): string {
  const avoidList = [...taste.dislikes, ...request.flagged_ingredients];

  return (
    'Generate a recipe meeting these constraints:\n' +
    `- Remaining macros: ${request.remaining_calories}cal, ${request.remaining_protein_g}g protein, ${request.remaining_carbs_g}g carbs, ${request.remaining_fat_g}g fat\n` +
    `- Cuisines: ${taste.cuisines.length > 0 ? taste.cuisines.join(', ') : 'any'}\n` +
    `- Restrictions: ${taste.restrictions.length > 0 ? taste.restrictions.filter((r) => r !== 'None').join(', ') : 'none'}\n` +
    `- Avoid ingredients: ${avoidList.length > 0 ? avoidList.join(', ') : 'none'}\n` +
    `- No alcohol in ingredients: ${request.no_alcohol}\n` +
    '- Prep time: under 30 minutes preferred\n' +
    `- Servings: ${request.servings}\n` +
    'Return as JSON with: name, description, prep_time_min, cook_time_min, ' +
    'servings, ingredients [{name, amount, unit, calories, protein_g}], ' +
    'instructions [{step_number, text}], total_nutrition {calories, protein_g, ' +
    'carbs_g, fat_g}, macro_match_pct.\n' +
    'If no recipe can meet all constraints within 10%, suggest the closest ' +
    'match and explain which constraint was relaxed in a "relaxed_constraint" field.\n' +
    'Return ONLY valid JSON, no markdown fences or extra text.'
  );
}

// ============================================================================
// Recipe generation
// ============================================================================

export async function generateRecipe(request: RecipeRequest): Promise<Recipe> {
  const taste = await getTasteProfile();
  const prompt = buildRecipePrompt(request, taste);

  const tier = await storageGet<EngagementTier>(STORAGE_KEYS.TIER) ?? 'balanced';

  const responseText = await sendMessage({
    systemPrompt:
      'You are a recipe generator. Return ONLY valid JSON matching the requested schema. ' +
      'Use accurate USDA-based nutrition estimates for all ingredients. ' +
      'Never include alcohol in recipes if no_alcohol is true. ' +
      'Never include ingredients from the avoid list.',
    messages: [{ role: 'user', content: prompt }],
    tier,
  });

  const cleaned = responseText
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const recipe: Recipe = JSON.parse(cleaned);
  return recipe;
}

// ============================================================================
// Scale recipe nutrition by serving count
// ============================================================================

export function scaleRecipe(recipe: Recipe, newServings: number): Recipe {
  const ratio = newServings / recipe.servings;

  return {
    ...recipe,
    servings: newServings,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      amount: String(Math.round(parseFloat(ing.amount) * ratio * 10) / 10),
      calories: Math.round(ing.calories * ratio),
      protein_g: Math.round(ing.protein_g * ratio * 10) / 10,
    })),
    total_nutrition: {
      calories: Math.round(recipe.total_nutrition.calories * ratio),
      protein_g: Math.round(recipe.total_nutrition.protein_g * ratio * 10) / 10,
      carbs_g: Math.round(recipe.total_nutrition.carbs_g * ratio * 10) / 10,
      fat_g: Math.round(recipe.total_nutrition.fat_g * ratio * 10) / 10,
    },
  };
}
