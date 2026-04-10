// My Recipes library — saved recipes with usage tracking
// Sprint 20: Recipe Builder + Macro Calculator

import { storageGet, storageSet, STORAGE_KEYS } from './storage';
import type { MyRecipe, MyRecipeIngredient, RecipeMacros } from '../types/food';

// ============================================================
// Macro Calculation
// ============================================================

export function calculateTotalMacros(ingredients: MyRecipeIngredient[]): RecipeMacros {
  return ingredients.reduce(
    (sum, ing) => ({
      calories: sum.calories + ing.calories,
      protein: sum.protein + ing.protein,
      carbs: sum.carbs + ing.carbs,
      fat: sum.fat + ing.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function calculatePerServingMacros(
  totalMacros: RecipeMacros,
  totalServings: number,
): RecipeMacros {
  if (totalServings <= 0) return { ...totalMacros };
  return {
    calories: Math.round(totalMacros.calories / totalServings),
    protein: Math.round((totalMacros.protein / totalServings) * 10) / 10,
    carbs: Math.round((totalMacros.carbs / totalServings) * 10) / 10,
    fat: Math.round((totalMacros.fat / totalServings) * 10) / 10,
  };
}

/** Calculate macros for a percentage portion of the total batch */
export function calculatePortionByPercentage(
  totalMacros: RecipeMacros,
  percentage: number,
): RecipeMacros {
  const factor = percentage / 100;
  return {
    calories: Math.round(totalMacros.calories * factor),
    protein: Math.round(totalMacros.protein * factor * 10) / 10,
    carbs: Math.round(totalMacros.carbs * factor * 10) / 10,
    fat: Math.round(totalMacros.fat * factor * 10) / 10,
  };
}

/** Calculate macros for a number of servings */
export function calculatePortionByServings(
  macrosPerServing: RecipeMacros,
  servingCount: number,
): RecipeMacros {
  return {
    calories: Math.round(macrosPerServing.calories * servingCount),
    protein: Math.round(macrosPerServing.protein * servingCount * 10) / 10,
    carbs: Math.round(macrosPerServing.carbs * servingCount * 10) / 10,
    fat: Math.round(macrosPerServing.fat * servingCount * 10) / 10,
  };
}

/** Calculate macros for a weight-based portion */
export function calculatePortionByWeight(
  totalMacros: RecipeMacros,
  totalWeightG: number,
  portionWeightG: number,
): RecipeMacros {
  if (totalWeightG <= 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const factor = portionWeightG / totalWeightG;
  return {
    calories: Math.round(totalMacros.calories * factor),
    protein: Math.round(totalMacros.protein * factor * 10) / 10,
    carbs: Math.round(totalMacros.carbs * factor * 10) / 10,
    fat: Math.round(totalMacros.fat * factor * 10) / 10,
  };
}

// ============================================================
// CRUD Operations
// ============================================================

export async function getMyRecipes(): Promise<MyRecipe[]> {
  const recipes = await storageGet<MyRecipe[]>(STORAGE_KEYS.MY_RECIPES);
  if (!recipes) return [];
  // Sort by most recently used, then most recently created
  return [...recipes].sort((a, b) => {
    if (a.lastLogged && b.lastLogged) return b.lastLogged.localeCompare(a.lastLogged);
    if (a.lastLogged) return -1;
    if (b.lastLogged) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function saveRecipe(recipe: MyRecipe): Promise<void> {
  const existing = await storageGet<MyRecipe[]>(STORAGE_KEYS.MY_RECIPES) ?? [];
  const filtered = existing.filter((r) => r.id !== recipe.id);
  await storageSet(STORAGE_KEYS.MY_RECIPES, [recipe, ...filtered]);
}

export async function deleteRecipe(id: string): Promise<void> {
  const existing = await storageGet<MyRecipe[]>(STORAGE_KEYS.MY_RECIPES) ?? [];
  await storageSet(STORAGE_KEYS.MY_RECIPES, existing.filter((r) => r.id !== id));
}

export async function duplicateRecipe(id: string): Promise<MyRecipe | null> {
  const existing = await storageGet<MyRecipe[]>(STORAGE_KEYS.MY_RECIPES) ?? [];
  const source = existing.find((r) => r.id === id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: MyRecipe = {
    ...source,
    id: `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `${source.name} (copy)`,
    timesLogged: 0,
    lastLogged: null,
    createdAt: now,
    updatedAt: now,
  };
  await storageSet(STORAGE_KEYS.MY_RECIPES, [copy, ...existing]);
  return copy;
}

export async function incrementRecipeTimesLogged(id: string): Promise<void> {
  const existing = await storageGet<MyRecipe[]>(STORAGE_KEYS.MY_RECIPES) ?? [];
  const updated = existing.map((r) =>
    r.id === id
      ? { ...r, timesLogged: r.timesLogged + 1, lastLogged: new Date().toISOString() }
      : r,
  );
  await storageSet(STORAGE_KEYS.MY_RECIPES, updated);
}

/** Generate a unique recipe ID */
export function generateRecipeId(): string {
  return `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
