// FatSecret Platform API client with OAuth 2.0 (client credentials)
// Phase 7: Food Logging -- Barcode and Additional APIs

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/storage';
import type { FoodItem, NutritionInfo, ServingSize } from '../types/food';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

// Placeholder credentials -- user should register at https://platform.fatsecret.com
const CLIENT_ID = 'FATSECRET_CLIENT_ID';
const CLIENT_SECRET = 'FATSECRET_CLIENT_SECRET';

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Check in-memory cache first
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  // Check persisted token from AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.FATSECRET_TOKEN);
    if (stored) {
      const { token, expiresAt } = JSON.parse(stored);
      if (Date.now() < expiresAt - 60_000) {
        cachedToken = { access_token: token, expires_at: expiresAt };
        return token;
      }
    }
  } catch {
    // Persisted read failed — proceed to OAuth
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'basic',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`FatSecret auth failed: ${response.status}`);
  }

  const data = await response.json();
  const expiresAt = Date.now() + data.expires_in * 1000;
  cachedToken = {
    access_token: data.access_token,
    expires_at: expiresAt,
  };

  // Persist token to survive app restarts
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.FATSECRET_TOKEN,
      JSON.stringify({ token: data.access_token, expiresAt }),
    );
  } catch {
    // Persist failed — non-critical, in-memory cache still works
  }

  return cachedToken.access_token;
}

// FatSecret API returns varying response shapes per endpoint; full typing impractical
async function apiCall(params: Record<string, string>): Promise<any> {
  const token = await getAccessToken();

  const body = new URLSearchParams({
    ...params,
    format: 'json',
  });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${token}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`FatSecret API failed: ${response.status}`);
  }

  return response.json();
}

// FatSecret response types

interface FsServing {
  serving_description: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  fiber?: string;
  sugar?: string;
  sodium?: string;
  cholesterol?: string;
  saturated_fat?: string;
  trans_fat?: string;
  potassium?: string;
  calcium?: string;
  iron?: string;
  vitamin_d?: string;
}

interface FsFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
}

interface FsFoodDetail {
  food_id: string;
  food_name: string;
  brand_name?: string;
  servings: {
    serving: FsServing | FsServing[];
  };
}

function parseFloat0(val: string | undefined): number {
  return val != null ? parseFloat(val) || 0 : 0;
}

function parseFloatNull(val: string | undefined): number | null {
  if (val == null) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function fsServingToNutritionPer100g(serving: FsServing): NutritionInfo {
  const grams = parseFloat(serving.metric_serving_amount ?? '100') || 100;
  const scale = 100 / grams;

  return {
    calories: parseFloat0(serving.calories) * scale,
    protein_g: parseFloat0(serving.protein) * scale,
    carbs_g: parseFloat0(serving.carbohydrate) * scale,
    fat_g: parseFloat0(serving.fat) * scale,
    fiber_g: parseFloatNull(serving.fiber) != null ? parseFloat0(serving.fiber) * scale : null,
    sugar_g: parseFloatNull(serving.sugar) != null ? parseFloat0(serving.sugar) * scale : null,
    added_sugar_g: null,
    sodium_mg: parseFloatNull(serving.sodium) != null ? parseFloat0(serving.sodium) * scale : null,
    cholesterol_mg: parseFloatNull(serving.cholesterol) != null ? parseFloat0(serving.cholesterol) * scale : null,
    saturated_fat_g: parseFloatNull(serving.saturated_fat) != null ? parseFloat0(serving.saturated_fat) * scale : null,
    trans_fat_g: parseFloatNull(serving.trans_fat) != null ? parseFloat0(serving.trans_fat) * scale : null,
    potassium_mg: parseFloatNull(serving.potassium) != null ? parseFloat0(serving.potassium) * scale : null,
    vitamin_d_mcg: parseFloatNull(serving.vitamin_d) != null ? parseFloat0(serving.vitamin_d) * scale : null,
    calcium_mg: parseFloatNull(serving.calcium) != null ? parseFloat0(serving.calcium) * scale : null,
    iron_mg: parseFloatNull(serving.iron) != null ? parseFloat0(serving.iron) * scale : null,
  };
}

function fsServingsToSizes(servings: FsServing[]): ServingSize[] {
  const sizes: ServingSize[] = [
    { description: '100g', unit: 'g', gram_weight: 100, quantity: 1 },
  ];

  for (const s of servings) {
    const grams = parseFloat(s.metric_serving_amount ?? '0');
    if (grams > 0) {
      const unit = s.metric_serving_unit ?? 'g';
      sizes.push({
        description: `${s.serving_description} (${Math.round(grams)}${unit})`,
        unit: 'g',
        gram_weight: grams,
        quantity: 1,
      });
    }
  }

  return sizes;
}

function mapFsDetailToItem(detail: FsFoodDetail): FoodItem {
  const servingArr = Array.isArray(detail.servings.serving)
    ? detail.servings.serving
    : [detail.servings.serving];

  const firstServing = servingArr[0];
  const nutrition = fsServingToNutritionPer100g(firstServing);
  const servingSizes = fsServingsToSizes(servingArr);

  return {
    source: 'fatsecret',
    source_id: `fatsecret:${detail.food_id}`,
    name: detail.food_name,
    brand: detail.brand_name ?? null,
    barcode: null,
    nutrition_per_100g: nutrition,
    serving_sizes: servingSizes,
    default_serving_index: servingSizes.length > 1 ? 1 : 0,
    ingredients: null,
    last_accessed: new Date().toISOString(),
  };
}

/**
 * Search FatSecret for foods matching a text query.
 */
export async function fatsecretSearch(query: string): Promise<FoodItem[]> {
  const data = await apiCall({
    method: 'foods.search',
    search_expression: query,
    max_results: '25',
  });

  const foods = data?.foods?.food;
  if (!foods) return [];

  const foodArr: FsFood[] = Array.isArray(foods) ? foods : [foods];
  const results: FoodItem[] = [];

  for (const food of foodArr) {
    try {
      const detail = await fatsecretGetFood(food.food_id);
      if (detail) results.push(detail);
    } catch {
      // Skip individual failures
    }
  }

  return results;
}

/**
 * Get detailed food info by FatSecret food ID.
 */
export async function fatsecretGetFood(foodId: string): Promise<FoodItem | null> {
  const data = await apiCall({
    method: 'food.get.v4',
    food_id: foodId,
  });

  const detail: FsFoodDetail | undefined = data?.food;
  if (!detail) return null;

  return mapFsDetailToItem(detail);
}

/**
 * Look up a food by barcode (UPC/EAN) via FatSecret.
 */
export async function fatsecretBarcodeLookup(barcode: string): Promise<FoodItem | null> {
  try {
    const data = await apiCall({
      method: 'food.find_id_for_barcode',
      barcode,
    });

    const foodId = data?.food_id?.value;
    if (!foodId) return null;

    const item = await fatsecretGetFood(foodId);
    // MASTER-30: Pass the scanned barcode through to the returned FoodItem
    if (item) {
      item.barcode = barcode;
    }
    return item;
  } catch {
    return null;
  }
}
