// Sprint 30: tests for the four new Coach tools and write-through behavior.

import { executeTool } from '../services/coachToolExecutor';
import {
  storageGet,
  storageSubscribe,
  STORAGE_KEYS,
  dateKey,
  _resetStorageListeners,
} from '../utils/storage';
import type { ToolUseRequest } from '../types/coach';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function buildReq(name: ToolUseRequest['name'], input: Record<string, unknown>): ToolUseRequest {
  return { toolUseId: `t_${Math.random().toString(36).slice(2)}`, name, input, status: 'pending' };
}

beforeEach(() => {
  // @ts-expect-error global jest setup map
  global.__mockStore.clear();
  _resetStorageListeners();
});

describe('executeTool — log_body_composition', () => {
  it('writes to LOG_BODY_MEASUREMENTS with all provided fields', async () => {
    const req = buildReq('log_body_composition', {
      body_fat_pct: 22.7,
      skeletal_muscle_lbs: 76.2,
      bmi: 26.4,
      visceral_fat_rating: 7,
    });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await storageGet<Array<Record<string, unknown>>>(
      dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today()),
    );
    expect(stored).toBeTruthy();
    expect(stored!).toHaveLength(1);
    expect(stored![0]).toMatchObject({
      body_fat_pct: 22.7,
      skeletal_muscle_lbs: 76.2,
      bmi: 26.4,
      visceral_fat_rating: 7,
      source: 'coach',
    });
  });

  it('defaults source to "coach" when omitted', async () => {
    const req = buildReq('log_body_composition', { body_fat_pct: 20 });
    await executeTool(req, '');
    const stored = await storageGet<Array<{ source: string }>>(
      dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today()),
    );
    expect(stored![0].source).toBe('coach');
  });

  it('respects an explicit source string', async () => {
    const req = buildReq('log_body_composition', { body_fat_pct: 20, source: 'garmin_scale_photo' });
    await executeTool(req, '');
    const stored = await storageGet<Array<{ source: string }>>(
      dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today()),
    );
    expect(stored![0].source).toBe('garmin_scale_photo');
  });

  it('returns a tool error and writes nothing when all fields are undefined', async () => {
    const req = buildReq('log_body_composition', {});
    const result = await executeTool(req, '');
    expect(result.ok).toBe(false);
    const stored = await storageGet<unknown[]>(dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today()));
    expect(stored).toBeNull();
  });
});

describe('executeTool — log_sleep', () => {
  it('writes to YESTERDAY\'s LOG_SLEEP key by default', async () => {
    const req = buildReq('log_sleep', { hours: 7.5, quality: 4 });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(true);
    const yesterdayEntry = await storageGet<Record<string, unknown>>(
      dateKey(STORAGE_KEYS.LOG_SLEEP, yesterday()),
    );
    const todayEntry = await storageGet<unknown>(dateKey(STORAGE_KEYS.LOG_SLEEP, today()));
    expect(yesterdayEntry).toBeTruthy();
    expect(todayEntry).toBeNull();
    expect(yesterdayEntry).toMatchObject({
      total_duration_hours: 7.5,
      quality: 4,
      source: 'coach',
    });
  });

  it('returns an error when hours is missing', async () => {
    const req = buildReq('log_sleep', { quality: 3 });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(false);
  });
});

describe('executeTool — log_mood', () => {
  it('writes to today\'s LOG_MOOD_MENTAL key', async () => {
    const req = buildReq('log_mood', { mood_rating: 4, stress_level: 2, note: 'feeling good' });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(true);
    const stored = await storageGet<Record<string, unknown>>(
      dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today()),
    );
    expect(stored).toMatchObject({
      stress_level: 2,
      notes: 'feeling good',
      date: today(),
    });
    // mood_rating is 1-5; storage uses 1-10 overall_mood
    expect(stored!.overall_mood).toBe(8);
  });

  it('writes to LOG_MOOD_MENTAL not legacy LOG_MOOD', async () => {
    const req = buildReq('log_mood', { mood_rating: 3 });
    await executeTool(req, '');
    const mental = await storageGet<unknown>(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today()));
    const legacy = await storageGet<unknown>(dateKey(STORAGE_KEYS.LOG_MOOD, today()));
    expect(mental).not.toBeNull();
    expect(legacy).toBeNull();
  });
});

describe('executeTool — log_substance', () => {
  it('writes to today\'s LOG_SUBSTANCES with source attribution', async () => {
    const req = buildReq('log_substance', {
      category: 'alcohol',
      amount: 12,
      unit: 'oz',
      method: 'beverage',
      note: 'one beer',
    });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(true);
    const stored = await storageGet<Array<Record<string, unknown>>>(
      dateKey(STORAGE_KEYS.LOG_SUBSTANCES, today()),
    );
    expect(stored).toHaveLength(1);
    expect(stored![0]).toMatchObject({
      substance: 'alcohol',
      amount: 12,
      unit: 'oz',
      notes: 'one beer',
      source: 'coach',
    });
  });

  it('rejects when category missing', async () => {
    const req = buildReq('log_substance', { amount: 1 });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(false);
  });
});

describe('Storage pub/sub — Sprint 30 tool writes', () => {
  it('log_body_composition fires the storage subscriber', async () => {
    const listener = jest.fn();
    const unsub = storageSubscribe(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, listener, { prefix: true });
    const req = buildReq('log_body_composition', { body_fat_pct: 22 });
    await executeTool(req, '');
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('log_sleep fires the storage subscriber', async () => {
    const listener = jest.fn();
    const unsub = storageSubscribe(STORAGE_KEYS.LOG_SLEEP, listener, { prefix: true });
    await executeTool(buildReq('log_sleep', { hours: 7 }), '');
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('log_mood fires the storage subscriber', async () => {
    const listener = jest.fn();
    const unsub = storageSubscribe(STORAGE_KEYS.LOG_MOOD_MENTAL, listener, { prefix: true });
    await executeTool(buildReq('log_mood', { mood_rating: 4 }), '');
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('log_substance fires the storage subscriber', async () => {
    const listener = jest.fn();
    const unsub = storageSubscribe(STORAGE_KEYS.LOG_SUBSTANCES, listener, { prefix: true });
    await executeTool(buildReq('log_substance', { category: 'cannabis' }), '');
    expect(listener).toHaveBeenCalled();
    unsub();
  });
});

describe('Existing tools still write correctly', () => {
  it('log_drink writes to LOG_WATER', async () => {
    await executeTool(buildReq('log_drink', { amount_oz: 16, beverage_type: 'water' }), '');
    const stored = await storageGet<Array<{ amount_oz: number }>>(dateKey(STORAGE_KEYS.LOG_WATER, today()));
    expect(stored![0].amount_oz).toBe(16);
  });

  it('log_weight writes to LOG_BODY', async () => {
    await executeTool(buildReq('log_weight', { weight_lbs: 192.5 }), '');
    const stored = await storageGet<Array<{ weight_lbs: number }>>(dateKey(STORAGE_KEYS.LOG_BODY, today()));
    expect(stored![0].weight_lbs).toBe(192.5);
  });
});
