// Formula constants for DUB_AI Tracker
// Phase 4: Calorie Engine Constants
//
// All constants are named exports. No magic numbers in computation functions.

// ============================================================================
// FORMULA 1: BMR (Mifflin-St Jeor Equation)
// Source: Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO.
//   A new predictive equation for resting energy expenditure in healthy
//   individuals. Am J Clin Nutr. 1990;51(2):241-247.
//   DOI: 10.1093/ajcn/51.2.241
//
// CRITICAL: Use PRECISE coefficients 9.99 and 4.92, NOT rounded 10 and 5.
// The original paper uses 9.99 and 4.92. Most clinical calculators round;
// we use source-faithful values. Expect minor discrepancies vs other tools.
// ============================================================================

export const BMR_WEIGHT_COEFFICIENT = 9.99; // kcal per kg body weight
export const BMR_HEIGHT_COEFFICIENT = 6.25; // kcal per cm height
export const BMR_AGE_COEFFICIENT = 4.92; // kcal per year of age
export const BMR_MALE_CONSTANT = 5; // added for males
export const BMR_FEMALE_CONSTANT = -161; // added for females

// ============================================================================
// FORMULA 2: TDEE Activity Multipliers
// Source: FAO/WHO/UNU. Energy and protein requirements. Report of a joint
//   FAO/WHO/UNU Expert Consultation. WHO Technical Report Series 724.
//   Geneva: World Health Organization; 1985.
// ============================================================================

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2, // Little or no exercise
  lightly_active: 1.375, // Light exercise 1-3 days/week
  moderately_active: 1.55, // Moderate exercise 3-5 days/week
  very_active: 1.725, // Hard exercise 6-7 days/week
  extremely_active: 1.9, // Very hard exercise + physical job
} as const;

// ============================================================================
// FORMULA 3: MET-Based Calorie Burn
// Source: Herrmann SD, Willis EA, Ainsworth BE, Barreira TV, Hastert M,
//   Kang M, Vasquez E, Schuna JM Jr. 2024 Adult Compendium of Physical
//   Activities: A third update of the codes and MET values.
//   J Sport Health Sci. 2024;13(1):6-12.
//   DOI: 10.1016/j.jshs.2023.10.010 (PMID 38242596)
//   Database URL: https://pacompendium.com
//
// Calorie Burn = MET x weight_kg x duration_hours
// ============================================================================

// No additional constants needed -- MET values are in data/met_compendium.json

// ============================================================================
// FORMULA 4: Weight Change Estimation
// STATUS: KNOWN LIMITATION. The 3,500-calorie rule is an oversimplification.
//
// Source: Hall KD, Chow CC. Estimating changes of free-living energy intake
//   and physical activity from body weight changes.
//   Int J Obes. 2013;37(12):1614. (Letter)
// Also: Hall KD, et al. Quantification of the effect of energy imbalance on
//   bodyweight. Lancet. 2011;378(9793):826-837.
//   DOI: 10.1016/S0140-6736(11)60812-X
//
// Used as STARTING ESTIMATE ONLY. Weekly TDEE reconciliation required.
// ============================================================================

export const CALORIES_PER_POUND = 3500;

// ============================================================================
// FORMULA 5: 1RM Estimation (Brzycki)
// Source: Brzycki M. Strength Testing -- Predicting a One-Rep Max from
//   Reps-to-Fatigue. JOHPERD. 1993;64(1):88-90.
//   DOI: 10.1080/07303084.1993.10606684
//
// 1RM = weight x (36 / (37 - reps))
// Valid for reps 1-10 only.
// ============================================================================

export const BRZYCKI_NUMERATOR = 36;
export const BRZYCKI_DENOMINATOR_BASE = 37;
export const BRZYCKI_MAX_REPS = 10;

// ============================================================================
// FORMULA 6: Recovery Score (DUB_AI Proprietary v1.0)
// Weights stored as configurable constants.
// ============================================================================

export const RECOVERY_WEIGHT_SLEEP_QUALITY = 0.25;
export const RECOVERY_WEIGHT_SLEEP_DURATION = 0.20;
export const RECOVERY_WEIGHT_HRV = 0.20;
export const RECOVERY_WEIGHT_RESTING_HR = 0.15;
export const RECOVERY_WEIGHT_TRAINING_LOAD = 0.15;
export const RECOVERY_WEIGHT_ALCOHOL = 0.05;

// ============================================================================
// FORMULA 7: Protein Target Defaults (g/kg body weight)
// Source: Jager R, et al. International Society of Sports Nutrition Position
//   Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.
//   DOI: 10.1186/s12970-017-0177-8
// Extension: Helms ER, et al. A systematic review of dietary protein during
//   caloric restriction in resistance trained lean athletes.
//   J Int Soc Sports Nutr. 2014;11:20. DOI: 10.1186/1550-2783-11-20
// ============================================================================

export const PROTEIN_TARGETS = {
  sedentary: { min: 0.8, max: 0.8 }, // RDA minimum
  flexible: { min: 1.2, max: 1.4 }, // Active / Flexible tier
  balanced: { min: 1.4, max: 1.6 }, // Balanced / Structured
  structured: { min: 1.4, max: 1.6 }, // Balanced / Structured
  precision: { min: 1.6, max: 2.2 }, // Precision / Strength focus
  weight_loss_resistance: { min: 2.3, max: 3.1 }, // g/kg lean mass (Helms)
} as const;

// ============================================================================
// Safety Floors
// Source: Expert 1 Clinical Audit. The app NEVER sets a target below these.
// Enforced in the calorie engine, not just the UI.
// ============================================================================

export const CALORIE_FLOOR_FEMALE = 1200; // kcal/day minimum for women
export const CALORIE_FLOOR_MALE = 1500; // kcal/day minimum for men

// ============================================================================
// Default Goal Rates (applied during onboarding when user selects goal
// direction but rate selection is deferred to Settings)
// ============================================================================

export const DEFAULT_LOSS_RATE_LBS_PER_WEEK = 1.0; // moderate deficit
export const DEFAULT_GAIN_SURPLUS_CALORIES = 500; // standard bulk

// ============================================================================
// Unit Conversion Constants
// ============================================================================

export const LBS_PER_KG = 2.20462;
export const CM_PER_INCH = 2.54;
export const INCHES_PER_FOOT = 12;

// ============================================================================
// Sugar Targets (AHA Recommendation)
// Source: Johnson RK, et al., Dietary Sugars Intake and Cardiovascular
//   Health: A Scientific Statement From the American Heart Association.
//   Circulation. 2009;120(11):1011-1020.
//   DOI: 10.1161/CIRCULATIONAHA.109.192627
// ============================================================================

export const SUGAR_TARGET_MALE_G = 36; // grams/day
export const SUGAR_TARGET_FEMALE_G = 25; // grams/day
