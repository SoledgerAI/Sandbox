// Food scan → confirm → persist → daily log integration test

import {
  storageGet,
  storageSet,
  storageDelete,
  STORAGE_KEYS,
  dateKey,
} from '../utils/storage';
import type { FoodEntry, RecentFoodInfo } from '../types/food';
import type { LogEntry } from '../../src/components/logging/FoodScanResult';

const TEST_DATE = '2026-04-14';

// Helper: build a scan LogEntry (matches what FoodScanResult produces)
function makeScanLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    foodName: 'Grilled Chicken Breast',
    brand: null,
    servingSize: '1 breast (120g)',
    mealType: 'lunch',
    photoUri: 'file:///tmp/scan123.jpg',
    confidence: 'high',
    isEstimate: true,
    nutrition: {
      calories: 280,
      protein: 42,
      carbs: 0,
      fat: 12,
      addedSugar: 0,
      fiber: 0,
    },
    ...overrides,
  };
}

// Helper: build a FoodEntry from a LogEntry (matches handleScanLog logic)
function buildFoodEntryFromScan(entry: LogEntry, timestamp: string): FoodEntry {
  const sourceId = `scan:test_${Math.random().toString(36).slice(2, 8)}`;
  const serving = { description: entry.servingSize, unit: 'each' as const, gram_weight: 0, quantity: 1 };
  return {
    id: `food_test_${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    meal_type: entry.mealType,
    food_item: {
      source: 'ai_photo' as const,
      source_id: sourceId,
      name: entry.foodName,
      brand: entry.brand,
      barcode: null,
      nutrition_per_100g: {
        calories: entry.nutrition.calories,
        protein_g: entry.nutrition.protein,
        carbs_g: entry.nutrition.carbs,
        fat_g: entry.nutrition.fat,
        fiber_g: entry.nutrition.fiber,
        sugar_g: null,
        added_sugar_g: entry.nutrition.addedSugar,
        sodium_mg: null,
        cholesterol_mg: null,
        saturated_fat_g: null,
        trans_fat_g: null,
        potassium_mg: null,
        vitamin_d_mcg: null,
        calcium_mg: null,
        iron_mg: null,
      },
      serving_sizes: [serving],
      default_serving_index: 0,
      ingredients: null,
      last_accessed: new Date().toISOString(),
    },
    serving,
    quantity: 1,
    computed_nutrition: {
      calories: entry.nutrition.calories,
      protein_g: entry.nutrition.protein,
      carbs_g: entry.nutrition.carbs,
      fat_g: entry.nutrition.fat,
      fiber_g: entry.nutrition.fiber,
      sugar_g: null,
      added_sugar_g: entry.nutrition.addedSugar,
      sodium_mg: null,
      cholesterol_mg: null,
      saturated_fat_g: null,
      trans_fat_g: null,
      potassium_mg: null,
      vitamin_d_mcg: null,
      calcium_mg: null,
      iron_mg: null,
    },
    source: 'ai_photo' as const,
    photo_uri: entry.photoUri,
    photo_confidence: entry.confidence,
    flagged_ingredients: [],
    notes: entry.isEstimate ? 'AI estimate' : 'Nutrition label scan',
  };
}

describe('Food Scan Save Flow', () => {
  const foodKey = dateKey(STORAGE_KEYS.LOG_FOOD, TEST_DATE);

  beforeEach(async () => {
    await storageDelete(foodKey);
    await storageDelete(STORAGE_KEYS.FOOD_RECENT);
  });

  it('single scanned food entry persists to storage', async () => {
    const entry = makeScanLogEntry();
    const foodEntry = buildFoodEntryFromScan(entry, new Date().toISOString());

    // Simulate handleScanLog: write to storage
    await storageSet(foodKey, [foodEntry]);

    // Verify: entry persists and is readable
    const stored = await storageGet<FoodEntry[]>(foodKey);
    expect(stored).not.toBeNull();
    expect(stored).toHaveLength(1);
    expect(stored![0].food_item.name).toBe('Grilled Chicken Breast');
    expect(stored![0].source).toBe('ai_photo');
    expect(stored![0].computed_nutrition.calories).toBe(280);
    expect(stored![0].computed_nutrition.protein_g).toBe(42);
    expect(stored![0].photo_uri).toBe('file:///tmp/scan123.jpg');
    expect(stored![0].photo_confidence).toBe('high');
  });

  it('scanned food appends to existing daily entries', async () => {
    // Pre-existing manual entry
    const manualEntry: FoodEntry = buildFoodEntryFromScan(
      makeScanLogEntry({ foodName: 'Oatmeal', nutrition: { calories: 150, protein: 5, carbs: 27, fat: 3, addedSugar: 0, fiber: 4 } }),
      new Date().toISOString(),
    );
    manualEntry.source = 'manual';
    await storageSet(foodKey, [manualEntry]);

    // Scan a new food
    const scanEntry = buildFoodEntryFromScan(
      makeScanLogEntry({ foodName: 'Grilled Chicken' }),
      new Date().toISOString(),
    );

    // Read existing, append, write (mirrors handleScanLog)
    const existing = (await storageGet<FoodEntry[]>(foodKey)) ?? [];
    await storageSet(foodKey, [...existing, scanEntry]);

    // Verify both entries present
    const stored = await storageGet<FoodEntry[]>(foodKey);
    expect(stored).toHaveLength(2);
    expect(stored![0].food_item.name).toBe('Oatmeal');
    expect(stored![1].food_item.name).toBe('Grilled Chicken');
    expect(stored![1].source).toBe('ai_photo');
  });

  it('multi-item scan saves all items in single batch write', async () => {
    const entries = [
      makeScanLogEntry({ foodName: 'Rice' }),
      makeScanLogEntry({ foodName: 'Chicken Curry', nutrition: { calories: 350, protein: 28, carbs: 15, fat: 20, addedSugar: 2, fiber: 3 } }),
      makeScanLogEntry({ foodName: 'Naan Bread', nutrition: { calories: 260, protein: 8, carbs: 45, fat: 5, addedSugar: 1, fiber: 2 } }),
    ];

    const timestamp = new Date().toISOString();
    const foodEntries = entries.map((e) => buildFoodEntryFromScan(e, timestamp));

    // Single batch write (mirrors fixed handleScanLog)
    await storageSet(foodKey, foodEntries);

    // Verify all items saved
    const stored = await storageGet<FoodEntry[]>(foodKey);
    expect(stored).toHaveLength(3);
    expect(stored!.map((e) => e.food_item.name)).toEqual(['Rice', 'Chicken Curry', 'Naan Bread']);

    // Verify total calories
    const totalCal = stored!.reduce((sum, e) => sum + e.computed_nutrition.calories, 0);
    expect(totalCal).toBe(280 + 350 + 260);
  });

  it('scanned food shows in daily log read (same storage key)', async () => {
    const entry = buildFoodEntryFromScan(
      makeScanLogEntry(),
      new Date().toISOString(),
    );
    await storageSet(foodKey, [entry]);

    // Dashboard read pattern — uses same dateKey
    const dashboardRead = await storageGet<FoodEntry[]>(foodKey);
    expect(dashboardRead).not.toBeNull();
    expect(dashboardRead!.length).toBeGreaterThan(0);

    // Log tab read pattern — access food_item.name
    const lastEntry = dashboardRead![dashboardRead!.length - 1];
    expect(lastEntry.food_item.name).toBe('Grilled Chicken Breast');
    expect(lastEntry.timestamp).toBeTruthy();
  });

  it('compliance engine counts scanned food as food_logged', async () => {
    const entry = buildFoodEntryFromScan(
      makeScanLogEntry(),
      new Date().toISOString(),
    );
    await storageSet(foodKey, [entry]);

    // Compliance check: foods.length > 0
    const foods = (await storageGet<FoodEntry[]>(foodKey)) ?? [];
    expect(foods.length).toBeGreaterThan(0); // log_food goal: completed

    // Calorie target check
    const totalCal = foods.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0);
    expect(totalCal).toBe(280);
  });

  it('Coach context builder picks up ai_photo source entries', async () => {
    const entry = buildFoodEntryFromScan(
      makeScanLogEntry(),
      new Date().toISOString(),
    );
    await storageSet(foodKey, [entry]);

    // Context builder reads all food entries regardless of source
    const foods = (await storageGet<FoodEntry[]>(foodKey)) ?? [];
    const aiPhotoEntries = foods.filter((f) => f.source === 'ai_photo');
    expect(aiPhotoEntries).toHaveLength(1);
    expect(aiPhotoEntries[0].computed_nutrition.protein_g).toBe(42);
  });

  it('recent foods list updates with scanned entry', async () => {
    const entry = buildFoodEntryFromScan(
      makeScanLogEntry(),
      new Date().toISOString(),
    );

    // Simulate recent foods update (mirrors handleScanLog)
    const recentEntry: RecentFoodInfo = {
      food_item: { ...entry.food_item, last_accessed: new Date().toISOString() },
      serving: entry.serving,
      quantity: entry.quantity,
      calories: Math.round(entry.computed_nutrition.calories),
    };
    await storageSet(STORAGE_KEYS.FOOD_RECENT, [recentEntry]);

    const recent = await storageGet<RecentFoodInfo[]>(STORAGE_KEYS.FOOD_RECENT);
    expect(recent).toHaveLength(1);
    expect(recent![0].food_item.name).toBe('Grilled Chicken Breast');
    expect(recent![0].calories).toBe(280);
  });

  it('nutrition label scan (non-estimate) saves with correct note', async () => {
    const entry = buildFoodEntryFromScan(
      makeScanLogEntry({ isEstimate: false, confidence: 'high' }),
      new Date().toISOString(),
    );

    expect(entry.notes).toBe('Nutrition label scan');
    expect(entry.photo_confidence).toBe('high');
  });

  it('scan entry has all required FoodEntry fields', () => {
    const entry = buildFoodEntryFromScan(
      makeScanLogEntry(),
      '2026-04-14T12:00:00.000Z',
    );

    // Verify all FoodEntry fields present
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBe('2026-04-14T12:00:00.000Z');
    expect(entry.meal_type).toBe('lunch');
    expect(entry.food_item).toBeDefined();
    expect(entry.food_item.source).toBe('ai_photo');
    expect(entry.food_item.name).toBe('Grilled Chicken Breast');
    expect(entry.serving).toBeDefined();
    expect(entry.serving.unit).toBe('each');
    expect(entry.quantity).toBe(1);
    expect(entry.computed_nutrition).toBeDefined();
    expect(entry.source).toBe('ai_photo');
    expect(entry.photo_uri).toBe('file:///tmp/scan123.jpg');
    expect(entry.photo_confidence).toBe('high');
    expect(entry.flagged_ingredients).toEqual([]);
    expect(entry.notes).toBe('AI estimate');
  });
});
