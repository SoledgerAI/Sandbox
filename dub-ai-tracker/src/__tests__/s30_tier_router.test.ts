// Sprint 30: tests for the classifyTier pure-function router.

import { classifyTier } from '../services/coachToolRouter';

describe('classifyTier — Sprint 30', () => {
  it('returns auto_commit for a single-field text-derived call', () => {
    expect(
      classifyTier({
        toolName: 'log_drink',
        toolInput: { amount_oz: 16 },
        userMessageHadImage: false,
        userMessageText: 'I drank 16 oz of water',
      }),
    ).toBe('auto_commit');
  });

  it('returns auto_commit for a two-field text-derived call (under threshold)', () => {
    expect(
      classifyTier({
        toolName: 'log_drink',
        toolInput: { amount_oz: 16, beverage_type: 'water' },
        userMessageHadImage: false,
        userMessageText: 'I drank 16 oz of water',
      }),
    ).toBe('auto_commit');
  });

  it('returns checklist when an image was attached', () => {
    expect(
      classifyTier({
        toolName: 'log_weight',
        toolInput: { weight_lbs: 195 },
        userMessageHadImage: true,
        userMessageText: '',
      }),
    ).toBe('checklist');
  });

  it('returns checklist when 3+ meaningful fields are present', () => {
    expect(
      classifyTier({
        toolName: 'log_body_composition',
        toolInput: { body_fat_pct: 22, skeletal_muscle_lbs: 76, bmi: 26 },
        userMessageHadImage: false,
        userMessageText: 'My scale: 22% bf, 76 lbs muscle, BMI 26',
      }),
    ).toBe('checklist');
  });

  it('does NOT count source / extraction_source / timestamp as meaningful fields', () => {
    expect(
      classifyTier({
        toolName: 'log_drink',
        toolInput: {
          amount_oz: 16,
          source: 'coach',
          extraction_source: 'user_text',
          timestamp: '2026-04-27T10:00:00Z',
        },
        userMessageHadImage: false,
        userMessageText: 'water',
      }),
    ).toBe('auto_commit');
  });

  it('returns explicit for log_substance alcohol from image_vision', () => {
    expect(
      classifyTier({
        toolName: 'log_substance',
        toolInput: { category: 'alcohol', extraction_source: 'image_vision' },
        userMessageHadImage: true,
        userMessageText: '',
      }),
    ).toBe('explicit');
  });

  it('returns explicit for log_substance cannabis from image_vision', () => {
    expect(
      classifyTier({
        toolName: 'log_substance',
        toolInput: { category: 'cannabis', extraction_source: 'image_vision' },
        userMessageHadImage: true,
        userMessageText: '',
      }),
    ).toBe('explicit');
  });

  it('does NOT escalate log_substance tobacco from image to explicit (only alcohol/cannabis)', () => {
    // Tobacco is sensitive but not in the explicit list — falls through to checklist.
    expect(
      classifyTier({
        toolName: 'log_substance',
        toolInput: { category: 'tobacco', extraction_source: 'image_vision' },
        userMessageHadImage: true,
        userMessageText: '',
      }),
    ).toBe('checklist');
  });

  it('treats text-only substance logging as auto_commit when single-field', () => {
    expect(
      classifyTier({
        toolName: 'log_substance',
        toolInput: { category: 'alcohol' },
        userMessageHadImage: false,
        userMessageText: 'log a beer',
      }),
    ).toBe('auto_commit');
  });

  it('defaults extractionSource to image_vision when image attached and not specified', () => {
    // Substance + alcohol + image with no explicit extraction_source on input should still
    // hit the explicit rule because the router infers image_vision.
    expect(
      classifyTier({
        toolName: 'log_substance',
        toolInput: { category: 'alcohol' },
        userMessageHadImage: true,
        userMessageText: '',
      }),
    ).toBe('explicit');
  });

  it('defaults extractionSource to user_text when no image and not specified', () => {
    // Alcohol substance, text-only — auto_commit (single field, no image).
    expect(
      classifyTier({
        toolName: 'log_substance',
        toolInput: { category: 'alcohol' },
        userMessageHadImage: false,
        userMessageText: 'one beer',
      }),
    ).toBe('auto_commit');
  });

  it('respects an explicit extractionSource override on the call', () => {
    // Caller can override via the dedicated parameter.
    expect(
      classifyTier({
        toolName: 'log_substance',
        toolInput: { category: 'alcohol' },
        userMessageHadImage: true,
        userMessageText: '',
        extractionSource: 'user_text',
      }),
    ).toBe('checklist'); // image attached → checklist; user_text avoids explicit
  });

  it('classifies a single-field non-substance log_food as auto_commit', () => {
    expect(
      classifyTier({
        toolName: 'log_food',
        toolInput: { food_name: 'apple' },
        userMessageHadImage: false,
        userMessageText: 'just an apple',
      }),
    ).toBe('auto_commit');
  });

  it('classifies a 4-field food log as checklist', () => {
    expect(
      classifyTier({
        toolName: 'log_food',
        toolInput: {
          food_name: 'oatmeal w/ berries',
          calories: 320,
          protein_g: 12,
          carbs_g: 58,
        },
        userMessageHadImage: false,
        userMessageText: 'I had oatmeal with berries',
      }),
    ).toBe('checklist');
  });

  it('ignores empty strings and empty arrays when counting fields', () => {
    expect(
      classifyTier({
        toolName: 'log_mood',
        toolInput: { mood_rating: 4, note: '', triggers: [] },
        userMessageHadImage: false,
        userMessageText: 'feeling 4/5',
      }),
    ).toBe('auto_commit');
  });

  // ---------------------------------------------------------------------------
  // Sprint 31 — log_recovery_metrics tier rules
  // ---------------------------------------------------------------------------

  it("classifies log_recovery_metrics with extraction_source 'wearable_scan' as checklist", () => {
    expect(
      classifyTier({
        toolName: 'log_recovery_metrics',
        toolInput: { sleep_score: 84, extraction_source: 'wearable_scan' },
        userMessageHadImage: false,
        userMessageText: 'wearable scan',
      }),
    ).toBe('checklist');
  });

  it("classifies log_recovery_metrics with extraction_source 'image' as checklist", () => {
    expect(
      classifyTier({
        toolName: 'log_recovery_metrics',
        toolInput: { sleep_score: 84, extraction_source: 'image' },
        userMessageHadImage: true,
        userMessageText: '',
      }),
    ).toBe('checklist');
  });

  it("classifies log_recovery_metrics with text + 1 field as auto_commit", () => {
    expect(
      classifyTier({
        toolName: 'log_recovery_metrics',
        toolInput: { sleep_score: 84, extraction_source: 'text' },
        userMessageHadImage: false,
        userMessageText: 'sleep score 84',
      }),
    ).toBe('auto_commit');
  });

  it("classifies log_recovery_metrics with text + 4 fields as checklist (existing 3+ rule)", () => {
    expect(
      classifyTier({
        toolName: 'log_recovery_metrics',
        toolInput: {
          sleep_score: 84,
          hrv_ms: 52,
          body_battery: 78,
          training_readiness: 81,
          extraction_source: 'text',
        },
        userMessageHadImage: false,
        userMessageText: 'sleep 84, hrv 52, battery 78, readiness 81',
      }),
    ).toBe('checklist');
  });
});
