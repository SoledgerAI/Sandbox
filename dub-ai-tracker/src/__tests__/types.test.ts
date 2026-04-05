// Step 2: Type system verification tests
// Verifies all core type interfaces can be instantiated without TypeScript errors

import type {
  UserProfile,
  FoodEntry,
  WorkoutEntry,
  SleepEntry,
  MoodEntry,
  BodyEntry,
  WaterEntry,
  CaffeineEntry,
  SubstanceEntry,
  SupplementEntry,
  CycleEntry,
  DigestiveEntry,
  PersonalCareEntry,
  InjuryEntry,
  BloodworkEntry,
  RecoveryScore,
  ChatMessage,
  DailySummary,
} from '../types';

describe('Type System -- Core Interfaces', () => {
  it('instantiates a valid UserProfile', () => {
    const profile: UserProfile = {
      name: 'Test User',
      dob: '1994-06-15',
      units: 'imperial',
      sex: 'male',
      height_inches: 70,
      weight_lbs: 180,
      activity_level: 'moderately_active',
      goal: {
        direction: 'LOSE',
        target_weight: 170,
        rate_lbs_per_week: 1.0,
        gain_type: null,
        surplus_calories: null,
      },
      pronouns: null,
      metabolic_profile: null,
      main_goal: null,
      altitude_acclimated: false,
    };
    expect(profile.name).toBe('Test User');
    expect(profile.sex).toBe('male');
  });

  it('instantiates a valid FoodEntry', () => {
    const entry: FoodEntry = {
      id: 'food_1',
      timestamp: '2026-03-27T12:00:00Z',
      meal_type: 'lunch',
      food_item: {
        source: 'usda',
        source_id: 'usda:12345',
        name: 'Chicken Breast',
        brand: null,
        barcode: null,
        nutrition_per_100g: {
          calories: 165,
          protein_g: 31,
          carbs_g: 0,
          fat_g: 3.6,
          fiber_g: 0,
          sugar_g: 0,
          added_sugar_g: null,
          sodium_mg: 74,
          cholesterol_mg: 85,
          saturated_fat_g: 1,
          trans_fat_g: 0,
          potassium_mg: 256,
          vitamin_d_mcg: null,
          calcium_mg: 11,
          iron_mg: 1,
        },
        serving_sizes: [
          { description: '100g', unit: 'g', gram_weight: 100, quantity: 1 },
        ],
        default_serving_index: 0,
        ingredients: null,
        last_accessed: '2026-03-27T12:00:00Z',
      },
      serving: { description: '100g', unit: 'g', gram_weight: 100, quantity: 1 },
      quantity: 1,
      computed_nutrition: {
        calories: 165,
        protein_g: 31,
        carbs_g: 0,
        fat_g: 3.6,
        fiber_g: 0,
        sugar_g: 0,
        added_sugar_g: null,
        sodium_mg: 74,
        cholesterol_mg: 85,
        saturated_fat_g: 1,
        trans_fat_g: 0,
        potassium_mg: 256,
        vitamin_d_mcg: null,
        calcium_mg: 11,
        iron_mg: 1,
      },
      source: 'usda',
      photo_uri: null,
      photo_confidence: null,
      flagged_ingredients: [],
      notes: null,
    };
    expect(entry.id).toBe('food_1');
  });

  it('instantiates a valid WorkoutEntry', () => {
    const entry: WorkoutEntry = {
      id: 'w_1',
      timestamp: '2026-03-27T08:00:00Z',
      activity_name: 'Running',
      compendium_code: 'run_outdoor',
      met_value: 9.8,
      duration_minutes: 30,
      intensity: 'vigorous',
      calories_burned: 392,
      distance: 3.5,
      distance_unit: 'miles',
      environmental: {
        elevation_gain_ft: null,
        elevation_loss_ft: null,
        altitude_ft: null,
        temperature_f: null,
      },
      biometric: {
        avg_heart_rate_bpm: null,
        max_heart_rate_bpm: null,
        heart_rate_zones: null,
      },
      rpe: null,
      notes: null,
      source: 'manual',
    };
    expect(entry.met_value).toBe(9.8);
  });

  it('instantiates a valid SleepEntry', () => {
    const entry: SleepEntry = {
      bedtime: '2026-03-26T22:30:00Z',
      wake_time: '2026-03-27T06:30:00Z',
      quality: 4,
      bathroom_trips: 1,
      alarm_used: true,
      time_to_fall_asleep_min: 15,
      notes: null,
      device_data: null,
    };
    expect(entry.quality).toBe(4);
  });

  it('instantiates a valid MoodEntry', () => {
    const entry: MoodEntry = {
      id: 'mood_1',
      timestamp: '2026-03-27T12:00:00Z',
      score: 4,
      energy: 3,
      anxiety: 2,
      note: 'Good day',
    };
    expect(entry.score).toBe(4);
  });

  it('instantiates a valid BodyEntry', () => {
    const entry: BodyEntry = {
      weight_lbs: 180,
      body_fat_pct: 18,
      measurements: null,
      bp_systolic: 120,
      bp_diastolic: 80,
      resting_hr: 62,
      hrv_ms: 55,
      spo2_pct: 98,
      timestamp: '2026-03-27T08:00:00Z',
    };
    expect(entry.weight_lbs).toBe(180);
  });

  it('instantiates a valid WaterEntry', () => {
    const entry: WaterEntry = {
      id: 'water_1',
      timestamp: '2026-03-27T08:00:00Z',
      amount_oz: 16,
      notes: null,
    };
    expect(entry.amount_oz).toBe(16);
  });

  it('instantiates a valid CaffeineEntry', () => {
    const entry: CaffeineEntry = {
      id: 'caf_1',
      timestamp: '2026-03-27T07:00:00Z',
      amount_mg: 95,
      source: 'coffee',
      notes: null,
    };
    expect(entry.amount_mg).toBe(95);
  });

  it('instantiates a valid SubstanceEntry', () => {
    const entry: SubstanceEntry = {
      id: 'sub_1',
      timestamp: '2026-03-27T20:00:00Z',
      substance: 'alcohol',
      amount: 1,
      unit: 'drink',
      alcohol_type: 'beer',
      cannabis_method: null,
      thc_mg: null,
      cbd_mg: null,
      calories: 150,
      notes: null,
    };
    expect(entry.substance).toBe('alcohol');
  });

  it('instantiates a valid SupplementEntry', () => {
    const entry: SupplementEntry = {
      id: 'supp_1',
      timestamp: '2026-03-27T08:00:00Z',
      name: 'Vitamin D3',
      dosage: 5000,
      unit: 'IU',
      taken: true,
      category: 'vitamin',
      notes: null,
      side_effects: null,
    };
    expect(entry.name).toBe('Vitamin D3');
  });

  it('instantiates a valid CycleEntry', () => {
    const entry: CycleEntry = {
      period_start: '2026-03-20',
      flow_level: 'medium',
      symptoms: ['cramps', 'bloating'],
      computed_phase: 'menstrual',
      cycle_day: 7,
      notes: null,
    };
    expect(entry.computed_phase).toBe('menstrual');
  });

  it('instantiates a valid DigestiveEntry', () => {
    const entry: DigestiveEntry = {
      id: 'dig_1',
      timestamp: '2026-03-27T09:00:00Z',
      bristol_type: 4,
      notes: null,
    };
    expect(entry.bristol_type).toBe(4);
  });

  it('instantiates a valid PersonalCareEntry', () => {
    const entry: PersonalCareEntry = {
      brush_teeth_am: true,
      brush_teeth_pm: true,
      floss: true,
      mouthwash: false,
      shower: true,
      skincare_am: true,
      skincare_am_detail: 'moisturizer',
      skincare_pm: true,
      skincare_pm_detail: 'retinol',
      sunscreen: true,
      grooming: false,
      grooming_notes: null,
      handwashing_count: 8,
    };
    expect(entry.brush_teeth_am).toBe(true);
  });

  it('instantiates a valid InjuryEntry', () => {
    const entry: InjuryEntry = {
      id: 'inj_1',
      body_location: 'left knee',
      severity: 4,
      type: 'chronic',
      description: 'Patellar tendonitis',
      aggravators: ['squats', 'running'],
      onset_date: '2026-01-15',
      resolved_date: null,
    };
    expect(entry.severity).toBe(4);
  });

  it('instantiates a valid BloodworkEntry', () => {
    const entry: BloodworkEntry = {
      date: '2026-03-15',
      lab_name: 'Quest Diagnostics',
      markers: [
        {
          name: 'Fasting Glucose',
          value: 95,
          unit: 'mg/dL',
          reference_range_low: 70,
          reference_range_high: 100,
          flagged: false,
        },
      ],
      notes: null,
    };
    expect(entry.markers).toHaveLength(1);
  });

  it('instantiates a valid RecoveryScore', () => {
    const score: RecoveryScore = {
      date: '2026-03-27',
      total_score: 78,
      components: [
        { name: 'Sleep Quality', weight: 0.25, raw_score: 75, weighted_score: 18.75, has_data: true },
      ],
      sufficient_data: true,
    };
    expect(score.total_score).toBe(78);
  });

  it('instantiates a valid ChatMessage', () => {
    const msg: ChatMessage = {
      id: 'chat_1',
      role: 'user',
      content: 'How am I doing today?',
      timestamp: '2026-03-27T12:00:00Z',
    };
    expect(msg.role).toBe('user');
  });

  it('instantiates a valid DailySummary', () => {
    const summary: DailySummary = {
      date: '2026-03-27',
      calories_consumed: 2100,
      calories_burned: 400,
      calories_net: 1700,
      calories_remaining: 0,
      protein_g: 160,
      carbs_g: 220,
      fat_g: 70,
      fiber_g: 30,
      sugar_g: 45,
      water_oz: 80,
      caffeine_mg: 200,
      steps: 10000,
      active_minutes: 45,
      sleep_hours: 7.5,
      sleep_quality: 4,
      mood_avg: 4.0,
      energy_avg: 3.5,
      anxiety_avg: 2.0,
      weight_lbs: 180,
      glucose_avg_mg_dl: null,
      bp_systolic_avg: null,
      bp_diastolic_avg: null,
      tags_logged: ['nutrition.food', 'hydration.water', 'sleep.tracking'],
      recovery_score: 78,
    };
    expect(summary.date).toBe('2026-03-27');
  });
});
