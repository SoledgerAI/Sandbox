// Food Lookup Fallback Waterfall
// Phase 7: Food Logging -- Barcode and Additional APIs
//
// Barcode waterfall:
//   1. FatSecret barcode lookup
//   2. Open Food Facts barcode lookup
//   3. USDA branded food search by barcode UPC
//   4. USDA generic search by barcode string (fallback)
//
// Text search waterfall:
//   1. FatSecret text search
//   2. USDA text search
//   3. Open Food Facts text search
//   4. NLP/AI estimation (if API key configured)
//   5. Manual entry (caller handles)

import type { FoodItem } from '../types/food';
import { fatsecretBarcodeLookup, fatsecretSearch } from '../services/fatsecret';
import { offBarcodeLookup, offSearch } from '../services/openfoodfacts';
import { usdaSearch, usdaBrandedBarcodeLookup } from '../services/usda';
import { isApiKeySet } from '../services/apiKeyService';

export interface WaterfallResult {
  items: FoodItem[];
  source: string;
  fromCache: boolean;
}

export interface GroupedSearchResult {
  usda: FoodItem[];
  openFoodFacts: FoodItem[];
  fatsecret: FoodItem[];
  nlpAvailable: boolean;
}

/**
 * Look up a food by barcode using the fallback waterfall.
 * Stops at the first successful result.
 */
export async function barcodeLookup(barcode: string): Promise<WaterfallResult> {
  // Step 1: FatSecret barcode
  try {
    const item = await fatsecretBarcodeLookup(barcode);
    if (item) {
      return { items: [item], source: 'fatsecret', fromCache: false };
    }
  } catch {
    // Fall through to next source
  }

  // Step 2: Open Food Facts barcode
  try {
    const item = await offBarcodeLookup(barcode);
    if (item) {
      return { items: [item], source: 'open_food_facts', fromCache: false };
    }
  } catch {
    // Fall through to next source
  }

  // Step 3: USDA branded food search by barcode UPC (MASTER-29)
  try {
    const results = await usdaBrandedBarcodeLookup(barcode);
    if (results.length > 0) {
      return { items: results, source: 'usda_branded', fromCache: false };
    }
  } catch {
    // Fall through
  }

  // Step 4: USDA generic search by barcode string (fallback)
  try {
    const results = await usdaSearch(barcode, 5);
    if (results.length > 0) {
      return { items: results, source: 'usda', fromCache: false };
    }
  } catch {
    // Fall through
  }

  return { items: [], source: 'none', fromCache: false };
}

/**
 * Search for food by text using the fallback waterfall.
 * Stops at the first source that returns results.
 */
export async function textSearchWaterfall(query: string): Promise<WaterfallResult> {
  // Step 1: FatSecret text search
  try {
    const results = await fatsecretSearch(query);
    if (results.length > 0) {
      return { items: results, source: 'fatsecret', fromCache: false };
    }
  } catch {
    // Fall through to next source
  }

  // Step 2: USDA text search
  try {
    const results = await usdaSearch(query);
    if (results.length > 0) {
      return { items: results, source: 'usda', fromCache: false };
    }
  } catch {
    // Fall through to next source
  }

  // Step 3: Open Food Facts text search
  try {
    const results = await offSearch(query);
    if (results.length > 0) {
      return { items: results, source: 'open_food_facts', fromCache: false };
    }
  } catch {
    // Fall through
  }

  // Step 4: NLP/AI estimation (MASTER-29)
  // If API key is configured, Coach can estimate nutrition from a text description.
  // Otherwise skip to manual entry.
  try {
    const hasKey = await isApiKeySet();
    if (hasKey) {
      // NLP estimation available — return empty with source marker so caller
      // can offer "Describe your food and let Coach estimate nutrition."
      return { items: [], source: 'nlp_available', fromCache: false };
    }
  } catch {
    // Fall through to manual
  }

  // Step 5: Manual entry -- handled by caller
  return { items: [], source: 'none', fromCache: false };
}

/**
 * Search multiple food sources in parallel and return grouped results.
 * Unlike the waterfall, this queries USDA and Open Food Facts simultaneously
 * so the UI can show source-grouped results with badges.
 */
export async function parallelFoodSearch(query: string): Promise<GroupedSearchResult> {
  const result: GroupedSearchResult = {
    usda: [],
    openFoodFacts: [],
    fatsecret: [],
    nlpAvailable: false,
  };

  const [fatsecretResult, usdaResult, offResult, nlpCheck] = await Promise.allSettled([
    fatsecretSearch(query),
    usdaSearch(query, 15),
    offSearch(query, 10),
    isApiKeySet(),
  ]);

  if (fatsecretResult.status === 'fulfilled') {
    result.fatsecret = fatsecretResult.value;
  }
  if (usdaResult.status === 'fulfilled') {
    result.usda = usdaResult.value;
  }
  if (offResult.status === 'fulfilled') {
    result.openFoodFacts = offResult.value;
  }
  if (nlpCheck.status === 'fulfilled') {
    result.nlpAvailable = nlpCheck.value;
  }

  return result;
}
