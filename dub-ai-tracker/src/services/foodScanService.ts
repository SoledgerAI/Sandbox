// Food scanning via Claude Vision API
// Sprint 10: Food Scanning MVP
// Two modes: nutrition label extraction (exact) and food photo estimation.

import { getApiKey, AnthropicError } from './anthropic';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
// Use Sonnet for speed — food scanning must feel fast
const SCAN_MODEL = 'claude-sonnet-4-20250514';

export interface FoodScanResult {
  foodName: string;
  brand: string | null;
  servingSize: string;
  servingsPerContainer: number | null;
  isEstimate: boolean; // true = food photo, false = nutrition label
  confidence: 'high' | 'medium' | 'low';
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    addedSugar: number;
    fiber: number;
  };
}

const SCAN_PROMPT = `Analyze this food image. You MUST respond with ONLY a JSON object, no other text, no markdown backticks.

If this is a NUTRITION LABEL, extract the exact values.
If this is a PHOTO OF FOOD (no label), identify the food and estimate nutrition per serving.

Respond with this exact JSON structure:
{
  "foodName": "name of the food item",
  "brand": "brand name if visible, otherwise null",
  "servingSize": "e.g. 1 breast (120g) or 1 cup",
  "servingsPerContainer": number or null,
  "isEstimate": true if food photo / false if nutrition label,
  "confidence": "high" or "medium" or "low",
  "nutrition": {
    "calories": number,
    "protein": number (grams),
    "carbs": number (grams),
    "fat": number (grams),
    "addedSugar": number (grams),
    "fiber": number (grams)
  }
}

Be conservative with estimates. If unsure, err on the higher calorie side. For restaurant food, assume generous portions with added oils/butter.`;

export async function scanFood(
  base64Image: string,
  mimeType: string = 'image/jpeg',
): Promise<FoodScanResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new AnthropicError(
      'API key not configured. Add your Anthropic API key in Settings.',
      undefined,
      'NO_API_KEY',
    );
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
      body: JSON.stringify({
        model: SCAN_MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: SCAN_PROMPT,
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });
  } catch {
    throw new AnthropicError(
      'Unable to reach the Anthropic API. Check your internet connection.',
      undefined,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new AnthropicError('Invalid API key.', status, 'INVALID_KEY');
    if (status === 429) throw new AnthropicError('Rate limited. Try again shortly.', status, 'RATE_LIMITED');
    if (status === 529) throw new AnthropicError('API temporarily overloaded. Try again shortly.', status, 'OVERLOADED');
    throw new AnthropicError(`Food scan failed (${status})`, status, 'API_ERROR');
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string; text?: string }) => b.type === 'text');
  if (!textBlock?.text) {
    throw new AnthropicError('Empty response from API', undefined, 'EMPTY_RESPONSE');
  }

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned) as FoodScanResult;
  } catch {
    throw new Error(`Failed to parse food scan result: ${textBlock.text.slice(0, 200)}`);
  }
}
