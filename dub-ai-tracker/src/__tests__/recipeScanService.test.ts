// Sprint 31: recipeScanService — happy-path + token-log retrofit tests
// (Net-new file. Prior to S31 the service had no dedicated test coverage.)

import { parseRecipeFromText } from '../services/recipeScanService';
import { getTokenLog } from '../utils/tokenLog';

const MOCK_KEY = 'sk-ant-api03-test-key-padding-padding-padding-padding-padding-padding';

beforeEach(() => {
  (global as unknown as { __mockSecureStore: Map<string, string> }).__mockSecureStore.set(
    'dub_ai_anthropic_api_key',
    MOCK_KEY,
  );
});

function mockClaudeResponse(modelOutput: object, usage = { input_tokens: 250, output_tokens: 120 }) {
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

const SAMPLE_RECIPE_TEXT = `Sheet pan chicken
2 lbs chicken thighs
1 tbsp olive oil
1 tsp salt
1 lb broccoli florets`;

describe('recipeScanService — Sprint 31 retrofit', () => {
  it('returns parsed recipe on a successful text parse (happy path)', async () => {
    mockClaudeResponse({
      name: 'Sheet Pan Chicken',
      ingredients: [
        { name: 'chicken thighs', amount: 2, unit: 'lbs', calories: 1200, protein_g: 180, carbs_g: 0, fat_g: 60 },
        { name: 'olive oil', amount: 1, unit: 'tbsp', calories: 120, protein_g: 0, carbs_g: 0, fat_g: 14 },
      ],
    });

    const result = await parseRecipeFromText(SAMPLE_RECIPE_TEXT);
    expect(result.name).toBe('Sheet Pan Chicken');
    expect(result.ingredients).toHaveLength(2);
    expect(result.ingredients[0].name).toBe('chicken thighs');
  });

  it('logs token usage with feature=recipe_scan on a successful parse', async () => {
    mockClaudeResponse(
      {
        name: 'Test',
        ingredients: [{ name: 'apple', amount: 1, unit: 'whole', calories: 95, protein_g: 0, carbs_g: 25, fat_g: 0 }],
      },
      { input_tokens: 555, output_tokens: 66 },
    );

    await parseRecipeFromText(SAMPLE_RECIPE_TEXT);
    const log = await getTokenLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      feature: 'recipe_scan',
      input_tokens: 555,
      output_tokens: 66,
    });
  });

  it('does NOT fail the parse when token logging throws', async () => {
    mockClaudeResponse({
      name: 'Test',
      ingredients: [{ name: 'apple', amount: 1, unit: 'whole', calories: 95, protein_g: 0, carbs_g: 25, fat_g: 0 }],
    });
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.setItem.mockImplementationOnce(() => Promise.reject(new Error('disk full')));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await parseRecipeFromText(SAMPLE_RECIPE_TEXT);
    expect(result.name).toBe('Test');
    warnSpy.mockRestore();
  });
});
