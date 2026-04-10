// Recipe portion logging screen
// Sprint 20: Recipe Builder — "I ate 30%" portion selection + log

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { PremiumButton } from '../../src/components/common/PremiumButton';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { useToast } from '../../src/contexts/ToastContext';
import { hapticLight, hapticSuccess, hapticSelection } from '../../src/utils/haptics';
import {
  getMyRecipes,
  incrementRecipeTimesLogged,
  calculatePortionByPercentage,
  calculatePortionByServings,
  calculatePortionByWeight,
} from '../../src/utils/recipeLibrary';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../../src/utils/storage';
import { todayDateString } from '../../src/utils/dayBoundary';
import { getActiveDate } from '../../src/services/dateContextService';
import type { MyRecipe, RecipePortionMethod, RecipeMacros, FoodEntry, NutritionInfo } from '../../src/types/food';

type TabId = 'percentage' | 'servings' | 'weight';

const TABS: { id: TabId; label: string }[] = [
  { id: 'percentage', label: '% of Batch' },
  { id: 'servings', label: 'Servings' },
  { id: 'weight', label: 'By Weight' },
];

const SERVING_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];

export default function RecipeLogScreen() {
  const params = useLocalSearchParams<{ recipeId: string }>();
  const { showToast } = useToast();

  const [recipe, setRecipe] = useState<MyRecipe | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('percentage');
  const [percentage, setPercentage] = useState(50);
  const [servingCount, setServingCount] = useState(1);
  const [portionWeight, setPortionWeight] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (params.recipeId) {
      getMyRecipes().then((recipes) => {
        const found = recipes.find((r) => r.id === params.recipeId);
        setRecipe(found ?? null);
      });
    }
  }, [params.recipeId]);

  const currentMacros: RecipeMacros = useMemo(() => {
    if (!recipe) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    switch (activeTab) {
      case 'percentage':
        return calculatePortionByPercentage(recipe.totalMacros, percentage);
      case 'servings':
        return calculatePortionByServings(recipe.macrosPerServing, servingCount);
      case 'weight': {
        const w = parseFloat(portionWeight) || 0;
        if (!recipe.totalWeight || recipe.totalWeight <= 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
        return calculatePortionByWeight(recipe.totalMacros, recipe.totalWeight, w);
      }
    }
  }, [recipe, activeTab, percentage, servingCount, portionWeight]);

  const portionLabel = useMemo(() => {
    switch (activeTab) {
      case 'percentage': return `${percentage}% of batch`;
      case 'servings': return `${servingCount} serving${servingCount !== 1 ? 's' : ''}`;
      case 'weight': return `${portionWeight || 0}g`;
    }
  }, [activeTab, percentage, servingCount, portionWeight]);

  const handleLog = useCallback(async () => {
    if (!recipe) return;
    setLogging(true);

    try {
      const targetDate = getActiveDate() ?? todayDateString();
      const logKey = dateKey(STORAGE_KEYS.LOG_FOOD, targetDate);

      // Build a FoodEntry compatible with existing food log
      const now = new Date().toISOString();
      const hour = new Date().getHours();
      const mealType = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 20 ? 'dinner' : 'snack';

      const nutrition: NutritionInfo = {
        calories: currentMacros.calories,
        protein_g: currentMacros.protein,
        carbs_g: currentMacros.carbs,
        fat_g: currentMacros.fat,
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

      const entry: FoodEntry = {
        id: `recipe_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now,
        meal_type: mealType as any,
        food_item: {
          source: 'recipe',
          source_id: recipe.id,
          name: `${recipe.name} (${portionLabel})`,
          brand: null,
          barcode: null,
          nutrition_per_100g: nutrition, // approximate
          serving_sizes: [{ description: portionLabel, unit: 'piece', gram_weight: 0, quantity: 1 }],
          default_serving_index: 0,
          ingredients: recipe.ingredients.map((i) => i.name).join(', '),
          last_accessed: now,
        },
        serving: { description: portionLabel, unit: 'piece', gram_weight: 0, quantity: 1 },
        quantity: 1,
        computed_nutrition: nutrition,
        source: 'recipe',
        photo_uri: recipe.photo_uri ?? null,
        photo_confidence: null,
        flagged_ingredients: [],
        notes: `Recipe: ${recipe.name} | ${portionLabel}`,
      };

      const existing = await storageGet<FoodEntry[]>(logKey) ?? [];
      await storageSet(logKey, [...existing, entry]);
      await incrementRecipeTimesLogged(recipe.id);

      hapticSuccess();
      showToast(`Logged ${recipe.name} (${portionLabel})`, 'success');
      router.back();
    } catch (error) {
      console.error('[RecipeLog] Failed to log:', error);
      Alert.alert('Error', 'Failed to log recipe. Try again.');
    } finally {
      setLogging(false);
    }
  }, [recipe, activeTab, percentage, servingCount, portionWeight, currentMacros, portionLabel, showToast]);

  if (!recipe) {
    return (
      <ScreenWrapper>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={styles.emptyText}>Loading recipe...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Recipe</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollPadding}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recipe info card */}
          <PremiumCard elevated>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <View style={styles.totalMacroRow}>
              <Text style={styles.totalLabel}>Total recipe:</Text>
              <Text style={styles.totalMacroText}>
                {recipe.totalMacros.calories} cal {'\u2022'} {recipe.totalMacros.protein}p {'\u2022'} {recipe.totalMacros.carbs}c {'\u2022'} {recipe.totalMacros.fat}f
              </Text>
            </View>
            <Text style={styles.servingInfo}>
              {recipe.totalServings} serving{recipe.totalServings !== 1 ? 's' : ''}
              {recipe.totalWeight ? ` \u2022 ${recipe.totalWeight}g total` : ''}
            </Text>
          </PremiumCard>

          {/* Tab selector */}
          <View style={styles.tabRow}>
            {TABS.map((tab) => {
              const disabled = tab.id === 'weight' && !recipe.totalWeight;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tab,
                    activeTab === tab.id && styles.tabActive,
                    disabled && styles.tabDisabled,
                  ]}
                  onPress={() => {
                    if (disabled) return;
                    hapticSelection();
                    setActiveTab(tab.id);
                  }}
                  disabled={disabled}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive,
                    disabled && styles.tabTextDisabled,
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Portion selector */}
          <PremiumCard>
            {activeTab === 'percentage' && (
              <View>
                <Text style={styles.portionTitle}>
                  I ate <Text style={styles.portionHighlight}>{percentage}%</Text> of the total batch
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.percentagePicker}
                >
                  {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.servingChip, percentage === pct && styles.servingChipActive]}
                      onPress={() => { hapticLight(); setPercentage(pct); }}
                    >
                      <Text style={[
                        styles.servingChipText,
                        percentage === pct && styles.servingChipTextActive,
                      ]}>
                        {pct}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeTab === 'servings' && (
              <View>
                <Text style={styles.portionTitle}>
                  I ate <Text style={styles.portionHighlight}>{servingCount}</Text> serving{servingCount !== 1 ? 's' : ''}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.servingPicker}
                >
                  {SERVING_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.servingChip, servingCount === opt && styles.servingChipActive]}
                      onPress={() => { hapticSelection(); setServingCount(opt); }}
                    >
                      <Text style={[
                        styles.servingChipText,
                        servingCount === opt && styles.servingChipTextActive,
                      ]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeTab === 'weight' && (
              <View>
                <Text style={styles.portionTitle}>My portion weighed:</Text>
                <View style={styles.weightInputRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={portionWeight}
                    onChangeText={setPortionWeight}
                    placeholder="e.g., 200"
                    placeholderTextColor={Colors.secondaryText}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.weightUnit}>grams</Text>
                </View>
              </View>
            )}
          </PremiumCard>

          {/* Live macro display */}
          <PremiumCard elevated>
            <Text style={styles.macroDisplayTitle}>Your Portion</Text>
            <View style={styles.macroDisplayRow}>
              <View style={styles.macroDisplayItem}>
                <Text style={styles.macroDisplayNumber}>{currentMacros.calories}</Text>
                <Text style={styles.macroDisplayLabel}>cal</Text>
              </View>
              <View style={styles.macroDisplayItem}>
                <Text style={styles.macroDisplayNumber}>{currentMacros.protein}</Text>
                <Text style={styles.macroDisplayLabel}>protein</Text>
              </View>
              <View style={styles.macroDisplayItem}>
                <Text style={styles.macroDisplayNumber}>{currentMacros.carbs}</Text>
                <Text style={styles.macroDisplayLabel}>carbs</Text>
              </View>
              <View style={styles.macroDisplayItem}>
                <Text style={styles.macroDisplayNumber}>{currentMacros.fat}</Text>
                <Text style={styles.macroDisplayLabel}>fat</Text>
              </View>
            </View>
          </PremiumCard>

          <View style={{ height: Spacing.lg }} />
          <PremiumButton
            label="Log It"
            onPress={handleLog}
            loading={logging}
            size="large"
          />
          <View style={{ height: Spacing.jumbo }} />
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  scrollPadding: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.jumbo,
  },
  recipeName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  totalMacroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  totalMacroText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '600',
  },
  servingInfo: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabDisabled: {
    opacity: 0.4,
  },
  tabText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.primaryBackground,
  },
  tabTextDisabled: {
    color: Colors.secondaryText,
  },
  portionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  portionHighlight: {
    color: Colors.accentText,
    fontWeight: '700',
    fontSize: 20,
  },
  percentagePicker: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    flexWrap: 'wrap',
  },
  servingPicker: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  servingChip: {
    width: 52,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  servingChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  servingChipText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  servingChipTextActive: {
    color: Colors.primaryBackground,
    fontWeight: '700',
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
  },
  weightUnit: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '500',
  },
  macroDisplayTitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  macroDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroDisplayItem: {
    alignItems: 'center',
  },
  macroDisplayNumber: {
    color: Colors.accentText,
    fontSize: 24,
    fontWeight: '700',
  },
  macroDisplayLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 16,
  },
});
