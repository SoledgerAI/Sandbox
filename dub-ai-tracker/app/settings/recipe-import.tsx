// AI recipe import screen — photo scan or text paste
// Sprint 20: Recipe Builder — import from photo or pasted text

import { useState, useCallback } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { PremiumButton } from '../../src/components/common/PremiumButton';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { useToast } from '../../src/contexts/ToastContext';
import { hapticSuccess, hapticSelection, hapticError } from '../../src/utils/haptics';
import { stripExifMetadata } from '../../src/utils/imagePrivacy';
import { parseRecipeFromPhoto, parseRecipeFromText, type RecipeParseResult } from '../../src/services/recipeScanService';
import {
  calculateTotalMacros,
  calculatePerServingMacros,
  generateRecipeId,
  saveRecipe,
} from '../../src/utils/recipeLibrary';
import type { MyRecipe, MyRecipeIngredient, RecipeUnit } from '../../src/types/food';

type ImportMode = 'choose' | 'scanning' | 'review';

const UNIT_OPTIONS: RecipeUnit[] = [
  'lbs', 'oz', 'g', 'kg', 'cups', 'tbsp', 'tsp', 'whole', 'slices', 'cans', 'pieces',
];

export default function RecipeImportScreen() {
  const { showToast } = useToast();
  const [mode, setMode] = useState<ImportMode>('choose');
  const [pasteText, setPasteText] = useState('');
  const [scanning, setScanning] = useState(false);

  // Review state (parsed result)
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<MyRecipeIngredient[]>([]);
  const [totalServings, setTotalServings] = useState('1');

  const handlePhotoImport = useCallback(async (useCamera: boolean) => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.8,
        base64: false,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.[0]) return;

      setScanning(true);
      setMode('scanning');

      // Strip EXIF
      const strippedUri = await stripExifMetadata(result.assets[0].uri);
      const base64 = await readAsStringAsync(strippedUri, { encoding: EncodingType.Base64 });
      const mimeType = result.assets[0].mimeType ?? 'image/jpeg';

      const parsed = await parseRecipeFromPhoto(base64, mimeType);
      applyParseResult(parsed);
    } catch (error: any) {
      hapticError();
      setMode('choose');
      Alert.alert('Import Failed', error.message || 'Could not parse recipe from photo.');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleTextImport = useCallback(async () => {
    if (pasteText.trim().length < 10) {
      Alert.alert('Too Short', 'Paste a full recipe with ingredients.');
      return;
    }

    try {
      setScanning(true);
      setMode('scanning');
      const parsed = await parseRecipeFromText(pasteText);
      applyParseResult(parsed);
    } catch (error: any) {
      hapticError();
      setMode('choose');
      Alert.alert('Import Failed', error.message || 'Could not parse recipe from text.');
    } finally {
      setScanning(false);
    }
  }, [pasteText]);

  const applyParseResult = useCallback((result: RecipeParseResult) => {
    setRecipeName(result.name);
    setIngredients(result.ingredients);
    setTotalServings('1');
    setMode('review');
  }, []);

  const handleUpdateIngredient = useCallback((index: number, field: keyof MyRecipeIngredient, value: string) => {
    setIngredients((prev) =>
      prev.map((ing, i) => {
        if (i !== index) return ing;
        if (field === 'name') return { ...ing, name: value };
        if (field === 'unit') return { ...ing, unit: value as RecipeUnit };
        const num = parseFloat(value) || 0;
        return { ...ing, [field]: num };
      }),
    );
  }, []);

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
    const totalMacros = calculateTotalMacros(ingredients);
    const servings = Math.max(parseFloat(totalServings) || 1, 0.25);
    const perServing = calculatePerServingMacros(totalMacros, servings);

    const recipe: MyRecipe = {
      id: generateRecipeId(),
      name: recipeName.trim(),
      ingredients,
      totalServings: servings,
      macrosPerServing: perServing,
      totalMacros,
      timesLogged: 0,
      lastLogged: null,
      createdAt: now,
      updatedAt: now,
    };

    await saveRecipe(recipe);
    hapticSuccess();
    showToast('Recipe imported!', 'success');
    router.back();
  }, [recipeName, ingredients, totalServings, showToast]);

  // Scanning state
  if (mode === 'scanning') {
    return (
      <ScreenWrapper>
        <View style={[styles.container, styles.centerContent]}>
          <Ionicons name="nutrition" size={48} color={Colors.accent} />
          <Text style={styles.scanningText}>Analyzing recipe...</Text>
          <Text style={styles.scanningSubtext}>
            AI is extracting ingredients and estimating macros
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  // Review parsed result
  if (mode === 'review') {
    const totalMacros = calculateTotalMacros(ingredients);
    const servings = Math.max(parseFloat(totalServings) || 1, 0.25);
    const perServing = calculatePerServingMacros(totalMacros, servings);

    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setMode('choose')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Review Import</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollPadding}
            keyboardShouldPersistTaps="handled"
          >
            <PremiumCard>
              <Text style={styles.fieldLabel}>Recipe Name</Text>
              <TextInput
                style={styles.textInput}
                value={recipeName}
                onChangeText={setRecipeName}
                placeholder="Recipe name"
                placeholderTextColor={Colors.secondaryText}
              />
            </PremiumCard>

            {/* Totals */}
            <PremiumCard elevated>
              <View style={styles.macroSummaryRow}>
                <View style={styles.macroSummaryItem}>
                  <Text style={styles.macroSummaryNum}>{totalMacros.calories}</Text>
                  <Text style={styles.macroSummaryLabel}>total cal</Text>
                </View>
                <View style={styles.macroSummaryItem}>
                  <Text style={styles.macroSummaryNum}>{perServing.calories}</Text>
                  <Text style={styles.macroSummaryLabel}>per serving</Text>
                </View>
              </View>
            </PremiumCard>

            <Text style={styles.sectionTitle}>
              Ingredients ({ingredients.length}) — tap to edit
            </Text>

            {ingredients.map((ing, index) => (
              <PremiumCard key={index}>
                <View style={styles.ingReviewRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.ingNameInput}
                      value={ing.name}
                      onChangeText={(v) => handleUpdateIngredient(index, 'name', v)}
                    />
                    <View style={styles.ingNumRow}>
                      <TextInput
                        style={styles.ingNumInput}
                        value={String(ing.amount)}
                        onChangeText={(v) => handleUpdateIngredient(index, 'amount', v)}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.ingUnitLabel}>{ing.unit}</Text>
                      <Text style={styles.ingMacroText}>
                        {ing.calories}cal {ing.protein}p {ing.carbs}c {ing.fat}f
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveIngredient(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={22} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </PremiumCard>
            ))}

            <PremiumCard>
              <Text style={styles.fieldLabel}>Total Servings</Text>
              <TextInput
                style={styles.textInput}
                value={totalServings}
                onChangeText={setTotalServings}
                placeholder="1"
                placeholderTextColor={Colors.secondaryText}
                keyboardType="decimal-pad"
              />
            </PremiumCard>

            <View style={{ height: Spacing.lg }} />
            <PremiumButton label="Save Recipe" onPress={handleSave} />
            <View style={{ height: Spacing.jumbo }} />
          </ScrollView>
        </View>
      </ScreenWrapper>
    );
  }

  // Choose import method
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
          <Text style={styles.headerTitle}>Import Recipe</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollPadding}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo import */}
          <PremiumCard>
            <View style={styles.importOption}>
              <Ionicons name="camera" size={32} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.importTitle}>Photo Scan</Text>
                <Text style={styles.importSubtitle}>
                  Take a photo of a recipe card, cookbook page, or screenshot
                </Text>
              </View>
            </View>
            <View style={styles.photoBtnRow}>
              <PremiumButton
                label="Camera"
                variant="secondary"
                size="small"
                onPress={() => handlePhotoImport(true)}
                icon={<Ionicons name="camera-outline" size={16} color={Colors.accent} />}
              />
              <PremiumButton
                label="Gallery"
                variant="secondary"
                size="small"
                onPress={() => handlePhotoImport(false)}
                icon={<Ionicons name="images-outline" size={16} color={Colors.accent} />}
              />
            </View>
          </PremiumCard>

          {/* Text paste */}
          <PremiumCard>
            <View style={styles.importOption}>
              <Ionicons name="document-text" size={32} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.importTitle}>Paste Text</Text>
                <Text style={styles.importSubtitle}>
                  Paste a recipe from a website or message
                </Text>
              </View>
            </View>
            <TextInput
              style={styles.pasteInput}
              value={pasteText}
              onChangeText={setPasteText}
              placeholder="Paste recipe text here..."
              placeholderTextColor={Colors.secondaryText}
              multiline
              maxLength={5000}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {pasteText.length}/5000
            </Text>
            <PremiumButton
              label="Analyze Recipe"
              onPress={handleTextImport}
              disabled={pasteText.trim().length < 10}
              loading={scanning}
            />
          </PremiumCard>

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
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
  importOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.md,
  },
  importTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  importSubtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  photoBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pasteInput: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 4,
  },
  charCount: {
    color: Colors.secondaryText,
    fontSize: 11,
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  scanningText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  scanningSubtext: {
    color: Colors.secondaryText,
    fontSize: 14,
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
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginVertical: Spacing.sm,
  },
  ingReviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingNameInput: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: 4,
    marginBottom: 4,
  },
  ingNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ingNumInput: {
    color: Colors.text,
    fontSize: 14,
    width: 50,
    textAlign: 'center',
    backgroundColor: Colors.elevated,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  ingUnitLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  ingMacroText: {
    color: Colors.accentText,
    fontSize: 12,
    marginLeft: 'auto',
  },
  macroSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroSummaryItem: {
    alignItems: 'center',
  },
  macroSummaryNum: {
    color: Colors.accentText,
    fontSize: 24,
    fontWeight: '700',
  },
  macroSummaryLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
});
