// Sprint 31: Wearable scan service tests

import { scanWearableScreenshot } from '../services/wearableScanService';
import { AnthropicError } from '../services/anthropic';
import { getTokenLog } from '../utils/tokenLog';

const MOCK_KEY = 'sk-ant-api03-test-key-for-wearable-scan-tests-padding-padding-padding';

beforeEach(() => {
  // Inject a mock API key into the secure-store mock so getApiKey() resolves.
  (global as unknown as { __mockSecureStore: Map<string, string> }).__mockSecureStore.set(
    'dub_ai_anthropic_api_key',
    MOCK_KEY,
  );
});

function mockFetchResponse(body: unknown, init?: { status?: number; ok?: boolean }) {
  const status = init?.status ?? 200;
  const ok = init?.ok ?? (status >= 200 && status < 300);
  (global.fetch as jest.Mock).mockImplementationOnce(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  );
}

function mockClaudeResponse(modelOutput: object | string, usage = { input_tokens: 100, output_tokens: 50 }) {
  const text = typeof modelOutput === 'string' ? modelOutput : JSON.stringify(modelOutput);
  mockFetchResponse({
    content: [{ type: 'text', text }],
    usage,
  });
}

describe('wearableScanService — Sprint 31', () => {
  it('returns parsed data on a successful scan', async () => {
    mockClaudeResponse({
      sleep_score: { value: 84, confidence: 'high' },
      hrv_ms: { value: 52, confidence: 'medium' },
      body_battery: { value: 78, confidence: 'high' },
      fields_extracted: ['sleep_score', 'hrv_ms', 'body_battery'],
    });

    const result = await scanWearableScreenshot('base64data', 'image/jpeg');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sleep_score).toEqual({ value: 84, confidence: 'high' });
    expect(result.data.hrv_ms).toEqual({ value: 52, confidence: 'medium' });
    expect(result.data.body_battery).toEqual({ value: 78, confidence: 'high' });
    expect(result.data.fields_extracted).toEqual(['sleep_score', 'hrv_ms', 'body_battery']);
    expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
    expect(result.fieldFlags).toBeUndefined();
  });

  it("flags 'low' confidence fields as 'low_confidence'", async () => {
    mockClaudeResponse({
      sleep_score: { value: 70, confidence: 'low' },
      hrv_ms: { value: 50, confidence: 'high' },
      fields_extracted: ['sleep_score', 'hrv_ms'],
    });

    const result = await scanWearableScreenshot('base64', 'image/jpeg');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fieldFlags).toEqual({ sleep_score: 'low_confidence' });
  });

  it("flags out-of-range values as 'out_of_range'", async () => {
    mockClaudeResponse({
      sleep_score: { value: 150, confidence: 'high' }, // >100, out of range
      hrv_ms: { value: 3, confidence: 'high' }, // <5, out of range
      vo2_max: { value: 50, confidence: 'high' }, // in range
      fields_extracted: ['sleep_score', 'hrv_ms', 'vo2_max'],
    });

    const result = await scanWearableScreenshot('base64', 'image/jpeg');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fieldFlags).toEqual({
      sleep_score: 'out_of_range',
      hrv_ms: 'out_of_range',
    });
  });

  it("'out_of_range' takes precedence over 'low_confidence'", async () => {
    mockClaudeResponse({
      sleep_score: { value: 200, confidence: 'low' }, // both out-of-range AND low confidence
      fields_extracted: ['sleep_score'],
    });

    const result = await scanWearableScreenshot('base64', 'image/jpeg');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fieldFlags?.sleep_score).toBe('out_of_range');
  });

  it('omits missing fields from result rather than nulling them', async () => {
    mockClaudeResponse({
      sleep_score: { value: 84, confidence: 'high' },
      fields_extracted: ['sleep_score'],
    });

    const result = await scanWearableScreenshot('base64', 'image/jpeg');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sleep_score).toBeDefined();
    expect(result.data.hrv_ms).toBeUndefined();
    expect(result.data.body_battery).toBeUndefined();
    expect('hrv_ms' in result.data).toBe(false);
  });

  it('raises INVALID_KEY on HTTP 401', async () => {
    mockFetchResponse({ error: { message: 'unauthorized' } }, { status: 401 });
    await expect(scanWearableScreenshot('base64', 'image/jpeg')).rejects.toMatchObject({
      name: 'AnthropicError',
      code: 'INVALID_KEY',
      status: 401,
    });
  });

  it('raises RATE_LIMITED on HTTP 429', async () => {
    mockFetchResponse({ error: { message: 'rate limited' } }, { status: 429 });
    await expect(scanWearableScreenshot('base64', 'image/jpeg')).rejects.toMatchObject({
      name: 'AnthropicError',
      code: 'RATE_LIMITED',
    });
  });

  it('raises OVERLOADED on HTTP 529', async () => {
    mockFetchResponse({ error: { message: 'overloaded' } }, { status: 529 });
    await expect(scanWearableScreenshot('base64', 'image/jpeg')).rejects.toMatchObject({
      name: 'AnthropicError',
      code: 'OVERLOADED',
    });
  });

  it("returns ok:false with parse_error code on bad JSON", async () => {
    mockClaudeResponse('this is definitely not json {{{');
    const result = await scanWearableScreenshot('base64', 'image/jpeg');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('parse_error');
  });

  it('logs token usage via tokenLog on a successful scan', async () => {
    mockClaudeResponse(
      {
        sleep_score: { value: 84, confidence: 'high' },
        fields_extracted: ['sleep_score'],
      },
      { input_tokens: 1234, output_tokens: 56 },
    );

    await scanWearableScreenshot('base64', 'image/jpeg');
    const log = await getTokenLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      feature: 'wearable_scan',
      input_tokens: 1234,
      output_tokens: 56,
    });
  });

  it('does NOT fail the scan when token logging throws', async () => {
    mockClaudeResponse({
      sleep_score: { value: 84, confidence: 'high' },
      fields_extracted: ['sleep_score'],
    });

    // Force the AsyncStorage write inside logTokenUsage to throw
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.setItem.mockImplementationOnce(() => Promise.reject(new Error('disk full')));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await scanWearableScreenshot('base64', 'image/jpeg');
    expect(result.ok).toBe(true);
    warnSpy.mockRestore();
  });

  it('omits fieldFlags entirely when no fields are flagged', async () => {
    mockClaudeResponse({
      sleep_score: { value: 84, confidence: 'high' },
      hrv_ms: { value: 52, confidence: 'medium' },
      fields_extracted: ['sleep_score', 'hrv_ms'],
    });

    const result = await scanWearableScreenshot('base64', 'image/jpeg');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fieldFlags).toBeUndefined();
    expect('fieldFlags' in result).toBe(false);
  });

  it('returns ok:false with network_error when fetch throws', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('connect ECONNREFUSED')),
    );
    const result = await scanWearableScreenshot('base64', 'image/jpeg');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('network_error');
  });
});
