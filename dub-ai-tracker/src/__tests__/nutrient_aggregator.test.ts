// Sprint 22 Batch 2: Daily Nutrient Aggregator tests
// Verifies the food+supplement P&L, UL alert logic, and the magnesium
// supplement-only UL special case.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { getDailyNutrientReport } from '../services/nutrientAggregator';
import type { FoodEntry, NutritionInfo, ServingSize } from '../types/food';
import type { SupplementEntry } from '../types';

const TEST_DATE = '2026-04-20';

function baseNutrition(overrides: Partial<NutritionInfo> = {}): NutritionInfo {
  return {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: null,
    sugar_g: null,
    added_sugar_g: null,
    sodium_mg: null,
    cholesterol_mg: null,
    saturated_fat_g: null,
    trans_fat_g: null,
    potassium_mg: null,
    calcium_mg: null,
    iron_mg: null,
    vitamin_d_mcg: null,
    ...overrides,
  };
}

const SERVING: ServingSize = {
  description: '100g',
  unit: 'g',
  gram_weight: 100,
  quantity: 1,
};

function foodEntry(name: string, nutrition: NutritionInfo): FoodEntry {
  return {
    id: `food_${name.replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: `${TEST_DATE}T12:00:00.000Z`,
    meal_type: 'lunch',
    food_item: {
      source: 'manual',
      source_id: `manual:${name}`,
      name,
      brand: null,
      barcode: null,
      nutrition_per_100g: nutrition,
      serving_sizes: [SERVING],
      default_serving_index: 0,
      ingredients: null,
      last_accessed: `${TEST_DATE}T12:00:00.000Z`,
    },
    serving: SERVING,
    quantity: 1,
    computed_nutrition: nutrition,
    source: 'manual',
    photo_uri: null,
    photo_confidence: null,
    flagged_ingredients: [],
    notes: null,
  };
}

function supplementEntry(
  name: string,
  nutrients?: { code: string; amount: number; unit: string }[],
): SupplementEntry {
  return {
    id: `supp_${name.replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: `${TEST_DATE}T08:00:00.000Z`,
    name,
    dosage: 0,
    unit: 'mg',
    taken: true,
    category: 'supplement',
    notes: null,
    side_effects: null,
    ...(nutrients ? { nutrients } : {}),
  };
}

async function writeFoods(entries: FoodEntry[]): Promise<void> {
  await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, TEST_DATE), entries);
}

async function writeSupps(entries: SupplementEntry[]): Promise<void> {
  await storageSet(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, TEST_DATE), entries);
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getDailyNutrientReport', () => {
  test('Test 1: empty day returns zero totals and no alerts', async () => {
    const report = await getDailyNutrientReport(TEST_DATE, 'female');
    expect(report.date).toBe(TEST_DATE);
    expect(report.entries_count).toBe(0);
    expect(report.totals).toHaveLength(0);
    expect(report.alerts).toHaveLength(0);
  });

  test('Test 2: food-only iron aggregation with adequate status', async () => {
    await writeFoods([
      foodEntry('Beef', baseNutrition({ iron_mg: 5 })),
      foodEntry('Spinach salad', baseNutrition({ iron_mg: 8 })),
      foodEntry('Lentils', baseNutrition({ iron_mg: 10 })),
    ]);

    const report = await getDailyNutrientReport(TEST_DATE, 'female');
    const iron = report.totals.find((t) => t.code === 'NUT-MIC-FE');
    expect(iron).toBeDefined();
    expect(iron!.food_sourced).toBe(23);
    expect(iron!.supplement_sourced).toBe(0);
    expect(iron!.total).toBe(23);
    expect(iron!.status).toBe('elevated'); // female RDA 18; 23 > 18
    expect(report.alerts.find((a) => a.code === 'NUT-MIC-FE')).toBeUndefined();
  });

  test('Test 3: food + supplement aggregation triggers critical UL alert', async () => {
    await writeFoods([
      foodEntry('Beef', baseNutrition({ iron_mg: 5 })),
      foodEntry('Fortified cereal', baseNutrition({ iron_mg: 8 })),
    ]);
    await writeSupps([
      supplementEntry('Iron supplement', [
        { code: 'NUT-MIC-FE', amount: 35, unit: 'mg' },
      ]),
    ]);

    const report = await getDailyNutrientReport(TEST_DATE, 'female');
    const iron = report.totals.find((t) => t.code === 'NUT-MIC-FE');
    expect(iron).toBeDefined();
    expect(iron!.food_sourced).toBe(13);
    expect(iron!.supplement_sourced).toBe(35);
    expect(iron!.total).toBe(48);
    expect(iron!.status).toBe('exceeds_ul');

    const alert = report.alerts.find((a) => a.code === 'NUT-MIC-FE');
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe('critical');
    expect(alert!.sources.length).toBeGreaterThanOrEqual(3);
    const sourceNames = alert!.sources.map((s) => s.name);
    expect(sourceNames).toContain('Beef');
    expect(sourceNames).toContain('Fortified cereal');
    expect(sourceNames).toContain('Iron supplement');
  });

  test('Test 4: multiple nutrients with mixed statuses — iron alerts, calcium does not, protein never', async () => {
    await writeFoods([
      foodEntry(
        'Big meal',
        baseNutrition({
          iron_mg: 30,
          calcium_mg: 800,
          protein_g: 200,
        }),
      ),
    ]);
    await writeSupps([
      supplementEntry('Iron pill', [
        { code: 'NUT-MIC-FE', amount: 25, unit: 'mg' },
      ]),
    ]);

    const report = await getDailyNutrientReport(TEST_DATE, 'female');
    expect(report.alerts.find((a) => a.code === 'NUT-MIC-FE')).toBeDefined();
    expect(report.alerts.find((a) => a.code === 'NUT-MIC-CA')).toBeUndefined();
    expect(report.alerts.find((a) => a.code === 'NUT-MAC-PRO')).toBeUndefined();

    const calcium = report.totals.find((t) => t.code === 'NUT-MIC-CA');
    expect(calcium!.total).toBe(800);
    expect(calcium!.status).not.toBe('exceeds_ul');
  });

  test('Test 5: magnesium special case — only supplement-sourced counts against UL', async () => {
    // Food 400mg + supp 200mg: supp is under 350mg UL → no alert
    await writeFoods([
      foodEntry('Leafy greens', baseNutrition({ magnesium_mg: 400 })),
    ]);
    await writeSupps([
      supplementEntry('Mag citrate', [
        { code: 'NUT-MIC-MG', amount: 200, unit: 'mg' },
      ]),
    ]);

    let report = await getDailyNutrientReport(TEST_DATE, 'female');
    let mg = report.totals.find((t) => t.code === 'NUT-MIC-MG');
    expect(mg!.food_sourced).toBe(400);
    expect(mg!.supplement_sourced).toBe(200);
    expect(mg!.status).not.toBe('exceeds_ul');
    expect(report.alerts.find((a) => a.code === 'NUT-MIC-MG')).toBeUndefined();

    // Now push supplement magnesium to 600mg (food untouched): over 350mg UL
    await writeSupps([
      supplementEntry('Mag citrate AM', [
        { code: 'NUT-MIC-MG', amount: 200, unit: 'mg' },
      ]),
      supplementEntry('Mag glycinate PM', [
        { code: 'NUT-MIC-MG', amount: 400, unit: 'mg' },
      ]),
    ]);

    report = await getDailyNutrientReport(TEST_DATE, 'female');
    mg = report.totals.find((t) => t.code === 'NUT-MIC-MG');
    expect(mg!.food_sourced).toBe(400);
    expect(mg!.supplement_sourced).toBe(600);
    expect(mg!.status).toBe('exceeds_ul');
    const alert = report.alerts.find((a) => a.code === 'NUT-MIC-MG');
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe('critical');
  });

  test('Test 6: warning severity at 80–100% of UL (iron at 38mg)', async () => {
    // Iron UL = 45mg; 38mg is ~84% — should warn, not critical
    await writeFoods([
      foodEntry('Fortified cereal', baseNutrition({ iron_mg: 20 })),
    ]);
    await writeSupps([
      supplementEntry('Iron supplement', [
        { code: 'NUT-MIC-FE', amount: 18, unit: 'mg' },
      ]),
    ]);

    const report = await getDailyNutrientReport(TEST_DATE, 'female');
    const iron = report.totals.find((t) => t.code === 'NUT-MIC-FE');
    expect(iron!.total).toBe(38);
    expect(iron!.status).not.toBe('exceeds_ul');
    const alert = report.alerts.find((a) => a.code === 'NUT-MIC-FE');
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe('warning');
  });

  test('Test 7: sex-adjusted RDA changes pct_rda for same intake', async () => {
    await writeFoods([foodEntry('Beef', baseNutrition({ iron_mg: 9 }))]);

    const male = await getDailyNutrientReport(TEST_DATE, 'male');
    const female = await getDailyNutrientReport(TEST_DATE, 'female');
    const maleIron = male.totals.find((t) => t.code === 'NUT-MIC-FE')!;
    const femaleIron = female.totals.find((t) => t.code === 'NUT-MIC-FE')!;
    expect(maleIron.rda).toBe(8);
    expect(femaleIron.rda).toBe(18);
    expect(maleIron.pct_rda).toBe(113); // 9/8 = 112.5 → 113
    expect(femaleIron.pct_rda).toBe(50); // 9/18 = 50
    expect(maleIron.pct_rda).not.toBe(femaleIron.pct_rda);
  });

  test('Test 8: backward compat — legacy entries with only macros aggregate without crashing', async () => {
    await writeFoods([
      foodEntry(
        'Plain chicken',
        baseNutrition({ calories: 250, protein_g: 30, carbs_g: 0, fat_g: 12 }),
      ),
      foodEntry(
        'White rice',
        baseNutrition({ calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0 }),
      ),
    ]);

    const report = await getDailyNutrientReport(TEST_DATE, 'female');
    const cal = report.totals.find((t) => t.code === 'NUT-MAC-CAL');
    const pro = report.totals.find((t) => t.code === 'NUT-MAC-PRO');
    expect(cal!.total).toBe(450);
    expect(pro!.total).toBe(34);

    // No micronutrients were set — they should not appear or should be 0.
    const iron = report.totals.find((t) => t.code === 'NUT-MIC-FE');
    expect(iron).toBeUndefined();
    const vitaminA = report.totals.find((t) => t.code === 'NUT-MIC-VA');
    expect(vitaminA).toBeUndefined();

    // No alerts (no ULs breached, no NaN explosions)
    expect(report.alerts).toHaveLength(0);
  });
});
