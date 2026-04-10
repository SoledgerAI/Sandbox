// AI recipe parsing via Claude Vision / text
// Sprint 20: Recipe Builder — import from photo or pasted text

import { getApiKey, AnthropicError } from './anthropic';
import type { MyRecipeIngredient } from '../types/food';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const SCAN_MODEL = 'claude-sonnet-4-20250514';

const RECIPE_PARSE_SYSTEM = `You are a nutrition assistant. Extract the recipe from the following input. Return ONLY valid JSON with this structure: { "name": string, "ingredients": [{ "name": string, "amount": number, "unit": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }] }. Use USDA standard reference values for macro estimates. Be conservative. No preamble, no markdown, no explanation. Valid units: lbs, oz, g, kg, cups, tbsp, tsp, whole, slices, cans, pieces.`;

export interface RecipeParseResult {
  name: string;
  ingredients: MyRecipeIngredient[];
}

/** Parse a recipe from a photo (base64 image) */
export async function parseRecipeFromPhoto(
  base64Image: string,
  mimeType: string = 'image/jpeg',
): Promise<RecipeParseResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new AnthropicError('API key not configured. Add your Anthropic API key in Settings.', undefined, 'NO_API_KEY');
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
        max_tokens: 2000,
        system: RECIPE_PARSE_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: base64Image },
              },
              {
                type: 'text',
                text: 'Extract the recipe from this image, including all ingredients with amounts and estimated macros per ingredient.',
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });
  } catch {
    throw new AnthropicError('Unable to reach the Anthropic API. Check your internet connection.', undefined, 'NETWORK_ERROR');
  }

  return handleResponse(response);
}

/** Parse a recipe from pasted text */
export async function parseRecipeFromText(recipeText: string): Promise<RecipeParseResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new AnthropicError('API key not configured. Add your Anthropic API key in Settings.', undefined, 'NO_API_KEY');
  }

  const trimmed = recipeText.trim().slice(0, 5000);
  if (trimmed.length < 10) {
    throw new AnthropicError('Recipe text is too short. Paste a full recipe with ingredients.');
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
        max_tokens: 2000,
        system: RECIPE_PARSE_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Extract the recipe from the following text:\n\n${trimmed}`,
          },
        ],
        temperature: 0.2,
      }),
    });
  } catch {
    throw new AnthropicError('Unable to reach the Anthropic API. Check your internet connection.', undefined, 'NETWORK_ERROR');
  }

  return handleResponse(response);
}

async function handleResponse(response: Response): Promise<RecipeParseResult> {
  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new AnthropicError('Invalid API key.', status, 'INVALID_KEY');
    if (status === 429) throw new AnthropicError('Rate limited. Try again shortly.', status, 'RATE_LIMITED');
    if (status === 529) throw new AnthropicError('API temporarily overloaded. Try again shortly.', status, 'OVERLOADED');
    throw new AnthropicError(`Recipe parse failed (${status})`, status, 'API_ERROR');
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string; text?: string }) => b.type === 'text');
  if (!textBlock?.text) {
    throw new AnthropicError('Empty response from API', undefined, 'EMPTY_RESPONSE');
  }

  const raw = textBlock.text;

  // Extract JSON
  let jsonStr: string;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
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
    return normalizeResult(parsed);
  } catch {
    throw new AnthropicError('Could not parse recipe from AI response. Try a clearer photo or text.', undefined, 'PARSE_ERROR');
  }
}

const VALID_UNITS = new Set(['lbs', 'oz', 'g', 'kg', 'cups', 'tbsp', 'tsp', 'whole', 'slices', 'cans', 'pieces']);

function normalizeResult(parsed: Record<string, unknown>): RecipeParseResult {
  const name = String(parsed.name || 'Imported Recipe');
  const rawIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];

  const ingredients: MyRecipeIngredient[] = rawIngredients
    .filter((i: any) => i && i.name)
    .map((i: any) => ({
      name: String(i.name).slice(0, 100),
      amount: Math.max(Number(i.amount) || 1, 0),
      unit: (VALID_UNITS.has(String(i.unit)) ? String(i.unit) : 'whole') as any,
      calories: Math.max(Number(i.calories) || 0, 0),
      protein: Math.max(Number(i.protein_g ?? i.protein) || 0, 0),
      carbs: Math.max(Number(i.carbs_g ?? i.carbs) || 0, 0),
      fat: Math.max(Number(i.fat_g ?? i.fat) || 0, 0),
    }));

  if (ingredients.length === 0) {
    throw new AnthropicError('No ingredients found. Try a clearer recipe.', undefined, 'NO_INGREDIENTS');
  }

  return { name, ingredients };
}
