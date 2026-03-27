// Food Lookup Fallback Waterfall
// Phase 7: Food Logging -- Barcode and Additional APIs
//
// Barcode waterfall:
//   1. FatSecret barcode lookup
//   2. Open Food Facts barcode lookup
//   3. USDA branded search by name (fallback)
//
// Text search waterfall:
//   1. FatSecret text search
//   2. USDA text search
//   3. Open Food Facts text search
//   4. NLP/AI estimation (stub -- Phase 14)
//   5. Manual entry (caller handles)

import type { FoodItem } from '../types/food';
import { fatsecretBarcodeLookup, fatsecretSearch } from '../services/fatsecret';
import { offBarcodeLookup, offSearch } from '../services/openfoodfacts';
import { usdaSearch } from '../services/usda';

export interface WaterfallResult {
  items: FoodItem[];
  source: string;
  fromCache: boolean;
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

  // Step 3: USDA branded search by barcode string
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

  // Step 4: NLP/AI estimation -- stub for Phase 14
  // Will be implemented with Coach AI integration

  // Step 5: Manual entry -- handled by caller
  return { items: [], source: 'none', fromCache: false };
}
