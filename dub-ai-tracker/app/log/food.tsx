// Food logging screen -- search, select, configure serving, save
// Phase 6: Food Logging -- Core

import { useState, useCallback } from 'react';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../../src/utils/storage';
import { scaleNutrition } from '../../src/utils/servingmath';
import { FoodSearch } from '../../src/components/logging/FoodSearch';
import { FoodEntryForm } from '../../src/components/logging/FoodEntryForm';
import { QuickLog } from '../../src/components/logging/QuickLog';
import { ServingSizeSelector } from '../../src/components/logging/ServingSizeSelector';
import { Button } from '../../src/components/common/Button';
import type { FoodItem, FoodEntry, MealType } from '../../src/types/food';

type Screen = 'search' | 'configure' | 'manual' | 'quicklog';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

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
  const [mealType] = useState<MealType>(guessMealType);

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
      router.back();
    },
    [],
  );

  const handleFoodSelected = useCallback((food: FoodItem) => {
    setSelectedFood(food);
    setServingIndex(food.default_serving_index);
    setQuantity(1);
    setScreen('configure');
  }, []);

  const handleConfirmServing = useCallback(() => {
    if (selectedFood == null) return;
    const serving = selectedFood.serving_sizes[servingIndex];
    const computed = scaleNutrition(selectedFood.nutrition_per_100g, serving, quantity);

    saveEntry({
      meal_type: mealType,
      food_item: selectedFood,
      serving,
      quantity,
      computed_nutrition: computed,
      source: selectedFood.source,
      photo_uri: null,
      photo_confidence: null,
      flagged_ingredients: [],
      notes: null,
    });
  }, [selectedFood, servingIndex, quantity, mealType, saveEntry]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {screen === 'search' && (
          <FoodSearch
            onSelect={handleFoodSelected}
            onManualEntry={() => setScreen('manual')}
            onQuickLog={() => setScreen('quicklog')}
          />
        )}

        {screen === 'configure' && selectedFood != null && (
          <View style={styles.configureContainer}>
            <ServingSizeSelector
              servingSizes={selectedFood.serving_sizes}
              selectedServingIndex={servingIndex}
              quantity={quantity}
              nutritionPer100g={selectedFood.nutrition_per_100g}
              onServingChange={setServingIndex}
              onQuantityChange={setQuantity}
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
