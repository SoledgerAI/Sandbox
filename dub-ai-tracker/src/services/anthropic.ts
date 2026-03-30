// Anthropic Messages API client
// Phase 14: AI Coach

import { COACH_MODEL_ID, TIER_TEMPERATURES } from '../constants/formulas';
import {
  getApiKey,
  setApiKey,
  deleteApiKey,
  isApiKeySet,
} from './apiKeyService';
import type { EngagementTier } from '../types/profile';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicResponse {
  id: string;
  content: Array<{ type: 'text'; text: string }>;
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

// Send message to Anthropic Messages API

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
  } catch (error) {
    throw new AnthropicError(
      'Unable to reach the Anthropic API. Check your internet connection.',
      undefined,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    const status = response.status;
    let message = 'API request failed';
    let code = 'API_ERROR';

    try {
      const errorBody = await response.json();
      message = errorBody?.error?.message ?? message;
      code = errorBody?.error?.type ?? code;
    } catch {
      // ignore parse error
    }

    if (status === 401) {
      throw new AnthropicError('Invalid API key. Check your key in Settings.', status, 'INVALID_KEY');
    }
    if (status === 429) {
      throw new AnthropicError('Rate limited. Please wait a moment and try again.', status, 'RATE_LIMITED');
    }
    if (status === 529) {
      throw new AnthropicError('Anthropic API is temporarily overloaded. Try again shortly.', status, 'OVERLOADED');
    }

    throw new AnthropicError(message, status, code);
  }

  const data: AnthropicResponse = await response.json();

  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock) {
    throw new AnthropicError('Empty response from API', undefined, 'EMPTY_RESPONSE');
  }

  return textBlock.text;
}
