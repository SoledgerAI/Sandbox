// Scale photo scanning via Claude Vision API
// TF-09: Read a bathroom/body-composition scale display and extract the
// weight reading (and any additional metrics like body fat) to pre-fill
// the weight logger. Mirrors the foodScanService pattern.

import { getApiKey, AnthropicError } from './anthropic';
import { logTokenUsage } from '../utils/tokenLog';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
// Sonnet for vision — fast, cost-effective, and reads small digits well.
const SCAN_MODEL = 'claude-sonnet-4-20250514';

export interface ScaleAdditionalMetrics {
  body_fat_pct: number | null;
  muscle_mass: number | null;
  water_pct: number | null;
  bone_mass: number | null;
  bmi: number | null;
}

export interface ScaleScanSuccess {
  ok: true;
  weight: number;
  unit: 'lbs' | 'kg';
  confidence: 'high' | 'medium' | 'low';
  additionalMetrics: ScaleAdditionalMetrics;
  device: string;
}

export interface ScaleScanFailure {
  ok: false;
  error: string;
}

export type ScaleScanResult = ScaleScanSuccess | ScaleScanFailure;

const SYSTEM_PROMPT = `You are a scale reading assistant. The user has photographed a bathroom scale, kitchen scale, or body composition device. Extract the weight reading from the display.

Respond ONLY with a JSON object:
{
  "weight": <number>,
  "unit": "lbs" | "kg",
  "confidence": "high" | "medium" | "low",
  "additional_metrics": {
    "body_fat_pct": <number or null>,
    "muscle_mass": <number or null>,
    "water_pct": <number or null>,
    "bone_mass": <number or null>,
    "bmi": <number or null>
  },
  "device": "<detected device name or 'unknown'>"
}

If you cannot read the scale clearly, set confidence to 'low' and weight to your best estimate. If you truly cannot determine any reading, respond with:
{ "error": "Could not read scale display" }`;

export async function scanScale(
  base64Image: string,
  mimeType: string = 'image/jpeg',
): Promise<ScaleScanResult> {
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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: 'Read the scale display. Return the JSON described in the system prompt and nothing else.',
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });
  } catch {
    throw new AnthropicError(
      'Unable to reach the Anthropic API. Check your internet connection.',
      undefined,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new AnthropicError('Invalid API key.', status, 'INVALID_KEY');
    if (status === 429) throw new AnthropicError('Rate limited. Try again shortly.', status, 'RATE_LIMITED');
    if (status === 529) throw new AnthropicError('API temporarily overloaded. Try again shortly.', status, 'OVERLOADED');
    throw new AnthropicError(`Scale scan failed (${status})`, status, 'API_ERROR');
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string; text?: string }) => b.type === 'text');
  if (!textBlock?.text) {
    throw new AnthropicError('Empty response from API', undefined, 'EMPTY_RESPONSE');
  }

  try {
    await logTokenUsage({
      feature: 'scale_scan',
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    });
  } catch (e) {
    console.warn('[token_log] failed to log usage', e);
  }

  return parseScaleResponse(textBlock.text);
}

/**
 * Parse a raw model response into a ScaleScanResult. Exported so the flow
 * can be unit-tested without hitting the network.
 */
export function parseScaleResponse(raw: string): ScaleScanResult {
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
    return { ok: false, error: 'Could not read scale display' };
  }

  if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
    return { ok: false, error: parsed.error };
  }

  const weight = Number(parsed.weight);
  if (!Number.isFinite(weight) || weight <= 0) {
    return { ok: false, error: 'Could not read scale display' };
  }

  const unit: 'lbs' | 'kg' = parsed.unit === 'kg' ? 'kg' : 'lbs';
  const confidence: 'high' | 'medium' | 'low' =
    parsed.confidence === 'high' || parsed.confidence === 'medium'
      ? (parsed.confidence as 'high' | 'medium')
      : 'low';

  const am = (parsed.additional_metrics ?? {}) as Record<string, unknown>;
  const numOrNull = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    ok: true,
    weight,
    unit,
    confidence,
    additionalMetrics: {
      body_fat_pct: numOrNull(am.body_fat_pct),
      muscle_mass: numOrNull(am.muscle_mass),
      water_pct: numOrNull(am.water_pct),
      bone_mass: numOrNull(am.bone_mass),
      bmi: numOrNull(am.bmi),
    },
    device: typeof parsed.device === 'string' && parsed.device.trim().length > 0
      ? parsed.device
      : 'unknown',
  };
}
