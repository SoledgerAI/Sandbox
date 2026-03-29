// Step 3: Calorie Engine tests with spec-defined test vectors

import {
  calculateBmr,
  calculateTdee,
  calculateCalorieTarget,
  calculateCalorieBurn,
  lbsToKg,
  inchesToCm,
  getCalorieFloor,
} from '../utils/calories';

import {
  ACTIVITY_MULTIPLIERS,
  CALORIE_FLOOR_FEMALE,
  CALORIE_FLOOR_MALE,
  LBS_PER_KG,
  CM_PER_INCH,
} from '../constants/formulas';

describe('Calorie Engine', () => {
  describe('BMR (Mifflin-St Jeor)', () => {
    it('computes BMR for male: 80kg, 178cm, 30y = ~1769.1 kcal', () => {
      // Spec: Male, 80kg, 178cm, 30 years = 1769.1 kcal
      // Formula: (9.99 * 80) + (6.25 * 178) - (4.92 * 30) + 5
      //        = 799.2 + 1112.5 - 147.6 + 5 = 1769.1
      const bmr = calculateBmr({
        weightKg: 80,
        heightCm: 178,
        ageYears: 30,
        sex: 'male',
      });
      expect(bmr).toBeCloseTo(1769.1, 1);
    });

    it('computes BMR for prefer_not_to_say: average of male and female (80kg, 178cm, 30y = ~1686.1)', () => {
      // prefer_not_to_say averages male (1769.1) and female (1603.1) = 1686.1
      const bmr = calculateBmr({
        weightKg: 80,
        heightCm: 178,
        ageYears: 30,
        sex: 'prefer_not_to_say',
      });
      const maleBmr = calculateBmr({ weightKg: 80, heightCm: 178, ageYears: 30, sex: 'male' });
      const femaleBmr = calculateBmr({ weightKg: 80, heightCm: 178, ageYears: 30, sex: 'female' });
      expect(bmr).toBeCloseTo((maleBmr + femaleBmr) / 2, 1);
      expect(bmr).toBeCloseTo(1686.1, 1);
    });

    it('computes BMR for female: 65kg, 165cm, 25y = ~1396.6 kcal', () => {
      // Spec: Female, 65kg, 165cm, 25 years = 1396.6 kcal
      // Formula: (9.99 * 65) + (6.25 * 165) - (4.92 * 25) - 161
      //        = 649.35 + 1031.25 - 123 - 161 = 1396.6
      const bmr = calculateBmr({
        weightKg: 65,
        heightCm: 165,
        ageYears: 25,
        sex: 'female',
      });
      expect(bmr).toBeCloseTo(1396.6, 1);
    });
  });

  describe('TDEE multipliers', () => {
    const testBmr = 1769.1;

    it('sedentary = BMR x 1.2', () => {
      expect(calculateTdee(testBmr, 'sedentary')).toBeCloseTo(testBmr * 1.2, 1);
    });

    it('lightly active = BMR x 1.375', () => {
      expect(calculateTdee(testBmr, 'lightly_active')).toBeCloseTo(testBmr * 1.375, 1);
    });

    it('moderately active = BMR x 1.55', () => {
      expect(calculateTdee(testBmr, 'moderately_active')).toBeCloseTo(testBmr * 1.55, 1);
    });

    it('very active = BMR x 1.725', () => {
      expect(calculateTdee(testBmr, 'very_active')).toBeCloseTo(testBmr * 1.725, 1);
    });

    it('extremely active = BMR x 1.9', () => {
      expect(calculateTdee(testBmr, 'extremely_active')).toBeCloseTo(testBmr * 1.9, 1);
    });

    it('multiplier constants match spec', () => {
      expect(ACTIVITY_MULTIPLIERS.sedentary).toBe(1.2);
      expect(ACTIVITY_MULTIPLIERS.lightly_active).toBe(1.375);
      expect(ACTIVITY_MULTIPLIERS.moderately_active).toBe(1.55);
      expect(ACTIVITY_MULTIPLIERS.very_active).toBe(1.725);
      expect(ACTIVITY_MULTIPLIERS.extremely_active).toBe(1.9);
    });
  });

  describe('Unit conversions', () => {
    it('180 lbs = ~81.6466 kg', () => {
      const kg = lbsToKg(180);
      expect(kg).toBeCloseTo(81.6466, 2);
    });

    it('70 inches = 177.8 cm', () => {
      const cm = inchesToCm(70);
      expect(cm).toBeCloseTo(177.8, 1);
    });

    it('LBS_PER_KG constant = 2.20462', () => {
      expect(LBS_PER_KG).toBe(2.20462);
    });

    it('CM_PER_INCH constant = 2.54', () => {
      expect(CM_PER_INCH).toBe(2.54);
    });
  });

  describe('Calorie floor enforcement', () => {
    it('female floor = 1200', () => {
      expect(CALORIE_FLOOR_FEMALE).toBe(1200);
      expect(getCalorieFloor('female')).toBe(1200);
    });

    it('male floor = 1500', () => {
      expect(CALORIE_FLOOR_MALE).toBe(1500);
      expect(getCalorieFloor('male')).toBe(1500);
    });

    it('prefer_not_to_say floor = 1500', () => {
      expect(getCalorieFloor('prefer_not_to_say')).toBe(1500);
    });

    it('clamps female target below 1200 to 1200', () => {
      // Use a very low TDEE scenario
      const target = calculateCalorieTarget({
        tdee: 1000,
        goalDirection: 'LOSE',
        sex: 'female',
        rateLbsPerWeek: 2.0,
      });
      expect(target).toBe(1200);
    });

    it('clamps male target below 1500 to 1500', () => {
      const target = calculateCalorieTarget({
        tdee: 1200,
        goalDirection: 'LOSE',
        sex: 'male',
        rateLbsPerWeek: 2.0,
      });
      expect(target).toBe(1500);
    });
  });

  describe('MET-based calorie burn', () => {
    it('Running MET 9.8, 80kg, 30min = 392 kcal', () => {
      // MET x weight_kg x duration_hours = 9.8 x 80 x 0.5 = 392
      const burn = calculateCalorieBurn(9.8, 80, 0.5);
      expect(burn).toBeCloseTo(392, 0);
    });

    it('returns 0 for 0 duration', () => {
      expect(calculateCalorieBurn(9.8, 80, 0)).toBe(0);
    });
  });
});
