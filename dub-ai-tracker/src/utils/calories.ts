// Calorie Engine for DUB_AI Tracker
// Phase 4: BMR, TDEE, calorie target, MET-based burn, weight change estimation
//
// Sources cited in constants/formulas.ts

import {
  BMR_WEIGHT_COEFFICIENT,
  BMR_HEIGHT_COEFFICIENT,
  BMR_AGE_COEFFICIENT,
  BMR_MALE_CONSTANT,
  BMR_FEMALE_CONSTANT,
  ACTIVITY_MULTIPLIERS,
  CALORIES_PER_POUND,
  CALORIE_FLOOR_FEMALE,
  CALORIE_FLOOR_MALE,
  DEFAULT_LOSS_RATE_LBS_PER_WEEK,
  DEFAULT_GAIN_SURPLUS_CALORIES,
  LBS_PER_KG,
  CM_PER_INCH,
} from '../constants/formulas';
import type { BiologicalSex, ActivityLevel, GoalDirection } from '../types/profile';
import metCompendium from '../data/met_compendium.json';

// ============================================================================
// Unit Conversions
// ============================================================================

/** Convert pounds to kilograms */
export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

/** Convert kilograms to pounds */
export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

/** Convert total inches to centimeters */
export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

/** Convert centimeters to inches */
export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

/** Convert feet and inches to total inches */
export function feetInchesToInches(feet: number, inches: number): number {
  return feet * 12 + inches;
}

// ============================================================================
// BMR (Basal Metabolic Rate) -- Mifflin-St Jeor Equation
//
// Men:   (9.99 x wt_kg) + (6.25 x ht_cm) - (4.92 x age) + 5
// Women: (9.99 x wt_kg) + (6.25 x ht_cm) - (4.92 x age) - 161
//
// Source: Mifflin et al., Am J Clin Nutr, 1990;51(2):241-247.
//         DOI: 10.1093/ajcn/51.2.241
// ============================================================================

interface BmrParams {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: BiologicalSex;
}

/** Calculate BMR using Mifflin-St Jeor with PRECISE coefficients (9.99, 4.92) */
export function calculateBmr({ weightKg, heightCm, ageYears, sex }: BmrParams): number {
  if (ageYears < 18) {
    throw new Error('BMR calculation requires age >= 18');
  }

  const base =
    BMR_WEIGHT_COEFFICIENT * weightKg +
    BMR_HEIGHT_COEFFICIENT * heightCm -
    BMR_AGE_COEFFICIENT * ageYears;

  if (sex === 'male') {
    return base + BMR_MALE_CONSTANT;
  }

  if (sex === 'female') {
    return base + BMR_FEMALE_CONSTANT;
  }

  // "Prefer Not to Say": average of male and female formulas
  const maleBmr = base + BMR_MALE_CONSTANT;
  const femaleBmr = base + BMR_FEMALE_CONSTANT;
  return (maleBmr + femaleBmr) / 2;
}

/** Calculate BMR from imperial inputs (lbs, inches) */
export function calculateBmrImperial(
  weightLbs: number,
  heightInches: number,
  ageYears: number,
  sex: BiologicalSex
): number {
  return calculateBmr({
    weightKg: lbsToKg(weightLbs),
    heightCm: inchesToCm(heightInches),
    ageYears,
    sex,
  });
}

// ============================================================================
// TDEE (Total Daily Energy Expenditure)
//
// TDEE = BMR x Activity Multiplier
//
// Source: FAO/WHO/UNU, WHO Technical Report Series 724, 1985.
// ============================================================================

/** Calculate TDEE from BMR and activity level */
export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

// ============================================================================
// Calorie Target Computation
//
// Based on goal direction and rate. Safety floors enforced.
// ============================================================================

interface CalorieTargetParams {
  tdee: number;
  goalDirection: GoalDirection;
  sex: BiologicalSex;
  /** lbs per week for LOSE goals; defaults to 1.0 */
  rateLbsPerWeek?: number;
  /** surplus calories for GAIN goals; defaults to 500 */
  surplusCalories?: number;
}

/**
 * Compute daily calorie target from TDEE and goal.
 *
 * LOSE: TDEE - (rate_lbs_per_week * CALORIES_PER_POUND / 7)
 * GAIN: TDEE + surplus_calories
 * MAINTAIN: TDEE
 *
 * Safety floors enforced: never below 1,200 (female) or 1,500 (male).
 * For "prefer_not_to_say", use the higher floor (1,500) to be safe.
 */
export function calculateCalorieTarget({
  tdee,
  goalDirection,
  sex,
  rateLbsPerWeek,
  surplusCalories,
}: CalorieTargetParams): number {
  let target: number;

  switch (goalDirection) {
    case 'LOSE': {
      const rate = rateLbsPerWeek ?? DEFAULT_LOSS_RATE_LBS_PER_WEEK;
      const dailyDeficit = (rate * CALORIES_PER_POUND) / 7;
      target = tdee - dailyDeficit;
      break;
    }
    case 'GAIN': {
      const surplus = surplusCalories ?? DEFAULT_GAIN_SURPLUS_CALORIES;
      target = tdee + surplus;
      break;
    }
    case 'MAINTAIN':
    default:
      target = tdee;
      break;
  }

  // Enforce safety floors
  const floor = getCalorieFloor(sex);
  return Math.max(target, floor);
}

/** Get the calorie floor for a given sex */
export function getCalorieFloor(sex: BiologicalSex): number {
  if (sex === 'female') return CALORIE_FLOOR_FEMALE;
  // Male and "prefer_not_to_say" use the higher floor to be safe
  return CALORIE_FLOOR_MALE;
}

// ============================================================================
// MET-Based Calorie Burn
//
// Calories Burned = MET x weight_kg x duration_hours
//
// Source: Herrmann et al., JSHS 2024;13(1):6-12. pacompendium.com.
// ============================================================================

export interface MetActivity {
  code: string;
  category: string;
  description: string;
  met: number;
  verify?: boolean;
}

/** Look up a MET activity by its 5-digit Compendium code */
export function getMetActivity(code: string): MetActivity | undefined {
  return metCompendium.activities.find(
    (a: MetActivity) => a.code === code
  );
}

/** Search MET activities by keyword in description */
export function searchMetActivities(query: string): MetActivity[] {
  const lowerQuery = query.toLowerCase();
  return metCompendium.activities.filter((a: MetActivity) =>
    a.description.toLowerCase().includes(lowerQuery)
  );
}

/** Calculate calories burned from MET value, weight, and duration */
export function calculateCalorieBurn(
  met: number,
  weightKg: number,
  durationHours: number
): number {
  return met * weightKg * durationHours;
}

/** Calculate calories burned from MET value, weight in lbs, and duration in minutes */
export function calculateCalorieBurnImperial(
  met: number,
  weightLbs: number,
  durationMinutes: number
): number {
  return calculateCalorieBurn(met, lbsToKg(weightLbs), durationMinutes / 60);
}

// ============================================================================
// Weight Change Estimation
//
// Estimated Weekly Weight Change (lbs) = (Weekly Cal In - Weekly Cal Out) / 3500
//
// STATUS: KNOWN LIMITATION. The 3,500-calorie rule is an oversimplification.
// Used as STARTING ESTIMATE ONLY.
//
// Source: Hall & Chow, Int J Obes, 2013;37(12):1614.
// ============================================================================

/**
 * Estimate weekly weight change in pounds.
 *
 * @param weeklyCaloriesIn - Total calories consumed in a week
 * @param weeklyCaloriesOut - Total calories expended in a week (TDEE * 7 + exercise)
 * @returns Estimated weight change in lbs (positive = gain, negative = loss)
 */
export function estimateWeeklyWeightChange(
  weeklyCaloriesIn: number,
  weeklyCaloriesOut: number
): number {
  return (weeklyCaloriesIn - weeklyCaloriesOut) / CALORIES_PER_POUND;
}

// ============================================================================
// Age Computation Helper
// ============================================================================

/** Compute age in years from date of birth (ISO date string) */
export function computeAge(dob: string, referenceDate?: Date): number {
  const birth = new Date(dob);
  const ref = referenceDate ?? new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ============================================================================
// Weight Change Disclaimer (required on any screen showing weight projections)
// ============================================================================

export const WEIGHT_PROJECTION_DISCLAIMER =
  'Weight projections use a simplified model. Actual weight change depends ' +
  'on many factors including metabolism, water retention, and body composition ' +
  'changes. Weekly check-ins help us refine your targets.';
