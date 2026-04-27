// Anthropic Messages API client
// Phase 14: AI Coach
// Sprint 12: Streaming SSE + Tool Use

import EventSource from 'react-native-sse';
import { COACH_MODEL_ID, TIER_TEMPERATURES } from '../constants/formulas';
import {
  getApiKey,
  setApiKey,
  deleteApiKey,
  isApiKeySet,
} from './apiKeyService';
import type { EngagementTier } from '../types/profile';
import type { CoachToolName } from '../types/coach';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface AnthropicResponse {
  id: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

// Re-export API key functions from apiKeyService for backwards compatibility
export { getApiKey, setApiKey, deleteApiKey };
export const hasApiKey = isApiKeySet;

// ============================================================
// Tool Definitions for Coach DUB (Feature 3)
// ============================================================

export const COACH_TOOLS = [
  {
    name: 'log_drink' as const,
    description: 'Log a drink/fluid intake entry',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount_oz: { type: 'number' as const, description: 'Amount in ounces' },
        beverage_type: {
          type: 'string' as const,
          enum: ['water', 'coffee', 'tea', 'juice', 'sparkling', 'energy_drink', 'smoothie', 'protein_shake', 'soda', 'milk', 'other'],
        },
        timestamp: { type: 'string' as const, description: 'ISO timestamp, default now' },
      },
      required: ['amount_oz', 'beverage_type'],
    },
  },
  {
    name: 'log_food' as const,
    description: 'Log a food entry with macros',
    input_schema: {
      type: 'object' as const,
      properties: {
        food_name: { type: 'string' as const },
        meal_type: { type: 'string' as const, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        calories: { type: 'number' as const },
        protein_g: { type: 'number' as const },
        carbs_g: { type: 'number' as const },
        fat_g: { type: 'number' as const },
        timestamp: { type: 'string' as const },
      },
      required: ['food_name', 'calories'],
    },
  },
  {
    name: 'log_weight' as const,
    description: 'Log a body weight measurement',
    input_schema: {
      type: 'object' as const,
      properties: {
        weight_lbs: { type: 'number' as const },
        timestamp: { type: 'string' as const },
      },
      required: ['weight_lbs'],
    },
  },
  {
    name: 'log_exercise' as const,
    description: 'Log an exercise/workout session',
    input_schema: {
      type: 'object' as const,
      properties: {
        exercise_type: { type: 'string' as const },
        duration_minutes: { type: 'number' as const },
        calories_burned: { type: 'number' as const },
        distance_miles: { type: 'number' as const },
        timestamp: { type: 'string' as const },
      },
      required: ['exercise_type', 'duration_minutes'],
    },
  },
  {
    name: 'log_supplement' as const,
    description: 'Log a supplement dose',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplement_name: { type: 'string' as const },
        dosage: { type: 'string' as const },
        timestamp: { type: 'string' as const },
      },
      required: ['supplement_name'],
    },
  },
  {
    name: 'log_feedback' as const,
    description: 'Log user feedback, bug report, or feature request. Used exclusively by @dub app support expert.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string' as const, enum: ['bug', 'feature_request', 'question'] },
        description: { type: 'string' as const, description: 'User description of the issue or request' },
        screen: { type: 'string' as const, description: 'Which app screen this relates to, if known' },
      },
      required: ['type', 'description'],
    },
  },
  // Sprint 30: multi-field extraction tools
  {
    name: 'log_body_composition' as const,
    description:
      'Log body composition metrics from a smart scale screenshot or manual entry. Use this when a scale photo is shared OR when the user reports body composition numbers. Always call alongside log_weight when both are present in the same source.',
    input_schema: {
      type: 'object' as const,
      properties: {
        body_fat_pct: { type: 'number' as const, description: '0-100' },
        skeletal_muscle_lbs: { type: 'number' as const },
        bone_mass_lbs: { type: 'number' as const },
        bmi: { type: 'number' as const },
        visceral_fat_rating: { type: 'number' as const, description: '0-30 typical Garmin/Withings' },
        body_water_pct: { type: 'number' as const, description: '0-100' },
        metabolic_age_years: { type: 'number' as const, description: 'integer years' },
        source: { type: 'string' as const, description: "e.g. 'garmin_scale_photo'" },
        extraction_source: {
          type: 'string' as const,
          enum: ['user_text', 'image_vision', 'inferred'],
          description: 'How this value was obtained',
        },
      },
    },
  },
  {
    name: 'log_sleep' as const,
    description:
      'Log a sleep entry for the previous night. Use when the user reports bedtime, wake time, or total sleep hours.',
    input_schema: {
      type: 'object' as const,
      properties: {
        hours: { type: 'number' as const, description: '0-16, total sleep duration' },
        quality: { type: 'number' as const, description: '1-5' },
        bedtime: { type: 'string' as const, description: 'HH:MM 24h' },
        wake_time: { type: 'string' as const, description: 'HH:MM 24h' },
        wake_count: { type: 'number' as const, description: 'integer' },
        source: { type: 'string' as const },
        extraction_source: {
          type: 'string' as const,
          enum: ['user_text', 'image_vision', 'inferred'],
        },
      },
      required: ['hours'],
    },
  },
  {
    name: 'log_mood' as const,
    description:
      'Log a mental/mood entry. Use when user shares a feeling, stress level, or mood rating.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mood_rating: { type: 'number' as const, description: '1-5' },
        stress_level: { type: 'number' as const, description: '1-5' },
        note: { type: 'string' as const, description: 'max 280 chars' },
        triggers: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'free-text tags',
        },
        source: { type: 'string' as const },
        extraction_source: {
          type: 'string' as const,
          enum: ['user_text', 'image_vision', 'inferred'],
        },
      },
      required: ['mood_rating'],
    },
  },
  {
    name: 'log_substance' as const,
    description:
      'Log a substance use entry (alcohol, cannabis, nicotine, etc.). Use ONLY when user explicitly asks to log it. This is sensitive data — never log substance use inferred from images alone without explicit user instruction.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string' as const,
          enum: ['alcohol', 'cannabis', 'hemp', 'tobacco', 'other'],
        },
        amount: { type: 'number' as const },
        unit: {
          type: 'string' as const,
          enum: ['oz', 'g', 'mg', 'puffs', 'cigarettes', 'units'],
        },
        method: {
          type: 'string' as const,
          enum: ['beverage', 'smoked', 'edible', 'vape', 'patch', 'other'],
        },
        note: { type: 'string' as const, description: 'max 280 chars' },
        source: { type: 'string' as const },
        extraction_source: {
          type: 'string' as const,
          enum: ['user_text', 'image_vision', 'inferred'],
        },
      },
      required: ['category'],
    },
  },
  // Sprint 31: wearable recovery metrics (Garmin / Oura / WHOOP)
  {
    name: 'log_recovery_metrics' as const,
    description:
      'Logs wearable-derived recovery metrics from a Garmin/Oura/WHOOP screenshot or from explicit user text. Use only when the user provides specific numeric values, not when they describe how they feel qualitatively.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sleep_score: { type: 'number' as const, minimum: 0, maximum: 100 },
        sleep_duration_hours: { type: 'number' as const, minimum: 0, maximum: 14 },
        hrv_ms: { type: 'number' as const, minimum: 5, maximum: 200 },
        body_battery: { type: 'number' as const, minimum: 0, maximum: 100 },
        stress_baseline: { type: 'number' as const, minimum: 0, maximum: 100 },
        training_readiness: { type: 'number' as const, minimum: 0, maximum: 100 },
        vo2_max: { type: 'number' as const, minimum: 15, maximum: 90 },
        resting_heart_rate: { type: 'number' as const, minimum: 30, maximum: 120 },
        timestamp: { type: 'string' as const, description: 'ISO 8601' },
        extraction_source: {
          type: 'string' as const,
          enum: ['image', 'text', 'wearable_scan'],
        },
      },
      required: ['extraction_source'],
    },
  },
];

// ============================================================
// Streaming callback types
// ============================================================

export interface StreamCallbacks {
  onText: (fullText: string) => void;
  onToolUse: (toolUseId: string, name: CoachToolName, input: Record<string, unknown>) => void;
  onDone: (fullText: string, stopReason: string) => void;
  onError: (error: AnthropicError) => void;
}

// ============================================================
// Non-streaming send (kept for backward compat)
// ============================================================

export async function sendMessage(params: {
  systemPrompt: string;
  messages: AnthropicMessage[];
  tier: EngagementTier;
}): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new AnthropicError('API key not configured. Add your Anthropic API key in Settings.', undefined, 'NO_API_KEY');
  }

  const temperature = TIER_TEMPERATURES[params.tier] ?? 0.7;

  const body = {
    model: COACH_MODEL_ID,
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: params.messages,
    temperature,
  };

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AnthropicError(
      'Unable to reach the Anthropic API. Check your internet connection.',
      undefined,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    handleErrorResponse(response.status, await safeParseError(response));
  }

  const data: AnthropicResponse = await response.json();

  const textBlock = data.content.find((b): b is { type: 'text'; text: string } => b.type === 'text');
  if (!textBlock) {
    throw new AnthropicError('Empty response from API', undefined, 'EMPTY_RESPONSE');
  }

  return textBlock.text;
}

// ============================================================
// Streaming send (Sprint 12 Feature 2)
// ============================================================

type AnthropicStreamEvent =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'ping';

export async function sendMessageStreaming(params: {
  systemPrompt: string;
  messages: AnthropicMessage[];
  tier: EngagementTier;
  tools?: boolean;
  callbacks: StreamCallbacks;
}): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    params.callbacks.onError(
      new AnthropicError('API key not configured. Add your Anthropic API key in Settings.', undefined, 'NO_API_KEY'),
    );
    return;
  }

  const temperature = TIER_TEMPERATURES[params.tier] ?? 0.7;

  const body: Record<string, unknown> = {
    model: COACH_MODEL_ID,
    max_tokens: 1024,
    stream: true,
    system: params.systemPrompt,
    messages: params.messages,
    temperature,
  };

  if (params.tools) {
    body.tools = COACH_TOOLS;
  }

  return new Promise<void>((resolve) => {
    let fullText = '';
    let currentToolId = '';
    let currentToolName = '';
    let toolInputJson = '';
    let stopReason = 'end_turn';
    let settled = false;

    const es = new EventSource<AnthropicStreamEvent>(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
      pollingInterval: 0,
    });

    const cleanup = () => {
      if (settled) return;
      settled = true;
      try {
        es.removeAllEventListeners();
        es.close();
      } catch {
        // ignore
      }
    };

    const finish = () => {
      if (settled) return;
      cleanup();
      fullText = fullText.replace(/recoRDed/g, 'recorded').replace(/recoRDing/g, 'recording');
      params.callbacks.onDone(fullText, stopReason);
      resolve();
    };

    const fail = (error: AnthropicError) => {
      if (settled) return;
      cleanup();
      params.callbacks.onError(error);
      resolve();
    };

    const parseJson = (data: string | null): Record<string, unknown> | null => {
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };

    es.addEventListener('error', (event) => {
      if (settled) return;
      if (event.type === 'exception') {
        fail(
          new AnthropicError(
            'Unable to reach the Anthropic API. Check your internet connection.',
            undefined,
            'NETWORK_ERROR',
          ),
        );
        return;
      }
      if (event.type === 'timeout') {
        fail(new AnthropicError('Request timed out. Please try again.', undefined, 'TIMEOUT'));
        return;
      }
      const status = (event as { xhrStatus?: number }).xhrStatus;
      const rawMessage = (event as { message?: string }).message ?? '';
      let errInfo: { message: string; code: string } = {
        message: 'API request failed',
        code: 'API_ERROR',
      };
      try {
        const parsed = JSON.parse(rawMessage);
        errInfo = {
          message: parsed?.error?.message ?? errInfo.message,
          code: parsed?.error?.type ?? errInfo.code,
        };
      } catch {
        // ignore parse error
      }
      if (!status) {
        fail(
          new AnthropicError(
            'Unable to reach the Anthropic API. Check your internet connection.',
            undefined,
            'NETWORK_ERROR',
          ),
        );
        return;
      }
      try {
        handleErrorResponse(status, errInfo);
      } catch (e) {
        fail(e as AnthropicError);
      }
    });

    es.addEventListener('content_block_start', (event) => {
      const parsed = parseJson(event.data);
      if (!parsed) return;
      const contentBlock = parsed.content_block as Record<string, unknown> | undefined;
      if (contentBlock?.type === 'tool_use') {
        currentToolId = contentBlock.id as string;
        currentToolName = contentBlock.name as string;
        toolInputJson = '';
      }
    });

    es.addEventListener('content_block_delta', (event) => {
      const parsed = parseJson(event.data);
      if (!parsed) return;
      const delta = parsed.delta as Record<string, unknown> | undefined;
      if (delta?.type === 'text_delta') {
        const text = (delta.text as string) ?? '';
        fullText += text;
        params.callbacks.onText(fullText);
      } else if (delta?.type === 'input_json_delta') {
        toolInputJson += (delta.partial_json as string) ?? '';
      }
    });

    es.addEventListener('content_block_stop', () => {
      if (currentToolId && currentToolName) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(toolInputJson);
        } catch {
          // empty input
        }
        params.callbacks.onToolUse(currentToolId, currentToolName as CoachToolName, input);
        currentToolId = '';
        currentToolName = '';
        toolInputJson = '';
      }
    });

    es.addEventListener('message_delta', (event) => {
      const parsed = parseJson(event.data);
      if (!parsed) return;
      const delta = parsed.delta as Record<string, unknown> | undefined;
      if (delta?.stop_reason) {
        stopReason = delta.stop_reason as string;
      }
    });

    es.addEventListener('message_stop', () => {
      finish();
    });
  });
}

// ============================================================
// Send tool result back to continue conversation
// ============================================================

export async function sendToolResult(params: {
  systemPrompt: string;
  messages: AnthropicMessage[];
  tier: EngagementTier;
  callbacks: StreamCallbacks;
}): Promise<void> {
  return sendMessageStreaming({ ...params, tools: true });
}

// ============================================================
// Helpers
// ============================================================

async function safeParseError(response: Response): Promise<{ message: string; code: string }> {
  let message = 'API request failed';
  let code = 'API_ERROR';
  try {
    const errorBody = await response.json();
    message = errorBody?.error?.message ?? message;
    code = errorBody?.error?.type ?? code;
  } catch {
    // ignore parse error
  }
  return { message, code };
}

function handleErrorResponse(status: number, errInfo: { message: string; code: string }): never {
  if (status === 401) {
    throw new AnthropicError('Invalid API key. Check your key in Settings.', status, 'INVALID_KEY');
  }
  if (status === 429) {
    throw new AnthropicError('Rate limited. Please wait a moment and try again.', status, 'RATE_LIMITED');
  }
  if (status === 529) {
    throw new AnthropicError('Anthropic API is temporarily overloaded. Try again shortly.', status, 'OVERLOADED');
  }
  throw new AnthropicError(errInfo.message, status, errInfo.code);
}
