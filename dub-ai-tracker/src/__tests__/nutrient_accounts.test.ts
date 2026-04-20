// Sprint 22 Batch 1: Nutrient Chart of Accounts foundation tests
// Validates account codes, UL/RDA lookups, and type backward compatibility.

import {
  NUTRIENT_ACCOUNTS,
  getAccount,
  getAccountsWithUL,
  getUL,
  getRDA,
} from '../constants/nutrientAccounts';
import type { FoodEntry, NutritionInfo, SupplementEntry } from '../types';

describe('Nutrient Chart of Accounts', () => {
  test('all account codes are unique', () => {
    const codes = NUTRIENT_ACCOUNTS.map((a) => a.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  test('all accounts with UL have valid values and a source', () => {
    const withUL = NUTRIENT_ACCOUNTS.filter((a) => a.ul !== null);
    expect(withUL.length).toBeGreaterThan(0);
    for (const a of withUL) {
      expect(a.ul).not.toBeNull();
      expect(a.ul as number).toBeGreaterThan(0);
      expect(a.ul_source).not.toBeNull();
      expect(typeof a.ul_source).toBe('string');
      expect((a.ul_source as string).length).toBeGreaterThan(0);
    }
  });

  test('getRDA returns sex-adjusted values', () => {
    expect(getRDA('NUT-MIC-FE', 'male')).toBe(8);
    expect(getRDA('NUT-MIC-FE', 'female')).toBe(18);
    expect(getRDA('NUT-MAC-PRO', 'male')).toBe(56);
    expect(getRDA('NUT-MAC-PRO', 'female')).toBe(46);
    expect(getRDA('NOT-A-CODE', 'male')).toBeNull();
  });

  test('getAccount returns the right record and undefined for unknown codes', () => {
    const calcium = getAccount('NUT-MIC-CA');
    expect(calcium).toBeDefined();
    expect(calcium?.name).toBe('Calcium');
    expect(calcium?.unit).toBe('mg');
    expect(getAccount('INVALID')).toBeUndefined();
  });

  test('getAccountsWithUL includes iron, calcium, zinc, vitamin A and excludes protein', () => {
    const list = getAccountsWithUL();
    const codes = new Set(list.map((a) => a.code));
    expect(codes.has('NUT-MIC-FE')).toBe(true);
    expect(codes.has('NUT-MIC-CA')).toBe(true);
    expect(codes.has('NUT-MIC-ZN')).toBe(true);
    expect(codes.has('NUT-MIC-VA')).toBe(true);
    expect(codes.has('NUT-MAC-PRO')).toBe(false);

    expect(getUL('NUT-MIC-FE')).toBe(45);
    expect(getUL('NUT-MIC-CA')).toBe(2500);
    expect(getUL('NUT-MIC-ZN')).toBe(40);
    expect(getUL('NUT-MIC-VA')).toBe(3000);
  });

  test('expanded food NutritionInfo accepts both legacy and micronutrient-rich shapes', () => {
    // Legacy shape — only required macros + existing nullable fields
    const legacyNutrition: NutritionInfo = {
      calories: 250,
      protein_g: 30,
      carbs_g: 10,
      fat_g: 8,
      fiber_g: null,
      sugar_g: null,
      added_sugar_g: null,
      sodium_mg: null,
      cholesterol_mg: null,
      saturated_fat_g: null,
      trans_fat_g: null,
      potassium_mg: null,
      vitamin_d_mcg: null,
      calcium_mg: null,
      iron_mg: null,
    };
    expect(legacyNutrition.calories).toBe(250);

    // Expanded shape — with the new optional micronutrient fields populated
    const richNutrition: NutritionInfo = {
      ...legacyNutrition,
      vitamin_a_mcg: 500,
      vitamin_c_mg: 60,
      vitamin_e_mg: 10,
      vitamin_k_mcg: 80,
      vitamin_b6_mg: 1.0,
      vitamin_b12_mcg: 2.0,
      folate_mcg: 300,
      niacin_mg: 12,
      zinc_mg: 8,
      magnesium_mg: 200,
      selenium_mcg: 40,
      copper_mg: 0.5,
      manganese_mg: 1.5,
      phosphorus_mg: 500,
      chromium_mcg: 20,
      total_sugar_g: 4,
    };
    expect(richNutrition.vitamin_a_mcg).toBe(500);
    expect(richNutrition.iron_mg).toBeNull();

    // FoodEntry with legacy nutrition still compiles (backward compat)
    const legacyEntry: FoodEntry = {
      id: 'food_1',
      timestamp: '2026-04-20T12:00:00.000Z',
      meal_type: 'lunch',
      food_item: {
        source: 'manual',
        source_id: 'manual:1',
        name: 'Plain chicken',
        brand: null,
        barcode: null,
        nutrition_per_100g: legacyNutrition,
        serving_sizes: [{ description: '100g', unit: 'g', gram_weight: 100, quantity: 1 }],
        default_serving_index: 0,
        ingredients: null,
        last_accessed: '2026-04-20T12:00:00.000Z',
      },
      serving: { description: '100g', unit: 'g', gram_weight: 100, quantity: 1 },
      quantity: 1,
      computed_nutrition: legacyNutrition,
      source: 'manual',
      photo_uri: null,
      photo_confidence: null,
      flagged_ingredients: [],
      notes: null,
    };
    expect(legacyEntry.computed_nutrition.protein_g).toBe(30);
  });

  test('SupplementEntry.nutrients is optional and can carry multiple account lines', () => {
    const legacy: SupplementEntry = {
      id: 'supp_1',
      timestamp: '2026-04-20T08:00:00.000Z',
      name: 'Fish oil',
      dosage: 1000,
      unit: 'mg',
      taken: true,
      category: 'supplement',
      notes: null,
      side_effects: null,
    };
    expect(legacy.nutrients).toBeUndefined();

    const multivitamin: SupplementEntry = {
      ...legacy,
      id: 'supp_2',
      name: 'Daily multivitamin',
      nutrients: [
        { code: 'NUT-MIC-VA', amount: 900, unit: 'mcg' },
        { code: 'NUT-MIC-VD', amount: 25, unit: 'mcg' },
        { code: 'NUT-MIC-FE', amount: 18, unit: 'mg' },
        { code: 'NUT-MIC-ZN', amount: 11, unit: 'mg' },
      ],
    };
    expect(multivitamin.nutrients).toHaveLength(4);
    expect(multivitamin.nutrients?.[2].code).toBe('NUT-MIC-FE');
  });
});
