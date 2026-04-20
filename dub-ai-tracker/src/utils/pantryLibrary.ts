// Personal Pantry — scan once, log forever.
// Sprint 21: Pantry library CRUD + duplicate detection + quick-log.

import { storageGet, storageSet, STORAGE_KEYS, dateKey } from './storage';
import { getActiveDate } from '../services/dateContextService';
import type {
  PantryItem,
  PantryCategory,
  PantrySource,
  FoodEntry,
  FoodItem,
  MealType,
  NutritionInfo,
  ServingSize,
} from '../types/food';

export type PantrySortMode = 'recency' | 'frequency';

export async function getPantryItems(
  sort: PantrySortMode = 'recency',
): Promise<PantryItem[]> {
  const items = (await storageGet<PantryItem[]>(STORAGE_KEYS.PANTRY_ITEMS)) ?? [];
  return sortPantryItems(items, sort);
}

export function sortPantryItems(
  items: PantryItem[],
  sort: PantrySortMode,
): PantryItem[] {
  const copy = [...items];
  if (sort === 'frequency') {
    copy.sort((a, b) => b.log_count - a.log_count || b.last_logged.localeCompare(a.last_logged));
  } else {
    copy.sort((a, b) => b.last_logged.localeCompare(a.last_logged));
  }
  return copy;
}

export function findDuplicate(
  items: PantryItem[],
  candidate: Pick<PantryItem, 'barcode' | 'name' | 'brand'>,
): PantryItem | null {
  const nameKey = candidate.name.trim().toLowerCase();
  const brandKey = (candidate.brand ?? '').trim().toLowerCase();
  for (const item of items) {
    if (candidate.barcode && item.barcode && candidate.barcode === item.barcode) {
      return item;
    }
    if (
      !candidate.barcode &&
      item.name.trim().toLowerCase() === nameKey &&
      (item.brand ?? '').trim().toLowerCase() === brandKey
    ) {
      return item;
    }
  }
  return null;
}

export async function isInPantry(
  candidate: Pick<PantryItem, 'barcode' | 'name' | 'brand'>,
): Promise<boolean> {
  const items = (await storageGet<PantryItem[]>(STORAGE_KEYS.PANTRY_ITEMS)) ?? [];
  return findDuplicate(items, candidate) != null;
}

export function generatePantryId(): string {
  return `pantry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface NewPantryItemInput {
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  added_sugar_g?: number | null;
  sodium_mg?: number | null;
  source: PantrySource;
  category?: PantryCategory;
}

// Returns { item, added } — added=false when the item was already in the pantry.
export async function addToPantry(
  input: NewPantryItemInput,
): Promise<{ item: PantryItem; added: boolean }> {
  const existing = (await storageGet<PantryItem[]>(STORAGE_KEYS.PANTRY_ITEMS)) ?? [];
  const dup = findDuplicate(existing, {
    barcode: input.barcode,
    name: input.name,
    brand: input.brand,
  });
  if (dup) {
    return { item: dup, added: false };
  }
  const now = new Date().toISOString();
  const item: PantryItem = {
    id: generatePantryId(),
    name: input.name,
    brand: input.brand,
    barcode: input.barcode,
    serving_size: input.serving_size,
    calories: input.calories,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g ?? null,
    added_sugar_g: input.added_sugar_g ?? null,
    sodium_mg: input.sodium_mg ?? null,
    source: input.source,
    category: input.category ?? 'food',
    created_at: now,
    last_logged: now,
    log_count: 0,
  };
  await storageSet(STORAGE_KEYS.PANTRY_ITEMS, [item, ...existing]);
  return { item, added: true };
}

export async function updatePantryItem(
  id: string,
  patch: Partial<Omit<PantryItem, 'id' | 'created_at'>>,
): Promise<void> {
  const existing = (await storageGet<PantryItem[]>(STORAGE_KEYS.PANTRY_ITEMS)) ?? [];
  const updated = existing.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await storageSet(STORAGE_KEYS.PANTRY_ITEMS, updated);
}

export async function deletePantryItem(id: string): Promise<void> {
  const existing = (await storageGet<PantryItem[]>(STORAGE_KEYS.PANTRY_ITEMS)) ?? [];
  await storageSet(STORAGE_KEYS.PANTRY_ITEMS, existing.filter((p) => p.id !== id));
}

export function filterPantryItems(
  items: PantryItem[],
  query: string,
): PantryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = `${item.name} ${item.brand ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

function pantryItemToFoodItem(item: PantryItem, multiplier: number): FoodItem {
  // Pantry stores per-serving macros; encode via gram_weight=100 and nutrition_per_100g
  // so the scan-style {calories, protein...} map directly without scaling downstream.
  const nutrition: NutritionInfo = {
    calories: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    fiber_g: item.fiber_g,
    sugar_g: null,
    added_sugar_g: item.added_sugar_g,
    sodium_mg: item.sodium_mg,
    cholesterol_mg: null,
    saturated_fat_g: null,
    trans_fat_g: null,
    potassium_mg: null,
    vitamin_d_mcg: null,
    calcium_mg: null,
    iron_mg: null,
  };
  const serving: ServingSize = {
    description: item.serving_size,
    unit: 'each',
    gram_weight: 0,
    quantity: 1,
  };
  const sourceTag: FoodItem['source'] =
    item.source === 'barcode_scan' || item.source === 'label_scan'
      ? 'ai_photo'
      : item.source === 'coach_ai'
        ? 'ai_photo'
        : 'manual';
  return {
    source: sourceTag,
    source_id: `pantry:${item.id}`,
    name: item.name,
    brand: item.brand,
    barcode: item.barcode,
    nutrition_per_100g: nutrition,
    serving_sizes: [serving],
    default_serving_index: 0,
    ingredients: null,
    last_accessed: new Date().toISOString(),
  };
}

// Log a pantry item to the food log, scaled by portion multiplier.
// Returns the newly-written FoodEntry for caller use (e.g., saveLastFood).
export async function logPantryItem(
  item: PantryItem,
  opts: { multiplier: number; mealType: MealType; timestamp?: Date },
): Promise<FoodEntry> {
  const multiplier = opts.multiplier;
  const timestamp = (opts.timestamp ?? new Date()).toISOString();
  const foodItem = pantryItemToFoodItem(item, multiplier);
  const scaledNutrition: NutritionInfo = {
    calories: Math.round(item.calories * multiplier),
    protein_g: Math.round(item.protein_g * multiplier * 10) / 10,
    carbs_g: Math.round(item.carbs_g * multiplier * 10) / 10,
    fat_g: Math.round(item.fat_g * multiplier * 10) / 10,
    fiber_g: item.fiber_g != null ? Math.round(item.fiber_g * multiplier * 10) / 10 : null,
    sugar_g: null,
    added_sugar_g:
      item.added_sugar_g != null ? Math.round(item.added_sugar_g * multiplier * 10) / 10 : null,
    sodium_mg: item.sodium_mg != null ? Math.round(item.sodium_mg * multiplier) : null,
    cholesterol_mg: null,
    saturated_fat_g: null,
    trans_fat_g: null,
    potassium_mg: null,
    vitamin_d_mcg: null,
    calcium_mg: null,
    iron_mg: null,
  };

  const servingDesc =
    multiplier === 1
      ? item.serving_size
      : `${item.serving_size} x${multiplier}`;
  const serving: ServingSize = {
    description: servingDesc,
    unit: 'each',
    gram_weight: 0,
    quantity: 1,
  };

  const entry: FoodEntry = {
    id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    meal_type: opts.mealType,
    food_item: foodItem,
    serving,
    quantity: 1,
    computed_nutrition: scaledNutrition,
    source: foodItem.source,
    photo_uri: null,
    photo_confidence: null,
    flagged_ingredients: [],
    notes: null,
  };

  const today = getActiveDate();
  const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
  const existing = (await storageGet<FoodEntry[]>(key)) ?? [];
  await storageSet(key, [...existing, entry]);

  // Bump usage stats
  const now = new Date().toISOString();
  const pantryExisting = (await storageGet<PantryItem[]>(STORAGE_KEYS.PANTRY_ITEMS)) ?? [];
  const updated = pantryExisting.map((p) =>
    p.id === item.id
      ? { ...p, last_logged: now, log_count: p.log_count + 1 }
      : p,
  );
  await storageSet(STORAGE_KEYS.PANTRY_ITEMS, updated);

  return entry;
}

export async function getPantryAutoAdd(): Promise<boolean> {
  const v = await storageGet<boolean>(STORAGE_KEYS.SETTINGS_PANTRY_AUTO_ADD);
  return v ?? true; // default ON
}

export async function setPantryAutoAdd(value: boolean): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS_PANTRY_AUTO_ADD, value);
}
