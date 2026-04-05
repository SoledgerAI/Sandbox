// Recovery Score tests — updated for MASTER-18,19,20,21,23

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

/** Helper: store a body entry for a given date */
async function setBodyEntry(
  date: string,
  overrides: Partial<{
    resting_hr: number | null;
    hrv_ms: number | null;
    weight_lbs: number | null;
  }> = {},
) {
  await AsyncStorage.setItem(
    `dub.log.body.${date}`,
    JSON.stringify({
      weight_lbs: 180,
      body_fat_pct: null,
      measurements: null,
      bp_systolic: null,
      bp_diastolic: null,
      resting_hr: overrides.resting_hr ?? null,
      hrv_ms: overrides.hrv_ms ?? null,
      spo2_pct: null,
      timestamp: `${date}T08:00:00Z`,
    }),
  );
}

/** Helper: store a workout entry for a given date */
async function setWorkoutEntry(date: string, durationMinutes: number) {
  await AsyncStorage.setItem(
    `dub.log.workout.${date}`,
    JSON.stringify([
      {
        id: `w-${date}`,
        timestamp: `${date}T08:00:00Z`,
        activity_name: 'Running',
        compendium_code: null,
        met_value: 9.8,
        duration_minutes: durationMinutes,
        intensity: 'vigorous',
        calories_burned: 400,
        distance: null,
        distance_unit: null,
        environmental: { elevation_gain_ft: null, elevation_loss_ft: null, altitude_ft: null, temperature_f: null },
        biometric: { avg_heart_rate_bpm: null, max_heart_rate_bpm: null, heart_rate_zones: null },
        rpe: null,
        notes: null,
        source: 'manual',
      },
    ]),
  );
}

/** Helper: get yesterday's date string from a given date */
function yesterdayOf(date: string): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/** Helper: get date strings for the N days preceding a given date */
function precedingDates(date: string, count: number): string[] {
  const dates: string[] = [];
  const d = new Date(date + 'T00:00:00');
  for (let i = 1; i <= count; i++) {
    const prev = new Date(d);
    prev.setDate(d.getDate() - i);
    dates.push(prev.toISOString().split('T')[0]);
  }
  return dates;
}

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

  describe('MASTER-23: Sleep duration curve', () => {
    // We test indirectly via the full computation with only sleep data + enough components
    // The scoring function is internal, so we verify via component raw_score

    async function getSleepDurationScore(hours: number): Promise<number> {
      const date = '2026-04-10';
      const bedtime = new Date('2026-04-09T22:00:00Z');
      const wakeTime = new Date(bedtime.getTime() + hours * 60 * 60 * 1000);

      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: bedtime.toISOString(),
          wake_time: wakeTime.toISOString(),
          quality: 3,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );

      // Need at least 3 components — add substances to get sleep quality + sleep duration + alcohol = 3
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));

      // Provide yesterday's workout for training load
      await setWorkoutEntry(yesterdayOf(date), 45);

      const result = await computeRecoveryScore(date);
      const sleepDur = result.components.find((c) => c.name === 'Sleep Duration');
      return sleepDur!.raw_score;
    }

    it('5h -> 15', async () => {
      expect(await getSleepDurationScore(5)).toBe(15);
    });

    it('6h -> 30', async () => {
      expect(await getSleepDurationScore(6)).toBe(30);
    });

    it('6.5h -> 45', async () => {
      expect(await getSleepDurationScore(6.5)).toBe(45);
    });

    it('7h -> 60', async () => {
      expect(await getSleepDurationScore(7)).toBe(60);
    });

    it('8h -> 80', async () => {
      expect(await getSleepDurationScore(8)).toBe(80);
    });

    it('9h -> 100 (optimal peak)', async () => {
      expect(await getSleepDurationScore(9)).toBe(100);
    });

    it('10h -> 90 (diminishing)', async () => {
      expect(await getSleepDurationScore(10)).toBe(90);
    });

    it('11h -> 80 (excessive)', async () => {
      expect(await getSleepDurationScore(11)).toBe(80);
    });
  });

  describe('MASTER-18: Alcohol step function', () => {
    async function getAlcoholScore(drinkCount: number): Promise<number> {
      const date = '2026-04-11';

      // Sleep for min-components requirement
      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-10T22:00:00Z',
          wake_time: '2026-04-11T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );

      // Yesterday's workout
      await setWorkoutEntry(yesterdayOf(date), 30);

      // Substances: N alcohol entries
      const substances = Array.from({ length: drinkCount }, (_, _i) => ({
        substance: 'alcohol',
        quantity: 1,
        unit: 'drink',
        timestamp: `${date}T20:00:00Z`,
        notes: null,
      }));
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify(substances));

      const result = await computeRecoveryScore(date);
      const alcohol = result.components.find((c) => c.name === 'Alcohol');
      return alcohol!.raw_score;
    }

    it('0 drinks -> 100', async () => {
      expect(await getAlcoholScore(0)).toBe(100);
    });

    it('1 drink -> 80', async () => {
      expect(await getAlcoholScore(1)).toBe(80);
    });

    it('2 drinks -> 50', async () => {
      expect(await getAlcoholScore(2)).toBe(50);
    });

    it('3 drinks -> 20', async () => {
      expect(await getAlcoholScore(3)).toBe(20);
    });

    it('5 drinks -> 20 (capped)', async () => {
      expect(await getAlcoholScore(5)).toBe(20);
    });
  });

  describe('MASTER-19: Training load uses yesterday workout', () => {
    it('reads workout from yesterday, not today', async () => {
      const date = '2026-04-12';
      const yesterday = yesterdayOf(date);

      // Put workout under YESTERDAY
      await setWorkoutEntry(yesterday, 45);

      // Put NO workout under today (to prove it reads yesterday)
      // (don't set today's workout at all)

      // Minimal other data for sufficient_data
      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-11T22:00:00Z',
          wake_time: '2026-04-12T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));

      const result = await computeRecoveryScore(date);
      const trainingLoad = result.components.find((c) => c.name === 'Training Load');

      expect(trainingLoad!.has_data).toBe(true);
      // 45 min workout -> score 100 (optimal range)
      expect(trainingLoad!.raw_score).toBe(100);
    });

    it('shows no training data when only today has workout', async () => {
      const date = '2026-04-13';

      // Workout under TODAY only (should NOT be read)
      await setWorkoutEntry(date, 45);

      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-12T22:00:00Z',
          wake_time: '2026-04-13T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));

      const result = await computeRecoveryScore(date);
      const trainingLoad = result.components.find((c) => c.name === 'Training Load');

      // Yesterday has no workout -> null -> has_data false
      expect(trainingLoad!.has_data).toBe(false);
    });
  });

  describe('MASTER-20: HRV scored against 7-day baseline', () => {
    it('scores HRV relative to baseline when available', async () => {
      const date = '2026-04-14';
      const past7 = precedingDates(date, 7);

      // Set 7 days of body entries with HRV ~50ms
      for (const d of past7) {
        await setBodyEntry(d, { hrv_ms: 50 });
      }

      // Today: HRV = 60ms (ratio 1.2 -> score 100)
      await setBodyEntry(date, { hrv_ms: 60, resting_hr: 60 });

      // Minimal data for sufficient_data
      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-13T22:00:00Z',
          wake_time: '2026-04-14T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));
      await setWorkoutEntry(yesterdayOf(date), 45);

      const result = await computeRecoveryScore(date);
      const hrvComp = result.components.find((c) => c.name === 'HRV');
      // baseline 50, today 60, ratio 1.2 >= 1.15 -> 100
      expect(hrvComp!.raw_score).toBe(100);
    });

    it('HRV below baseline scores lower', async () => {
      const date = '2026-04-15';
      const past7 = precedingDates(date, 7);

      // Baseline HRV ~50ms
      for (const d of past7) {
        await setBodyEntry(d, { hrv_ms: 50 });
      }

      // Today: HRV = 40ms (ratio 0.8 -> score 50)
      await setBodyEntry(date, { hrv_ms: 40, resting_hr: 60 });

      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-14T22:00:00Z',
          wake_time: '2026-04-15T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));
      await setWorkoutEntry(yesterdayOf(date), 45);

      const result = await computeRecoveryScore(date);
      const hrvComp = result.components.find((c) => c.name === 'HRV');
      // baseline 50, today 40, ratio 0.8 -> 50
      expect(hrvComp!.raw_score).toBe(50);
    });

    it('HRV with no baseline falls back to absolute scoring', async () => {
      const date = '2026-04-16';
      // No prior body entries -> null baseline

      // Today: HRV = 60ms -> fallback: min(100, max(0, round(60/60*100))) = 100
      await setBodyEntry(date, { hrv_ms: 60, resting_hr: 60 });

      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-15T22:00:00Z',
          wake_time: '2026-04-16T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));
      await setWorkoutEntry(yesterdayOf(date), 45);

      const result = await computeRecoveryScore(date);
      const hrvComp = result.components.find((c) => c.name === 'HRV');
      expect(hrvComp!.raw_score).toBe(100);
    });
  });

  describe('MASTER-21: Resting HR scored against 7-day baseline', () => {
    it('lower than baseline scores high', async () => {
      const date = '2026-04-17';
      const past7 = precedingDates(date, 7);

      // Baseline RHR ~62bpm
      for (const d of past7) {
        await setBodyEntry(d, { resting_hr: 62 });
      }

      // Today: RHR = 55bpm (diff -7 -> score 100)
      await setBodyEntry(date, { resting_hr: 55, hrv_ms: 50 });

      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-16T22:00:00Z',
          wake_time: '2026-04-17T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));
      await setWorkoutEntry(yesterdayOf(date), 45);

      const result = await computeRecoveryScore(date);
      const rhrComp = result.components.find((c) => c.name === 'Resting HR');
      // baseline 62, today 55, diff -7 <= -5 -> 100
      expect(rhrComp!.raw_score).toBe(100);
    });

    it('higher than baseline scores low', async () => {
      const date = '2026-04-18';
      const past7 = precedingDates(date, 7);

      for (const d of past7) {
        await setBodyEntry(d, { resting_hr: 62 });
      }

      // Today: RHR = 68bpm (diff +6 -> score 30)
      await setBodyEntry(date, { resting_hr: 68, hrv_ms: 50 });

      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-17T22:00:00Z',
          wake_time: '2026-04-18T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));
      await setWorkoutEntry(yesterdayOf(date), 45);

      const result = await computeRecoveryScore(date);
      const rhrComp = result.components.find((c) => c.name === 'Resting HR');
      // baseline 62, today 68, diff +6 (5 < diff <= 10) -> 30
      expect(rhrComp!.raw_score).toBe(30);
    });

    it('RHR with no baseline falls back to absolute scoring', async () => {
      const date = '2026-04-19';

      // Today: RHR = 55bpm -> fallback: <= 60 -> 80
      await setBodyEntry(date, { resting_hr: 55, hrv_ms: 50 });

      await AsyncStorage.setItem(
        `dub.log.sleep.${date}`,
        JSON.stringify({
          bedtime: '2026-04-18T22:00:00Z',
          wake_time: '2026-04-19T06:00:00Z',
          quality: 4,
          bathroom_trips: 0,
          alarm_used: false,
          time_to_fall_asleep_min: 10,
          notes: null,
          device_data: null,
        }),
      );
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));
      await setWorkoutEntry(yesterdayOf(date), 45);

      const result = await computeRecoveryScore(date);
      const rhrComp = result.components.find((c) => c.name === 'Resting HR');
      expect(rhrComp!.raw_score).toBe(80);
    });
  });

  describe('Full computation (all 6 components)', () => {
    it('computes a score with all data present', async () => {
      const date = '2026-03-27';
      const yesterday = yesterdayOf(date);

      // Sleep data
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
        }),
      );

      // Body data (HRV + resting HR)
      await setBodyEntry(date, { resting_hr: 55, hrv_ms: 60 });

      // MASTER-19: workout data under YESTERDAY
      await setWorkoutEntry(yesterday, 45);

      // 0 alcohol
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));

      const result = await computeRecoveryScore(date);

      expect(result.sufficient_data).toBe(true);
      expect(result.total_score).toBeGreaterThan(0);
      expect(result.total_score).toBeLessThanOrEqual(100);
      expect(result.components).toHaveLength(6);

      const withData = result.components.filter((c) => c.has_data);
      expect(withData.length).toBe(6);
    });
  });

  describe('Missing component redistribution', () => {
    it('redistributes weights proportionally when components are missing', async () => {
      const date = '2026-03-28';
      const yesterday = yesterdayOf(date);

      // Sleep data (quality + duration) + workout + substances = 4 components
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
        }),
      );

      // No body entry (no HRV, no resting HR)
      await setWorkoutEntry(yesterday, 30);
      await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));

      const result = await computeRecoveryScore(date);

      expect(result.sufficient_data).toBe(true);

      const availableComponents = result.components.filter((c) => c.has_data);
      expect(availableComponents.length).toBe(4);

      const missingComponents = result.components.filter((c) => !c.has_data);
      for (const comp of missingComponents) {
        expect(comp.weighted_score).toBe(0);
      }
    });
  });

  describe('Insufficient data', () => {
    it('returns sufficient_data=false with fewer than 3 components', async () => {
      const date = '2026-03-29';

      // Only sleep quality (no bedtime/wake = no duration)
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
        }),
      );

      const result = await computeRecoveryScore(date);

      expect(result.sufficient_data).toBe(false);
      expect(result.total_score).toBe(0);
    });
  });
});
