// Step 5: Strength Training Utility tests

import { estimate1RM, calculateVolume, detectPR } from '../utils/strength';
import {
  BRZYCKI_NUMERATOR,
  BRZYCKI_DENOMINATOR_BASE,
  BRZYCKI_MAX_REPS,
} from '../constants/formulas';
import type { ExerciseSet, PersonalRecord } from '../types/workout';

describe('Strength Utilities', () => {
  describe('Brzycki 1RM formula', () => {
    it('225 lbs x 5 reps = 253.125 lbs', () => {
      // 1RM = 225 x (36 / (37 - 5)) = 225 x (36 / 32) = 225 x 1.125 = 253.125
      const result = estimate1RM(225, 5);
      expect(result).toBeCloseTo(253.125, 2);
    });

    it('returns the weight itself for 1 rep', () => {
      expect(estimate1RM(315, 1)).toBe(315);
    });

    it('returns null for reps > 10', () => {
      expect(estimate1RM(135, 11)).toBeNull();
    });

    it('returns null for reps < 1', () => {
      expect(estimate1RM(135, 0)).toBeNull();
    });

    it('computes correctly for 10 reps', () => {
      // 1RM = 135 x (36 / (37 - 10)) = 135 x (36 / 27) = 135 x 1.333... = 180
      const result = estimate1RM(135, 10);
      expect(result).toBeCloseTo(180, 1);
    });

    it('uses correct constants', () => {
      expect(BRZYCKI_NUMERATOR).toBe(36);
      expect(BRZYCKI_DENOMINATOR_BASE).toBe(37);
      expect(BRZYCKI_MAX_REPS).toBe(10);
    });
  });

  describe('Volume calculation', () => {
    it('sums weight x reps for working sets only', () => {
      const sets: ExerciseSet[] = [
        { set_number: 1, weight: 135, weight_unit: 'lbs', reps: 10, rpe: null, rest_seconds: null, notes: null, is_warmup: true, is_pr: false },
        { set_number: 2, weight: 225, weight_unit: 'lbs', reps: 5, rpe: 8, rest_seconds: 120, notes: null, is_warmup: false, is_pr: false },
        { set_number: 3, weight: 225, weight_unit: 'lbs', reps: 5, rpe: 9, rest_seconds: 120, notes: null, is_warmup: false, is_pr: false },
        { set_number: 4, weight: 225, weight_unit: 'lbs', reps: 4, rpe: 10, rest_seconds: null, notes: null, is_warmup: false, is_pr: false },
      ];

      // Volume = (225*5) + (225*5) + (225*4) = 1125 + 1125 + 900 = 3150
      // Warmup set (135*10 = 1350) is excluded
      expect(calculateVolume(sets)).toBe(3150);
    });

    it('returns 0 for all warmup sets', () => {
      const sets: ExerciseSet[] = [
        { set_number: 1, weight: 135, weight_unit: 'lbs', reps: 10, rpe: null, rest_seconds: null, notes: null, is_warmup: true, is_pr: false },
      ];
      expect(calculateVolume(sets)).toBe(0);
    });

    it('returns 0 for empty sets', () => {
      expect(calculateVolume([])).toBe(0);
    });
  });

  describe('PR detection', () => {
    it('detects a new 1RM PR', () => {
      const set: ExerciseSet = {
        set_number: 1,
        weight: 245,
        weight_unit: 'lbs',
        reps: 5,
        rpe: 9,
        rest_seconds: null,
        notes: null,
        is_warmup: false,
        is_pr: false,
      };

      const existingPRs: PersonalRecord[] = [
        {
          exercise_id: 'bench_press',
          exercise_name: 'Bench Press',
          type: '1rm_estimated',
          value: 253.125, // previous PR: 225x5
          weight: 225,
          reps: 5,
          date: '2026-03-20',
        },
      ];

      const pr = detectPR(set, existingPRs, 'bench_press');
      // 245 x (36/32) = 245 * 1.125 = 275.625 > 253.125
      expect(pr).not.toBeNull();
      expect(pr!.type).toBe('1rm_estimated');
      expect(pr!.value).toBeCloseTo(275.6, 0);
    });

    it('returns null for warmup sets', () => {
      const set: ExerciseSet = {
        set_number: 1,
        weight: 300,
        weight_unit: 'lbs',
        reps: 5,
        rpe: null,
        rest_seconds: null,
        notes: null,
        is_warmup: true,
        is_pr: false,
      };

      const result = detectPR(set, [], 'bench_press');
      expect(result).toBeNull();
    });

    it('detects a max weight PR when no existing PRs', () => {
      const set: ExerciseSet = {
        set_number: 1,
        weight: 225,
        weight_unit: 'lbs',
        reps: 5,
        rpe: 8,
        rest_seconds: null,
        notes: null,
        is_warmup: false,
        is_pr: false,
      };

      const pr = detectPR(set, [], 'bench_press');
      expect(pr).not.toBeNull();
    });
  });
});
