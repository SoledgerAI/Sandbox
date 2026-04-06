// Food logging screen -- search, select, configure serving, save
// Phase 6: Food Logging -- Core
// Phase 19: NLP text entry and photo food entry integration

import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView } from 'react-native';
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
import { TimestampPicker } from '../../src/components/common/TimestampPicker';
import { RepeatLastEntry } from '../../src/components/logging/RepeatLastEntry';
import { useLastEntry } from '../../src/hooks/useLastEntry';
import { loadIngredientFlags, detectFlaggedIngredients } from '../../src/utils/ingredients';
import type { FoodItem, FoodEntry, MealType, IngredientFlag, RecentFoodInfo } from '../../src/types/food';
import { todayDateString } from '../../src/utils/dayBoundary';
import type { AppSettings } from '../../src/types/profile';

type Screen = 'search' | 'configure' | 'manual' | 'quicklog' | 'barcode' | 'nlp' | 'photo' | 'quickconfirm';


function guessMealType(hour: number, settings?: AppSettings | null): MealType {
  if (settings?.fasting_enabled) {
    const start = settings.eating_window_start ?? 12;
    const end = settings.eating_window_end ?? 20;
    if (hour < start || hour >= end) {
      return 'snack'; // Outside eating window
    }
    // Inside window: divide into thirds for meal categorization
    const windowLength = end - start;
    const elapsed = hour - start;
    if (elapsed < windowLength / 3) return 'lunch';  // First meal (not "breakfast")
    if (elapsed < (windowLength * 2) / 3) return 'dinner';
    return 'snack';
  }
  // Original logic for non-fasting users
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

export default function FoodLogScreen() {
  const [entryTimestamp, setEntryTimestamp] = useState(new Date());
  const [screen, setScreen] = useState<Screen>('search');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingIndex, setServingIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [customWeightGrams, setCustomWeightGrams] = useState<number | null>(null);
  const [mealType, setMealType] = useState<MealType>(() => guessMealType(new Date().getHours()));
  const [ingredientFlags, setIngredientFlags] = useState<IngredientFlag[]>([]);
  const [quickConfirmEntry, setQuickConfirmEntry] = useState<RecentFoodInfo | null>(null);
  const { lastEntry: lastFoodEntry, saveAsLast: saveLastFood } = useLastEntry<FoodEntry>('nutrition.food');

  useEffect(() => {
    loadIngredientFlags().then(setIngredientFlags);
    // Load fasting settings to refine meal type guess
    storageGet<AppSettings>(STORAGE_KEYS.SETTINGS).then((settings) => {
      if (settings?.fasting_enabled) {
        setMealType(guessMealType(new Date().getHours(), settings));
      }
    });
  }, []);

  const saveEntry = useCallback(
    async (partial: Omit<FoodEntry, 'id' | 'timestamp'>) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
      const existing = (await storageGet<FoodEntry[]>(key)) ?? [];

      const entry: FoodEntry = {
        ...partial,
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: entryTimestamp.toISOString(),
      };

      await storageSet(key, [...existing, entry]);
      await saveLastFood(entry);

      // F-03: Update recent foods with enriched serving info
      const recentList = (await storageGet<RecentFoodInfo[]>(STORAGE_KEYS.FOOD_RECENT)) ?? [];
      const recentEntry: RecentFoodInfo = {
        food_item: { ...partial.food_item, last_accessed: new Date().toISOString() },
        serving: partial.serving,
        quantity: partial.quantity,
        calories: Math.round(partial.computed_nutrition.calories),
      };
      const filteredRecent = recentList.filter((r) => r.food_item.source_id !== partial.food_item.source_id);
      await storageSet(STORAGE_KEYS.FOOD_RECENT, [recentEntry, ...filteredRecent].slice(0, 50));

      router.back();
    },
    [saveLastFood, entryTimestamp],
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

  // F-03: Quick confirm for recent food (2-tap flow)
  const handleRecentTap = useCallback((entry: RecentFoodInfo) => {
    setQuickConfirmEntry(entry);
    setScreen('quickconfirm');
  }, []);

  const handleQuickConfirm = useCallback(() => {
    if (!quickConfirmEntry) return;
    const { food_item, serving, quantity: qty } = quickConfirmEntry;
    const computed = scaleNutrition(food_item.nutrition_per_100g, serving, qty);
    saveEntry({
      meal_type: mealType,
      food_item,
      serving,
      quantity: qty,
      computed_nutrition: computed,
      source: food_item.source,
      photo_uri: null,
      photo_confidence: null,
      flagged_ingredients: [],
      notes: null,
    });
  }, [quickConfirmEntry, mealType, saveEntry]);

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
          timestamp: entryTimestamp.toISOString(),
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
    [mealType, entryTimestamp],
  );

  const handlePhotoConfirm = useCallback(
    (items: Array<{ name: string; portion: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; confidence: 'high' | 'medium' | 'low'; note: string | null }>, photoUri: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);

      (async () => {
        const existing = (await storageGet<FoodEntry[]>(key)) ?? [];
        const newEntries: FoodEntry[] = items.map((item) => ({
          id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: entryTimestamp.toISOString(),
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
    [mealType, entryTimestamp],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TimestampPicker value={entryTimestamp} onChange={setEntryTimestamp} />
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
            onRecentTap={handleRecentTap}
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

        {/* F-03: Quick confirm for recent food (2-tap flow) */}
        {screen === 'quickconfirm' && quickConfirmEntry && (
          <View style={styles.quickConfirmContainer}>
            <View style={styles.quickConfirmCard}>
              <Text style={styles.quickConfirmName}>{quickConfirmEntry.food_item.name}</Text>
              <Text style={styles.quickConfirmServing}>
                {quickConfirmEntry.serving?.description ?? 'Default serving'}
                {quickConfirmEntry.quantity > 1 ? ` x${quickConfirmEntry.quantity}` : ''}
              </Text>
              <Text style={styles.quickConfirmCal}>
                {quickConfirmEntry.calories} cal
              </Text>
            </View>
            <View style={styles.configureActions}>
              <View style={styles.flex1}>
                <Button
                  title="Change"
                  variant="secondary"
                  onPress={() => {
                    // Go to full configure mode
                    setSelectedFood(quickConfirmEntry.food_item);
                    const idx = quickConfirmEntry.food_item.serving_sizes.findIndex(
                      (s) => s.description === quickConfirmEntry.serving?.description,
                    );
                    setServingIndex(idx >= 0 ? idx : quickConfirmEntry.food_item.default_serving_index);
                    setQuantity(quickConfirmEntry.quantity);
                    setCustomWeightGrams(null);
                    setScreen('configure');
                  }}
                />
              </View>
              <View style={styles.flex2}>
                <Button title="Log" onPress={handleQuickConfirm} />
              </View>
            </View>
          </View>
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
  flex2: {
    flex: 2,
  },
  quickConfirmContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  quickConfirmCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  quickConfirmName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickConfirmServing: {
    color: Colors.secondaryText,
    fontSize: 15,
    textAlign: 'center',
  },
  quickConfirmCal: {
    color: Colors.accentText,
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums' as const],
    marginTop: 8,
  },
});
