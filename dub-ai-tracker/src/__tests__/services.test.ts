// Step 12: Service Layer tests

describe('USDA Service', () => {
  it('constructs correct USDA FoodData Central API URL', async () => {
    const { usdaSearch } = require('../services/usda');

    // Mock fetch to capture the URL
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ foods: [], totalHits: 0, currentPage: 1, totalPages: 0 }),
      })
    ) as jest.Mock;
    global.fetch = mockFetch;

    await usdaSearch('chicken breast', 5);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('https://api.nal.usda.gov/fdc/v1/foods/search');
    expect(url).toContain('query=chicken%20breast');
    expect(url).toContain('pageSize=5');
    expect(url).toContain('api_key=');
  });

  it('parses response into FoodItem type', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            foods: [
              {
                fdcId: 171077,
                description: 'Chicken breast',
                brandName: null,
                gtinUpc: null,
                foodNutrients: [
                  { nutrientId: 1008, value: 165 },
                  { nutrientId: 1003, value: 31 },
                  { nutrientId: 1005, value: 0 },
                  { nutrientId: 1004, value: 3.6 },
                ],
                foodMeasures: [],
              },
            ],
            totalHits: 1,
            currentPage: 1,
            totalPages: 1,
          }),
      })
    ) as jest.Mock;
    global.fetch = mockFetch;

    const { usdaSearch } = require('../services/usda');
    const results = await usdaSearch('chicken breast');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('usda');
    expect(results[0].name).toBe('Chicken breast');
  });
});

describe('OpenFoodFacts Service', () => {
  it('barcode lookup constructs correct URL', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 0, product: null }),
      })
    ) as jest.Mock;
    global.fetch = mockFetch;

    const { offBarcodeLookup } = require('../services/openfoodfacts');
    await offBarcodeLookup('0049000006346');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('world.openfoodfacts.org/api/v0/product/0049000006346');
  });

  it('handles product-not-found gracefully', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 0, product: null }),
      })
    ) as jest.Mock;
    global.fetch = mockFetch;

    const { offBarcodeLookup } = require('../services/openfoodfacts');
    const result = await offBarcodeLookup('0000000000000');
    expect(result).toBeNull();
  });
});

describe('Anthropic Service', () => {
  it('imports correctly', async () => {
    const mod = require('../services/anthropic');
    expect(mod.sendMessage).toBeDefined();
    expect(mod.getApiKey).toBeDefined();
    expect(mod.setApiKey).toBeDefined();
    expect(mod.AnthropicError).toBeDefined();
  });

  // Sprint 30: COACH_TOOLS extended from 6 → 10
  // Sprint 31: extended again to 11 (added log_recovery_metrics)
  it('exports COACH_TOOLS containing all 11 expected tools with valid schemas', () => {
    const { COACH_TOOLS } = require('../services/anthropic');
    expect(Array.isArray(COACH_TOOLS)).toBe(true);
    expect(COACH_TOOLS).toHaveLength(11);
    const names = COACH_TOOLS.map((t: { name: string }) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'log_drink',
        'log_food',
        'log_weight',
        'log_exercise',
        'log_supplement',
        'log_feedback',
        'log_body_composition',
        'log_sleep',
        'log_mood',
        'log_substance',
        'log_recovery_metrics',
      ]),
    );
    for (const t of COACH_TOOLS) {
      expect(typeof t.name).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(t.input_schema).toBeDefined();
      expect(t.input_schema.type).toBe('object');
      expect(t.input_schema.properties).toBeDefined();
    }
  });

  it('Sprint 30 tools include the optional extraction_source enum', () => {
    const { COACH_TOOLS } = require('../services/anthropic');
    const newToolNames = ['log_body_composition', 'log_sleep', 'log_mood', 'log_substance'];
    for (const name of newToolNames) {
      const tool = COACH_TOOLS.find((t: { name: string }) => t.name === name);
      expect(tool).toBeDefined();
      expect(tool.input_schema.properties.extraction_source).toBeDefined();
      expect(tool.input_schema.properties.extraction_source.enum).toEqual([
        'user_text',
        'image_vision',
        'inferred',
      ]);
    }
  });

  it('uses correct endpoint and model', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockResolvedValueOnce('test-api-key');

    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'msg_123',
            content: [{ type: 'text', text: 'Hello!' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 100, output_tokens: 50 },
          }),
      })
    ) as jest.Mock;
    global.fetch = mockFetch;

    const { sendMessage } = require('../services/anthropic');
    await sendMessage({
      systemPrompt: 'You are a test.',
      messages: [{ role: 'user', content: 'Hello' }],
      tier: 'balanced',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

    // Verify endpoint
    expect(url).toBe('https://api.anthropic.com/v1/messages');

    // Verify headers
    const headers = options.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-api-key');
    expect(headers['Content-Type']).toBe('application/json');

    // Verify body
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.max_tokens).toBe(1024);
  });

  it('handles missing API key gracefully', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockResolvedValueOnce(null);

    const { sendMessage, AnthropicError } = require('../services/anthropic');

    await expect(
      sendMessage({
        systemPrompt: 'Test',
        messages: [{ role: 'user', content: 'Hello' }],
        tier: 'balanced',
      })
    ).rejects.toThrow(AnthropicError);
  });

  it('handles API error response gracefully', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockResolvedValueOnce('test-api-key');

    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: { message: 'Invalid API key', type: 'INVALID_KEY' },
          }),
      })
    ) as jest.Mock;
    global.fetch = mockFetch;

    const { sendMessage, AnthropicError } = require('../services/anthropic');

    await expect(
      sendMessage({
        systemPrompt: 'Test',
        messages: [{ role: 'user', content: 'Hello' }],
        tier: 'balanced',
      })
    ).rejects.toThrow(AnthropicError);
  });
});

describe('Notifications Service', () => {
  it('configureNotifications function exists', async () => {
    const { configureNotifications } = require('../services/notifications');
    expect(typeof configureNotifications).toBe('function');
  });

  it('scheduleEODNotification function exists', async () => {
    const { scheduleEODNotification } = require('../services/notifications');
    expect(typeof scheduleEODNotification).toBe('function');
  });

  it('cancelAllNotifications function exists', async () => {
    const { cancelAllNotifications } = require('../services/notifications');
    expect(typeof cancelAllNotifications).toBe('function');
  });
});

describe('PDF Service', () => {
  it('generateHealthReportPDF function exists', async () => {
    const { generateHealthReportPDF } = require('../services/pdf');
    expect(typeof generateHealthReportPDF).toBe('function');
  });

  it('SECTION_LABELS includes required sections', async () => {
    const { SECTION_LABELS } = require('../services/pdf');
    expect(SECTION_LABELS.weight_body_composition).toBeDefined();
    expect(SECTION_LABELS.nutrition).toBeDefined();
    expect(SECTION_LABELS.exercise).toBeDefined();
    expect(SECTION_LABELS.sleep).toBeDefined();
    expect(SECTION_LABELS.vital_signs).toBeDefined();
    expect(SECTION_LABELS.bloodwork).toBeDefined();
    expect(SECTION_LABELS.supplements).toBeDefined();
  });
});

describe('Reporting Service', () => {
  it('generateDailySummary function exists', async () => {
    const { generateDailySummary } = require('../services/reporting');
    expect(typeof generateDailySummary).toBe('function');
  });

  it('generateWeeklySummary function exists', async () => {
    const { generateWeeklySummary } = require('../services/reporting');
    expect(typeof generateWeeklySummary).toBe('function');
  });

  it('checkDueReports function exists', async () => {
    const { checkDueReports } = require('../services/reporting');
    expect(typeof checkDueReports).toBe('function');
  });

  it('report cadences include expected values', async () => {
    const { checkDueReports } = require('../services/reporting');
    const due = await checkDueReports();
    // 'daily' is always due
    expect(due).toContain('daily');
  });
});
