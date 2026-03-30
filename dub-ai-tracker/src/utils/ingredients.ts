// Ingredient detection in food data
// Phase 19: Ingredient Flag System and NLP/Photo Food Logging

import { storageGet } from './storage';
import type { IngredientFlag } from '../types/food';

// Default ingredient flags (all off by default, user enables what they care about)
export const DEFAULT_INGREDIENT_FLAGS: IngredientFlag[] = [
  {
    id: 'added_sugars',
    name: 'Added Sugars',
    keywords: ['added sugar', 'cane sugar', 'brown sugar', 'corn syrup', 'dextrose', 'fructose', 'maltose', 'sucrose', 'turbinado'],
    enabled: false,
  },
  {
    id: 'hfcs',
    name: 'High Fructose Corn Syrup (HFCS)',
    keywords: ['high fructose corn syrup', 'hfcs', 'high-fructose corn syrup'],
    enabled: false,
  },
  {
    id: 'hydrogenated_oils',
    name: 'Hydrogenated Oils / Partially Hydrogenated Oils',
    keywords: ['hydrogenated', 'partially hydrogenated', 'trans fat'],
    enabled: false,
  },
  {
    id: 'sodium_nitrate',
    name: 'Sodium Nitrate / Sodium Nitrite',
    keywords: ['sodium nitrate', 'sodium nitrite'],
    enabled: false,
  },
  {
    id: 'artificial_colors',
    name: 'Artificial Colors',
    keywords: ['red 40', 'yellow 5', 'yellow 6', 'blue 1', 'blue 2', 'red 3', 'green 3', 'fd&c', 'artificial color'],
    enabled: false,
  },
  {
    id: 'artificial_sweeteners',
    name: 'Artificial Sweeteners',
    keywords: ['aspartame', 'sucralose', 'saccharin', 'acesulfame', 'acesulfame-k', 'ace-k', 'neotame', 'advantame'],
    enabled: false,
  },
  {
    id: 'carrageenan',
    name: 'Carrageenan',
    keywords: ['carrageenan'],
    enabled: false,
  },
  {
    id: 'msg',
    name: 'MSG (Monosodium Glutamate)',
    keywords: ['monosodium glutamate', 'msg'],
    enabled: false,
  },
  {
    id: 'bha_bht',
    name: 'BHA / BHT',
    keywords: ['bha', 'bht', 'butylated hydroxyanisole', 'butylated hydroxytoluene'],
    enabled: false,
  },
  {
    id: 'sodium_benzoate',
    name: 'Sodium Benzoate',
    keywords: ['sodium benzoate'],
    enabled: false,
  },
  {
    id: 'potassium_bromate',
    name: 'Potassium Bromate',
    keywords: ['potassium bromate'],
    enabled: false,
  },
];

export const INGREDIENT_FLAGS_STORAGE_KEY = 'dub.settings.ingredient_flags';

/**
 * Load ingredient flags from storage. Falls back to defaults if not configured.
 */
export async function loadIngredientFlags(): Promise<IngredientFlag[]> {
  const stored = await storageGet<IngredientFlag[]>(INGREDIENT_FLAGS_STORAGE_KEY);
  return stored ?? DEFAULT_INGREDIENT_FLAGS;
}

/**
 * Save ingredient flags to storage.
 */
export async function saveIngredientFlags(flags: IngredientFlag[]): Promise<void> {
  const { storageSet } = await import('./storage');
  await storageSet(INGREDIENT_FLAGS_STORAGE_KEY, flags);
}

/**
 * Detect flagged ingredients in a food item's ingredient string.
 * Returns array of flag names that matched.
 */
export function detectFlaggedIngredients(
  ingredientString: string | null,
  flags: IngredientFlag[],
): string[] {
  if (!ingredientString) return [];
  const lower = ingredientString.toLowerCase();

  const matched: string[] = [];
  for (const flag of flags) {
    if (!flag.enabled) continue;
    for (const keyword of flag.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        matched.push(flag.name);
        break;
      }
    }
  }
  return matched;
}

/**
 * Get only the enabled flags.
 */
export function getEnabledFlags(flags: IngredientFlag[]): IngredientFlag[] {
  return flags.filter((f) => f.enabled);
}
