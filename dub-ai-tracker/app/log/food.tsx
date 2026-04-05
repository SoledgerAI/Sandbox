// Food logging screen -- search, select, configure serving, save
// Phase 6: Food Logging -- Core
// Phase 19: NLP text entry and photo food entry integration

import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../../src/utils/storage';
import { scaleNutrition } from '../../src/utils/servingmath';
import { FoodSearch } from '../../src/components/logging/FoodSearch';
import { FoodEntryForm } from '../../src/components/logging/FoodEntryForm';
import { QuickLog } from '../../src/components/logging/QuickLog';
import { ServingSizeSelector } from '../../src/components/logging/ServingSizeSelector';
import { BarcodeScanner } from '../../src/components/logging/BarcodeScanner';
import { NLPFoodEntry } from '../../src/components/logging/NLPFoodEntry';
import { PhotoFoodEntry } from '../../src/components/logging/PhotoFoodEntry';
import { Button } from '../../src/components/common/Button';
import { RepeatLastEntry } from '../../src/components/logging/RepeatLastEntry';
import { useLastEntry } from '../../src/hooks/useLastEntry';
import { loadIngredientFlags, detectFlaggedIngredients } from '../../src/utils/ingredients';
import type { FoodItem, FoodEntry, MealType, IngredientFlag } from '../../src/types/food';
import { todayDateString } from '../../src/utils/dayBoundary';

type Screen = 'search' | 'configure' | 'manual' | 'quicklog' | 'barcode' | 'nlp' | 'photo';


function guessMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

export default function FoodLogScreen() {
  const [screen, setScreen] = useState<Screen>('search');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingIndex, setServingIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [customWeightGrams, setCustomWeightGrams] = useState<number | null>(null);
  const [mealType] = useState<MealType>(guessMealType);
  const [ingredientFlags, setIngredientFlags] = useState<IngredientFlag[]>([]);
  const { lastEntry: lastFoodEntry, saveAsLast: saveLastFood } = useLastEntry<FoodEntry>('nutrition.food');

  useEffect(() => {
    loadIngredientFlags().then(setIngredientFlags);
  }, []);

  const saveEntry = useCallback(
    async (partial: Omit<FoodEntry, 'id' | 'timestamp'>) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
      const existing = (await storageGet<FoodEntry[]>(key)) ?? [];

      const entry: FoodEntry = {
        ...partial,
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
      };

      await storageSet(key, [...existing, entry]);
      await saveLastFood(entry);
      router.back();
    },
    [saveLastFood],
  );

  const handleBarcodeFound = useCallback((food: FoodItem) => {
    setSelectedFood(food);
    setServingIndex(food.default_serving_index);
    setQuantity(1);
    setScreen('configure');
  }, []);

  const handleBarcodeNotFound = useCallback((_barcode: string) => {
    setScreen('manual');
  }, []);

  const repeatLastFood = useCallback(() => {
    if (!lastFoodEntry) return;
    setSelectedFood(lastFoodEntry.food_item);
    setServingIndex(
      lastFoodEntry.food_item.serving_sizes.findIndex(
        (s) => s.description === lastFoodEntry.serving.description,
      ) ?? 0,
    );
    setQuantity(lastFoodEntry.quantity);
    setCustomWeightGrams(null);
    setScreen('configure');
  }, [lastFoodEntry]);

  const handleFoodSelected = useCallback((food: FoodItem) => {
    setSelectedFood(food);
    setServingIndex(food.default_serving_index);
    setQuantity(1);
    setCustomWeightGrams(null);
    setScreen('configure');
  }, []);

  const handleConfirmServing = useCallback(() => {
    if (selectedFood == null) return;

    // Use custom weight serving if set, otherwise use the selected serving size
    const serving = customWeightGrams != null && customWeightGrams > 0
      ? { description: `${Math.round(customWeightGrams)}g (custom)`, unit: 'g' as const, gram_weight: customWeightGrams, quantity: 1 }
      : selectedFood.serving_sizes[servingIndex];
    const effectiveQty = customWeightGrams != null && customWeightGrams > 0 ? 1 : quantity;

    const computed = scaleNutrition(selectedFood.nutrition_per_100g, serving, effectiveQty);
    const flagged = detectFlaggedIngredients(selectedFood.ingredients, ingredientFlags);

    saveEntry({
      meal_type: mealType,
      food_item: selectedFood,
      serving,
      quantity: effectiveQty,
      computed_nutrition: computed,
      source: selectedFood.source,
      photo_uri: null,
      photo_confidence: null,
      flagged_ingredients: flagged,
      notes: null,
    });
  }, [selectedFood, servingIndex, quantity, customWeightGrams, mealType, saveEntry, ingredientFlags]);

  const handleNLPConfirm = useCallback(
    (items: Array<{ name: string; portion: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g?: number | null; sugar_g?: number | null; sodium_mg?: number | null }>) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);

      (async () => {
        const existing = (await storageGet<FoodEntry[]>(key)) ?? [];
        const newEntries: FoodEntry[] = items.map((item) => ({
          id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          meal_type: mealType,
          food_item: {
            source: 'nlp' as const,
            source_id: `nlp:${Date.now()}`,
            name: item.name,
            brand: null,
            barcode: null,
            nutrition_per_100g: {
              calories: item.calories,
              protein_g: item.protein_g,
              carbs_g: item.carbs_g,
              fat_g: item.fat_g,
              fiber_g: item.fiber_g ?? null,
              sugar_g: item.sugar_g ?? null,
              added_sugar_g: null,
              sodium_mg: item.sodium_mg ?? null,
              cholesterol_mg: null,
              saturated_fat_g: null,
              trans_fat_g: null,
              potassium_mg: null,
              vitamin_d_mcg: null,
              calcium_mg: null,
              iron_mg: null,
            },
            serving_sizes: [{ description: item.portion, unit: 'each', gram_weight: 0, quantity: 1 }],
            default_serving_index: 0,
            ingredients: null,
            last_accessed: new Date().toISOString(),
          },
          serving: { description: item.portion, unit: 'each', gram_weight: 0, quantity: 1 },
          quantity: 1,
          computed_nutrition: {
            calories: item.calories,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
            fiber_g: item.fiber_g ?? null,
            sugar_g: item.sugar_g ?? null,
            added_sugar_g: null,
            sodium_mg: item.sodium_mg ?? null,
            cholesterol_mg: null,
            saturated_fat_g: null,
            trans_fat_g: null,
            potassium_mg: null,
            vitamin_d_mcg: null,
            calcium_mg: null,
            iron_mg: null,
          },
          source: 'nlp' as const,
          photo_uri: null,
          photo_confidence: null,
          flagged_ingredients: [],
          notes: null,
        }));

        await storageSet(key, [...existing, ...newEntries]);
        router.back();
      })();
    },
    [mealType],
  );

  const handlePhotoConfirm = useCallback(
    (items: Array<{ name: string; portion: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; confidence: 'high' | 'medium' | 'low'; note: string | null }>, photoUri: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);

      (async () => {
        const existing = (await storageGet<FoodEntry[]>(key)) ?? [];
        const newEntries: FoodEntry[] = items.map((item) => ({
          id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          meal_type: mealType,
          food_item: {
            source: 'ai_photo' as const,
            source_id: `photo:${Date.now()}`,
            name: item.name,
            brand: null,
            barcode: null,
            nutrition_per_100g: {
              calories: item.calories,
              protein_g: item.protein_g,
              carbs_g: item.carbs_g,
              fat_g: item.fat_g,
              fiber_g: null,
              sugar_g: null,
              added_sugar_g: null,
              sodium_mg: null,
              cholesterol_mg: null,
              saturated_fat_g: null,
              trans_fat_g: null,
              potassium_mg: null,
              vitamin_d_mcg: null,
              calcium_mg: null,
              iron_mg: null,
            },
            serving_sizes: [{ description: item.portion, unit: 'each', gram_weight: 0, quantity: 1 }],
            default_serving_index: 0,
            ingredients: null,
            last_accessed: new Date().toISOString(),
          },
          serving: { description: item.portion, unit: 'each', gram_weight: 0, quantity: 1 },
          quantity: 1,
          computed_nutrition: {
            calories: item.calories,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
            fiber_g: null,
            sugar_g: null,
            added_sugar_g: null,
            sodium_mg: null,
            cholesterol_mg: null,
            saturated_fat_g: null,
            trans_fat_g: null,
            potassium_mg: null,
            vitamin_d_mcg: null,
            calcium_mg: null,
            iron_mg: null,
          },
          source: 'ai_photo' as const,
          photo_uri: photoUri,
          photo_confidence: item.confidence,
          flagged_ingredients: [],
          notes: item.note,
        }));

        await storageSet(key, [...existing, ...newEntries]);
        router.back();
      })();
    },
    [mealType],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {screen === 'search' && (
          <>
          <RepeatLastEntry
            tagLabel="food"
            subtitle={lastFoodEntry?.food_item.name}
            visible={lastFoodEntry != null}
            onRepeat={repeatLastFood}
          />
          <FoodSearch
            onSelect={handleFoodSelected}
            onManualEntry={() => setScreen('manual')}
            onQuickLog={() => setScreen('quicklog')}
            onBarcodeScan={() => setScreen('barcode')}
            onNLPEntry={() => setScreen('nlp')}
            onPhotoEntry={() => setScreen('photo')}
          />
          </>
        )}

        {screen === 'barcode' && (
          <BarcodeScanner
            onFoodFound={handleBarcodeFound}
            onNotFound={handleBarcodeNotFound}
            onCancel={() => setScreen('search')}
          />
        )}

        {screen === 'configure' && selectedFood != null && (
          <View style={styles.configureContainer}>
            <ServingSizeSelector
              servingSizes={selectedFood.serving_sizes}
              selectedServingIndex={servingIndex}
              quantity={quantity}
              nutritionPer100g={selectedFood.nutrition_per_100g}
              onServingChange={(idx) => { setCustomWeightGrams(null); setServingIndex(idx); }}
              onQuantityChange={setQuantity}
              onCustomWeight={setCustomWeightGrams}
            />
            <View style={styles.configureActions}>
              <View style={styles.flex1}>
                <Button
                  title="Back"
                  variant="secondary"
                  onPress={() => {
                    setScreen('search');
                    setSelectedFood(null);
                  }}
                />
              </View>
              <View style={styles.flex1}>
                <Button title="Add Food" onPress={handleConfirmServing} />
              </View>
            </View>
          </View>
        )}

        {screen === 'manual' && (
          <FoodEntryForm
            food={null}
            mealType={mealType}
            onSave={saveEntry}
            onCancel={() => setScreen('search')}
          />
        )}

        {screen === 'quicklog' && (
          <QuickLog
            mealType={mealType}
            onSave={saveEntry}
            onCancel={() => setScreen('search')}
          />
        )}

        {screen === 'nlp' && (
          <NLPFoodEntry
            mealType={mealType}
            onConfirm={handleNLPConfirm}
            onCancel={() => setScreen('search')}
          />
        )}

        {screen === 'photo' && (
          <PhotoFoodEntry
            mealType={mealType}
            onConfirm={handlePhotoConfirm}
            onCancel={() => setScreen('search')}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 16,
  },
  configureContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  configureActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
  },
  flex1: {
    flex: 1,
  },
});
