// MASTER-65: ED Risk Detection tests
// Tests eating disorder risk flag generation in context_builder

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCoachContext } from '../ai/context_builder';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function pastDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function setProfile(overrides: Record<string, unknown> = {}) {
  await AsyncStorage.setItem(
    'dub.profile',
    JSON.stringify({
      name: 'Test User',
      dob: '1994-06-15',
      units: 'imperial',
      sex: 'female',
      height_inches: 65,
      weight_lbs: 130,
      activity_level: 'sedentary',
      goal: { direction: 'LOSE', target_weight: 120, rate_lbs_per_week: 1.0, gain_type: null, surplus_calories: null },
      pronouns: null,
      metabolic_profile: null,
      main_goal: null,
      altitude_acclimated: false,
      ...overrides,
    }),
  );
  await AsyncStorage.setItem('dub.tier', JSON.stringify('balanced'));
}

async function setFoodForDate(date: string, calories: number) {
  await AsyncStorage.setItem(
    `dub.log.food.${date}`,
    JSON.stringify([
      {
        id: `food-${date}`,
        timestamp: `${date}T12:00:00Z`,
        description: 'Test food',
        computed_nutrition: { calories, protein_g: 20, carbs_g: 30, fat_g: 10 },
        source: 'manual',
      },
    ]),
  );
}

describe('ED Risk Detection (MASTER-65)', () => {
  describe('Sustained low intake flag', () => {
    it('flags when below calorie floor for 3+ consecutive days', async () => {
      await setProfile({ sex: 'female' });
      const _today = todayDateString();

      // Set 3 days of food below 1200 cal floor
      for (let i = 0; i < 3; i++) {
        await setFoodForDate(pastDateString(i), 900);
      }

      const { context } = await buildCoachContext('How am I doing?');
      const sustainedFlag = context.ed_risk_flags.find(
        (f) => f.type === 'sustained_low_intake',
      );
      expect(sustainedFlag).toBeDefined();
    });

    it('does NOT flag when below floor for only 2 days then above', async () => {
      await setProfile({ sex: 'female' });

      // 2 days low, then normal
      await setFoodForDate(pastDateString(0), 900);
      await setFoodForDate(pastDateString(1), 900);
      await setFoodForDate(pastDateString(2), 1500);
      await setFoodForDate(pastDateString(3), 1500);
      await setFoodForDate(pastDateString(4), 1500);
      await setFoodForDate(pastDateString(5), 1500);
      await setFoodForDate(pastDateString(6), 1500);

      const { context } = await buildCoachContext('How am I doing?');
      const sustainedFlag = context.ed_risk_flags.find(
        (f) => f.type === 'sustained_low_intake',
      );
      expect(sustainedFlag).toBeUndefined();
    });
  });

  describe('BMI-based flags', () => {
    it('flags underweight BMI (BMI <= 18.5) with any goal', async () => {
      // BMI 17: weight_lbs and height_inches calculated to give BMI ~17
      // BMI = kg / m^2. For height 65in = 165.1cm = 1.651m
      // 17 = kg / (1.651)^2 -> kg = 17 * 2.727 = 46.36 -> lbs = 46.36 * 2.20462 = 102.2
      await setProfile({
        weight_lbs: 102,
        height_inches: 65,
        goal: { direction: 'MAINTAIN', target_weight: null, rate_lbs_per_week: null, gain_type: null, surplus_calories: null },
      });

      const { context } = await buildCoachContext('Hello');
      const bmiFlag = context.ed_risk_flags.find(
        (f) => f.type === 'underweight_bmi',
      );
      expect(bmiFlag).toBeDefined();
    });

    it('flags healthy BMI with LOSE goal (BMI <= 24.9)', async () => {
      // BMI ~22: 65in height, ~132 lbs
      await setProfile({
        weight_lbs: 132,
        height_inches: 65,
        goal: { direction: 'LOSE', target_weight: 120, rate_lbs_per_week: 1.0, gain_type: null, surplus_calories: null },
      });

      const { context } = await buildCoachContext('Hello');
      const healthyLoseFlag = context.ed_risk_flags.find(
        (f) => f.type === 'healthy_bmi_loss_goal',
      );
      expect(healthyLoseFlag).toBeDefined();
    });

    it('does NOT flag BMI 22 with MAINTAIN goal', async () => {
      await setProfile({
        weight_lbs: 132,
        height_inches: 65,
        goal: { direction: 'MAINTAIN', target_weight: null, rate_lbs_per_week: null, gain_type: null, surplus_calories: null },
      });

      const { context } = await buildCoachContext('Hello');
      const healthyLoseFlag = context.ed_risk_flags.find(
        (f) => f.type === 'healthy_bmi_loss_goal',
      );
      expect(healthyLoseFlag).toBeUndefined();
    });
  });

  describe('Extreme restriction today', () => {
    it('flags when today intake < 1000 cal with food logged', async () => {
      await setProfile();
      await setFoodForDate(todayDateString(), 400);

      const { context } = await buildCoachContext('Hello');
      const extremeFlag = context.ed_risk_flags.find(
        (f) => f.type === 'extreme_restriction_today',
      );
      expect(extremeFlag).toBeDefined();
    });

    it('does NOT flag 400 cal day as something to celebrate', async () => {
      await setProfile();
      await setFoodForDate(todayDateString(), 400);

      const { context } = await buildCoachContext('Hello');
      // extreme_restriction_today flag should be present
      expect(
        context.ed_risk_flags.some((f) => f.type === 'extreme_restriction_today'),
      ).toBe(true);
    });
  });
});
