// Serving size math: scaling nutrition values with precision/rounding
// Phase 6: Food Logging -- Core

import type { NutritionInfo, ServingSize } from '../types/food';

/**
 * Scale a single nutrient value by a multiplier.
 * Returns null if the input is null; full precision for storage.
 */
function scaleNutrient(value: number | null, multiplier: number): number | null {
  if (value === null) return null;
  return value * multiplier;
}

/**
 * Round a nutrient value for display purposes.
 * Whole numbers for display, full precision stored.
 */
export function roundForDisplay(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value);
}

/**
 * Format a nutrient for display as a string.
 * Returns "--" for null values.
 */
export function formatNutrient(value: number | null, unit: string = ''): string {
  if (value === null) return '--';
  const rounded = Math.round(value);
  return unit ? `${rounded}${unit}` : `${rounded}`;
}

/**
 * Compute the multiplier from a serving size and quantity relative to per-100g data.
 * multiplier = (gram_weight * quantity) / 100
 */
export function computeMultiplier(serving: ServingSize, quantity: number): number {
  return (serving.gram_weight * quantity) / 100;
}

/**
 * Scale all nutrition values from per-100g to the actual serving.
 * Stores full precision; use roundForDisplay() for UI.
 */
export function scaleNutrition(
  per100g: NutritionInfo,
  serving: ServingSize,
  quantity: number,
): NutritionInfo {
  const multiplier = computeMultiplier(serving, quantity);

  return {
    calories: (per100g.calories * multiplier),
    protein_g: (per100g.protein_g * multiplier),
    carbs_g: (per100g.carbs_g * multiplier),
    fat_g: (per100g.fat_g * multiplier),
    fiber_g: scaleNutrient(per100g.fiber_g, multiplier),
    sugar_g: scaleNutrient(per100g.sugar_g, multiplier),
    added_sugar_g: scaleNutrient(per100g.added_sugar_g, multiplier),
    sodium_mg: scaleNutrient(per100g.sodium_mg, multiplier),
    cholesterol_mg: scaleNutrient(per100g.cholesterol_mg, multiplier),
    saturated_fat_g: scaleNutrient(per100g.saturated_fat_g, multiplier),
    trans_fat_g: scaleNutrient(per100g.trans_fat_g, multiplier),
    potassium_mg: scaleNutrient(per100g.potassium_mg, multiplier),
    vitamin_d_mcg: scaleNutrient(per100g.vitamin_d_mcg, multiplier),
    calcium_mg: scaleNutrient(per100g.calcium_mg, multiplier),
    iron_mg: scaleNutrient(per100g.iron_mg, multiplier),
  };
}

/**
 * Create a display-friendly nutrition object with rounded whole numbers.
 */
export function displayNutrition(nutrition: NutritionInfo): NutritionInfo {
  return {
    calories: Math.round(nutrition.calories),
    protein_g: Math.round(nutrition.protein_g),
    carbs_g: Math.round(nutrition.carbs_g),
    fat_g: Math.round(nutrition.fat_g),
    fiber_g: roundForDisplay(nutrition.fiber_g),
    sugar_g: roundForDisplay(nutrition.sugar_g),
    added_sugar_g: roundForDisplay(nutrition.added_sugar_g),
    sodium_mg: roundForDisplay(nutrition.sodium_mg),
    cholesterol_mg: roundForDisplay(nutrition.cholesterol_mg),
    saturated_fat_g: roundForDisplay(nutrition.saturated_fat_g),
    trans_fat_g: roundForDisplay(nutrition.trans_fat_g),
    potassium_mg: roundForDisplay(nutrition.potassium_mg),
    vitamin_d_mcg: roundForDisplay(nutrition.vitamin_d_mcg),
    calcium_mg: roundForDisplay(nutrition.calcium_mg),
    iron_mg: roundForDisplay(nutrition.iron_mg),
  };
}

/** Predefined quantity multiplier steps for the serving size selector */
export const QUANTITY_STEPS = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10,
] as const;

/**
 * Format a quantity for display (e.g., 0.25 -> "1/4", 1.5 -> "1.5")
 */
export function formatQuantity(qty: number): string {
  const fractions: Record<number, string> = {
    0.25: '\u00BC',
    0.5: '\u00BD',
    0.75: '\u00BE',
  };
  if (fractions[qty] != null) return fractions[qty];
  if (Number.isInteger(qty)) return String(qty);
  return qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
