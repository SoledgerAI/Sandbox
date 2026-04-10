// Recipe creation / edit screen
// Sprint 20: Recipe Builder + Macro Calculator

import { useState, useCallback, useEffect } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
  calculateTotalMacros,
  calculatePerServingMacros,
  generateRecipeId,
  saveRecipe,
  getMyRecipes,
} from '../../src/utils/recipeLibrary';
import type { MyRecipe, MyRecipeIngredient, RecipeUnit, RecipeMacros } from '../../src/types/food';

const UNIT_OPTIONS: RecipeUnit[] = [
  'lbs', 'oz', 'g', 'kg', 'cups', 'tbsp', 'tsp', 'whole', 'slices', 'cans', 'pieces',
];

type EditMode = 'list' | 'add-ingredient';

export default function RecipeCreateScreen() {
  const params = useLocalSearchParams<{ recipeId?: string }>();
  const { showToast } = useToast();
  const isEditing = !!params.recipeId;

  // Recipe state
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<MyRecipeIngredient[]>([]);
  const [totalServings, setTotalServings] = useState('1');
  const [totalWeight, setTotalWeight] = useState('');
  const [mode, setMode] = useState<EditMode>('list');

  // Ingredient form state
  const [ingName, setIngName] = useState('');
  const [ingAmount, setIngAmount] = useState('');
  const [ingUnit, setIngUnit] = useState<RecipeUnit>('whole');
  const [ingCalories, setIngCalories] = useState('');
  const [ingProtein, setIngProtein] = useState('');
  const [ingCarbs, setIngCarbs] = useState('');
  const [ingFat, setIngFat] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Load existing recipe if editing
  useEffect(() => {
    if (params.recipeId) {
      getMyRecipes().then((recipes) => {
        const recipe = recipes.find((r) => r.id === params.recipeId);
        if (recipe) {
          setRecipeName(recipe.name);
          setIngredients(recipe.ingredients);
          setTotalServings(String(recipe.totalServings));
          if (recipe.totalWeight) setTotalWeight(String(recipe.totalWeight));
        }
      });
    }
  }, [params.recipeId]);

  const totalMacros = calculateTotalMacros(ingredients);
  const servingCount = Math.max(parseFloat(totalServings) || 1, 0.25);
  const perServing = calculatePerServingMacros(totalMacros, servingCount);

  const resetIngredientForm = useCallback(() => {
    setIngName('');
    setIngAmount('');
    setIngUnit('whole');
    setIngCalories('');
    setIngProtein('');
    setIngCarbs('');
    setIngFat('');
    setEditingIndex(null);
  }, []);

  const handleAddIngredient = useCallback(() => {
    if (!ingName.trim()) {
      Alert.alert('Missing Name', 'Enter an ingredient name.');
      return;
    }
    const amount = parseFloat(ingAmount) || 0;
    if (amount <= 0) {
      Alert.alert('Missing Amount', 'Enter a valid amount.');
      return;
    }

    const newIngredient: MyRecipeIngredient = {
      name: ingName.trim(),
      amount,
      unit: ingUnit,
      calories: parseFloat(ingCalories) || 0,
      protein: parseFloat(ingProtein) || 0,
      carbs: parseFloat(ingCarbs) || 0,
      fat: parseFloat(ingFat) || 0,
    };

    if (editingIndex !== null) {
      setIngredients((prev) => prev.map((ing, i) => (i === editingIndex ? newIngredient : ing)));
    } else {
      setIngredients((prev) => [...prev, newIngredient]);
    }

    hapticLight();
    resetIngredientForm();
    setMode('list');
  }, [ingName, ingAmount, ingUnit, ingCalories, ingProtein, ingCarbs, ingFat, editingIndex, resetIngredientForm]);

  const handleEditIngredient = useCallback((index: number) => {
    const ing = ingredients[index];
    setIngName(ing.name);
    setIngAmount(String(ing.amount));
    setIngUnit(ing.unit);
    setIngCalories(String(ing.calories));
    setIngProtein(String(ing.protein));
    setIngCarbs(String(ing.carbs));
    setIngFat(String(ing.fat));
    setEditingIndex(index);
    setMode('add-ingredient');
  }, [ingredients]);

  const handleRemoveIngredient = useCallback((index: number) => {
    hapticSelection();
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!recipeName.trim()) {
      Alert.alert('Missing Name', 'Give your recipe a name.');
      return;
    }
    if (ingredients.length === 0) {
      Alert.alert('No Ingredients', 'Add at least one ingredient.');
      return;
    }

    const now = new Date().toISOString();
    const finalTotalMacros = calculateTotalMacros(ingredients);
    const finalServings = Math.max(parseFloat(totalServings) || 1, 0.25);
    const finalPerServing = calculatePerServingMacros(finalTotalMacros, finalServings);
    const weightG = parseFloat(totalWeight) || undefined;

    const recipe: MyRecipe = {
      id: params.recipeId || generateRecipeId(),
      name: recipeName.trim(),
      ingredients,
      totalServings: finalServings,
      totalWeight: weightG,
      macrosPerServing: finalPerServing,
      totalMacros: finalTotalMacros,
      timesLogged: 0,
      lastLogged: null,
      createdAt: isEditing ? '' : now, // preserved if editing
      updatedAt: now,
      photo_uri: undefined,
    };

    // If editing, preserve original creation date and timesLogged
    if (isEditing) {
      const existing = await getMyRecipes();
      const original = existing.find((r) => r.id === params.recipeId);
      if (original) {
        recipe.createdAt = original.createdAt;
        recipe.timesLogged = original.timesLogged;
        recipe.lastLogged = original.lastLogged;
        recipe.photo_uri = original.photo_uri;
      }
    }

    await saveRecipe(recipe);
    hapticSuccess();
    showToast(isEditing ? 'Recipe updated!' : 'Recipe saved!', 'success');
    router.back();
  }, [recipeName, ingredients, totalServings, totalWeight, params.recipeId, isEditing, showToast]);

  const renderMacroRow = (label: string, macros: RecipeMacros) => (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroValues}>
        <Text style={styles.macroVal}>{macros.calories}<Text style={styles.macroUnit}> cal</Text></Text>
        <Text style={styles.macroDot}>{'\u2022'}</Text>
        <Text style={styles.macroVal}>{macros.protein}<Text style={styles.macroUnit}>p</Text></Text>
        <Text style={styles.macroDot}>{'\u2022'}</Text>
        <Text style={styles.macroVal}>{macros.carbs}<Text style={styles.macroUnit}>c</Text></Text>
        <Text style={styles.macroDot}>{'\u2022'}</Text>
        <Text style={styles.macroVal}>{macros.fat}<Text style={styles.macroUnit}>f</Text></Text>
      </View>
    </View>
  );

  // Ingredient adding/editing form
  if (mode === 'add-ingredient') {
    return (
      <ScreenWrapper>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => { resetIngredientForm(); setMode('list'); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {editingIndex !== null ? 'Edit Ingredient' : 'Add Ingredient'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollPadding}
            keyboardShouldPersistTaps="handled"
          >
            <PremiumCard>
              <Text style={styles.fieldLabel}>Ingredient Name</Text>
              <TextInput
                style={styles.textInput}
                value={ingName}
                onChangeText={setIngName}
                placeholder="e.g., Ground beef"
                placeholderTextColor={Colors.secondaryText}
                autoFocus
              />

              <View style={styles.amountRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Amount</Text>
                  <TextInput
                    style={styles.textInput}
                    value={ingAmount}
                    onChangeText={setIngAmount}
                    placeholder="1"
                    placeholderTextColor={Colors.secondaryText}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.unitRow}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, ingUnit === u && styles.unitChipActive]}
                        onPress={() => { hapticSelection(); setIngUnit(u); }}
                      >
                        <Text style={[styles.unitChipText, ingUnit === u && styles.unitChipTextActive]}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </PremiumCard>

            <PremiumCard>
              <Text style={styles.sectionTitle}>Macros</Text>
              <View style={styles.macroInputGrid}>
                <View style={styles.macroInputCol}>
                  <Text style={styles.macroInputLabel}>Calories</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={ingCalories}
                    onChangeText={setIngCalories}
                    placeholder="0"
                    placeholderTextColor={Colors.secondaryText}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.macroInputCol}>
                  <Text style={styles.macroInputLabel}>Protein (g)</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={ingProtein}
                    onChangeText={setIngProtein}
                    placeholder="0"
                    placeholderTextColor={Colors.secondaryText}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.macroInputCol}>
                  <Text style={styles.macroInputLabel}>Carbs (g)</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={ingCarbs}
                    onChangeText={setIngCarbs}
                    placeholder="0"
                    placeholderTextColor={Colors.secondaryText}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.macroInputCol}>
                  <Text style={styles.macroInputLabel}>Fat (g)</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={ingFat}
                    onChangeText={setIngFat}
                    placeholder="0"
                    placeholderTextColor={Colors.secondaryText}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </PremiumCard>

            <View style={{ height: Spacing.lg }} />
            <PremiumButton
              label={editingIndex !== null ? 'Update Ingredient' : 'Add Ingredient'}
              onPress={handleAddIngredient}
            />
            <View style={{ height: Spacing.jumbo }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenWrapper>
    );
  }

  // Main recipe form (list mode)
  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Recipe' : 'New Recipe'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollPadding}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recipe Name */}
          <PremiumCard>
            <Text style={styles.fieldLabel}>Recipe Name</Text>
            <TextInput
              style={styles.textInput}
              value={recipeName}
              onChangeText={setRecipeName}
              placeholder="e.g., Josh's Meatloaf"
              placeholderTextColor={Colors.secondaryText}
            />
          </PremiumCard>

          {/* Running Totals */}
          {ingredients.length > 0 && (
            <PremiumCard elevated>
              {renderMacroRow('Total Recipe', totalMacros)}
              <View style={styles.divider} />
              {renderMacroRow('Per Serving', perServing)}
            </PremiumCard>
          )}

          {/* Ingredients List */}
          <View style={styles.ingredientHeader}>
            <Text style={styles.sectionTitle}>
              Ingredients ({ingredients.length})
            </Text>
            <TouchableOpacity
              style={styles.addIngBtn}
              onPress={() => { resetIngredientForm(); setMode('add-ingredient'); }}
            >
              <Ionicons name="add-circle" size={24} color={Colors.accent} />
              <Text style={styles.addIngText}>Add</Text>
            </TouchableOpacity>
          </View>

          {ingredients.length === 0 ? (
            <PremiumCard>
              <Text style={styles.emptyText}>
                No ingredients yet. Tap "Add" to start building your recipe.
              </Text>
            </PremiumCard>
          ) : (
            ingredients.map((ing, index) => (
              <PremiumCard key={index}>
                <View style={styles.ingredientRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ingName}>{ing.name}</Text>
                    <Text style={styles.ingAmount}>
                      {ing.amount} {ing.unit}
                    </Text>
                    <Text style={styles.ingMacros}>
                      {ing.calories} cal {'\u2022'} {ing.protein}p {'\u2022'} {ing.carbs}c {'\u2022'} {ing.fat}f
                    </Text>
                  </View>
                  <View style={styles.ingActions}>
                    <TouchableOpacity
                      onPress={() => handleEditIngredient(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil" size={18} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemoveIngredient(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </PremiumCard>
            ))
          )}

          {/* Servings and Weight */}
          <PremiumCard>
            <View style={styles.servingsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Total Servings</Text>
                <TextInput
                  style={styles.textInput}
                  value={totalServings}
                  onChangeText={setTotalServings}
                  placeholder="6"
                  placeholderTextColor={Colors.secondaryText}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Total Weight (g, optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={totalWeight}
                  onChangeText={setTotalWeight}
                  placeholder="e.g., 1200"
                  placeholderTextColor={Colors.secondaryText}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </PremiumCard>

          <View style={{ height: Spacing.lg }} />
          <PremiumButton
            label={isEditing ? 'Update Recipe' : 'Save Recipe'}
            onPress={handleSave}
            disabled={!recipeName.trim() || ingredients.length === 0}
          />
          <View style={{ height: Spacing.jumbo }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flex: 1,
  },
  scrollPadding: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.jumbo,
  },
  fieldLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  addIngBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addIngText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  ingAmount: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  ingMacros: {
    color: Colors.accentText,
    fontSize: 12,
    marginTop: 2,
  },
  ingActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.md,
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 4,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  unitChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  unitChipText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  unitChipTextActive: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  macroInputGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
  },
  macroInputCol: {
    flex: 1,
  },
  macroInputLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  macroInput: {
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  macroLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  macroValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroVal: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  macroUnit: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '400',
  },
  macroDot: {
    color: Colors.secondaryText,
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 8,
  },
  servingsRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
