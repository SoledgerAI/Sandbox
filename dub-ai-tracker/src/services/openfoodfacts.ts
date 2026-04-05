// Open Food Facts API client
// Phase 7: Food Logging -- Barcode and Additional APIs

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/storage';
import type { FoodItem, NutritionInfo, ServingSize } from '../types/food';

const BASE_URL = 'https://world.openfoodfacts.org';
const USER_AGENT = 'DUB_AI_Tracker/1.0 (health-tracker-app)';

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  sodium_100g?: number;
  'saturated-fat_100g'?: number;
  'trans-fat_100g'?: number;
  cholesterol_100g?: number;
  potassium_100g?: number;
  calcium_100g?: number;
  iron_100g?: number;
  'vitamin-d_100g'?: number;
}

interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments: OffNutriments;
  ingredients_text?: string;
}

interface OffBarcodeResponse {
  status: number;
  product?: OffProduct;
}

interface OffSearchResponse {
  products: OffProduct[];
  count: number;
  page: number;
  page_size: number;
}

function nullIfUndefined(val: number | undefined): number | null {
  return val != null ? val : null;
}

function parseNutrition(n: OffNutriments): NutritionInfo {
  return {
    calories: n['energy-kcal_100g'] ?? 0,
    protein_g: n.proteins_100g ?? 0,
    carbs_g: n.carbohydrates_100g ?? 0,
    fat_g: n.fat_100g ?? 0,
    fiber_g: nullIfUndefined(n.fiber_100g),
    sugar_g: nullIfUndefined(n.sugars_100g),
    added_sugar_g: null,
    // MASTER-32 fix: OFF consistently reports sodium in grams per 100g.
    // Always convert g -> mg. Previous threshold heuristic (> 5) was wrong —
    // very salty foods can legitimately exceed 5g sodium/100g.
    sodium_mg: (() => {
      if (n.sodium_100g == null) return null;
      const raw = typeof n.sodium_100g === 'number' ? n.sodium_100g : parseFloat(n.sodium_100g as unknown as string);
      return !isNaN(raw) ? Math.round(raw * 1000) : null;
    })(),
    cholesterol_mg: nullIfUndefined(n.cholesterol_100g),
    saturated_fat_g: nullIfUndefined(n['saturated-fat_100g']),
    trans_fat_g: nullIfUndefined(n['trans-fat_100g']),
    potassium_mg: nullIfUndefined(n.potassium_100g),
    vitamin_d_mcg: nullIfUndefined(n['vitamin-d_100g']),
    calcium_mg: nullIfUndefined(n.calcium_100g),
    iron_mg: nullIfUndefined(n.iron_100g),
  };
}

function parseServingSizes(product: OffProduct): ServingSize[] {
  const sizes: ServingSize[] = [
    { description: '100g', unit: 'g', gram_weight: 100, quantity: 1 },
  ];

  if (product.serving_quantity && product.serving_quantity > 0) {
    const desc = product.serving_size ?? `1 serving`;
    sizes.push({
      description: `${desc} (${Math.round(product.serving_quantity)}g)`,
      unit: 'g',
      gram_weight: product.serving_quantity,
      quantity: 1,
    });
  }

  return sizes;
}

function mapProductToItem(product: OffProduct): FoodItem | null {
  if (!product.product_name) return null;

  const nutrition = parseNutrition(product.nutriments);
  const servingSizes = parseServingSizes(product);

  return {
    source: 'open_food_facts',
    source_id: `off:${product.code}`,
    name: product.product_name,
    brand: product.brands ?? null,
    barcode: product.code || null,
    nutrition_per_100g: nutrition,
    serving_sizes: servingSizes,
    default_serving_index: servingSizes.length > 1 ? 1 : 0,
    ingredients: product.ingredients_text ?? null,
    last_accessed: new Date().toISOString(),
  };
}

const BARCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Look up a product by barcode via Open Food Facts.
 * Checks local cache first; caches successful lookups for 30 days.
 */
export async function offBarcodeLookup(barcode: string): Promise<FoodItem | null> {
  // Check cache first
  const cacheKey = `${STORAGE_KEYS.BARCODE_CACHE}_${barcode}`;
  try {
    const cachedStr = await AsyncStorage.getItem(cacheKey);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      const ageMs = Date.now() - (cached._cachedAt || 0);
      if (ageMs < BARCODE_CACHE_TTL_MS) {
        return cached.data;
      }
    }
  } catch {
    // Cache read failed — proceed to network
  }

  const url = `${BASE_URL}/api/v0/product/${encodeURIComponent(barcode)}.json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Open Food Facts barcode lookup failed: ${response.status}`);
  }

  const data: OffBarcodeResponse = await response.json();
  if (data.status !== 1 || !data.product) return null;

  const item = mapProductToItem(data.product);

  // Cache successful lookup
  if (item) {
    try {
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ data: item, _cachedAt: Date.now() }),
      );
    } catch {
      // Cache write failed — non-critical
    }
  }

  return item;
}

/**
 * Search Open Food Facts for products matching a text query.
 */
export async function offSearch(query: string, pageSize: number = 25): Promise<FoodItem[]> {
  const url = `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=${pageSize}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Open Food Facts search failed: ${response.status}`);
  }

  const data: OffSearchResponse = await response.json();
  const items: FoodItem[] = [];

  for (const product of data.products) {
    const item = mapProductToItem(product);
    if (item) items.push(item);
  }

  return items;
}
