// Prompt 08: Activity Library tests
// Validates the 25-item curated activity list

import {
  ACTIVITIES,
  ACTIVITY_CATEGORIES,
  getActivityById,
  getActivitiesByCategory,
} from '../data/activities';
import type { Activity, ActivityCategory as _ActivityCategory } from '../data/activities';
import { calculateCalorieBurnImperial, searchMetActivities } from '../utils/calories';

describe('Activity Library', () => {
  it('has exactly 26 activities (prompt spec lists 26 across 8 categories)', () => {
    expect(ACTIVITIES).toHaveLength(26);
  });

  it('each activity has required fields (id, name, category, met)', () => {
    for (const activity of ACTIVITIES) {
      expect(typeof activity.id).toBe('string');
      expect(activity.id.length).toBeGreaterThan(0);
      expect(typeof activity.name).toBe('string');
      expect(activity.name.length).toBeGreaterThan(0);
      expect(typeof activity.category).toBe('string');
      expect(typeof activity.met).toBe('number');
      expect(activity.met).toBeGreaterThan(0);
    }
  });

  it('all activity IDs are unique', () => {
    const ids = ACTIVITIES.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every category has at least 2 entries', () => {
    const grouped = getActivitiesByCategory();
    for (const group of grouped) {
      expect(group.activities.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all categories from ACTIVITY_CATEGORIES are represented', () => {
    const usedCategories = new Set(ACTIVITIES.map((a) => a.category));
    for (const cat of ACTIVITY_CATEGORIES) {
      expect(usedCategories.has(cat.key)).toBe(true);
    }
  });

  it('getActivityById returns correct activity', () => {
    const run = getActivityById('run_outdoor');
    expect(run).toBeDefined();
    expect(run!.name).toBe('Run (outdoor)');
    expect(run!.met).toBe(9.8);
  });

  it('getActivityById returns undefined for unknown ID', () => {
    expect(getActivityById('nonexistent')).toBeUndefined();
  });

  it('searchMetActivities finds activities by name', () => {
    const results = searchMetActivities('run');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((a) => a.name.toLowerCase().includes('run'))).toBe(true);
  });

  it('searchMetActivities returns empty for no match', () => {
    const results = searchMetActivities('zzz_nonexistent_zzz');
    expect(results).toHaveLength(0);
  });
});

describe('Recent Activities', () => {
  it('returns empty array when no history exists', () => {
    // Simulating no recent activity IDs
    const recentIds: string[] = [];
    const recentActivities = recentIds
      .map((id) => ACTIVITIES.find((a) => a.id === id))
      .filter((a): a is Activity => a !== undefined);
    expect(recentActivities).toHaveLength(0);
  });

  it('resolves recent IDs to activities', () => {
    const recentIds = ['run_outdoor', 'yoga', 'walk'];
    const recentActivities = recentIds
      .map((id) => ACTIVITIES.find((a) => a.id === id))
      .filter((a): a is Activity => a !== undefined);
    expect(recentActivities).toHaveLength(3);
    expect(recentActivities[0].name).toBe('Run (outdoor)');
  });
});

describe('Calorie Calculation with new MET values', () => {
  // Formula: MET x weight_kg x duration_hours
  // Imperial wrapper: MET x (weightLbs / 2.20462) x (durationMinutes / 60)

  it('30min run outdoor, 80kg -> ~392 cal', () => {
    // 9.8 x 80 x 0.5 = 392
    const weightLbs = 80 * 2.20462; // convert to lbs for the imperial function
    const result = calculateCalorieBurnImperial(9.8, weightLbs, 30);
    expect(Math.round(result)).toBeCloseTo(392, -1); // within rounding
  });

  it('60min walk, 70kg -> ~245 cal', () => {
    // 3.5 x 70 x 1.0 = 245
    const weightLbs = 70 * 2.20462;
    const result = calculateCalorieBurnImperial(3.5, weightLbs, 60);
    expect(Math.round(result)).toBeCloseTo(245, -1);
  });

  it('45min weight training, 75kg -> ~281 cal', () => {
    // 5.0 x 75 x 0.75 = 281.25
    const weightLbs = 75 * 2.20462;
    const result = calculateCalorieBurnImperial(5.0, weightLbs, 45);
    expect(Math.round(result)).toBeCloseTo(281, -1);
  });

  it('calorie values are reasonable (positive, not astronomical)', () => {
    for (const activity of ACTIVITIES) {
      // 30 min, 80kg person
      const weightLbs = 80 * 2.20462;
      const cals = calculateCalorieBurnImperial(activity.met, weightLbs, 30);
      expect(cals).toBeGreaterThan(0);
      expect(cals).toBeLessThan(1000); // no 30min activity should exceed 1000 cal
    }
  });
});

describe('No orphan imports', () => {
  it('activities module exports are complete', () => {
    expect(ACTIVITIES).toBeDefined();
    expect(ACTIVITY_CATEGORIES).toBeDefined();
    expect(getActivityById).toBeInstanceOf(Function);
    expect(getActivitiesByCategory).toBeInstanceOf(Function);
  });

  it('calories module still exports needed functions', () => {
    expect(calculateCalorieBurnImperial).toBeInstanceOf(Function);
    expect(searchMetActivities).toBeInstanceOf(Function);
  });
});
