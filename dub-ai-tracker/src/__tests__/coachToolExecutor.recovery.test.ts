// Sprint 31: log_recovery_metrics handler tests

import { executeTool, reverseLastTool } from '../services/coachToolExecutor';
import { storageGet, STORAGE_KEYS, dateKey } from '../utils/storage';
import type { ToolUseRequest } from '../types/coach';

function todayKey(): string {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return dateKey(STORAGE_KEYS.LOG_RECOVERY_METRICS, today);
}

function makeReq(input: Record<string, unknown>, idSuffix = '1'): ToolUseRequest {
  return {
    toolUseId: `tu_recovery_${idSuffix}`,
    name: 'log_recovery_metrics',
    input,
    status: 'pending',
    tier: 'checklist',
  };
}

describe('coachToolExecutor — log_recovery_metrics (Sprint 31)', () => {
  it('writes an entry with all fields present', async () => {
    const result = await executeTool(
      makeReq({
        sleep_score: 84,
        sleep_duration_hours: 7.5,
        hrv_ms: 52,
        body_battery: 78,
        stress_baseline: 25,
        training_readiness: 81,
        vo2_max: 50,
        resting_heart_rate: 58,
        extraction_source: 'wearable_scan',
      }),
      'wearable scan',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await storageGet<Array<Record<string, unknown>>>(todayKey());
    expect(stored).toHaveLength(1);
    const entry = stored![0];
    expect(entry).toMatchObject({
      sleep_score: 84,
      hrv_ms: 52,
      body_battery: 78,
      vo2_max: 50,
      resting_heart_rate: 58,
      extraction_source: 'wearable_scan',
    });
    expect(entry.id).toEqual(expect.stringMatching(/^coach_/));
    expect(typeof entry.timestamp).toBe('string');
  });

  it('writes an entry with a subset of fields (just one numeric + required source)', async () => {
    const result = await executeTool(
      makeReq({
        sleep_score: 90,
        extraction_source: 'text',
      }),
      'sleep was a 90',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await storageGet<Array<Record<string, unknown>>>(todayKey());
    expect(stored).toHaveLength(1);
    expect(stored![0]).toMatchObject({
      sleep_score: 90,
      hrv_ms: null,
      body_battery: null,
      extraction_source: 'text',
    });
  });

  it('returns error when no numeric fields are provided (only extraction_source)', async () => {
    const result = await executeTool(
      makeReq({ extraction_source: 'image' }),
      'recovery',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/at least one numeric field/);
  });

  it('generates unique ids across calls', async () => {
    await executeTool(
      makeReq({ sleep_score: 80, extraction_source: 'text' }, '1'),
      'a',
    );
    await executeTool(
      makeReq({ sleep_score: 81, extraction_source: 'text' }, '2'),
      'b',
    );
    const stored = await storageGet<Array<Record<string, unknown>>>(todayKey());
    expect(stored).toHaveLength(2);
    expect(stored![0].id).not.toBe(stored![1].id);
  });

  it('builds a multi-field label correctly', async () => {
    const result = await executeTool(
      makeReq({
        sleep_score: 84,
        hrv_ms: 52,
        body_battery: 78,
        extraction_source: 'wearable_scan',
      }),
      'morning',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.label).toBe('Recovery: sleep 84, HRV 52ms, body battery 78');
  });

  it('builds a single-field label correctly', async () => {
    const result = await executeTool(
      makeReq({ hrv_ms: 60, extraction_source: 'text' }),
      'hrv 60',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.label).toBe('Recovery: HRV 60ms');
  });

  it('undo via reverseLastTool removes the entry by id (restores prev array)', async () => {
    // Pre-populate with one entry
    const first = await executeTool(
      makeReq({ sleep_score: 70, extraction_source: 'text' }, 'first'),
      'first',
    );
    expect(first.ok).toBe(true);

    // Append a second entry that we'll undo
    const second = await executeTool(
      makeReq({ sleep_score: 95, extraction_source: 'text' }, 'second'),
      'second',
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    let stored = await storageGet<Array<Record<string, unknown>>>(todayKey());
    expect(stored).toHaveLength(2);

    await reverseLastTool({
      toolUseId: 'tu_recovery_second',
      toolName: 'log_recovery_metrics',
      storageKey: second.storageKey,
      prevValue: second.prevValue,
      executedAt: Date.now(),
    });

    stored = await storageGet<Array<Record<string, unknown>>>(todayKey());
    expect(stored).toHaveLength(1);
    expect(stored![0].sleep_score).toBe(70);
  });

  it("accepts extraction_source: 'wearable_scan'", async () => {
    const result = await executeTool(
      makeReq({ vo2_max: 55, extraction_source: 'wearable_scan' }),
      'wearable',
    );
    expect(result.ok).toBe(true);
    const stored = await storageGet<Array<Record<string, unknown>>>(todayKey());
    expect(stored![0].extraction_source).toBe('wearable_scan');
  });

  // S31 C2: morning scan of last night's data must land under the
  // calendar day the data represents, not the day the scan ran.
  it('files entry under input.timestamp date when timestamp is provided', async () => {
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    yesterdayDate.setHours(0, 0, 0, 0);
    const yesterdayIso = yesterdayDate.toISOString();
    const yyyy = yesterdayDate.getFullYear();
    const mm = String(yesterdayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterdayDate.getDate()).padStart(2, '0');
    const yesterdayKey = dateKey(STORAGE_KEYS.LOG_RECOVERY_METRICS, `${yyyy}-${mm}-${dd}`);

    const result = await executeTool(
      makeReq({
        sleep_score: 84,
        timestamp: yesterdayIso,
        extraction_source: 'wearable_scan',
      }),
      'morning scan',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storageKey).toBe(yesterdayKey);

    const storedYesterday = await storageGet<Array<Record<string, unknown>>>(yesterdayKey);
    expect(storedYesterday).toHaveLength(1);
    expect(storedYesterday![0]).toMatchObject({
      sleep_score: 84,
      date: `${yyyy}-${mm}-${dd}`,
      extraction_source: 'wearable_scan',
    });

    const storedToday = await storageGet<Array<Record<string, unknown>>>(todayKey());
    expect(storedToday).toBeNull();
  });

  it('falls back to today when input.timestamp is absent', async () => {
    const result = await executeTool(
      makeReq({ sleep_score: 80, extraction_source: 'text' }),
      'no timestamp',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storageKey).toBe(todayKey());
    const stored = await storageGet<Array<Record<string, unknown>>>(todayKey());
    expect(stored).toHaveLength(1);
  });

  it('falls back to today and warns when input.timestamp is malformed', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await executeTool(
        makeReq({
          sleep_score: 75,
          timestamp: 'not-a-real-date',
          extraction_source: 'text',
        }),
        'malformed',
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.storageKey).toBe(todayKey());
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[log_recovery_metrics]'),
        'not-a-real-date',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
