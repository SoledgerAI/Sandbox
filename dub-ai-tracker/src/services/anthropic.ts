// Anthropic Messages API client
// Phase 14: AI Coach
// Sprint 12: Streaming SSE + Tool Use

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
    params.callbacks.onError(
      new AnthropicError(
        'Unable to reach the Anthropic API. Check your internet connection.',
        undefined,
        'NETWORK_ERROR',
      ),
    );
    return;
  }

  if (!response.ok) {
    const errInfo = await safeParseError(response);
    try {
      handleErrorResponse(response.status, errInfo);
    } catch (e) {
      params.callbacks.onError(e as AnthropicError);
    }
    return;
  }

  // Process SSE stream
  const reader = response.body?.getReader();
  if (!reader) {
    params.callbacks.onError(new AnthropicError('No response body', undefined, 'EMPTY_RESPONSE'));
    return;
  }

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let currentToolId = '';
  let currentToolName = '';
  let toolInputJson = '';
  let stopReason = 'end_turn';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep incomplete last line in buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        const eventType = parsed.type as string;

        if (eventType === 'content_block_start') {
          const contentBlock = parsed.content_block as Record<string, unknown> | undefined;
          if (contentBlock?.type === 'tool_use') {
            currentToolId = contentBlock.id as string;
            currentToolName = contentBlock.name as string;
            toolInputJson = '';
          }
        } else if (eventType === 'content_block_delta') {
          const delta = parsed.delta as Record<string, unknown> | undefined;
          if (delta?.type === 'text_delta') {
            const text = (delta.text as string) ?? '';
            fullText += text;
            params.callbacks.onText(fullText);
          } else if (delta?.type === 'input_json_delta') {
            toolInputJson += (delta.partial_json as string) ?? '';
          }
        } else if (eventType === 'content_block_stop') {
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
        } else if (eventType === 'message_delta') {
          const delta = parsed.delta as Record<string, unknown> | undefined;
          if (delta?.stop_reason) {
            stopReason = delta.stop_reason as string;
          }
        }
      }
    }
  } catch (e) {
    params.callbacks.onError(
      new AnthropicError(
        e instanceof Error ? e.message : 'Stream reading failed',
        undefined,
        'STREAM_ERROR',
      ),
    );
    return;
  }

  // Post-process: fix tokenization artifacts
  fullText = fullText.replace(/recoRDed/g, 'recorded').replace(/recoRDing/g, 'recording');

  params.callbacks.onDone(fullText, stopReason);
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
