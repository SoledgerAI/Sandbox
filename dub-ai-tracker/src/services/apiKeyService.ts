// API Key lifecycle service — BYOK (Bring Your Own Key) management
// Prompt 04 v2: API Key Setup Wizard + Validation

import { getSecure, setSecure, deleteSecure, SECURE_KEYS } from './secureStorageService';

// ============================================================
// Format validation result
// ============================================================

export interface KeyFormatResult {
  valid: boolean;
  keyType: 'api_key' | 'oauth_token' | 'unknown';
  error?: string;
}

export interface KeyTestResult {
  valid: boolean;
  error?: string;
  model?: string;
}

// ============================================================
// API Key CRUD
// ============================================================

export async function getApiKey(): Promise<string | null> {
  return getSecure(SECURE_KEYS.ANTHROPIC_API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  const result = validateKeyFormat(key);
  if (!result.valid) {
    throw new Error(result.error || 'Invalid API key format');
  }
  await setSecure(SECURE_KEYS.ANTHROPIC_API_KEY, key);
}

export async function deleteApiKey(): Promise<void> {
  await deleteSecure(SECURE_KEYS.ANTHROPIC_API_KEY);
}

export async function isApiKeySet(): Promise<boolean> {
  const key = await getApiKey();
  return key != null && key.length > 0;
}

// ============================================================
// Format validation — catches OAuth tokens (Red Team Finding #3)
// ============================================================

export function validateKeyFormat(key: string): KeyFormatResult {
  const trimmed = key.trim();

  if (!trimmed) {
    return {
      valid: false,
      keyType: 'unknown',
      error: "This doesn't look like an Anthropic API key. Keys start with sk-ant-",
    };
  }

  // OAuth token detection — sk-ant-oat01-... is a subscription token, NOT an API key
  if (/^sk-ant-oat\d{2}-/.test(trimmed)) {
    return {
      valid: false,
      keyType: 'oauth_token',
      error:
        'This looks like a Claude Pro/Team subscription token, not an API key. You need an API key from console.anthropic.com.',
    };
  }

  // Standard API key pattern — sk-ant-api03-...
  if (/^sk-ant-api\d{2}-/.test(trimmed)) {
    return { valid: true, keyType: 'api_key' };
  }

  // Other sk- prefixed keys — possibly valid, allow with warning
  if (/^sk-/.test(trimmed)) {
    return { valid: true, keyType: 'unknown' };
  }

  // Anything else — invalid
  return {
    valid: false,
    keyType: 'unknown',
    error: "This doesn't look like an Anthropic API key. Keys start with sk-ant-",
  };
}

// ============================================================
// Live API key test — minimal call to verify key works
// ============================================================

const TEST_API_URL = 'https://api.anthropic.com/v1/messages';
const TEST_API_VERSION = '2023-06-01';
const TEST_TIMEOUT_MS = 10_000;

export async function testApiKey(key: string): Promise<KeyTestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const response = await fetch(TEST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': TEST_API_VERSION,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, model: data.model };
    }

    if (response.status === 401) {
      return {
        valid: false,
        error: 'Invalid API key. Check that you copied the full key from console.anthropic.com.',
      };
    }

    if (response.status === 429) {
      return {
        valid: false,
        error: 'Rate limited. The key is valid but you have hit the usage limit. Try again shortly.',
      };
    }

    return {
      valid: false,
      error: `API returned status ${response.status}. Please try again.`,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        valid: false,
        error: 'Request timed out. Check your internet connection and try again.',
      };
    }
    return {
      valid: false,
      error: 'Could not reach Anthropic servers. Check your internet connection.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
