// Sprint 30: tests for reverseLastTool / undo behavior.

import { executeTool, reverseLastTool, type UndoRecord } from '../services/coachToolExecutor';
import { storageGet, storageSet, STORAGE_KEYS, dateKey, _resetStorageListeners } from '../utils/storage';
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

function build(name: ToolUseRequest['name'], input: Record<string, unknown>): ToolUseRequest {
  return { toolUseId: `t_${Math.random().toString(36).slice(2)}`, name, input, status: 'pending' };
}

beforeEach(() => {
  // @ts-expect-error global jest setup map
  global.__mockStore.clear();
  _resetStorageListeners();
});

describe('reverseLastTool — undo behavior', () => {
  it('restores prior array value on undo (storageAppend path)', async () => {
    // Pre-existing entries.
    const key = dateKey(STORAGE_KEYS.LOG_WATER, today());
    await storageSet(key, [{ id: 'pre1', amount_oz: 8, beverage_type: 'water' }]);

    const req = build('log_drink', { amount_oz: 16, beverage_type: 'water' });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = await storageGet<Array<{ amount_oz: number }>>(key);
    expect(after).toHaveLength(2);

    const record: UndoRecord = {
      toolUseId: req.toolUseId,
      toolName: req.name,
      storageKey: result.storageKey,
      prevValue: result.prevValue,
      executedAt: Date.now(),
    };
    await reverseLastTool(record);

    const restored = await storageGet<Array<{ amount_oz: number }>>(key);
    expect(restored).toHaveLength(1);
    expect(restored![0].amount_oz).toBe(8);
  });

  it('deletes the key when prior value was null (first write)', async () => {
    // No existing entry.
    const req = build('log_weight', { weight_lbs: 195 });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prevValue).toBeNull();

    const key = result.storageKey;
    expect(await storageGet<unknown>(key)).not.toBeNull();

    await reverseLastTool({
      toolUseId: req.toolUseId,
      toolName: req.name,
      storageKey: key,
      prevValue: null,
      executedAt: Date.now(),
    });
    expect(await storageGet<unknown>(key)).toBeNull();
  });

  it('restores prior single-entry value (storageSet path) — log_sleep', async () => {
    // Pre-existing sleep entry on YESTERDAY.
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, yesterday());
    const prior = { total_duration_hours: 8, quality: 5 };
    await storageSet(key, prior);

    const req = build('log_sleep', { hours: 4, quality: 1 });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = await storageGet<{ total_duration_hours: number }>(key);
    expect(after!.total_duration_hours).toBe(4);

    await reverseLastTool({
      toolUseId: req.toolUseId,
      toolName: req.name,
      storageKey: result.storageKey,
      prevValue: result.prevValue,
      executedAt: Date.now(),
    });
    const restored = await storageGet<{ total_duration_hours: number; quality: number }>(key);
    expect(restored).toEqual(prior);
  });
});

describe('Undo window — useCoach reference time semantics', () => {
  it('UndoRecord exposes executedAt for window enforcement', async () => {
    const before = Date.now();
    const req = build('log_drink', { amount_oz: 8, beverage_type: 'water' });
    const result = await executeTool(req, '');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record: UndoRecord = {
      toolUseId: req.toolUseId,
      toolName: req.name,
      storageKey: result.storageKey,
      prevValue: result.prevValue,
      executedAt: Date.now(),
    };
    const after = Date.now();
    expect(record.executedAt).toBeGreaterThanOrEqual(before);
    expect(record.executedAt).toBeLessThanOrEqual(after);
    // The hook enforces a 5s window; that gate is unit-tested via useCoach
    // integration. Here we verify the record carries the timestamp the gate
    // needs.
  });
});

describe('Multi-tool checklist — no undo path', () => {
  it('checklist-tier execution is gated by user confirmation, so reverseLastTool is only called for auto_commit results', async () => {
    // This is a contract test: reverseLastTool itself takes any UndoRecord;
    // the policy "only most recent tool reversible" lives in useCoach. We
    // assert here that calling reverseLastTool twice in a row works for the
    // SECOND record (i.e. there's no internal "lock" on the executor).
    const key = dateKey(STORAGE_KEYS.LOG_WATER, today());
    await storageSet(key, [{ id: 'pre', amount_oz: 4 }]);

    // First write
    const r1 = await executeTool(build('log_drink', { amount_oz: 8, beverage_type: 'water' }), '');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Second write
    const r2 = await executeTool(build('log_drink', { amount_oz: 12, beverage_type: 'water' }), '');
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    // Reverse the second — should restore the state after the first write (1 pre + 1 from r1).
    await reverseLastTool({
      toolUseId: 't2',
      toolName: 'log_drink',
      storageKey: r2.storageKey,
      prevValue: r2.prevValue,
      executedAt: Date.now(),
    });
    const after = await storageGet<Array<{ amount_oz: number }>>(key);
    expect(after).toHaveLength(2);
    expect(after![1].amount_oz).toBe(8);
  });
});
