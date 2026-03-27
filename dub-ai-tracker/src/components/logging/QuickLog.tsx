// Calorie-only quick entry with optional protein
// Phase 6: Food Logging -- Core

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../common/Button';
import type { FoodEntry, MealType, NutritionInfo } from '../../types/food';

interface QuickLogProps {
  mealType: MealType;
  onSave: (entry: Omit<FoodEntry, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
}

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const QUICK_AMOUNTS = [100, 200, 300, 400, 500, 750, 1000] as const;

export function QuickLog({ mealType, onSave, onCancel }: QuickLogProps) {
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [description, setDescription] = useState('');
  const [meal, setMeal] = useState<MealType>(mealType);

  const calNum = parseFloat(calories);
  const canSave = !isNaN(calNum) && calNum > 0;

  const handleSave = () => {
    const cal = parseFloat(calories) || 0;
    const prot = parseFloat(protein) || 0;

    const nutrition: NutritionInfo = {
      calories: cal,
      protein_g: prot,
      carbs_g: 0,
      fat_g: 0,
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
    };

    onSave({
      meal_type: meal,
      food_item: {
        source: 'manual',
        source_id: `quicklog:${Date.now()}`,
        name: description.trim() || `Quick log (${cal} kcal)`,
        brand: null,
        barcode: null,
        nutrition_per_100g: nutrition,
        serving_sizes: [
          {
            description: '1 entry',
            unit: 'each',
            gram_weight: 100,
            quantity: 1,
          },
        ],
        default_serving_index: 0,
        ingredients: null,
        last_accessed: new Date().toISOString(),
      },
      serving: {
        description: '1 entry',
        unit: 'each',
        gram_weight: 100,
        quantity: 1,
      },
      quantity: 1,
      computed_nutrition: nutrition,
      source: 'manual',
      photo_uri: null,
      photo_confidence: null,
      flagged_ingredients: [],
      notes: null,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flash" size={24} color={Colors.accent} />
        <Text style={styles.heading}>Quick Log</Text>
      </View>

      {/* Meal type */}
      <View style={styles.mealRow}>
        {MEAL_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.mealChip, meal === opt.value && styles.mealChipSelected]}
            onPress={() => setMeal(opt.value)}
          >
            <Text
              style={[
                styles.mealChipText,
                meal === opt.value && styles.mealChipTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Calorie input */}
      <Text style={styles.label}>Calories *</Text>
      <TextInput
        style={styles.mainInput}
        value={calories}
        onChangeText={setCalories}
        placeholder="0"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="numeric"
        autoFocus
      />

      {/* Quick amount buttons */}
      <View style={styles.quickAmounts}>
        {QUICK_AMOUNTS.map((amt) => (
          <TouchableOpacity
            key={amt}
            style={styles.quickAmountBtn}
            onPress={() => setCalories(String(amt))}
          >
            <Text style={styles.quickAmountText}>{amt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Optional protein */}
      <Text style={styles.label}>Protein (g) -- optional</Text>
      <TextInput
        style={styles.input}
        value={protein}
        onChangeText={setProtein}
        placeholder="0"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="numeric"
      />

      {/* Optional description */}
      <Text style={styles.label}>Description -- optional</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="e.g., Lunch out with friends"
        placeholderTextColor={Colors.secondaryText}
      />

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.flex1}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.flex1}>
          <Button title="Log" onPress={handleSave} disabled={!canSave} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  heading: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  mealRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  mealChipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  mealChipText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  mealChipTextSelected: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  label: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
  },
  mainInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.accent,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    fontVariant: ['tabular-nums'],
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickAmountBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
  },
  quickAmountText: {
    color: Colors.text,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  flex1: {
    flex: 1,
  },
});
