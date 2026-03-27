// USDA FoodData Central API client
// Phase 6: Food Logging -- Core

import type { FoodItem, NutritionInfo, ServingSize } from '../types/food';

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// Placeholder -- user should register at https://fdc.nal.usda.gov/api-key-signup
const API_KEY = 'DEMO_KEY';

// USDA API response types (subset of full schema)

interface UsdaNutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
  unitName: string;
}

interface UsdaFoodNutrient {
  nutrientId?: number;
  nutrientName?: string;
  nutrientNumber?: string;
  value?: number;
  unitName?: string;
  // Search endpoint nests differently
  nutrient?: {
    id: number;
    name: string;
    number: string;
    unitName: string;
  };
  amount?: number;
}

interface UsdaFoodPortion {
  gramWeight: number;
  amount: number;
  modifier: string;
  portionDescription?: string;
  measureUnit?: { name: string };
}

interface UsdaSearchFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  foodNutrients: UsdaFoodNutrient[];
  foodMeasures?: UsdaFoodPortion[];
  servingSize?: number;
  servingSizeUnit?: string;
}

interface UsdaSearchResponse {
  foods: UsdaSearchFood[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

interface UsdaDetailFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  foodNutrients: UsdaFoodNutrient[];
  foodPortions?: UsdaFoodPortion[];
  servingSize?: number;
  servingSizeUnit?: string;
  ingredients?: string;
}

// USDA nutrient IDs for the nutrients we track
const NUTRIENT_IDS: Record<string, number[]> = {
  calories: [1008],
  protein_g: [1003],
  carbs_g: [1005],
  fat_g: [1004],
  fiber_g: [1079],
  sugar_g: [2000, 1063],
  added_sugar_g: [1235],
  sodium_mg: [1093],
  cholesterol_mg: [1253],
  saturated_fat_g: [1258],
  trans_fat_g: [1257],
  potassium_mg: [1092],
  vitamin_d_mcg: [1114, 1110],
  calcium_mg: [1087],
  iron_mg: [1089],
};

function extractNutrientValue(
  nutrients: UsdaFoodNutrient[],
  ids: number[],
): number | null {
  for (const id of ids) {
    const found = nutrients.find(
      (n) =>
        n.nutrientId === id ||
        n.nutrient?.id === id ||
        (n.nutrientNumber != null && parseInt(n.nutrientNumber, 10) === id),
    );
    if (found != null) {
      return found.value ?? found.amount ?? null;
    }
  }
  return null;
}

function parseNutrition(nutrients: UsdaFoodNutrient[]): NutritionInfo {
  return {
    calories: extractNutrientValue(nutrients, NUTRIENT_IDS.calories) ?? 0,
    protein_g: extractNutrientValue(nutrients, NUTRIENT_IDS.protein_g) ?? 0,
    carbs_g: extractNutrientValue(nutrients, NUTRIENT_IDS.carbs_g) ?? 0,
    fat_g: extractNutrientValue(nutrients, NUTRIENT_IDS.fat_g) ?? 0,
    fiber_g: extractNutrientValue(nutrients, NUTRIENT_IDS.fiber_g),
    sugar_g: extractNutrientValue(nutrients, NUTRIENT_IDS.sugar_g),
    added_sugar_g: extractNutrientValue(nutrients, NUTRIENT_IDS.added_sugar_g),
    sodium_mg: extractNutrientValue(nutrients, NUTRIENT_IDS.sodium_mg),
    cholesterol_mg: extractNutrientValue(nutrients, NUTRIENT_IDS.cholesterol_mg),
    saturated_fat_g: extractNutrientValue(nutrients, NUTRIENT_IDS.saturated_fat_g),
    trans_fat_g: extractNutrientValue(nutrients, NUTRIENT_IDS.trans_fat_g),
    potassium_mg: extractNutrientValue(nutrients, NUTRIENT_IDS.potassium_mg),
    vitamin_d_mcg: extractNutrientValue(nutrients, NUTRIENT_IDS.vitamin_d_mcg),
    calcium_mg: extractNutrientValue(nutrients, NUTRIENT_IDS.calcium_mg),
    iron_mg: extractNutrientValue(nutrients, NUTRIENT_IDS.iron_mg),
  };
}

function parseServingSizes(
  portions: UsdaFoodPortion[] | undefined,
  servingSize?: number,
  servingSizeUnit?: string,
): ServingSize[] {
  const sizes: ServingSize[] = [];

  // Always include a 100g base
  sizes.push({
    description: '100g',
    unit: 'g',
    gram_weight: 100,
    quantity: 1,
  });

  if (portions != null) {
    for (const p of portions) {
      const desc =
        p.portionDescription ??
        (p.measureUnit?.name != null
          ? `${p.amount} ${p.measureUnit.name}`
          : `${p.amount} ${p.modifier}`);
      sizes.push({
        description: `${desc} (${Math.round(p.gramWeight)}g)`,
        unit: 'g',
        gram_weight: p.gramWeight,
        quantity: p.amount || 1,
      });
    }
  }

  if (servingSize != null && servingSize > 0) {
    const unit = servingSizeUnit ?? 'g';
    const alreadyHas = sizes.some(
      (s) => Math.abs(s.gram_weight - servingSize) < 0.5,
    );
    if (!alreadyHas) {
      sizes.push({
        description: `1 serving (${Math.round(servingSize)}${unit})`,
        unit: 'g',
        gram_weight: servingSize,
        quantity: 1,
      });
    }
  }

  return sizes;
}

function mapSearchFoodToItem(food: UsdaSearchFood): FoodItem {
  const nutrition = parseNutrition(food.foodNutrients);
  const servingSizes = parseServingSizes(
    food.foodMeasures,
    food.servingSize,
    food.servingSizeUnit,
  );

  return {
    source: 'usda',
    source_id: `usda:${food.fdcId}`,
    name: food.description,
    brand: food.brandName ?? food.brandOwner ?? null,
    barcode: food.gtinUpc ?? null,
    nutrition_per_100g: nutrition,
    serving_sizes: servingSizes,
    default_serving_index: servingSizes.length > 1 ? 1 : 0,
    ingredients: null,
    last_accessed: new Date().toISOString(),
  };
}

function mapDetailFoodToItem(food: UsdaDetailFood): FoodItem {
  const nutrition = parseNutrition(food.foodNutrients);
  const servingSizes = parseServingSizes(
    food.foodPortions,
    food.servingSize,
    food.servingSizeUnit,
  );

  return {
    source: 'usda',
    source_id: `usda:${food.fdcId}`,
    name: food.description,
    brand: food.brandName ?? food.brandOwner ?? null,
    barcode: food.gtinUpc ?? null,
    nutrition_per_100g: nutrition,
    serving_sizes: servingSizes,
    default_serving_index: servingSizes.length > 1 ? 1 : 0,
    ingredients: food.ingredients ?? null,
    last_accessed: new Date().toISOString(),
  };
}

/**
 * Search USDA FoodData Central for foods matching a query.
 */
export async function usdaSearch(
  query: string,
  pageSize: number = 25,
): Promise<FoodItem[]> {
  const url = `${BASE_URL}/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&api_key=${API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`USDA search failed: ${response.status} ${response.statusText}`);
  }

  const data: UsdaSearchResponse = await response.json();
  return data.foods.map(mapSearchFoodToItem);
}

/**
 * Get detailed food info from USDA by FDC ID.
 */
export async function usdaGetFood(fdcId: number): Promise<FoodItem> {
  const url = `${BASE_URL}/food/${fdcId}?api_key=${API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`USDA food detail failed: ${response.status} ${response.statusText}`);
  }

  const data: UsdaDetailFood = await response.json();
  return mapDetailFoodToItem(data);
}
