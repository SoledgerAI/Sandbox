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

/** Multi-item scan result — wraps one or more FoodScanResult items */
export interface MultiItemScanResult {
  items: FoodScanResult[];
  isMultiItem: boolean;
}

const SCAN_PROMPT = `Analyze this food image. You MUST respond with ONLY a JSON object, no other text, no markdown backticks.

If this is a NUTRITION LABEL, extract the exact values.
If this is a PHOTO OF FOOD (no label), identify the food and estimate nutrition per serving.
If the image shows MULTIPLE food items, list each one separately with individual nutrition estimates.
If the image is blurry or unreadable, set confidence to "low" and provide your best guess.
If you cannot identify the food at all, set confidence to "low" and foodName to "Unknown Food".

For restaurant or cultural foods you can identify but can't precisely estimate (e.g., lamb biryani, pad thai), provide your best estimate and note "Restaurant portions vary" in the foodName or use medium confidence.

Respond with this exact JSON structure. If there are multiple items, return them in an "items" array:

For SINGLE item:
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

For MULTIPLE items on a plate/tray:
{
  "items": [
    { same structure as single item above },
    { ... }
  ]
}

Be conservative with estimates. If unsure, err on the higher calorie side. For restaurant food, assume generous portions with added oils/butter.
For whole fruits and vegetables, estimate based on a medium-sized piece unless the image clearly shows otherwise.`;

export async function scanFood(
  base64Image: string,
  mimeType: string = 'image/jpeg',
): Promise<MultiItemScanResult> {
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

  const raw = textBlock.text;

  // Extract JSON from response — handle markdown fences, preamble text, etc.
  let jsonStr: string;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    // Try to find a JSON object in the response
    const braceStart = raw.indexOf('{');
    const braceEnd = raw.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonStr = raw.slice(braceStart, braceEnd + 1);
    } else {
      jsonStr = raw.trim();
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle multi-item response: { items: [...] }
    if (parsed.items && Array.isArray(parsed.items)) {
      const items = parsed.items.map(normalizeItem).filter(Boolean) as FoodScanResult[];
      if (items.length === 0) return { items: [makeFallbackItem(raw)], isMultiItem: false };
      return { items, isMultiItem: items.length > 1 };
    }

    // Single item response
    const item = normalizeItem(parsed);
    if (!item) return { items: [makeFallbackItem(raw)], isMultiItem: false };
    return { items: [item], isMultiItem: false };
  } catch {
    // If JSON parsing fails entirely, return a fallback instead of crashing
    return { items: [makeFallbackItem(raw)], isMultiItem: false };
  }
}

/** Normalize and validate a single parsed item */
function normalizeItem(parsed: Record<string, unknown>): FoodScanResult | null {
  if (!parsed.foodName || !parsed.nutrition) return null;
  const n = parsed.nutrition as Record<string, unknown>;
  return {
    foodName: String(parsed.foodName),
    brand: parsed.brand ? String(parsed.brand) : null,
    servingSize: String(parsed.servingSize ?? '1 serving'),
    servingsPerContainer: parsed.servingsPerContainer != null ? Number(parsed.servingsPerContainer) : null,
    isEstimate: Boolean(parsed.isEstimate),
    confidence: (['high', 'medium', 'low'].includes(String(parsed.confidence)) ? String(parsed.confidence) : 'low') as 'high' | 'medium' | 'low',
    nutrition: {
      calories: Number(n.calories) || 0,
      protein: Number(n.protein) || 0,
      carbs: Number(n.carbs) || 0,
      fat: Number(n.fat) || 0,
      addedSugar: Number(n.addedSugar) || 0,
      fiber: Number(n.fiber) || 0,
    },
  };
}

/** Return a low-confidence placeholder so the user can enter values manually. */
function makeFallbackItem(rawResponse?: string): FoodScanResult {
  console.warn('[foodScanService] Could not parse scan result, returning fallback. Raw:', rawResponse?.slice(0, 300));
  return {
    foodName: 'Unknown Food',
    brand: null,
    servingSize: '1 serving',
    servingsPerContainer: null,
    isEstimate: true,
    confidence: 'low',
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, addedSugar: 0, fiber: 0 },
  };
}
