// Sprint 21: Personal Pantry tests
// Covers add, duplicate detection, log-from-pantry, portion scaling, search, sort.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addToPantry,
  getPantryItems,
  findDuplicate,
  filterPantryItems,
  sortPantryItems,
  logPantryItem,
  getPantryAutoAdd,
  setPantryAutoAdd,
} from '../utils/pantryLibrary';
import { storageGet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { getActiveDate } from '../services/dateContextService';
import type { FoodEntry, PantryItem } from '../types/food';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Pantry: add + persistence', () => {
  it('adds a pantry item and reads it back with all fields intact', async () => {
    const { item, added } = await addToPantry({
      name: 'Triscuit Thin Crisps Original',
      brand: 'Nabisco',
      barcode: '044000032029',
      serving_size: '15 crackers (30g)',
      calories: 140,
      protein_g: 3,
      carbs_g: 22,
      fat_g: 5,
      fiber_g: 3,
      added_sugar_g: 0,
      sodium_mg: 180,
      source: 'barcode_scan',
    });

    expect(added).toBe(true);
    expect(item.name).toBe('Triscuit Thin Crisps Original');
    expect(item.brand).toBe('Nabisco');
    expect(item.barcode).toBe('044000032029');
    expect(item.calories).toBe(140);
    expect(item.log_count).toBe(0);
    expect(item.category).toBe('food');
    expect(item.source).toBe('barcode_scan');
    expect(item.created_at).toBeTruthy();

    const fromStorage = await getPantryItems();
    expect(fromStorage).toHaveLength(1);
    expect(fromStorage[0]).toEqual(item);
  });
});

describe('Pantry: duplicate detection', () => {
  it('does not add a second item with the same barcode', async () => {
    await addToPantry({
      name: 'Greek Yogurt',
      brand: 'Kirkland',
      barcode: '012345',
      serving_size: '1 cup',
      calories: 100,
      protein_g: 17,
      carbs_g: 6,
      fat_g: 0,
      source: 'barcode_scan',
    });

    const second = await addToPantry({
      name: 'Greek Yogurt Renamed',
      brand: 'Kirkland',
      barcode: '012345',
      serving_size: '1 cup',
      calories: 100,
      protein_g: 17,
      carbs_g: 6,
      fat_g: 0,
      source: 'barcode_scan',
    });

    expect(second.added).toBe(false);
    const all = await getPantryItems();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Greek Yogurt');
  });

  it('detects duplicate by exact name+brand when barcode is null', async () => {
    await addToPantry({
      name: 'Grilled Chicken Breast',
      brand: null,
      barcode: null,
      serving_size: '4 oz',
      calories: 190,
      protein_g: 35,
      carbs_g: 0,
      fat_g: 4,
      source: 'label_scan',
    });

    const candidate = {
      barcode: null,
      name: 'Grilled Chicken Breast',
      brand: null,
    };
    const items = await getPantryItems();
    expect(findDuplicate(items, candidate)).not.toBeNull();
  });
});

describe('Pantry: log + usage stats', () => {
  it('logs a pantry item to the food log and increments log_count + last_logged', async () => {
    const { item } = await addToPantry({
      name: 'Oatmeal',
      brand: 'Quaker',
      barcode: null,
      serving_size: '1/2 cup dry',
      calories: 150,
      protein_g: 5,
      carbs_g: 27,
      fat_g: 3,
      fiber_g: 4,
      source: 'manual',
    });

    const before = item.last_logged;

    // Force a tick so last_logged timestamp advances.
    await new Promise((r) => setTimeout(r, 10));

    const entry = await logPantryItem(item, { multiplier: 1, mealType: 'breakfast' });

    expect(entry.food_item.name).toBe('Oatmeal');
    expect(entry.meal_type).toBe('breakfast');
    expect(entry.computed_nutrition.calories).toBe(150);

    const today = getActiveDate();
    const logKey = dateKey(STORAGE_KEYS.LOG_FOOD, today);
    const logged = await storageGet<FoodEntry[]>(logKey);
    expect(logged).toHaveLength(1);
    expect(logged?.[0].food_item.name).toBe('Oatmeal');

    const updated = await getPantryItems();
    expect(updated[0].log_count).toBe(1);
    expect(updated[0].last_logged > before).toBe(true);
  });
});

describe('Pantry: portion scaling', () => {
  it('scales calories and macros by portion multiplier', async () => {
    const { item } = await addToPantry({
      name: 'Protein Bar',
      brand: 'RXBAR',
      barcode: null,
      serving_size: '1 bar',
      calories: 140,
      protein_g: 12,
      carbs_g: 22,
      fat_g: 4,
      source: 'label_scan',
    });

    const entry = await logPantryItem(item, { multiplier: 0.5, mealType: 'snack' });
    expect(entry.computed_nutrition.calories).toBe(70);
    expect(entry.computed_nutrition.protein_g).toBe(6);
    expect(entry.computed_nutrition.carbs_g).toBe(11);
    expect(entry.computed_nutrition.fat_g).toBe(2);
  });

  it('scales by 1.5x and rounds reasonably', async () => {
    const { item } = await addToPantry({
      name: 'Rice Bowl',
      brand: null,
      barcode: null,
      serving_size: '1 cup',
      calories: 200,
      protein_g: 4,
      carbs_g: 45,
      fat_g: 1,
      source: 'manual',
    });

    const entry = await logPantryItem(item, { multiplier: 1.5, mealType: 'lunch' });
    expect(entry.computed_nutrition.calories).toBe(300);
    expect(entry.computed_nutrition.protein_g).toBe(6);
    expect(entry.computed_nutrition.carbs_g).toBe(67.5);
  });
});

describe('Pantry: search', () => {
  it('returns items matching partial name (case-insensitive)', async () => {
    await addToPantry({ name: 'Banana', brand: null, barcode: null, serving_size: '1 medium', calories: 105, protein_g: 1, carbs_g: 27, fat_g: 0, source: 'manual' });
    await addToPantry({ name: 'Chicken Breast', brand: null, barcode: null, serving_size: '4 oz', calories: 190, protein_g: 35, carbs_g: 0, fat_g: 4, source: 'manual' });
    await addToPantry({ name: 'Greek Yogurt', brand: null, barcode: null, serving_size: '1 cup', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0, source: 'manual' });
    await addToPantry({ name: 'Almonds', brand: null, barcode: null, serving_size: '1 oz', calories: 160, protein_g: 6, carbs_g: 6, fat_g: 14, source: 'manual' });
    await addToPantry({ name: 'Brown Rice', brand: null, barcode: null, serving_size: '1 cup', calories: 220, protein_g: 5, carbs_g: 46, fat_g: 2, source: 'manual' });

    const all = await getPantryItems();
    const chickenMatches = filterPantryItems(all, 'chicken');
    expect(chickenMatches).toHaveLength(1);
    expect(chickenMatches[0].name).toBe('Chicken Breast');

    const upperMatches = filterPantryItems(all, 'RICE');
    expect(upperMatches).toHaveLength(1);
    expect(upperMatches[0].name).toBe('Brown Rice');

    expect(filterPantryItems(all, '')).toHaveLength(5);
    expect(filterPantryItems(all, 'zzz')).toHaveLength(0);
  });
});

describe('Pantry: sort order', () => {
  it('sorts by frequency (log_count) and then by recency', () => {
    const base = {
      brand: null,
      barcode: null,
      serving_size: '1',
      calories: 100,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: null,
      added_sugar_g: null,
      sodium_mg: null,
      source: 'manual' as const,
      category: 'food' as const,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const items: PantryItem[] = [
      { ...base, id: 'a', name: 'A', log_count: 3, last_logged: '2026-04-20T10:00:00.000Z' },
      { ...base, id: 'b', name: 'B', log_count: 10, last_logged: '2026-04-19T10:00:00.000Z' },
      { ...base, id: 'c', name: 'C', log_count: 1, last_logged: '2026-04-20T12:00:00.000Z' },
    ];

    const byFreq = sortPantryItems(items, 'frequency');
    expect(byFreq.map((i) => i.id)).toEqual(['b', 'a', 'c']);

    const byRecency = sortPantryItems(items, 'recency');
    expect(byRecency.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('Pantry: auto-add preference', () => {
  it('defaults to ON and persists updates', async () => {
    expect(await getPantryAutoAdd()).toBe(true);
    await setPantryAutoAdd(false);
    expect(await getPantryAutoAdd()).toBe(false);
    await setPantryAutoAdd(true);
    expect(await getPantryAutoAdd()).toBe(true);
  });
});
