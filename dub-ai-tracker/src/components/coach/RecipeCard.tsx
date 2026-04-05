// Recipe card component with nutrition info and Instacart button
// Phase 20: Data Expansion and Recipe Engine

import { useState, useCallback } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize } from '../../constants/typography';
import { scaleRecipe } from '../../ai/recipe_engine';
import type { Recipe } from '../../ai/recipe_engine';
import { openInstacartWithIngredients, buildShoppingListText } from '../../services/instacart';

interface RecipeCardProps {
  recipe: Recipe;
  onDismiss?: () => void;
}

export function RecipeCard({ recipe: initialRecipe, onDismiss }: RecipeCardProps) {
  const [servings, setServings] = useState(initialRecipe.servings);
  const [expanded, setExpanded] = useState(false);

  const recipe = servings === initialRecipe.servings
    ? initialRecipe
    : scaleRecipe(initialRecipe, servings);

  const adjustServings = useCallback((delta: number) => {
    setServings((prev) => Math.max(1, prev + delta));
  }, []);

  const handleInstacart = useCallback(async () => {
    try {
      await openInstacartWithIngredients(recipe.ingredients);
    } catch {
      Alert.alert('Unable to Open', 'Could not open Instacart. The shopping list has been copied to your clipboard.');
      const text = buildShoppingListText(recipe.ingredients);
      await Clipboard.setStringAsync(text);
    }
  }, [recipe.ingredients]);

  const handleCopyList = useCallback(async () => {
    const text = buildShoppingListText(recipe.ingredients);
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Shopping list copied to clipboard.');
  }, [recipe.ingredients]);

  const n = recipe.total_nutrition;
  const matchColor = recipe.macro_match_pct >= 90
    ? Colors.success
    : recipe.macro_match_pct >= 75
      ? Colors.warning
      : Colors.danger;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{recipe.name}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {recipe.description}
          </Text>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={Colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{n.calories}</Text>
          <Text style={styles.statLabel}>cal</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{n.protein_g}g</Text>
          <Text style={styles.statLabel}>protein</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{recipe.prep_time_min}m</Text>
          <Text style={styles.statLabel}>prep</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{recipe.cook_time_min}m</Text>
          <Text style={styles.statLabel}>cook</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{recipe.ingredients.length}</Text>
          <Text style={styles.statLabel}>items</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: matchColor }]}>{recipe.macro_match_pct}%</Text>
          <Text style={styles.statLabel}>match</Text>
        </View>
      </View>

      {/* Macro breakdown */}
      <View style={styles.macroRow}>
        <Text style={styles.macroText}>C: {n.carbs_g}g</Text>
        <Text style={styles.macroDivider}>|</Text>
        <Text style={styles.macroText}>F: {n.fat_g}g</Text>
        <Text style={styles.macroDivider}>|</Text>
        <Text style={styles.macroText}>P: {n.protein_g}g</Text>
      </View>

      {recipe.relaxed_constraint && (
        <Text style={styles.relaxedNote}>
          Note: {recipe.relaxed_constraint}
        </Text>
      )}

      {/* Servings adjuster */}
      <View style={styles.servingsRow}>
        <Text style={styles.servingsLabel}>Servings:</Text>
        <TouchableOpacity
          style={styles.servingsButton}
          onPress={() => adjustServings(-1)}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={16} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.servingsValue}>{servings}</Text>
        <TouchableOpacity
          style={styles.servingsButton}
          onPress={() => adjustServings(1)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Expand/collapse details */}
      <TouchableOpacity
        style={styles.expandToggle}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.expandText}>
          {expanded ? 'Hide Details' : 'Show Ingredients & Instructions'}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.accent}
        />
      </TouchableOpacity>

      {expanded && (
        <>
          {/* Ingredients */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ing, idx) => (
              <View key={idx} style={styles.ingredientRow}>
                <Text style={styles.ingredientAmount}>
                  {ing.amount} {ing.unit}
                </Text>
                <Text style={styles.ingredientName}>{ing.name}</Text>
                <Text style={styles.ingredientCal}>{ing.calories} cal</Text>
              </View>
            ))}
          </View>

          {/* Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.instructions.map((step) => (
              <View key={step.step_number} style={styles.stepRow}>
                <Text style={styles.stepNumber}>{step.step_number}.</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.instacartButton}
          onPress={handleInstacart}
          activeOpacity={0.7}
        >
          <Ionicons name="cart-outline" size={18} color={Colors.primaryBackground} />
          <Text style={styles.instacartText}>Add to Instacart</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.copyButton}
          onPress={handleCopyList}
          activeOpacity={0.7}
        >
          <Ionicons name="copy-outline" size={18} color={Colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: { flex: 1, marginRight: 8 },
  name: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  stat: { alignItems: 'center' },
  statValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  statLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  macroText: { color: Colors.secondaryText, fontSize: 13 },
  macroDivider: { color: Colors.divider, fontSize: 13 },
  relaxedNote: {
    color: Colors.warning,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  servingsLabel: { color: Colors.secondaryText, fontSize: 13 },
  servingsButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  expandText: { color: Colors.accentText, fontSize: 13, fontWeight: '500' },
  section: { marginTop: 12 },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  ingredientAmount: {
    color: Colors.secondaryText,
    fontSize: 13,
    width: 80,
  },
  ingredientName: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
  },
  ingredientCal: {
    color: Colors.secondaryText,
    fontSize: 12,
    width: 50,
    textAlign: 'right',
  },
  stepRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: 8,
  },
  stepNumber: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '600',
    width: 20,
  },
  stepText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  instacartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
  },
  instacartText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '600',
  },
  copyButton: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
  },
});
