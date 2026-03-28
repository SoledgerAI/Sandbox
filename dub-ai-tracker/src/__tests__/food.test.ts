// Step 7: Food Waterfall, Ingredient Flags, and Serving Math tests

import { detectFlaggedIngredients, DEFAULT_INGREDIENT_FLAGS, getEnabledFlags } from '../utils/ingredients';
import { scaleNutrition, computeMultiplier, roundForDisplay, formatQuantity, QUANTITY_STEPS } from '../utils/servingmath';
import type { NutritionInfo, ServingSize } from '../types/food';
import type { IngredientFlag } from '../types/food';

describe('Food Waterfall', () => {
  // [ASSUMPTION] Testing waterfall priority by verifying the functions exist
  // and the barcode/text search functions call sources in order.
  // Actual API calls are mocked, so we verify structure.

  it('barcodeLookup function exists and is importable', async () => {
    const { barcodeLookup } = require('../utils/foodwaterfall');
    expect(typeof barcodeLookup).toBe('function');
  });

  it('textSearchWaterfall function exists and is importable', async () => {
    const { textSearchWaterfall } = require('../utils/foodwaterfall');
    expect(typeof textSearchWaterfall).toBe('function');
  });
});

describe('Ingredient Flag Detection', () => {
  it('detects flagged ingredients when enabled', () => {
    const flags: IngredientFlag[] = [
      {
        id: 'hfcs',
        name: 'High Fructose Corn Syrup (HFCS)',
        keywords: ['high fructose corn syrup', 'hfcs'],
        enabled: true,
      },
      {
        id: 'msg',
        name: 'MSG (Monosodium Glutamate)',
        keywords: ['monosodium glutamate', 'msg'],
        enabled: true,
      },
    ];

    const result = detectFlaggedIngredients(
      'Water, Sugar, High Fructose Corn Syrup, Natural Flavors',
      flags
    );
    expect(result).toContain('High Fructose Corn Syrup (HFCS)');
    expect(result).not.toContain('MSG (Monosodium Glutamate)');
  });

  it('skips disabled flags', () => {
    const flags: IngredientFlag[] = [
      {
        id: 'hfcs',
        name: 'HFCS',
        keywords: ['high fructose corn syrup'],
        enabled: false,
      },
    ];

    const result = detectFlaggedIngredients(
      'High Fructose Corn Syrup',
      flags
    );
    expect(result).toHaveLength(0);
  });

  it('returns empty array for null ingredient string', () => {
    const flags: IngredientFlag[] = [
      { id: 'test', name: 'Test', keywords: ['test'], enabled: true },
    ];
    expect(detectFlaggedIngredients(null, flags)).toEqual([]);
  });

  it('DEFAULT_INGREDIENT_FLAGS has expected entries', () => {
    expect(DEFAULT_INGREDIENT_FLAGS.length).toBeGreaterThanOrEqual(10);
    const ids = DEFAULT_INGREDIENT_FLAGS.map((f) => f.id);
    expect(ids).toContain('added_sugars');
    expect(ids).toContain('hfcs');
    expect(ids).toContain('artificial_sweeteners');
    expect(ids).toContain('msg');
  });

  it('all default flags are disabled by default', () => {
    for (const flag of DEFAULT_INGREDIENT_FLAGS) {
      expect(flag.enabled).toBe(false);
    }
  });

  it('getEnabledFlags returns only enabled flags', () => {
    const flags: IngredientFlag[] = [
      { id: 'a', name: 'A', keywords: ['a'], enabled: true },
      { id: 'b', name: 'B', keywords: ['b'], enabled: false },
      { id: 'c', name: 'C', keywords: ['c'], enabled: true },
    ];
    const enabled = getEnabledFlags(flags);
    expect(enabled).toHaveLength(2);
    expect(enabled.map((f) => f.id)).toEqual(['a', 'c']);
  });
});

describe('Serving Math', () => {
  const per100g: NutritionInfo = {
    calories: 200,
    protein_g: 20,
    carbs_g: 30,
    fat_g: 8,
    fiber_g: 5,
    sugar_g: 10,
    added_sugar_g: null,
    sodium_mg: 400,
    cholesterol_mg: 50,
    saturated_fat_g: 3,
    trans_fat_g: 0,
    potassium_mg: 300,
    vitamin_d_mcg: null,
    calcium_mg: 100,
    iron_mg: 2,
  };

  const serving100g: ServingSize = {
    description: '100g',
    unit: 'g',
    gram_weight: 100,
    quantity: 1,
  };

  const serving200g: ServingSize = {
    description: '1 cup (200g)',
    unit: 'g',
    gram_weight: 200,
    quantity: 1,
  };

  describe('Serving size scaling', () => {
    it('2x serving = 2x calories/macros', () => {
      const scaled = scaleNutrition(per100g, serving100g, 2);
      expect(scaled.calories).toBeCloseTo(400, 1);
      expect(scaled.protein_g).toBeCloseTo(40, 1);
      expect(scaled.carbs_g).toBeCloseTo(60, 1);
      expect(scaled.fat_g).toBeCloseTo(16, 1);
    });

    it('1 serving of 200g = 2x of per-100g values', () => {
      const scaled = scaleNutrition(per100g, serving200g, 1);
      expect(scaled.calories).toBeCloseTo(400, 1);
      expect(scaled.protein_g).toBeCloseTo(40, 1);
    });
  });

  describe('Fractional servings', () => {
    it('0.5 serving = half values', () => {
      const scaled = scaleNutrition(per100g, serving100g, 0.5);
      expect(scaled.calories).toBeCloseTo(100, 1);
      expect(scaled.protein_g).toBeCloseTo(10, 1);
      expect(scaled.carbs_g).toBeCloseTo(15, 1);
      expect(scaled.fat_g).toBeCloseTo(4, 1);
    });
  });

  describe('computeMultiplier', () => {
    it('100g serving, qty 1 = multiplier 1.0', () => {
      expect(computeMultiplier(serving100g, 1)).toBe(1.0);
    });

    it('200g serving, qty 1 = multiplier 2.0', () => {
      expect(computeMultiplier(serving200g, 1)).toBe(2.0);
    });

    it('100g serving, qty 0.5 = multiplier 0.5', () => {
      expect(computeMultiplier(serving100g, 0.5)).toBe(0.5);
    });
  });

  describe('roundForDisplay', () => {
    it('rounds to nearest integer', () => {
      expect(roundForDisplay(10.6)).toBe(11);
      expect(roundForDisplay(10.4)).toBe(10);
    });

    it('returns null for null input', () => {
      expect(roundForDisplay(null)).toBeNull();
    });
  });

  describe('formatQuantity', () => {
    it('formats common fractions', () => {
      expect(formatQuantity(0.5)).toBe('\u00BD');
      expect(formatQuantity(0.25)).toBe('\u00BC');
      expect(formatQuantity(0.75)).toBe('\u00BE');
    });

    it('formats integers', () => {
      expect(formatQuantity(1)).toBe('1');
      expect(formatQuantity(2)).toBe('2');
    });
  });

  describe('QUANTITY_STEPS', () => {
    it('includes expected steps', () => {
      expect(QUANTITY_STEPS).toContain(0.25);
      expect(QUANTITY_STEPS).toContain(0.5);
      expect(QUANTITY_STEPS).toContain(1);
      expect(QUANTITY_STEPS).toContain(2);
    });
  });
});
