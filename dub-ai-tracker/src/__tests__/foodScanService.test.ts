// Sprint 31: foodScanService — happy-path + token-log retrofit tests
// (Net-new file. Prior to S31 the service had no dedicated test coverage.)

import { scanFood } from '../services/foodScanService';
import { getTokenLog } from '../utils/tokenLog';

const MOCK_KEY = 'sk-ant-api03-test-key-padding-padding-padding-padding-padding-padding';

beforeEach(() => {
  (global as unknown as { __mockSecureStore: Map<string, string> }).__mockSecureStore.set(
    'dub_ai_anthropic_api_key',
    MOCK_KEY,
  );
});

function mockClaudeResponse(modelOutput: object, usage = { input_tokens: 400, output_tokens: 100 }) {
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

describe('foodScanService — Sprint 31 retrofit', () => {
  it('returns parsed food on a successful scan (happy path)', async () => {
    mockClaudeResponse({
      foodName: 'Grilled Chicken Breast',
      brand: null,
      servingSize: '1 breast (120g)',
      servingsPerContainer: null,
      isEstimate: true,
      confidence: 'high',
      nutrition: {
        calories: 280,
        protein: 42,
        carbs: 0,
        fat: 12,
        addedSugar: 0,
        fiber: 0,
      },
    });

    const result = await scanFood('base64data', 'image/jpeg');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].foodName).toBe('Grilled Chicken Breast');
    expect(result.items[0].nutrition.calories).toBe(280);
    expect(result.isMultiItem).toBe(false);
  });

  it('logs token usage with feature=food_scan on a successful scan', async () => {
    mockClaudeResponse(
      {
        foodName: 'Apple',
        brand: null,
        servingSize: '1 medium',
        servingsPerContainer: null,
        isEstimate: true,
        confidence: 'high',
        nutrition: { calories: 95, protein: 0, carbs: 25, fat: 0, addedSugar: 0, fiber: 4 },
      },
      { input_tokens: 712, output_tokens: 88 },
    );

    await scanFood('base64', 'image/jpeg');
    const log = await getTokenLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      feature: 'food_scan',
      input_tokens: 712,
      output_tokens: 88,
    });
  });

  it('does NOT fail the scan when token logging throws', async () => {
    mockClaudeResponse({
      foodName: 'Apple',
      brand: null,
      servingSize: '1 medium',
      servingsPerContainer: null,
      isEstimate: true,
      confidence: 'high',
      nutrition: { calories: 95, protein: 0, carbs: 25, fat: 0, addedSugar: 0, fiber: 4 },
    });
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.setItem.mockImplementationOnce(() => Promise.reject(new Error('disk full')));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await scanFood('base64', 'image/jpeg');
    expect(result.items[0].foodName).toBe('Apple');
    warnSpy.mockRestore();
  });
});
