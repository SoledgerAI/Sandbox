// Food and Nutrition types for DUB_AI Tracker
// Phase 2: Type System and Storage Layer
// Per Section 10: Food Intelligence System

export type FoodSource = 'fatsecret' | 'usda' | 'open_food_facts' | 'nutritionix' | 'manual' | 'ai_photo' | 'nlp' | 'recipe';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type ServingUnit =
  // Volume
  | 'cup' | 'tbsp' | 'tsp' | 'fl_oz' | 'ml' | 'L'
  // Weight
  | 'g' | 'oz' | 'lb' | 'kg'
  // Count
  | 'piece' | 'slice' | 'patty' | 'fillet' | 'scoop' | 'packet' | 'container' | 'each';

export type PhotoConfidence = 'high' | 'medium' | 'low';

export interface NutritionInfo {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  added_sugar_g: number | null;
  sodium_mg: number | null;
  cholesterol_mg: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  potassium_mg: number | null;
  vitamin_d_mcg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  zinc_mg?: number | null;
  magnesium_mg?: number | null;
  selenium_mcg?: number | null;
  vitamin_b12_mcg?: number | null;
}

export interface ServingSize {
  description: string; // e.g., "1 cup (258g)"
  unit: ServingUnit;
  gram_weight: number; // grams per one unit
  quantity: number; // default quantity (usually 1)
}

export interface FoodItem {
  source: FoodSource;
  source_id: string; // e.g., "fatsecret:12345", "usda:167512"
  name: string;
  brand: string | null;
  barcode: string | null;
  nutrition_per_100g: NutritionInfo;
  serving_sizes: ServingSize[];
  default_serving_index: number;
  ingredients: string | null;
  last_accessed: string; // ISO datetime for LRU cache eviction
}

export interface FoodEntry {
  id: string;
  timestamp: string; // ISO datetime
  meal_type: MealType;
  food_item: FoodItem;
  serving: ServingSize;
  quantity: number; // multiplier
  computed_nutrition: NutritionInfo;
  source: FoodSource;
  photo_uri: string | null;
  photo_confidence: PhotoConfidence | null;
  flagged_ingredients: string[];
  notes: string | null;
}

export interface IngredientFlag {
  id: string;
  name: string;
  keywords: string[]; // ingredient strings to match against
  enabled: boolean;
}

export interface MealTemplate {
  id: string;
  name: string; // e.g., "My usual breakfast"
  entries: Omit<FoodEntry, 'id' | 'timestamp'>[];
  created_at: string; // ISO datetime
  last_used: string | null;
}

// Recent food entry for quick-repeat logging (F-03)
export interface RecentFoodInfo {
  food_item: FoodItem;
  serving: ServingSize;
  quantity: number;
  calories: number;
}

export interface FavoriteFood {
  id: string;
  food_item: FoodItem;
  serving: ServingSize;
  quantity: number;
  meal_type: MealType | null;
  added_at: string; // ISO datetime
}

export interface PhotoEstimateItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: PhotoConfidence;
  note: string | null;
}

export interface PhotoEstimateResult {
  items: PhotoEstimateItem[];
  total_calories: number;
  disclaimer: string;
}

export interface RecipeEntry {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  total_nutrition: NutritionInfo;
  nutrition_per_serving: NutritionInfo;
  created_at: string;
}

export interface RecipeIngredient {
  food_item: FoodItem;
  serving: ServingSize;
  quantity: number;
  computed_nutrition: NutritionInfo;
}

// Sprint 20: My Recipes — user-created recipe library

export type RecipeUnit =
  | 'lbs' | 'oz' | 'g' | 'kg'
  | 'cups' | 'tbsp' | 'tsp'
  | 'whole' | 'slices' | 'cans' | 'pieces';

export interface MyRecipeIngredient {
  name: string;
  amount: number;
  unit: RecipeUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MyRecipe {
  id: string;
  name: string;
  ingredients: MyRecipeIngredient[];
  totalServings: number;
  totalWeight?: number; // total recipe weight in grams (optional, for weight-based portioning)
  macrosPerServing: RecipeMacros;
  totalMacros: RecipeMacros;
  timesLogged: number;
  lastLogged: string | null;
  createdAt: string;
  updatedAt: string;
  photo_uri?: string;
}

export type RecipePortionMethod = 'percentage' | 'servings' | 'weight';

// Sprint 21: Personal Pantry — scan once, log forever
export type PantrySource = 'barcode_scan' | 'label_scan' | 'manual' | 'coach_ai';
export type PantryCategory = 'food' | 'drink';

export interface PantryItem {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  added_sugar_g: number | null;
  sodium_mg: number | null;
  source: PantrySource;
  category: PantryCategory;
  created_at: string;
  last_logged: string;
  log_count: number;
}

export interface RecipeLogEntry {
  recipeId: string;
  recipeName: string;
  portionMethod: RecipePortionMethod;
  portionValue: number; // percentage (5-100), serving count (0.25+), or weight in g/oz
  portionLabel: string; // e.g., "30% of batch", "1.5 servings", "200g"
  macros: RecipeMacros;
}
