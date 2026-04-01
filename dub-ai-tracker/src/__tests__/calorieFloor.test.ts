// MASTER-65, MASTER-94: Calorie floor enforcement tests
// Verifies safety floors are enforced in calculateCalorieTarget

import {
  calculateCalorieTarget,
  getCalorieFloor,
} from '../utils/calories';
import {
  CALORIE_FLOOR_FEMALE,
  CALORIE_FLOOR_MALE,
} from '../constants/formulas';

describe('Calorie Floor Enforcement (MASTER-94)', () => {
  it('female target below 1200 is clamped to 1200', () => {
    // Small female, sedentary, aggressive deficit: TDEE ~1300, deficit pushes below
    const target = calculateCalorieTarget({
      tdee: 1300,
      goalDirection: 'LOSE',
      sex: 'female',
      rateLbsPerWeek: 2.0, // 2 lbs/wk = 1000 cal/day deficit
    });
    expect(target).toBe(CALORIE_FLOOR_FEMALE); // 1200
  });

  it('male target below 1500 is clamped to 1500', () => {
    const target = calculateCalorieTarget({
      tdee: 1600,
      goalDirection: 'LOSE',
      sex: 'male',
      rateLbsPerWeek: 2.0,
    });
    expect(target).toBe(CALORIE_FLOOR_MALE); // 1500
  });

  it('prefer_not_to_say target below 1350 is clamped to 1350', () => {
    const target = calculateCalorieTarget({
      tdee: 1400,
      goalDirection: 'LOSE',
      sex: 'prefer_not_to_say',
      rateLbsPerWeek: 2.0,
    });
    // Average of 1200 and 1500 = 1350
    expect(target).toBe(1350);
  });

  it('normal target above floor is unchanged', () => {
    const target = calculateCalorieTarget({
      tdee: 2500,
      goalDirection: 'LOSE',
      sex: 'female',
      rateLbsPerWeek: 1.0, // 500 cal/day deficit -> target 2000
    });
    expect(target).toBe(2000);
  });

  it('MAINTAIN goal returns TDEE unchanged (above floor)', () => {
    const target = calculateCalorieTarget({
      tdee: 2000,
      goalDirection: 'MAINTAIN',
      sex: 'female',
    });
    expect(target).toBe(2000);
  });

  it('GAIN goal returns TDEE + surplus (always above floor)', () => {
    const target = calculateCalorieTarget({
      tdee: 2000,
      goalDirection: 'GAIN',
      sex: 'male',
      surplusCalories: 500,
    });
    expect(target).toBe(2500);
  });

  describe('getCalorieFloor', () => {
    it('female floor = 1200', () => {
      expect(getCalorieFloor('female')).toBe(1200);
    });

    it('male floor = 1500', () => {
      expect(getCalorieFloor('male')).toBe(1500);
    });

    it('prefer_not_to_say floor = 1350 (average)', () => {
      expect(getCalorieFloor('prefer_not_to_say')).toBe(1350);
    });
  });
});
