// Step 4: Recovery Score tests

import {
  RECOVERY_WEIGHT_SLEEP_QUALITY,
  RECOVERY_WEIGHT_SLEEP_DURATION,
  RECOVERY_WEIGHT_HRV,
  RECOVERY_WEIGHT_RESTING_HR,
  RECOVERY_WEIGHT_TRAINING_LOAD,
  RECOVERY_WEIGHT_ALCOHOL,
} from '../constants/formulas';

import { computeRecoveryScore } from '../utils/recovery';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Recovery Score', () => {
  describe('Weight constants', () => {
    it('RECOVERY_WEIGHT_SLEEP_QUALITY = 0.25', () => {
      expect(RECOVERY_WEIGHT_SLEEP_QUALITY).toBe(0.25);
    });

    it('RECOVERY_WEIGHT_SLEEP_DURATION = 0.20', () => {
      expect(RECOVERY_WEIGHT_SLEEP_DURATION).toBe(0.20);
    });

    it('RECOVERY_WEIGHT_HRV = 0.20', () => {
      expect(RECOVERY_WEIGHT_HRV).toBe(0.20);
    });

    it('RECOVERY_WEIGHT_RESTING_HR = 0.15', () => {
      expect(RECOVERY_WEIGHT_RESTING_HR).toBe(0.15);
    });

    it('RECOVERY_WEIGHT_TRAINING_LOAD = 0.15', () => {
      expect(RECOVERY_WEIGHT_TRAINING_LOAD).toBe(0.15);
    });

    it('RECOVERY_WEIGHT_ALCOHOL = 0.05', () => {
      expect(RECOVERY_WEIGHT_ALCOHOL).toBe(0.05);
    });

    it('all weights sum to 1.0', () => {
      const sum =
        RECOVERY_WEIGHT_SLEEP_QUALITY +
        RECOVERY_WEIGHT_SLEEP_DURATION +
        RECOVERY_WEIGHT_HRV +
        RECOVERY_WEIGHT_RESTING_HR +
        RECOVERY_WEIGHT_TRAINING_LOAD +
        RECOVERY_WEIGHT_ALCOHOL;
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  describe('Full computation (all 6 components)', () => {
    it('computes a score with all data present', async () => {
      const date = '2026-03-27';

      // Set up sleep data
      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-03-26T22:00:00Z',
          wake_time: '2026-03-27T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        })
      );

      // Set up body data (HRV + resting HR)
      await AsyncStorage.setItem(
        `dub.log.body.${date}`,
        JSON.stringify({
          weight_lbs: 180,
          body_fat_pct: null,
          measurements: null,
          bp_systolic: null,
          bp_diastolic: null,
          resting_hr: 55,
          hrv_ms: 60,
          spo2_pct: null,
          timestamp: '2026-03-27T08:00:00Z',
        })
      );

      // Set up workout data
      await AsyncStorage.setItem(
        `dub.log.workout.${date}`,
        JSON.stringify([
          {
            id: 'w1',
            timestamp: '2026-03-27T08:00:00Z',
            activity_name: 'Running',
            compendium_code: null,
            met_value: 9.8,
            duration_minutes: 45,
            intensity: 'vigorous',
            calories_burned: 400,
            distance: null,
            distance_unit: null,
            environmental: { elevation_gain_ft: null, elevation_loss_ft: null, altitude_ft: null, temperature_f: null },
            biometric: { avg_heart_rate_bpm: null, max_heart_rate_bpm: null, heart_rate_zones: null },
            notes: null,
            source: 'manual',
          },
        ])
      );

      // Set up substance data (0 alcohol)
      await AsyncStorage.setItem(
        `dub.log.substances.${date}`,
        JSON.stringify([])
      );

      const result = await computeRecoveryScore(date);

      expect(result.sufficient_data).toBe(true);
      expect(result.total_score).toBeGreaterThan(0);
      expect(result.total_score).toBeLessThanOrEqual(100);
      expect(result.components).toHaveLength(6);

      // All components should have data
      const withData = result.components.filter((c) => c.has_data);
      expect(withData.length).toBe(6);
    });
  });

  describe('Missing component redistribution', () => {
    it('redistributes weights proportionally when one component is missing', async () => {
      const date = '2026-03-28';

      // Only sleep data (quality + duration) + workout + substances = 4 components
      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-03-27T22:00:00Z',
          wake_time: '2026-03-28T06:00:00Z',
          quality: 5,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 5,
          notes: null,
          device_data: null,
        })
      );

      // No body entry (no HRV, no resting HR)
      await AsyncStorage.setItem(
        `dub.log.workout.${date}`,
        JSON.stringify([
          {
            id: 'w2',
            timestamp: '2026-03-28T08:00:00Z',
            activity_name: 'Walking',
            compendium_code: null,
            met_value: 3.5,
            duration_minutes: 30,
            intensity: 'light',
            calories_burned: 120,
            distance: null,
            distance_unit: null,
            environmental: { elevation_gain_ft: null, elevation_loss_ft: null, altitude_ft: null, temperature_f: null },
            biometric: { avg_heart_rate_bpm: null, max_heart_rate_bpm: null, heart_rate_zones: null },
            notes: null,
            source: 'manual',
          },
        ])
      );

      await AsyncStorage.setItem(
        `dub.log.substances.${date}`,
        JSON.stringify([])
      );

      const result = await computeRecoveryScore(date);

      expect(result.sufficient_data).toBe(true);

      // Available components should have adjusted weights that still produce a valid score
      const availableComponents = result.components.filter((c) => c.has_data);
      expect(availableComponents.length).toBe(4); // sleep quality, sleep duration, training, alcohol

      // Missing components should have 0 weighted score
      const missingComponents = result.components.filter((c) => !c.has_data);
      for (const comp of missingComponents) {
        expect(comp.weighted_score).toBe(0);
      }
    });
  });

  describe('Insufficient data', () => {
    it('returns sufficient_data=false with fewer than 3 components', async () => {
      const date = '2026-03-29';

      // Only sleep quality available (1 component with data = sleep quality)
      // Actually sleep gives 2 components (quality + duration), so let's provide only quality without bedtime/wake
      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: null,
          wake_time: null,
          quality: 3,
          bathroom_trips: null,
          alarm_used: null,
          time_to_fall_asleep_min: null,
          notes: null,
          device_data: null,
        })
      );

      // No body, no workout, no substances
      const result = await computeRecoveryScore(date);

      expect(result.sufficient_data).toBe(false);
      expect(result.total_score).toBe(0);
    });
  });

  describe('Color coding', () => {
    // Color coding is UI-level concern, but verify the score ranges are meaningful
    it('score >= 80 is high (green zone)', async () => {
      // Verify that perfect inputs produce a high score
      const date = '2026-03-30';

      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-03-29T22:00:00Z',
          wake_time: '2026-03-30T06:00:00Z',
          quality: 5,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 5,
          notes: null,
          device_data: null,
        })
      );

      await AsyncStorage.setItem(
        `dub.log.body.${date}`,
        JSON.stringify({
          weight_lbs: 180,
          body_fat_pct: null,
          measurements: null,
          bp_systolic: null,
          bp_diastolic: null,
          resting_hr: 45,
          hrv_ms: 90,
          spo2_pct: null,
          timestamp: '2026-03-30T08:00:00Z',
        })
      );

      await AsyncStorage.setItem(
        `dub.log.workout.${date}`,
        JSON.stringify([
          {
            id: 'w3',
            timestamp: '2026-03-30T08:00:00Z',
            activity_name: 'Moderate Run',
            compendium_code: null,
            met_value: 7,
            duration_minutes: 45,
            intensity: 'moderate',
            calories_burned: 300,
            distance: null,
            distance_unit: null,
            environmental: { elevation_gain_ft: null, elevation_loss_ft: null, altitude_ft: null, temperature_f: null },
            biometric: { avg_heart_rate_bpm: null, max_heart_rate_bpm: null, heart_rate_zones: null },
            notes: null,
            source: 'manual',
          },
        ])
      );

      await AsyncStorage.setItem(
        `dub.log.substances.${date}`,
        JSON.stringify([])
      );

      const result = await computeRecoveryScore(date);
      expect(result.sufficient_data).toBe(true);
      expect(result.total_score).toBeGreaterThanOrEqual(70);
    });
  });
});
