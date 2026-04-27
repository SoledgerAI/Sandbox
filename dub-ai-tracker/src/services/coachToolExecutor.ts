// Sprint 30: Coach tool executor
// Pure storage write-through, tool-batch execution, recursive multi-tool loop, and undo.
// Extracted from useCoach.ts so the logic is unit-testable without React.

import { storageGet, storageSet, storageDelete, storageAppend, STORAGE_KEYS, dateKey } from '../utils/storage';
import { logFeedback } from '../utils/feedbackLog';
import type { CoachToolName, ToolUseRequest } from '../types/coach';

export const MAX_TOOL_TURNS = 5;

export type ExecuteToolSuccess = {
  ok: true;
  label: string;
  storageKey: string;
  prevValue: unknown;
};
export type ExecuteToolFailure = { ok: false; error: string };
export type ExecuteToolResult = ExecuteToolSuccess | ExecuteToolFailure;

export interface UndoRecord {
  toolUseId: string;
  toolName: CoachToolName;
  storageKey: string;
  prevValue: unknown;
  executedAt: number;
}

function genId(): string {
  return `coach_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Sleep is reported in the morning for the previous night, so by default
// log_sleep writes to YESTERDAY's date key. This matches how SleepLogger
// presents the day's "last night" entry.
function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export async function executeTool(
  toolReq: ToolUseRequest,
  userMessageText: string,
): Promise<ExecuteToolResult> {
  const today = todayString();
  const input = toolReq.input;
  const sourceTag = (str(input.source) ?? 'coach');

  try {
    switch (toolReq.name) {
      case 'log_drink': {
        const key = dateKey(STORAGE_KEYS.LOG_WATER, today);
        const prev = await storageGet<unknown[]>(key);
        const beverage = str(input.beverage_type) ?? 'water';
        const amount = num(input.amount_oz);
        await storageAppend(key, {
          id: genId(),
          timestamp: str(input.timestamp) ?? new Date().toISOString(),
          amount_oz: amount,
          beverage_type: beverage,
          source: sourceTag,
        });
        return { ok: true, label: `${amount ?? '?'} oz ${beverage}`, storageKey: key, prevValue: prev };
      }

      case 'log_food': {
        const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
        const prev = await storageGet<unknown[]>(key);
        const name = str(input.food_name) ?? 'meal';
        const cal = num(input.calories);
        await storageAppend(key, {
          id: genId(),
          timestamp: str(input.timestamp) ?? new Date().toISOString(),
          name,
          meal_type: str(input.meal_type) ?? 'snack',
          calories: cal ?? 0,
          protein_g: num(input.protein_g) ?? 0,
          carbs_g: num(input.carbs_g) ?? 0,
          fat_g: num(input.fat_g) ?? 0,
          source: sourceTag,
        });
        return { ok: true, label: `${name}${cal != null ? ` (${cal} cal)` : ''}`, storageKey: key, prevValue: prev };
      }

      case 'log_weight': {
        const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
        const prev = await storageGet<unknown[]>(key);
        const weight = num(input.weight_lbs);
        if (weight == null) return { ok: false, error: 'weight_lbs missing' };
        await storageAppend(key, {
          id: genId(),
          timestamp: str(input.timestamp) ?? new Date().toISOString(),
          weight_lbs: weight,
          source: sourceTag,
        });
        return { ok: true, label: `${weight} lbs`, storageKey: key, prevValue: prev };
      }

      case 'log_exercise': {
        const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, today);
        const prev = await storageGet<unknown[]>(key);
        const exType = str(input.exercise_type) ?? 'workout';
        const dur = num(input.duration_minutes);
        await storageAppend(key, {
          id: genId(),
          timestamp: str(input.timestamp) ?? new Date().toISOString(),
          exercise_type: exType,
          duration_minutes: dur,
          calories_burned: num(input.calories_burned) ?? 0,
          distance_miles: num(input.distance_miles),
          source: sourceTag,
        });
        return { ok: true, label: `${exType} — ${dur ?? '?'} min`, storageKey: key, prevValue: prev };
      }

      case 'log_supplement': {
        const key = dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today);
        const prev = await storageGet<unknown[]>(key);
        const name = str(input.supplement_name) ?? 'supplement';
        const dosage = str(input.dosage) ?? '';
        await storageAppend(key, {
          id: genId(),
          timestamp: str(input.timestamp) ?? new Date().toISOString(),
          supplement_name: name,
          dosage,
          source: sourceTag,
        });
        return { ok: true, label: `${name}${dosage ? ` ${dosage}` : ''}`, storageKey: key, prevValue: prev };
      }

      case 'log_feedback': {
        // Feedback log uses a dedicated helper; no undo path (feedback is one-way).
        await logFeedback({
          type: (str(input.type) as 'bug' | 'feature_request' | 'question' | null) ?? 'question',
          description: str(input.description) ?? '',
          screen: str(input.screen) ?? '',
          userMessage: userMessageText,
        });
        return {
          ok: true,
          label: `${str(input.type) ?? 'question'}: ${str(input.description) ?? ''}`,
          storageKey: STORAGE_KEYS.FEEDBACK_LOG,
          prevValue: null,
        };
      }

      // Sprint 30: body composition (smart-scale screenshot)
      case 'log_body_composition': {
        const fields = {
          body_fat_pct: num(input.body_fat_pct),
          skeletal_muscle_lbs: num(input.skeletal_muscle_lbs),
          bone_mass_lbs: num(input.bone_mass_lbs),
          bmi: num(input.bmi),
          visceral_fat_rating: num(input.visceral_fat_rating),
          body_water_pct: num(input.body_water_pct),
          metabolic_age_years: num(input.metabolic_age_years),
        };
        const hasAny = Object.values(fields).some((v) => v != null);
        if (!hasAny) return { ok: false, error: 'log_body_composition requires at least one numeric field' };
        const key = dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today);
        const prev = await storageGet<unknown[]>(key);
        await storageAppend(key, {
          id: genId(),
          timestamp: new Date().toISOString(),
          date: today,
          ...fields,
          source: sourceTag,
        });
        const labelParts: string[] = [];
        if (fields.body_fat_pct != null) labelParts.push(`BF ${fields.body_fat_pct}%`);
        if (fields.skeletal_muscle_lbs != null) labelParts.push(`SMM ${fields.skeletal_muscle_lbs} lbs`);
        if (fields.bmi != null) labelParts.push(`BMI ${fields.bmi}`);
        return {
          ok: true,
          label: labelParts.length > 0 ? `Body comp: ${labelParts.join(', ')}` : 'Body composition logged',
          storageKey: key,
          prevValue: prev,
        };
      }

      // Sprint 30: sleep — single-entry-per-day, default to YESTERDAY's date
      case 'log_sleep': {
        const hours = num(input.hours);
        if (hours == null) return { ok: false, error: 'log_sleep requires hours' };
        const date = yesterdayString();
        const key = dateKey(STORAGE_KEYS.LOG_SLEEP, date);
        const prev = await storageGet<unknown>(key);
        const quality = num(input.quality);
        const wakeCount = num(input.wake_count);
        const entry = {
          bedtime: str(input.bedtime) ? `${date}T${input.bedtime as string}:00` : null,
          wake_time: str(input.wake_time) ? `${date}T${input.wake_time as string}:00` : null,
          quality,
          bathroom_trips: null,
          alarm_used: null,
          time_to_fall_asleep_min: null,
          notes: null,
          device_data: null,
          source: sourceTag,
          total_duration_hours: hours,
          wake_ups: wakeCount,
          disturbances: [],
          sleep_aids_used: [],
          nap: false,
        };
        await storageSet(key, entry);
        return { ok: true, label: `${hours}h sleep`, storageKey: key, prevValue: prev };
      }

      // Sprint 30: mood — single-entry-per-day
      case 'log_mood': {
        const moodRating = num(input.mood_rating);
        if (moodRating == null) return { ok: false, error: 'log_mood requires mood_rating' };
        const key = dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today);
        const prev = await storageGet<unknown>(key);
        const stress = num(input.stress_level);
        const note = str(input.note);
        const triggers = Array.isArray(input.triggers) ? (input.triggers as string[]).filter((t) => typeof t === 'string') : [];
        const entry = {
          id: genId(),
          timestamp: new Date().toISOString(),
          date: today,
          overall_mood: Math.max(1, Math.min(10, moodRating * 2)),
          energy_level: 3,
          anxiety_level: 1,
          stress_level: stress ?? 1,
          mental_clarity: 3,
          emotions: [],
          triggers,
          trigger_other_text: null,
          coping_used: [],
          coping_other_text: null,
          sleep_quality_last_night: null,
          notes: note ? note.slice(0, 280) : null,
          source: sourceTag,
        };
        await storageSet(key, entry);
        return { ok: true, label: `Mood ${moodRating}/5`, storageKey: key, prevValue: prev };
      }

      // Sprint 30: substance — append to array. Sensitive; tier router gates this.
      case 'log_substance': {
        const category = str(input.category);
        if (category == null) return { ok: false, error: 'log_substance requires category' };
        const key = dateKey(STORAGE_KEYS.LOG_SUBSTANCES, today);
        const prev = await storageGet<unknown[]>(key);
        const amount = num(input.amount);
        const unit = str(input.unit);
        const method = str(input.method);
        await storageAppend(key, {
          id: genId(),
          timestamp: new Date().toISOString(),
          substance: category,
          amount: amount ?? 0,
          unit: unit ?? '',
          alcohol_type: null,
          cannabis_method: category === 'cannabis' ? method : null,
          hemp_method: category === 'hemp' ? method : null,
          thc_mg: null,
          cbd_mg: null,
          calories: null,
          notes: str(input.note) ? (input.note as string).slice(0, 280) : null,
          terpenes: null,
          strain_name: null,
          source: sourceTag,
        });
        return {
          ok: true,
          label: `${category}${amount != null ? ` ${amount}${unit ?? ''}` : ''}`,
          storageKey: key,
          prevValue: prev,
        };
      }

      // Sprint 31: wearable-derived recovery metrics
      case 'log_recovery_metrics': {
        const fields = {
          sleep_score: num(input.sleep_score),
          sleep_duration_hours: num(input.sleep_duration_hours),
          hrv_ms: num(input.hrv_ms),
          body_battery: num(input.body_battery),
          stress_baseline: num(input.stress_baseline),
          training_readiness: num(input.training_readiness),
          vo2_max: num(input.vo2_max),
          resting_heart_rate: num(input.resting_heart_rate),
        };
        const hasAny = Object.values(fields).some((v) => v != null);
        if (!hasAny) return { ok: false, error: 'log_recovery_metrics requires at least one numeric field' };
        const key = dateKey(STORAGE_KEYS.LOG_RECOVERY_METRICS, today);
        const prev = await storageGet<unknown[]>(key);
        await storageAppend(key, {
          id: genId(),
          timestamp: str(input.timestamp) ?? new Date().toISOString(),
          date: today,
          ...fields,
          extraction_source: str(input.extraction_source) ?? 'text',
          source: sourceTag,
        });
        const labelParts: string[] = [];
        if (fields.sleep_score != null) labelParts.push(`sleep ${fields.sleep_score}`);
        if (fields.hrv_ms != null) labelParts.push(`HRV ${fields.hrv_ms}ms`);
        if (fields.body_battery != null) labelParts.push(`body battery ${fields.body_battery}`);
        if (fields.training_readiness != null) labelParts.push(`readiness ${fields.training_readiness}`);
        if (fields.vo2_max != null) labelParts.push(`VO2 ${fields.vo2_max}`);
        if (fields.resting_heart_rate != null) labelParts.push(`RHR ${fields.resting_heart_rate}`);
        if (fields.sleep_duration_hours != null && fields.sleep_score == null) {
          labelParts.push(`${fields.sleep_duration_hours}h sleep`);
        }
        if (fields.stress_baseline != null) labelParts.push(`stress ${fields.stress_baseline}`);
        return {
          ok: true,
          label: labelParts.length > 0 ? `Recovery: ${labelParts.join(', ')}` : 'Recovery logged',
          storageKey: key,
          prevValue: prev,
        };
      }

      default: {
        const _exhaustive: never = toolReq.name;
        return { ok: false, error: `Unknown tool: ${String(_exhaustive)}` };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Coach] Tool execution failed:', msg);
    }
    return { ok: false, error: msg };
  }
}

/**
 * Execute a batch of tool requests sequentially. Errors in one tool do not
 * abort the others — each is captured in its own result. Sequential (rather
 * than parallel) so that two appends to the same key don't race the lock
 * unnecessarily.
 */
export async function executeToolBatch(
  tools: ToolUseRequest[],
  userMessageText: string,
): Promise<ExecuteToolResult[]> {
  const out: ExecuteToolResult[] = [];
  for (const t of tools) {
    out.push(await executeTool(t, userMessageText));
  }
  return out;
}

/**
 * Reverse the most recent successful tool execution.
 * - If prevValue was null (key did not exist before), delete the key.
 * - Otherwise, restore prevValue via storageSet (works for both array
 *   appends and single-entry sets).
 */
export async function reverseLastTool(record: UndoRecord): Promise<void> {
  if (record.prevValue == null) {
    await storageDelete(record.storageKey);
  } else {
    await storageSet(record.storageKey, record.prevValue);
  }
}

export interface RunToolLoopParams {
  initialToolUses: ToolUseRequest[];
  userMessageText: string;
  /** Send tool results back and return the model's next turn. */
  sendNextTurn: (toolResults: { toolUseId: string; content: string }[]) => Promise<{
    text: string;
    toolUses: ToolUseRequest[];
    stopReason: string;
  }>;
  maxTurns?: number;
  onTurnComplete?: (turn: number, results: ExecuteToolResult[]) => void;
}

export interface RunToolLoopResult {
  executions: ExecuteToolResult[];
  turns: number;
  capped: boolean;
  lastText: string;
}

/**
 * Drive multi-turn tool execution: execute the current batch, send results
 * back, and recurse until the model stops requesting tools or the cap is hit.
 */
export async function runToolLoop(params: RunToolLoopParams): Promise<RunToolLoopResult> {
  const max = params.maxTurns ?? MAX_TOOL_TURNS;
  let currentBatch = params.initialToolUses;
  const executions: ExecuteToolResult[] = [];
  let turns = 0;
  let capped = false;
  let lastText = '';

  while (currentBatch.length > 0) {
    if (turns >= max) {
      capped = true;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Coach] Tool turn limit reached');
      }
      break;
    }

    const batchResults = await executeToolBatch(currentBatch, params.userMessageText);
    for (const r of batchResults) executions.push(r);
    turns++;
    params.onTurnComplete?.(turns, batchResults);

    const toolResults = currentBatch.map((t, i) => {
      const r = batchResults[i];
      return {
        toolUseId: t.toolUseId,
        content: r.ok ? `Logged: ${r.label}` : `Error: ${r.error}`,
      };
    });

    const next = await params.sendNextTurn(toolResults);
    lastText = next.text;
    if (next.stopReason !== 'tool_use' || next.toolUses.length === 0) break;
    currentBatch = next.toolUses;
  }

  return { executions, turns, capped, lastText };
}
