// Sprint 31: Wearable screenshot scanner.
// Reads a Garmin / Oura / WHOOP morning-report screenshot and extracts
// recovery metrics (sleep score, HRV, body battery, etc). Mirrors the
// scaleScanService structure: caller passes pre-stripped base64 + mime,
// service fetches its own API key, returns a discriminated result.
//
// Two intentional differences from sibling scan services:
//   1. ok:true variant returns `usage` so callers can surface token cost
//   2. ok:true variant returns `fieldFlags` keyed by bare field name so
//      Commit-2 can decorate the confirmation card with confidence /
//      range warnings.

import { getApiKey, AnthropicError } from './anthropic';
import { logTokenUsage } from '../utils/tokenLog';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const SCAN_MODEL = 'claude-sonnet-4-20250514';

export type Confidence = 'high' | 'medium' | 'low';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface WearableField {
  value: number;
  confidence: Confidence;
}

export interface WearableScanData {
  sleep_score?: WearableField;
  sleep_duration_hours?: WearableField;
  hrv_ms?: WearableField;
  body_battery?: WearableField;
  stress_baseline?: WearableField;
  training_readiness?: WearableField;
  vo2_max?: WearableField;
  resting_heart_rate?: WearableField;
  fields_extracted: string[];
}

export type WearableFieldFlag = 'low_confidence' | 'out_of_range';

export interface WearableScanSuccess {
  ok: true;
  data: WearableScanData;
  usage: TokenUsage;
  fieldFlags?: Record<string, WearableFieldFlag>;
}

export interface WearableScanFailure {
  ok: false;
  error: string;
  code?: string;
}

export type WearableScanResult = WearableScanSuccess | WearableScanFailure;

const SCANNABLE_FIELDS = [
  'sleep_score',
  'sleep_duration_hours',
  'hrv_ms',
  'body_battery',
  'stress_baseline',
  'training_readiness',
  'vo2_max',
  'resting_heart_rate',
] as const;

type ScannableField = (typeof SCANNABLE_FIELDS)[number];

const FIELD_RANGES: Record<ScannableField, { min: number; max: number }> = {
  sleep_score: { min: 0, max: 100 },
  sleep_duration_hours: { min: 0, max: 14 },
  hrv_ms: { min: 5, max: 200 },
  body_battery: { min: 0, max: 100 },
  stress_baseline: { min: 0, max: 100 },
  training_readiness: { min: 0, max: 100 },
  vo2_max: { min: 15, max: 90 },
  resting_heart_rate: { min: 30, max: 120 },
};

const SYSTEM_PROMPT = `You are reading a wearable device morning-report screenshot (Garmin Connect, Oura, or WHOOP).

Extract any of these fields you can read clearly:
  sleep_score (0-100)
  sleep_duration_hours (e.g. 7.5)
  hrv_ms (heart rate variability in milliseconds)
  body_battery (0-100, Garmin metric)
  stress_baseline (0-100)
  training_readiness (0-100)
  vo2_max
  resting_heart_rate

Respond with ONLY a JSON object, no markdown fences, no prose:
{
  "sleep_score": { "value": 84, "confidence": "high" },
  "hrv_ms": { "value": 52, "confidence": "medium" },
  ...other fields you read...
  "fields_extracted": ["sleep_score", "hrv_ms"]
}

For each field include a "confidence" of "high", "medium", or "low".
OMIT fields you cannot read — do NOT include null values.
Always include "fields_extracted" listing the field names you returned.

If the image is not a wearable report or you cannot read any field, respond:
{ "fields_extracted": [] }`;

export async function scanWearableScreenshot(
  base64: string,
  mimeType: string = 'image/jpeg',
): Promise<WearableScanResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new AnthropicError(
      'API key not configured. Add your Anthropic API key in Settings.',
      undefined,
      'NO_API_KEY',
    );
  }

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: SCAN_MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: base64 },
              },
              {
                type: 'text',
                text: 'Extract recovery metrics from this wearable screenshot. Return only the JSON described in the system prompt.',
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });
  } catch {
    return { ok: false, error: 'Unable to reach the Anthropic API.', code: 'network_error' };
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new AnthropicError('Invalid API key.', status, 'INVALID_KEY');
    if (status === 429) throw new AnthropicError('Rate limited. Try again shortly.', status, 'RATE_LIMITED');
    if (status === 529) throw new AnthropicError('API temporarily overloaded. Try again shortly.', status, 'OVERLOADED');
    throw new AnthropicError(`Wearable scan failed (${status})`, status, 'API_ERROR');
  }

  const responseJson = await response.json();
  const textBlock = responseJson.content?.find(
    (b: { type: string; text?: string }) => b.type === 'text',
  );
  if (!textBlock?.text) {
    return { ok: false, error: 'Empty response from API', code: 'parse_error' };
  }

  const parsed = parseWearableResponse(textBlock.text);
  if (!parsed.ok) return parsed;

  const usage: TokenUsage = {
    input_tokens: responseJson.usage?.input_tokens ?? 0,
    output_tokens: responseJson.usage?.output_tokens ?? 0,
  };

  const fieldFlags = buildFieldFlags(parsed.data);

  // Token logging MUST NOT fail the scan.
  try {
    await logTokenUsage({
      feature: 'wearable_scan',
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    });
  } catch (e) {
    console.warn('[token_log] failed to log usage', e);
  }

  const result: WearableScanSuccess = {
    ok: true,
    data: parsed.data,
    usage,
  };
  if (Object.keys(fieldFlags).length > 0) {
    result.fieldFlags = fieldFlags;
  }
  return result;
}

/** Exported so the parse logic can be unit-tested without the network. */
export function parseWearableResponse(
  raw: string,
): { ok: true; data: WearableScanData } | WearableScanFailure {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    jsonStr = fence[1].trim();
  } else {
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end > start) {
      jsonStr = jsonStr.slice(start, end + 1);
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: 'Could not parse wearable response', code: 'parse_error' };
  }

  const data: WearableScanData = { fields_extracted: [] };
  const extracted = new Set<string>();
  for (const f of SCANNABLE_FIELDS) {
    const raw = parsed[f] as { value?: unknown; confidence?: unknown } | undefined;
    if (!raw || typeof raw !== 'object') continue;
    const value = Number(raw.value);
    if (!Number.isFinite(value)) continue;
    const confidence = normalizeConfidence(raw.confidence);
    data[f] = { value, confidence };
    extracted.add(f);
  }

  // Trust the model's fields_extracted if present, else use what we parsed.
  if (Array.isArray(parsed.fields_extracted)) {
    data.fields_extracted = parsed.fields_extracted
      .filter((s): s is string => typeof s === 'string')
      .filter((s) => extracted.has(s));
  } else {
    data.fields_extracted = [...extracted];
  }

  return { ok: true, data };
}

function normalizeConfidence(v: unknown): Confidence {
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return 'low';
}

/**
 * Build a flag map keyed by BARE field name. 'out_of_range' takes precedence
 * over 'low_confidence' when both apply. The Commit-2 caller transforms
 * these bare keys into ${toolUseId}.${fieldKey} for the confirmation card.
 */
function buildFieldFlags(data: WearableScanData): Record<string, WearableFieldFlag> {
  const flags: Record<string, WearableFieldFlag> = {};
  for (const f of SCANNABLE_FIELDS) {
    const field = data[f];
    if (!field) continue;
    const range = FIELD_RANGES[f];
    if (field.value < range.min || field.value > range.max) {
      flags[f] = 'out_of_range';
    } else if (field.confidence === 'low') {
      flags[f] = 'low_confidence';
    }
  }
  return flags;
}
