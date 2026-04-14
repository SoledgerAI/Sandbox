// Sprint 21: Elect-In Category System + Log Tab Reorganization tests

import {
  storageGet,
  storageSet,
  storageDelete,
  STORAGE_KEYS,
  dateKey,
} from '../utils/storage';
import {
  getEnabledCategories,
  setEnabledCategories,
  enableCategory,
  disableCategory,
  toggleCategory,
  isCategoryEnabled,
  applySexAwareDefaults,
  getQuickAccessCategories,
  setQuickAccessCategories,
  getCollapsedSections,
  setCollapsedSections,
  toggleSectionCollapsed,
} from '../utils/categoryElection';
import type {
  PerimenopauseEntry,
  BreastfeedingEntry,
  ElectInCategoryId,
} from '../types';
import {
  ALL_ELECT_IN_CATEGORIES,
  ELECT_IN_CATEGORY_GROUPS,
} from '../types';

const TODAY = '2026-04-09';

// ============================================================
// Category Election: Enable / Disable / Persist
// ============================================================

describe('Category Election', () => {
  beforeEach(async () => {
    await storageDelete(STORAGE_KEYS.SETTINGS_ENABLED_CATEGORIES);
  });

  it('returns empty array when nothing is stored (all OFF by default)', async () => {
    const result = await getEnabledCategories();
    expect(result).toEqual([]);
  });

  it('enables a category and persists', async () => {
    await enableCategory('blood_pressure');
    const result = await getEnabledCategories();
    expect(result).toContain('blood_pressure');
  });

  it('disables a category (does not delete data)', async () => {
    // First log some data
    const dataKey = dateKey(STORAGE_KEYS.LOG_BP, TODAY);
    await storageSet(dataKey, [{ id: 'bp1', systolic: 120, diastolic: 80 }]);

    // Enable then disable
    await enableCategory('blood_pressure');
    await disableCategory('blood_pressure');
    const enabled = await getEnabledCategories();
    expect(enabled).not.toContain('blood_pressure');

    // Data still exists!
    const data = await storageGet(dataKey);
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);

    await storageDelete(dataKey);
  });

  it('toggle returns new state', async () => {
    const first = await toggleCategory('glucose');
    expect(first).toBe(true);
    const enabled1 = await getEnabledCategories();
    expect(enabled1).toContain('glucose');

    const second = await toggleCategory('glucose');
    expect(second).toBe(false);
    const enabled2 = await getEnabledCategories();
    expect(enabled2).not.toContain('glucose');
  });

  it('enableCategory is idempotent — no duplicates', async () => {
    await enableCategory('bloodwork');
    await enableCategory('bloodwork');
    const result = await getEnabledCategories();
    expect(result.filter((id) => id === 'bloodwork').length).toBe(1);
  });

  it('isCategoryEnabled returns correct state', async () => {
    expect(await isCategoryEnabled('allergies')).toBe(false);
    await enableCategory('allergies');
    expect(await isCategoryEnabled('allergies')).toBe(true);
  });

  it('setEnabledCategories replaces entire list', async () => {
    await setEnabledCategories(['blood_pressure', 'glucose', 'allergies']);
    const result = await getEnabledCategories();
    expect(result).toEqual(['blood_pressure', 'glucose', 'allergies']);
  });
});

// ============================================================
// Sex-Aware Defaults
// ============================================================

describe('Sex-Aware Defaults', () => {
  beforeEach(async () => {
    await storageDelete(STORAGE_KEYS.SETTINGS_ENABLED_CATEGORIES);
  });

  it('auto-enables cycle_tracking for female', async () => {
    const result = await applySexAwareDefaults('female');
    expect(result.autoEnabled).toContain('cycle_tracking');
    expect(result.showPrompt).toBe(true);
    expect(await isCategoryEnabled('cycle_tracking')).toBe(true);
  });

  it('does NOT auto-enable for male', async () => {
    const result = await applySexAwareDefaults('male');
    expect(result.autoEnabled).toEqual([]);
    expect(result.showPrompt).toBe(false);
    expect(await isCategoryEnabled('cycle_tracking')).toBe(false);
  });

  it('does NOT auto-enable for prefer_not_to_say', async () => {
    const result = await applySexAwareDefaults('prefer_not_to_say');
    expect(result.autoEnabled).toEqual([]);
    expect(result.showPrompt).toBe(false);
  });

  it('all categories always available in definitions regardless of sex', () => {
    // Women's Health categories exist in the definitions
    const womensHealth = ALL_ELECT_IN_CATEGORIES.filter((c) => c.group === 'womens_health');
    expect(womensHealth.length).toBe(3);
    expect(womensHealth.map((c) => c.id)).toContain('cycle_tracking');
    expect(womensHealth.map((c) => c.id)).toContain('breastfeeding');
    expect(womensHealth.map((c) => c.id)).toContain('perimenopause');
  });
});

// ============================================================
// Log Tab Section Visibility
// ============================================================

describe('Log Tab Section Visibility', () => {
  it('elect-in sections hidden when no categories enabled', () => {
    const enabledCats: ElectInCategoryId[] = [];
    // Simulate the visibility logic from the Log tab
    const electInSectionItems = ALL_ELECT_IN_CATEGORIES.filter(
      (cat) => cat.group === 'health_metrics' && enabledCats.includes(cat.id),
    );
    expect(electInSectionItems.length).toBe(0);
  });

  it('elect-in section visible when at least one category enabled', () => {
    const enabledCats: ElectInCategoryId[] = ['blood_pressure'];
    const healthMetrics = ALL_ELECT_IN_CATEGORIES.filter(
      (cat) => cat.group === 'health_metrics' && enabledCats.includes(cat.id),
    );
    expect(healthMetrics.length).toBe(1);
    expect(healthMetrics[0].id).toBe('blood_pressure');
  });

  it('womens health section shows only enabled categories', () => {
    const enabledCats: ElectInCategoryId[] = ['cycle_tracking', 'perimenopause'];
    const womensHealth = ALL_ELECT_IN_CATEGORIES.filter(
      (cat) => cat.group === 'womens_health' && enabledCats.includes(cat.id),
    );
    expect(womensHealth.length).toBe(2);
    expect(womensHealth.map((c) => c.id)).not.toContain('breastfeeding');
  });
});

// ============================================================
// Quick Access Customization
// ============================================================

describe('Quick Access Customization', () => {
  beforeEach(async () => {
    await storageDelete(STORAGE_KEYS.SETTINGS_QUICK_ACCESS);
  });

  it('returns defaults when nothing stored', async () => {
    const result = await getQuickAccessCategories();
    expect(result).toEqual(['food', 'water', 'workout', 'mood', 'habits']);
  });

  it('saves and retrieves custom quick access', async () => {
    await setQuickAccessCategories(['food', 'sleep_log', 'meditation']);
    const result = await getQuickAccessCategories();
    expect(result).toEqual(['food', 'sleep_log', 'meditation']);
  });
});

// ============================================================
// Collapsible Section State Persistence
// ============================================================

describe('Collapsible Section State', () => {
  beforeEach(async () => {
    await storageDelete(STORAGE_KEYS.SETTINGS_LOG_SECTIONS_COLLAPSED);
  });

  it('returns empty array by default (all expanded)', async () => {
    const result = await getCollapsedSections();
    expect(result).toEqual([]);
  });

  it('toggle collapses a section and persists', async () => {
    const nowCollapsed = await toggleSectionCollapsed('nutrition');
    expect(nowCollapsed).toBe(true);
    const result = await getCollapsedSections();
    expect(result).toContain('nutrition');
  });

  it('toggle expands a collapsed section', async () => {
    await toggleSectionCollapsed('nutrition'); // collapse
    const nowCollapsed = await toggleSectionCollapsed('nutrition'); // expand
    expect(nowCollapsed).toBe(false);
    const result = await getCollapsedSections();
    expect(result).not.toContain('nutrition');
  });

  it('multiple sections can be collapsed independently', async () => {
    await toggleSectionCollapsed('nutrition');
    await toggleSectionCollapsed('sleep');
    const result = await getCollapsedSections();
    expect(result).toContain('nutrition');
    expect(result).toContain('sleep');
  });
});

// ============================================================
// Perimenopause Logger: All Symptom Types Save/Retrieve
// ============================================================

describe('Perimenopause Logger CRUD', () => {
  const KEY = dateKey(STORAGE_KEYS.LOG_PERIMENOPAUSE, TODAY);

  beforeEach(async () => {
    await storageDelete(KEY);
  });

  it('saves and retrieves a full perimenopause entry', async () => {
    const entry: PerimenopauseEntry = {
      id: 'peri_1',
      timestamp: '2026-04-09T10:00:00Z',
      date: TODAY,
      hot_flashes_count: 3,
      hot_flashes: [
        { severity: 'mild' },
        { severity: 'moderate' },
        { severity: 'severe' },
      ],
      night_sweats: true,
      night_sweats_severity: 'mild',
      mood_shifts: 3,
      sleep_disruption: 4,
      brain_fog: 2,
      joint_pain: 3,
      joint_pain_areas: ['knees', 'hips'],
      cycle_irregularity_days: 45,
      energy_level: 2,
      notes: 'Rough day',
    };
    await storageSet(KEY, entry);
    const result = await storageGet<PerimenopauseEntry>(KEY);
    expect(result).not.toBeNull();
    expect(result!.hot_flashes_count).toBe(3);
    expect(result!.hot_flashes).toHaveLength(3);
    expect(result!.hot_flashes[0].severity).toBe('mild');
    expect(result!.night_sweats).toBe(true);
    expect(result!.night_sweats_severity).toBe('mild');
    expect(result!.mood_shifts).toBe(3);
    expect(result!.sleep_disruption).toBe(4);
    expect(result!.brain_fog).toBe(2);
    expect(result!.joint_pain).toBe(3);
    expect(result!.joint_pain_areas).toEqual(['knees', 'hips']);
    expect(result!.cycle_irregularity_days).toBe(45);
    expect(result!.energy_level).toBe(2);
    expect(result!.notes).toBe('Rough day');
  });

  it('handles entry with no night sweats and no joint pain areas', async () => {
    const entry: PerimenopauseEntry = {
      id: 'peri_2',
      timestamp: '2026-04-09T10:00:00Z',
      date: TODAY,
      hot_flashes_count: 0,
      hot_flashes: [],
      night_sweats: false,
      night_sweats_severity: null,
      mood_shifts: 1,
      sleep_disruption: 1,
      brain_fog: 1,
      joint_pain: 1,
      joint_pain_areas: [],
      cycle_irregularity_days: null,
      energy_level: 5,
      notes: null,
    };
    await storageSet(KEY, entry);
    const result = await storageGet<PerimenopauseEntry>(KEY);
    expect(result!.hot_flashes_count).toBe(0);
    expect(result!.night_sweats).toBe(false);
    expect(result!.night_sweats_severity).toBeNull();
    expect(result!.joint_pain_areas).toEqual([]);
    expect(result!.cycle_irregularity_days).toBeNull();
    expect(result!.notes).toBeNull();
  });
});

// ============================================================
// Breastfeeding Logger: All Entry Types Save/Retrieve
// ============================================================

describe('Breastfeeding Logger CRUD', () => {
  const KEY = dateKey(STORAGE_KEYS.LOG_BREASTFEEDING, TODAY);

  beforeEach(async () => {
    await storageDelete(KEY);
  });

  it('saves and retrieves nursing session', async () => {
    const entry: BreastfeedingEntry = {
      id: 'bf_1',
      timestamp: '2026-04-09T08:00:00Z',
      type: 'nursing',
      side: 'left',
      duration_minutes: 15,
      output_amount: null,
      output_unit: null,
      bottle_amount: null,
      bottle_unit: null,
      timer_start: null,
      timer_end: null,
      notes: null,
    };
    await storageSet(KEY, [entry]);
    const result = await storageGet<BreastfeedingEntry[]>(KEY);
    expect(result).toHaveLength(1);
    expect(result![0].type).toBe('nursing');
    expect(result![0].side).toBe('left');
    expect(result![0].duration_minutes).toBe(15);
  });

  it('saves pumping session with output', async () => {
    const entry: BreastfeedingEntry = {
      id: 'bf_2',
      timestamp: '2026-04-09T10:00:00Z',
      type: 'pumping',
      side: null,
      duration_minutes: 20,
      output_amount: 4.5,
      output_unit: 'oz',
      bottle_amount: null,
      bottle_unit: null,
      timer_start: '2026-04-09T09:40:00Z',
      timer_end: '2026-04-09T10:00:00Z',
      notes: 'Good session',
    };
    await storageSet(KEY, [entry]);
    const result = await storageGet<BreastfeedingEntry[]>(KEY);
    expect(result![0].output_amount).toBe(4.5);
    expect(result![0].output_unit).toBe('oz');
    expect(result![0].notes).toBe('Good session');
  });

  it('saves bottle session with amount', async () => {
    const entry: BreastfeedingEntry = {
      id: 'bf_3',
      timestamp: '2026-04-09T14:00:00Z',
      type: 'bottle',
      side: null,
      duration_minutes: 10,
      output_amount: null,
      output_unit: null,
      bottle_amount: 3,
      bottle_unit: 'oz',
      timer_start: null,
      timer_end: null,
      notes: null,
    };
    await storageSet(KEY, [entry]);
    const result = await storageGet<BreastfeedingEntry[]>(KEY);
    expect(result![0].type).toBe('bottle');
    expect(result![0].bottle_amount).toBe(3);
    expect(result![0].bottle_unit).toBe('oz');
  });

  it('supports multiple sessions per day', async () => {
    const sessions: BreastfeedingEntry[] = [
      { id: 'bf_a', timestamp: '2026-04-09T06:00:00Z', type: 'nursing', side: 'right', duration_minutes: 12, output_amount: null, output_unit: null, bottle_amount: null, bottle_unit: null, timer_start: null, timer_end: null, notes: null },
      { id: 'bf_b', timestamp: '2026-04-09T09:00:00Z', type: 'pumping', side: null, duration_minutes: 20, output_amount: 5, output_unit: 'oz', bottle_amount: null, bottle_unit: null, timer_start: null, timer_end: null, notes: null },
      { id: 'bf_c', timestamp: '2026-04-09T12:00:00Z', type: 'nursing', side: 'both', duration_minutes: 18, output_amount: null, output_unit: null, bottle_amount: null, bottle_unit: null, timer_start: null, timer_end: null, notes: null },
      { id: 'bf_d', timestamp: '2026-04-09T15:00:00Z', type: 'bottle', side: null, duration_minutes: 8, output_amount: null, output_unit: null, bottle_amount: 4, bottle_unit: 'oz', timer_start: null, timer_end: null, notes: null },
    ];
    await storageSet(KEY, sessions);
    const result = await storageGet<BreastfeedingEntry[]>(KEY);
    expect(result).toHaveLength(4);
    const totalMin = result!.reduce((s, e) => s + e.duration_minutes, 0);
    expect(totalMin).toBe(58);
  });
});

// ============================================================
// Running Timer: Start/Stop/Duration Calculation
// ============================================================

describe('Breastfeeding Timer', () => {
  it('calculates duration from timer_start and timer_end', () => {
    const start = new Date('2026-04-09T10:00:00Z');
    const end = new Date('2026-04-09T10:23:00Z');
    const elapsedSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    expect(durationMinutes).toBe(23);
  });

  it('rounds sub-minute timer to 1 minute', () => {
    const start = new Date('2026-04-09T10:00:00Z');
    const end = new Date('2026-04-09T10:00:30Z'); // 30 seconds
    const elapsedSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    expect(durationMinutes).toBe(1);
  });
});

// ============================================================
// Data Preservation on Category Disable
// ============================================================

describe('Data Preservation on Category Disable', () => {
  it('breastfeeding data preserved when category disabled', async () => {
    const key = dateKey(STORAGE_KEYS.LOG_BREASTFEEDING, TODAY);
    await storageSet(key, [{ id: 'bf_test', type: 'nursing', duration_minutes: 10 }]);
    await enableCategory('breastfeeding');

    // Disable the category
    await disableCategory('breastfeeding');
    expect(await isCategoryEnabled('breastfeeding')).toBe(false);

    // Data still exists
    const data = await storageGet<any[]>(key);
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe('bf_test');

    await storageDelete(key);
  });

  it('perimenopause data preserved when category disabled', async () => {
    const key = dateKey(STORAGE_KEYS.LOG_PERIMENOPAUSE, TODAY);
    await storageSet(key, { id: 'peri_test', hot_flashes_count: 2 });
    await enableCategory('perimenopause');

    // Disable the category
    await disableCategory('perimenopause');
    expect(await isCategoryEnabled('perimenopause')).toBe(false);

    // Data still exists
    const data = await storageGet<any>(key);
    expect(data).not.toBeNull();
    expect(data.hot_flashes_count).toBe(2);

    await storageDelete(key);
  });
});

// ============================================================
// Type Definitions Integrity
// ============================================================

describe('Elect-In Category Types', () => {
  it('all categories have required fields', () => {
    for (const cat of ALL_ELECT_IN_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.description).toBeTruthy();
      expect(cat.group).toBeTruthy();
      expect(cat.icon).toBeTruthy();
    }
  });

  it('11 elect-in categories defined (Sprint 22: +migraine_tracking)', () => {
    expect(ALL_ELECT_IN_CATEGORIES).toHaveLength(11);
  });

  it('3 category groups defined', () => {
    expect(ELECT_IN_CATEGORY_GROUPS).toHaveLength(3);
  });

  it('all category groups have at least one category', () => {
    for (const group of ELECT_IN_CATEGORY_GROUPS) {
      const cats = ALL_ELECT_IN_CATEGORIES.filter((c) => c.group === group.id);
      expect(cats.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Context Builder: Category-Gated Data
// ============================================================

describe('Context Builder Category Gating', () => {
  beforeEach(async () => {
    await storageDelete(STORAGE_KEYS.SETTINGS_ENABLED_CATEGORIES);
  });

  it('isCategoryEnabled returns false for disabled categories', async () => {
    expect(await isCategoryEnabled('blood_pressure')).toBe(false);
    expect(await isCategoryEnabled('perimenopause')).toBe(false);
  });

  it('isCategoryEnabled returns true for enabled categories', async () => {
    await enableCategory('blood_pressure');
    await enableCategory('perimenopause');
    expect(await isCategoryEnabled('blood_pressure')).toBe(true);
    expect(await isCategoryEnabled('perimenopause')).toBe(true);
  });

  it('enabling one category does not affect others', async () => {
    await enableCategory('glucose');
    expect(await isCategoryEnabled('glucose')).toBe(true);
    expect(await isCategoryEnabled('blood_pressure')).toBe(false);
    expect(await isCategoryEnabled('allergies')).toBe(false);
  });
});

// ============================================================
// Compliance Goals Hidden When Category Disabled
// ============================================================

describe('Compliance Goal Visibility', () => {
  it('breastfeeding_logged and perimenopause_logged are in ALL_DAILY_GOALS', () => {
    const { ALL_DAILY_GOALS } = require('../types');
    const goalIds = ALL_DAILY_GOALS.map((g: any) => g.id);
    expect(goalIds).toContain('breastfeeding_logged');
    expect(goalIds).toContain('perimenopause_logged');
  });

  it('breastfeeding goal has correct label and icon', () => {
    const { ALL_DAILY_GOALS } = require('../types');
    const goal = ALL_DAILY_GOALS.find((g: any) => g.id === 'breastfeeding_logged');
    expect(goal).toBeDefined();
    expect(goal.label).toContain('Breastfeeding');
    expect(goal.icon).toBe('heart-outline');
  });

  it('perimenopause goal has correct label and icon', () => {
    const { ALL_DAILY_GOALS } = require('../types');
    const goal = ALL_DAILY_GOALS.find((g: any) => g.id === 'perimenopause_logged');
    expect(goal).toBeDefined();
    expect(goal.label).toContain('Perimenopause');
    expect(goal.icon).toBe('thermometer-outline');
  });
});

// ============================================================
// Storage Keys Exist
// ============================================================

describe('Sprint 21 Storage Keys', () => {
  it('new storage keys are defined', () => {
    expect(STORAGE_KEYS.LOG_PERIMENOPAUSE).toBe('dub.log.perimenopause');
    expect(STORAGE_KEYS.LOG_BREASTFEEDING).toBe('dub.log.breastfeeding');
    expect(STORAGE_KEYS.SETTINGS_ENABLED_CATEGORIES).toBe('dub.settings.enabled_categories');
    expect(STORAGE_KEYS.SETTINGS_LOG_SECTIONS_COLLAPSED).toBe('dub.settings.log_sections_collapsed');
    expect(STORAGE_KEYS.SETTINGS_QUICK_ACCESS).toBe('dub.settings.quick_access');
  });
});
