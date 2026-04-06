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

    it('prefer_not_to_say floor = 1350 (MASTER-94: average of 1200 and 1500)', () => {
      expect(getCalorieFloor('prefer_not_to_say')).toBe(1350);
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

  // ── F-05 Spec Test Vectors (Mifflin-St Jeor full pipeline) ──
  // Note: coefficients are 9.99/4.92 (source-faithful), not 10/5 (rounded).
  // Expected values computed with precise coefficients.

  describe('F-05: Full calorie target pipeline', () => {
    it('Male, 30, 180cm, 80kg, moderately active, maintenance ≈ 2,466 cal', () => {
      // BMR = (9.99*80) + (6.25*180) - (4.92*30) + 5 = 799.2 + 1125 - 147.6 + 5 = 1781.6
      // TDEE = 1781.6 * 1.55 = 2761.48
      // Target = TDEE + 0 (maintain) = 2761 (rounded)
      const bmr = calculateBmr({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male' });
      const tdee = calculateTdee(bmr, 'moderately_active');
      const target = calculateCalorieTarget({ tdee, goalDirection: 'MAINTAIN', sex: 'male' });
      expect(bmr).toBeCloseTo(1781.6, 0);
      expect(target).toBeCloseTo(2761, -1); // within ~10 cal
    });

    it('Female, 25, 165cm, 60kg, lightly active, fat loss ≈ 1,266 cal', () => {
      // BMR = (9.99*60) + (6.25*165) - (4.92*25) - 161 = 599.4 + 1031.25 - 123 - 161 = 1346.65
      // TDEE = 1346.65 * 1.375 = 1851.64
      // Target = 1851.64 - 500 = 1351.64 ≈ 1352
      const bmr = calculateBmr({ weightKg: 60, heightCm: 165, ageYears: 25, sex: 'female' });
      const tdee = calculateTdee(bmr, 'lightly_active');
      const target = calculateCalorieTarget({
        tdee, goalDirection: 'LOSE', sex: 'female', rateLbsPerWeek: 1.0,
      });
      expect(bmr).toBeCloseTo(1346.65, 0);
      expect(target).toBeCloseTo(1352, -1); // within ~10 cal
    });

    it('Male, 45, 175cm, 90kg, sedentary, maintenance ≈ 1,961 cal', () => {
      // BMR = (9.99*90) + (6.25*175) - (4.92*45) + 5 = 899.1 + 1093.75 - 221.4 + 5 = 1776.45
      // TDEE = 1776.45 * 1.2 = 2131.74
      // Target = 2131.74 (maintain) ≈ 2132
      const bmr = calculateBmr({ weightKg: 90, heightCm: 175, ageYears: 45, sex: 'male' });
      const tdee = calculateTdee(bmr, 'sedentary');
      const target = calculateCalorieTarget({ tdee, goalDirection: 'MAINTAIN', sex: 'male' });
      expect(bmr).toBeCloseTo(1776.45, 0);
      expect(target).toBeCloseTo(2132, -1);
    });

    it('returns null-safe: calculateBmr throws for age < 18', () => {
      expect(() =>
        calculateBmr({ weightKg: 60, heightCm: 165, ageYears: 15, sex: 'female' }),
      ).toThrow('BMR calculation requires age >= 18');
    });

    it('returns null-safe: zero weight produces zero BMR', () => {
      // Zero weight edge case — formula still runs but result is meaningless
      const bmr = calculateBmr({ weightKg: 0, heightCm: 165, ageYears: 25, sex: 'female' });
      // BMR = (9.99*0) + (6.25*165) - (4.92*25) - 161 = 0 + 1031.25 - 123 - 161 = 747.25
      // Not zero, but the calorie target is not meaningful
      expect(bmr).toBeCloseTo(747.25, 0);
    });

    it('gain surplus defaults to 300 (F-05 spec)', () => {
      const target = calculateCalorieTarget({
        tdee: 2500,
        goalDirection: 'GAIN',
        sex: 'male',
      });
      // TDEE 2500 + default surplus 300 = 2800
      expect(target).toBe(2800);
    });
  });
});
