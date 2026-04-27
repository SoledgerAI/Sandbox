// Sprint 31: scaleScanService — happy-path + token-log retrofit tests
// (Net-new file. Prior to S31 the service had no dedicated test coverage.)

import { scanScale } from '../services/scaleScanService';
import { getTokenLog } from '../utils/tokenLog';

const MOCK_KEY = 'sk-ant-api03-test-key-padding-padding-padding-padding-padding-padding';

beforeEach(() => {
  (global as unknown as { __mockSecureStore: Map<string, string> }).__mockSecureStore.set(
    'dub_ai_anthropic_api_key',
    MOCK_KEY,
  );
});

function mockClaudeResponse(modelOutput: object, usage = { input_tokens: 200, output_tokens: 80 }) {
  (global.fetch as jest.Mock).mockImplementationOnce(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          content: [{ type: 'text', text: JSON.stringify(modelOutput) }],
          usage,
        }),
    }),
  );
}

describe('scaleScanService — Sprint 31 retrofit', () => {
  it('returns parsed weight on a successful scan (happy path)', async () => {
    mockClaudeResponse({
      weight: 195.4,
      unit: 'lbs',
      confidence: 'high',
      additional_metrics: {
        body_fat_pct: 22.1,
        muscle_mass: null,
        water_pct: null,
        bone_mass: null,
        bmi: 26.4,
      },
      device: 'Withings Body+',
    });

    const result = await scanScale('base64data', 'image/jpeg');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weight).toBe(195.4);
    expect(result.unit).toBe('lbs');
    expect(result.confidence).toBe('high');
    expect(result.additionalMetrics.body_fat_pct).toBe(22.1);
    expect(result.device).toBe('Withings Body+');
  });

  it('logs token usage with feature=scale_scan on a successful scan', async () => {
    mockClaudeResponse(
      { weight: 180, unit: 'lbs', confidence: 'high', additional_metrics: {}, device: 'unknown' },
      { input_tokens: 333, output_tokens: 44 },
    );

    await scanScale('base64', 'image/jpeg');
    const log = await getTokenLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      feature: 'scale_scan',
      input_tokens: 333,
      output_tokens: 44,
    });
  });

  it('does NOT fail the scan when token logging throws', async () => {
    mockClaudeResponse({
      weight: 180,
      unit: 'lbs',
      confidence: 'high',
      additional_metrics: {},
      device: 'unknown',
    });
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.setItem.mockImplementationOnce(() => Promise.reject(new Error('disk full')));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await scanScale('base64', 'image/jpeg');
    expect(result.ok).toBe(true);
    warnSpy.mockRestore();
  });
});
