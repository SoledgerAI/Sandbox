// Display a logged food item in the daily food list
// Phase 6: Food Logging -- Core
// Phase 19: Ingredient flag icons on flagged foods

import React from 'react';
import { Alert, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { FoodEntry } from '../../types/food';
import { formatNutrient } from '../../utils/servingmath';

const INGREDIENT_FLAG_DISCLAIMER =
  'Ingredient flags are informational only. DUB_AI does not make health claims about specific ingredients.';

interface FoodEntryCardProps {
  entry: FoodEntry;
  onPress?: () => void;
  onDelete?: () => void;
  onFavorite?: () => void;
  hideCalories?: boolean;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const FoodEntryCard = React.memo(function FoodEntryCard({ entry, onPress, onDelete, onFavorite, hideCalories }: FoodEntryCardProps) {
  const { food_item, computed_nutrition, quantity, serving, meal_type, flagged_ingredients } = entry;
  const cal = Math.round(computed_nutrition.calories);
  const servingDesc =
    quantity !== 1
      ? `${quantity}x ${serving.description}`
      : serving.description;
  const hasFlaggedIngredients = flagged_ingredients && flagged_ingredients.length > 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.mainRow}>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {food_item.name}
            </Text>
            {hasFlaggedIngredients && (
              <FlagBadge ingredients={flagged_ingredients} />
            )}
          </View>
          <Text style={styles.details} numberOfLines={1}>
            {servingDesc}
            {food_item.brand ? ` \u2022 ${food_item.brand}` : ''}
          </Text>
        </View>
        {!hideCalories && (
          <View style={styles.calColumn}>
            <Text style={styles.calories}>{cal}</Text>
            <Text style={styles.calLabel}>kcal</Text>
          </View>
        )}
      </View>

      <View style={styles.macroRow}>
        <Text style={styles.mealBadge}>{MEAL_LABELS[meal_type] ?? meal_type}</Text>
        <View style={styles.macros}>
          <MacroPill label="P" value={formatNutrient(computed_nutrition.protein_g, 'g')} />
          <MacroPill label="C" value={formatNutrient(computed_nutrition.carbs_g, 'g')} />
          <MacroPill label="F" value={formatNutrient(computed_nutrition.fat_g, 'g')} />
        </View>
        <View style={styles.actions}>
          {onFavorite != null && (
            <TouchableOpacity onPress={onFavorite} hitSlop={8} style={styles.actionBtn}>
              <Ionicons name="heart-outline" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          )}
          {onDelete != null && (
            <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

function FlagBadge({ ingredients }: { ingredients: string[] }) {
  return (
    <TouchableOpacity
      onPress={() =>
        Alert.alert(
          'Flagged Ingredients',
          `${ingredients.join(', ')}\n\n${INGREDIENT_FLAG_DISCLAIMER}`,
        )
      }
      hitSlop={6}
      style={styles.flagBadge}
    >
      <Ionicons name="flag" size={12} color={Colors.warning} />
      <TouchableOpacity
        onPress={() => Alert.alert('Info', INGREDIENT_FLAG_DISCLAIMER)}
        hitSlop={4}
      >
        <Ionicons name="information-circle-outline" size={11} color={Colors.secondaryText} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function MacroPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.warning + '18',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  details: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  calColumn: {
    alignItems: 'flex-end',
  },
  calories: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  calLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: -2,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  mealBadge: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginRight: 10,
  },
  macros: {
    flexDirection: 'row',
    flex: 1,
    gap: 6,
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  macroLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '700',
    marginRight: 3,
  },
  macroValue: {
    color: Colors.text,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
