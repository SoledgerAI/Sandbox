// Sprint 31: Token usage circular buffer.
// Captures Anthropic API input/output tokens per feature so the future
// admin/diagnostics surface can report cost. Persists to AsyncStorage,
// caps at the last MAX_ENTRIES. Logging must NEVER throw or block the
// calling service — write failures are swallowed with a console.warn.

import { storageGet, storageSet, storageDelete, STORAGE_KEYS } from './storage';

export type TokenLogFeature =
  | 'wearable_scan'
  | 'scale_scan'
  | 'recipe_scan'
  | 'food_scan'
  | 'coach_chat';

export interface TokenLogEntry {
  timestamp: number;
  feature: TokenLogFeature;
  input_tokens: number;
  output_tokens: number;
}

export interface TokenLogSummary {
  total_input: number;
  total_output: number;
  by_feature: Record<TokenLogFeature, { input: number; output: number; count: number }>;
}

const MAX_ENTRIES = 1000;

const FEATURES: TokenLogFeature[] = [
  'wearable_scan',
  'scale_scan',
  'recipe_scan',
  'food_scan',
  'coach_chat',
];

function emptySummary(): TokenLogSummary {
  const by_feature = {} as Record<TokenLogFeature, { input: number; output: number; count: number }>;
  for (const f of FEATURES) {
    by_feature[f] = { input: 0, output: 0, count: 0 };
  }
  return { total_input: 0, total_output: 0, by_feature };
}

async function readBuffer(): Promise<TokenLogEntry[]> {
  try {
    const raw = await storageGet<TokenLogEntry[]>(STORAGE_KEYS.TOKEN_LOG_BUFFER);
    if (!Array.isArray(raw)) return [];
    return raw;
  } catch {
    return [];
  }
}

export async function logTokenUsage(
  entry: Omit<TokenLogEntry, 'timestamp'>,
): Promise<void> {
  try {
    const buffer = await readBuffer();
    buffer.push({ ...entry, timestamp: Date.now() });
    const trimmed = buffer.length > MAX_ENTRIES ? buffer.slice(-MAX_ENTRIES) : buffer;
    await storageSet(STORAGE_KEYS.TOKEN_LOG_BUFFER, trimmed);
  } catch (e) {
    console.warn('[token_log] failed to log usage', e);
  }
}

export async function getTokenLog(): Promise<TokenLogEntry[]> {
  return readBuffer();
}

export async function clearTokenLog(): Promise<void> {
  await storageDelete(STORAGE_KEYS.TOKEN_LOG_BUFFER);
}

export async function getTokenLogSummary(opts?: {
  sinceMs?: number;
}): Promise<TokenLogSummary> {
  const buffer = await readBuffer();
  const summary = emptySummary();
  const since = opts?.sinceMs;
  for (const e of buffer) {
    if (since != null && e.timestamp < since) continue;
    const feat = summary.by_feature[e.feature];
    if (!feat) continue;
    feat.input += e.input_tokens;
    feat.output += e.output_tokens;
    feat.count += 1;
    summary.total_input += e.input_tokens;
    summary.total_output += e.output_tokens;
  }
  return summary;
}
