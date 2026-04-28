// Sprint 30: tests for the multi-tool execution loop in coachToolExecutor.

import {
  executeToolBatch,
  runToolLoop,
  MAX_TOOL_TURNS,
} from '../services/coachToolExecutor';
import { storageGet, STORAGE_KEYS, dateKey, _resetStorageListeners } from '../utils/storage';
import type { ToolUseRequest } from '../types/coach';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => {
  // @ts-expect-error global jest setup map
  global.__mockStore.clear();
  _resetStorageListeners();
});

function build(name: ToolUseRequest['name'], input: Record<string, unknown>): ToolUseRequest {
  return { toolUseId: `t_${Math.random().toString(36).slice(2)}`, name, input, status: 'pending' };
}

describe('executeToolBatch — multi-tool single-turn execution', () => {
  it('executes both tool_use blocks in a single turn', async () => {
    const tools = [
      build('log_weight', { weight_lbs: 190 }),
      build('log_body_composition', { body_fat_pct: 22.7 }),
    ];
    const results = await executeToolBatch(tools, '');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
    const weight = await storageGet<Array<{ weight_lbs: number }>>(
      dateKey(STORAGE_KEYS.LOG_BODY, today()),
    );
    const bodycomp = await storageGet<Array<{ body_fat_pct: number }>>(
      dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today()),
    );
    expect(weight![0].weight_lbs).toBe(190);
    expect(bodycomp![0].body_fat_pct).toBe(22.7);
  });

  it('errors in one tool do not break the others', async () => {
    // log_body_composition with no fields → error.
    const tools = [
      build('log_weight', { weight_lbs: 188 }),
      build('log_body_composition', {}), // invalid
      build('log_drink', { amount_oz: 8, beverage_type: 'water' }),
    ];
    const results = await executeToolBatch(tools, '');
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[2].ok).toBe(true);
    // Verify the valid writes both happened.
    const weight = await storageGet<Array<{ weight_lbs: number }>>(
      dateKey(STORAGE_KEYS.LOG_BODY, today()),
    );
    const water = await storageGet<Array<{ amount_oz: number }>>(
      dateKey(STORAGE_KEYS.LOG_WATER, today()),
    );
    expect(weight![0].weight_lbs).toBe(188);
    expect(water![0].amount_oz).toBe(8);
  });
});

describe('runToolLoop — recursion cap at MAX_TOOL_TURNS', () => {
  it('exposes MAX_TOOL_TURNS = 5', () => {
    expect(MAX_TOOL_TURNS).toBe(5);
  });

  it('caps at 5 turns when 6 sequential tools are emitted, and console.warns', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let nextTurnCalls = 0;
    // Each turn the model emits one more tool, up to 6 total turns.
    const sendNextTurn = jest.fn(async () => {
      nextTurnCalls += 1;
      // Turns 1-5 keep emitting another tool; the 6th won't be reached because
      // the loop caps before turn 6.
      if (nextTurnCalls < 6) {
        return {
          text: '',
          toolUses: [build('log_drink', { amount_oz: nextTurnCalls + 1, beverage_type: 'water' })],
          stopReason: 'tool_use',
        };
      }
      return { text: 'all done', toolUses: [], stopReason: 'end_turn' };
    });

    const result = await runToolLoop({
      initialToolUses: [build('log_drink', { amount_oz: 1, beverage_type: 'water' })],
      userMessageText: '',
      sendNextTurn,
    });

    expect(result.turns).toBe(5);
    expect(result.executions).toHaveLength(5);
    expect(result.capped).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Tool turn limit'));
    warnSpy.mockRestore();
  });

  it('exits cleanly when model stops requesting tools', async () => {
    const sendNextTurn = jest.fn(async () => ({
      text: 'final text',
      toolUses: [],
      stopReason: 'end_turn',
    }));
    const result = await runToolLoop({
      initialToolUses: [build('log_drink', { amount_oz: 8, beverage_type: 'water' })],
      userMessageText: '',
      sendNextTurn,
    });
    expect(result.turns).toBe(1);
    expect(result.executions).toHaveLength(1);
    expect(result.capped).toBe(false);
    expect(result.lastText).toBe('final text');
  });

  it('two tool_use blocks emitted in a single continuation both execute', async () => {
    let calls = 0;
    const sendNextTurn = jest.fn(async () => {
      calls++;
      if (calls === 1) {
        // Continuation emits two tool_uses in one turn
        return {
          text: '',
          toolUses: [
            build('log_drink', { amount_oz: 8, beverage_type: 'water' }),
            build('log_supplement', { supplement_name: 'vitamin D', dosage: '2000 IU' }),
          ],
          stopReason: 'tool_use',
        };
      }
      return { text: 'done', toolUses: [], stopReason: 'end_turn' };
    });

    const result = await runToolLoop({
      initialToolUses: [build('log_weight', { weight_lbs: 190 })],
      userMessageText: '',
      sendNextTurn,
    });
    expect(result.turns).toBe(2);
    expect(result.executions).toHaveLength(3); // 1 weight + 2 continuation
    const water = await storageGet<Array<{ amount_oz: number }>>(
      dateKey(STORAGE_KEYS.LOG_WATER, today()),
    );
    const supps = await storageGet<Array<{ supplement_name: string }>>(
      dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today()),
    );
    expect(water![0].amount_oz).toBe(8);
    expect(supps![0].supplement_name).toBe('vitamin D');
  });

  it('passes tool_results to sendNextTurn with the tool_use_id round-tripped', async () => {
    const initial = build('log_weight', { weight_lbs: 200 });
    const captured: Array<{ toolUseId: string; content: string }[]> = [];
    const sendNextTurn = async (results: { toolUseId: string; content: string }[]) => {
      captured.push(results);
      return { text: '', toolUses: [], stopReason: 'end_turn' };
    };
    await runToolLoop({
      initialToolUses: [initial],
      userMessageText: '',
      sendNextTurn,
    });
    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual([
      expect.objectContaining({ toolUseId: initial.toolUseId, content: expect.stringContaining('200 lbs') }),
    ]);
  });
});
