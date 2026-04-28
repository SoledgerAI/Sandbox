// S36: Exercise catalog data integrity + filterByEquipment behavior.

import {
  EXERCISE_CATALOG,
  ALL_BODY_REGIONS,
  ALL_EQUIPMENT,
  FULL_GYM_EXPANSION,
  filterByEquipment,
  expandFullGym,
  getExerciseById,
  getExercisesByRegion,
  type BodyRegion,
} from '../exerciseCatalog';

describe('exerciseCatalog', () => {
  it('every exercise has a valid primary BodyRegion', () => {
    const valid = new Set<BodyRegion>(ALL_BODY_REGIONS);
    for (const ex of EXERCISE_CATALOG) {
      expect(valid.has(ex.primary)).toBe(true);
    }
  });

  it('every exercise has at least one equipment tag', () => {
    for (const ex of EXERCISE_CATALOG) {
      expect(ex.equipment.length).toBeGreaterThan(0);
    }
  });

  it('every exercise id is unique and kebab-case', () => {
    const seen = new Set<string>();
    for (const ex of EXERCISE_CATALOG) {
      expect(seen.has(ex.id)).toBe(false);
      seen.add(ex.id);
      expect(ex.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('every exercise has a non-empty cue_short', () => {
    for (const ex of EXERCISE_CATALOG) {
      expect(typeof ex.cue_short).toBe('string');
      expect(ex.cue_short.length).toBeGreaterThan(0);
    }
  });

  it('region floor counts are met', () => {
    const counts: Record<BodyRegion, number> = {
      chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0,
      quads: 0, hamstrings: 0, glutes: 0, calves: 0, core: 0,
      forearms: 0, traps: 0, full_body: 0,
    };
    for (const ex of EXERCISE_CATALOG) counts[ex.primary] += 1;
    expect(counts.chest).toBeGreaterThanOrEqual(8);
    expect(counts.back).toBeGreaterThanOrEqual(8);
    expect(counts.shoulders).toBeGreaterThanOrEqual(6);
    expect(counts.biceps).toBeGreaterThanOrEqual(5);
    expect(counts.triceps).toBeGreaterThanOrEqual(5);
    expect(counts.quads).toBeGreaterThanOrEqual(5);
    expect(counts.hamstrings).toBeGreaterThanOrEqual(3);
    expect(counts.glutes).toBeGreaterThanOrEqual(3);
    expect(counts.calves).toBeGreaterThanOrEqual(2);
    expect(counts.core).toBeGreaterThanOrEqual(6);
    expect(counts.forearms).toBeGreaterThanOrEqual(2);
    expect(counts.traps).toBeGreaterThanOrEqual(1);
    expect(counts.full_body).toBeGreaterThanOrEqual(4);
  });

  it('total catalog size is in [60, 80]', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(60);
    expect(EXERCISE_CATALOG.length).toBeLessThanOrEqual(80);
  });

  it('filterByEquipment returns the correct intersection set', () => {
    const result = filterByEquipment(EXERCISE_CATALOG, ['barbell']);
    expect(result.length).toBeGreaterThan(0);
    for (const ex of result) {
      expect(ex.equipment).toContain('barbell');
    }
    // no exercise without barbell should leak through
    for (const ex of result) {
      expect(ex.equipment.some((eq) => eq === 'barbell')).toBe(true);
    }
  });

  it('filterByEquipment with empty owned list returns empty', () => {
    expect(filterByEquipment(EXERCISE_CATALOG, [])).toEqual([]);
  });

  it('filterByEquipment is non-mutating', () => {
    const before = [...EXERCISE_CATALOG];
    const owned = ['dumbbells' as const];
    const ownedBefore = [...owned];
    filterByEquipment(EXERCISE_CATALOG, owned);
    expect(EXERCISE_CATALOG).toEqual(before);
    expect(owned).toEqual(ownedBefore);
  });

  it('default_order is alphabetical-within-region (1-based, contiguous)', () => {
    for (const region of ALL_BODY_REGIONS) {
      const list = getExercisesByRegion(region);
      if (list.length === 0) continue;
      const sorted = list.slice().sort((a, b) => a.default_order - b.default_order);
      // names should be alphabetical
      for (let i = 1; i < sorted.length; i += 1) {
        expect(
          sorted[i - 1].name.localeCompare(sorted[i].name),
        ).toBeLessThanOrEqual(0);
      }
      // default_order should be 1..N contiguously
      sorted.forEach((ex, i) => expect(ex.default_order).toBe(i + 1));
    }
  });

  it('expandFullGym replaces full_gym with the FULL_GYM_EXPANSION items', () => {
    const out = expandFullGym(['bodyweight', 'full_gym']);
    expect(out).toContain('bodyweight');
    for (const eq of FULL_GYM_EXPANSION) expect(out).toContain(eq);
    expect(out).not.toContain('full_gym' as never);
  });

  it('getExerciseById returns the right exercise or undefined', () => {
    const sample = EXERCISE_CATALOG[0];
    expect(getExerciseById(sample.id)?.id).toBe(sample.id);
    expect(getExerciseById('nonsense-id-xyz-123')).toBeUndefined();
  });

  it('every Equipment value in ALL_EQUIPMENT appears on at least one exercise', () => {
    const used = new Set<string>();
    for (const ex of EXERCISE_CATALOG) {
      for (const eq of ex.equipment) used.add(eq);
    }
    for (const eq of ALL_EQUIPMENT) {
      expect(used.has(eq)).toBe(true);
    }
  });
});
