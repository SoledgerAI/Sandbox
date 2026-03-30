// Tests for apiKeyService — Prompt 04 v2: BYOK UX
// Covers: validateKeyFormat, set/get/delete round-trip, isApiKeySet, testApiKey

import {
  validateKeyFormat,
  getApiKey,
  setApiKey,
  deleteApiKey,
  isApiKeySet,
  testApiKey,
} from '../services/apiKeyService';

// Clear SecureStore between tests
beforeEach(() => {
  (global as any).__mockSecureStore.clear();
  (global.fetch as jest.Mock).mockReset();
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ model: 'claude-sonnet-4-20250514' }),
  });
});

describe('apiKeyService', () => {
  // ============================================================
  // validateKeyFormat
  // ============================================================

  describe('validateKeyFormat', () => {
    it('identifies standard API keys as valid', () => {
      const result = validateKeyFormat('sk-ant-api03-abcdefghijklmnop');
      expect(result.valid).toBe(true);
      expect(result.keyType).toBe('api_key');
      expect(result.error).toBeUndefined();
    });

    it('catches OAuth tokens and returns specific error', () => {
      const result = validateKeyFormat('sk-ant-oat01-abcdefghijklmnop');
      expect(result.valid).toBe(false);
      expect(result.keyType).toBe('oauth_token');
      expect(result.error).toContain('subscription token');
      expect(result.error).toContain('console.anthropic.com');
    });

    it('allows other sk- prefixed keys with unknown type', () => {
      const result = validateKeyFormat('sk-other-format-key');
      expect(result.valid).toBe(true);
      expect(result.keyType).toBe('unknown');
    });

    it('rejects strings not starting with sk-', () => {
      const result = validateKeyFormat('not-a-key-at-all');
      expect(result.valid).toBe(false);
      expect(result.keyType).toBe('unknown');
      expect(result.error).toContain('sk-ant-');
    });

    it('rejects empty strings', () => {
      const result = validateKeyFormat('');
      expect(result.valid).toBe(false);
    });

    it('rejects whitespace-only strings', () => {
      const result = validateKeyFormat('   ');
      expect(result.valid).toBe(false);
    });

    it('trims whitespace before validating', () => {
      const result = validateKeyFormat('  sk-ant-api03-trimmed  ');
      expect(result.valid).toBe(true);
      expect(result.keyType).toBe('api_key');
    });
  });

  // ============================================================
  // CRUD round-trip
  // ============================================================

  describe('set/get/delete round-trip', () => {
    it('stores and retrieves an API key', async () => {
      await setApiKey('sk-ant-api03-testkey123');
      const key = await getApiKey();
      expect(key).toBe('sk-ant-api03-testkey123');
    });

    it('deletes an API key', async () => {
      await setApiKey('sk-ant-api03-testkey123');
      await deleteApiKey();
      const key = await getApiKey();
      expect(key).toBeNull();
    });

    it('throws on invalid key format when setting', async () => {
      await expect(setApiKey('invalid-key')).rejects.toThrow();
    });
  });

  // ============================================================
  // isApiKeySet
  // ============================================================

  describe('isApiKeySet', () => {
    it('returns false by default', async () => {
      const result = await isApiKeySet();
      expect(result).toBe(false);
    });

    it('returns true after setting a key', async () => {
      await setApiKey('sk-ant-api03-testkey123');
      const result = await isApiKeySet();
      expect(result).toBe(true);
    });

    it('returns false after deleting a key', async () => {
      await setApiKey('sk-ant-api03-testkey123');
      await deleteApiKey();
      const result = await isApiKeySet();
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // testApiKey
  // ============================================================

  describe('testApiKey', () => {
    it('returns valid on 200 response', async () => {
      const result = await testApiKey('sk-ant-api03-testkey123');
      expect(result.valid).toBe(true);
      expect(result.model).toBe('claude-sonnet-4-20250514');
    });

    it('returns invalid on 401 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });
      const result = await testApiKey('sk-ant-api03-badkey');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('returns rate limited error on 429', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });
      const result = await testApiKey('sk-ant-api03-ratelimited');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Rate limited');
    });

    it('returns network error on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network fail'));
      const result = await testApiKey('sk-ant-api03-nonetwork');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Could not reach');
    });
  });
});
