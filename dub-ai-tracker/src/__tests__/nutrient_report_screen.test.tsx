// Sprint 22 — Nutrient P&L Report screen tests
// Covers the screen render paths, alert surfacing, empty state, plus the
// underlying 7-day average math and progress-bar colour policy.

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor } from '@testing-library/react-native';

import { storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { todayDateString } from '../utils/dayBoundary';
import type { FoodEntry, NutritionInfo, ServingSize } from '../types/food';
import type { SupplementEntry } from '../types';

import NutrientReportScreen, {
  pickBarColor,
} from '../../app/log/nutrient-report';
import {
  buildNutrientAverages,
  computeTrend,
} from '../services/nutrientAverage';
import type { DailyNutrientReport } from '../services/nutrientAggregator';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    setParams: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// ---------------------------------------------------------------------------
// Fixture helpers (mirrors nutrient_aggregator.test.ts)
// ---------------------------------------------------------------------------

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
    id: `food_${name.replace(/\s+/g, '_')}`,
    timestamp: `${todayDateString()}T12:00:00.000Z`,
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
      last_accessed: `${todayDateString()}T12:00:00.000Z`,
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
  nutrients: { code: string; amount: number; unit: string }[],
): SupplementEntry {
  return {
    id: `supp_${name.replace(/\s+/g, '_')}`,
    timestamp: `${todayDateString()}T08:00:00.000Z`,
    name,
    dosage: 0,
    unit: 'mg',
    taken: true,
    category: 'supplement',
    notes: null,
    side_effects: null,
    nutrients,
  };
}

function stubReport(
  date: string,
  totals: { code: string; name: string; unit: string; total: number; rda: number | null; ul: number | null }[],
): DailyNutrientReport {
  return {
    date,
    entries_count: 1,
    alerts: [],
    totals: totals.map((t) => ({
      code: t.code,
      name: t.name,
      unit: t.unit,
      food_sourced: t.total,
      supplement_sourced: 0,
      total: t.total,
      rda: t.rda,
      ul: t.ul,
      pct_rda: t.rda ? Math.round((t.total / t.rda) * 100) : null,
      pct_ul: t.ul ? Math.round((t.total / t.ul) * 100) : null,
      status: 'adequate' as const,
    })),
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await storageSet(STORAGE_KEYS.PROFILE, { sex: 'female' });
});

// ---------------------------------------------------------------------------
// Test 1: Report renders sections with data
// ---------------------------------------------------------------------------

describe('NutrientReportScreen — rendering', () => {
  test('Test 1: renders macro + vitamin + mineral sections when data present', async () => {
    const today = todayDateString();
    await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, today), [
      foodEntry(
        'Mixed meal',
        baseNutrition({
          calories: 500,
          protein_g: 30,
          iron_mg: 10,
          vitamin_c_mg: 40,
          calcium_mg: 400,
        }),
      ),
    ]);

    const { findByText } = render(<NutrientReportScreen />);

    // Macro section
    await findByText('Macronutrients');
    // Water-soluble vitamins section
    await findByText(/Water-soluble/);
    // Minerals section
    await findByText('Minerals');
    // Nutrient names
    await findByText('Iron');
    await findByText('Vitamin C');
    await findByText('Calcium');
  });

  // -------------------------------------------------------------------------
  // Test 2: Alerts display with source breakdown
  // -------------------------------------------------------------------------
  test('Test 2: renders alert card + alert status copy when a UL is breached', async () => {
    const today = todayDateString();
    await storageSet(dateKey(STORAGE_KEYS.LOG_FOOD, today), [
      foodEntry('Beef', baseNutrition({ iron_mg: 5 })),
      foodEntry('Fortified cereal', baseNutrition({ iron_mg: 10 })),
    ]);
    await storageSet(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today), [
      supplementEntry('Iron supplement', [
        { code: 'NUT-MIC-FE', amount: 35, unit: 'mg' },
      ]),
    ]);

    const { findByText } = render(<NutrientReportScreen />);

    // "EXCEEDS UPPER LIMIT" + "Sources:" appear only in the alert card, not
    // in the summary row. Avoid the literal "Alerts" text because it
    // collides with the "Alerts" summary card label.
    await findByText('EXCEEDS UPPER LIMIT');
    await findByText('Sources:');
    await findByText('Iron supplement');
  });

  // -------------------------------------------------------------------------
  // Test 3: Empty state
  // -------------------------------------------------------------------------
  test('Test 3: empty-state message when no entries logged', async () => {
    const { findByText } = render(<NutrientReportScreen />);

    await findByText(/No entries logged today/);
  });
});

// ---------------------------------------------------------------------------
// Test 4: 7-day average + trend direction
// ---------------------------------------------------------------------------

describe('buildNutrientAverages — 7-day variance', () => {
  test('Test 4a: averages across 7 reports are computed correctly', async () => {
    const ironTotals = [10, 12, 14, 10, 16, 18, 10]; // mean = 12.857
    const currentWindow: DailyNutrientReport[] = ironTotals.map((v, i) =>
      stubReport(`2026-04-${14 + i}`, [
        {
          code: 'NUT-MIC-FE',
          name: 'Iron',
          unit: 'mg',
          total: v,
          rda: 18,
          ul: 45,
        },
      ]),
    );

    const rows = buildNutrientAverages(currentWindow, 'female');
    const iron = rows.find((r) => r.code === 'NUT-MIC-FE');
    expect(iron).toBeDefined();
    // 10+12+14+10+16+18+10 = 90; 90/7 = 12.857...
    expect(iron!.avg_total).toBeCloseTo(12.857, 2);
    expect(iron!.rda).toBe(18);
    expect(iron!.ul).toBe(45);
    // pct_rda = round(12.857 / 18 * 100) = 71
    expect(iron!.pct_rda).toBe(71);
  });

  test('Test 4b: trend arrow direction reflects prior-window delta', () => {
    // Prior 7-day iron avg: 10mg ; current 7-day: 14mg → UP 40%
    const prior: DailyNutrientReport[] = Array.from({ length: 7 }, (_, i) =>
      stubReport(`prior-${i}`, [
        { code: 'NUT-MIC-FE', name: 'Iron', unit: 'mg', total: 10, rda: 18, ul: 45 },
      ]),
    );
    const current: DailyNutrientReport[] = Array.from({ length: 7 }, (_, i) =>
      stubReport(`cur-${i}`, [
        { code: 'NUT-MIC-FE', name: 'Iron', unit: 'mg', total: 14, rda: 18, ul: 45 },
      ]),
    );

    const rows = buildNutrientAverages(current, 'female', prior);
    const iron = rows.find((r) => r.code === 'NUT-MIC-FE');
    expect(iron!.trend_direction).toBe('up');
    expect(iron!.trend_pct).toBe(40);

    // Opposite case: stable (<5%)
    const currentStable: DailyNutrientReport[] = Array.from({ length: 7 }, (_, i) =>
      stubReport(`cur-${i}`, [
        { code: 'NUT-MIC-FE', name: 'Iron', unit: 'mg', total: 10.2, rda: 18, ul: 45 },
      ]),
    );
    const rowsStable = buildNutrientAverages(currentStable, 'female', prior);
    const ironStable = rowsStable.find((r) => r.code === 'NUT-MIC-FE');
    expect(ironStable!.trend_direction).toBe('stable');
    expect(ironStable!.trend_pct).toBe(0);

    // Down case
    const currentDown: DailyNutrientReport[] = Array.from({ length: 7 }, (_, i) =>
      stubReport(`cur-${i}`, [
        { code: 'NUT-MIC-FE', name: 'Iron', unit: 'mg', total: 5, rda: 18, ul: 45 },
      ]),
    );
    const rowsDown = buildNutrientAverages(currentDown, 'female', prior);
    const ironDown = rowsDown.find((r) => r.code === 'NUT-MIC-FE');
    expect(ironDown!.trend_direction).toBe('down');
    expect(ironDown!.trend_pct).toBe(50);
  });

  test('Test 4c: computeTrend handles zero-previous without NaN', () => {
    expect(computeTrend(0, 0)).toEqual({ direction: 'stable', pct: 0 });
    expect(computeTrend(5, 0)).toEqual({ direction: 'up', pct: 100 });
  });
});

// ---------------------------------------------------------------------------
// Test 5: Progress bar colors
// ---------------------------------------------------------------------------

describe('pickBarColor — progress bar colour policy', () => {
  test('Test 5: nutrient at 75% RDA → green success', () => {
    const color = pickBarColor({ pct_rda: 75, pct_ul: null, rda: 18 });
    expect(color).toBe('#4CAF50'); // Colors.success
  });

  test('Test 5: nutrient at 30% RDA → amber (deficient)', () => {
    const color = pickBarColor({ pct_rda: 30, pct_ul: null, rda: 18 });
    expect(color).toBe('#D4A843'); // Colors.warning
  });

  test('Test 5: nutrient at 120% UL → red danger', () => {
    const color = pickBarColor({ pct_rda: 250, pct_ul: 120, rda: 18 });
    expect(color).toBe('#E57373'); // Colors.danger
  });

  test('Test 5: nutrient with no RDA → neutral gold accent', () => {
    const color = pickBarColor({ pct_rda: null, pct_ul: null, rda: null });
    expect(color).toBe('#D4A843'); // Colors.accent
  });

  test('Test 5: nutrient at 180% RDA but no UL → accent (elevated, not red)', () => {
    const color = pickBarColor({ pct_rda: 180, pct_ul: null, rda: 18 });
    expect(color).toBe('#D4A843');
  });
});
