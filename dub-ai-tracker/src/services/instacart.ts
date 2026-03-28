// Instacart deep link / API client
// Phase 20: Data Expansion and Recipe Engine
// Per Expert 2 Audit: was listed under Modify but never created in a prior phase.
// Provides "Add to Instacart" functionality via deep links.

import { Linking, Platform } from 'react-native';
import type { RecipeIngredient } from '../ai/recipe_engine';

// ============================================================================
// Constants
// ============================================================================

const INSTACART_SCHEME = 'instacart://';
const INSTACART_WEB_URL = 'https://www.instacart.com';
const INSTACART_SEARCH_PATH = '/store/search/';

// ============================================================================
// Types
// ============================================================================

export interface InstacartItem {
  name: string;
  quantity: string;
}

// ============================================================================
// Deep link helpers
// ============================================================================

/**
 * Build an Instacart search deep link for a single ingredient.
 */
function buildSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `${INSTACART_WEB_URL}${INSTACART_SEARCH_PATH}${encoded}`;
}

/**
 * Check if Instacart app is installed on device.
 */
export async function isInstacartInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL(INSTACART_SCHEME);
  } catch {
    return false;
  }
}

/**
 * Open Instacart app or website to search for a single item.
 */
export async function openInstacartSearch(query: string): Promise<void> {
  const url = buildSearchUrl(query);
  await Linking.openURL(url);
}

/**
 * Convert recipe ingredients to Instacart shopping list items.
 */
export function ingredientsToItems(ingredients: RecipeIngredient[]): InstacartItem[] {
  return ingredients.map((ing) => ({
    name: ing.name,
    quantity: `${ing.amount} ${ing.unit}`.trim(),
  }));
}

/**
 * Build a shopping list string from ingredients for clipboard/sharing.
 */
export function buildShoppingListText(ingredients: RecipeIngredient[]): string {
  return ingredients
    .map((ing) => `${ing.amount} ${ing.unit} ${ing.name}`.trim())
    .join('\n');
}

/**
 * Open Instacart with the first ingredient as a search entry point.
 * Since Instacart deep linking for full cart population requires
 * partner API access, this opens the app/website as a starting point.
 * Users can then search for remaining items.
 */
export async function openInstacartWithIngredients(
  ingredients: RecipeIngredient[],
): Promise<void> {
  if (ingredients.length === 0) return;

  const appInstalled = await isInstacartInstalled();

  if (appInstalled && Platform.OS !== 'web') {
    // Open Instacart app
    try {
      await Linking.openURL(INSTACART_SCHEME);
      return;
    } catch {
      // Fall through to web
    }
  }

  // Fall back to web search with first ingredient
  const firstItem = ingredients[0].name;
  await openInstacartSearch(firstItem);
}
