// Serving size selector with quantity multiplier (0.25x - 10x) and custom weight input
// Phase 6: Food Logging -- Core
// Prompt 08: Added custom weight/ounce input

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../../constants/colors';
import type { ServingSize, NutritionInfo } from '../../types/food';
import { scaleNutrition, displayNutrition, formatQuantity, QUANTITY_STEPS } from '../../utils/servingmath';

const OZ_TO_GRAMS = 28.3495;

const SERVING_SHORTCUTS = [
  { label: '100g', grams: 100 },
  { label: '1 cup', grams: 240 },
  { label: '1 tbsp', grams: 15 },
  { label: '1 oz', grams: 28.35 },
  { label: '1 piece', grams: 50 },
] as const;

interface ServingSizeSelectorProps {
  servingSizes: ServingSize[];
  selectedServingIndex: number;
  quantity: number;
  nutritionPer100g: NutritionInfo;
  onServingChange: (index: number) => void;
  onQuantityChange: (quantity: number) => void;
  /** Called when custom weight changes — parent should use this for final save */
  onCustomWeight?: (gramWeight: number) => void;
}

export function ServingSizeSelector({
  servingSizes,
  selectedServingIndex,
  quantity,
  nutritionPer100g,
  onServingChange,
  onQuantityChange,
  onCustomWeight,
}: ServingSizeSelectorProps) {
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<'g' | 'oz'>('g');

  const customGrams = (() => {
    const num = parseFloat(customValue);
    if (isNaN(num) || num <= 0) return 0;
    return customUnit === 'oz' ? num * OZ_TO_GRAMS : num;
  })();

  // Build the nutrition preview based on mode
  const effectiveServing = customMode
    ? { description: 'Custom', unit: 'g' as const, gram_weight: customGrams, quantity: 1 }
    : servingSizes[selectedServingIndex];
  const effectiveQty = customMode ? 1 : quantity;

  const scaled = scaleNutrition(nutritionPer100g, effectiveServing, effectiveQty);
  const display = displayNutrition(scaled);
  const base = displayNutrition(
    scaleNutrition(nutritionPer100g, effectiveServing, 1),
  );

  const quickSteps = [0.5, 1, 1.5, 2] as const;
  const stepsToShow = showAllSteps ? QUANTITY_STEPS : quickSteps;

  const handleCustomToggle = () => {
    if (customMode) {
      // Exit custom mode
      setCustomMode(false);
      setCustomValue('');
    } else {
      setCustomMode(true);
      onQuantityChange(1); // Reset quantity when entering custom mode
    }
  };

  const handleCustomValueChange = (text: string) => {
    // Allow digits and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    setCustomValue(cleaned);
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      const grams = customUnit === 'oz' ? num * OZ_TO_GRAMS : num;
      onCustomWeight?.(grams);
    }
  };

  const handleUnitToggle = () => {
    const newUnit = customUnit === 'g' ? 'oz' : 'g';
    setCustomUnit(newUnit);
    // Recalculate and notify parent
    const num = parseFloat(customValue);
    if (!isNaN(num) && num > 0) {
      const grams = newUnit === 'oz' ? num * OZ_TO_GRAMS : num;
      onCustomWeight?.(grams);
    }
  };

  return (
    <View style={styles.container}>
      {/* Serving size picker */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Serving Size</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {servingSizes.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.chip,
                !customMode && i === selectedServingIndex && styles.chipSelected,
              ]}
              onPress={() => {
                setCustomMode(false);
                setCustomValue('');
                onServingChange(i);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  !customMode && i === selectedServingIndex && styles.chipTextSelected,
                ]}
                numberOfLines={1}
              >
                {s.description}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Custom weight chip */}
          <TouchableOpacity
            style={[styles.chip, customMode && styles.chipSelected]}
            onPress={handleCustomToggle}
          >
            <Text style={[styles.chipText, customMode && styles.chipTextSelected]}>
              Custom weight
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Quick serving shortcuts */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Quick Amount</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SERVING_SHORTCUTS.map((shortcut) => (
            <TouchableOpacity
              key={shortcut.label}
              style={styles.chip}
              onPress={() => {
                setCustomMode(true);
                const val = String(shortcut.grams);
                setCustomValue(val);
                setCustomUnit('g');
                onCustomWeight?.(shortcut.grams);
              }}
            >
              <Text style={styles.chipText}>{shortcut.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Custom weight input — shown when custom mode active */}
      {customMode && (
        <View style={styles.customWeightSection}>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              value={customValue}
              onChangeText={handleCustomValueChange}
              placeholder="0"
              placeholderTextColor={Colors.divider}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TouchableOpacity style={styles.unitToggle} onPress={handleUnitToggle}>
              <Text style={[styles.unitText, customUnit === 'g' && styles.unitTextActive]}>g</Text>
              <Text style={styles.unitDivider}>|</Text>
              <Text style={[styles.unitText, customUnit === 'oz' && styles.unitTextActive]}>oz</Text>
            </TouchableOpacity>
          </View>
          {customGrams > 0 && customUnit === 'oz' && (
            <Text style={styles.gramsHint}>= {Math.round(customGrams)}g</Text>
          )}
        </View>
      )}

      {/* Quantity selector — hidden when custom weight active */}
      {!customMode && (
        <View style={styles.section}>
          <View style={styles.quantityHeader}>
            <Text style={styles.sectionLabel}>
              Quantity: {formatQuantity(quantity)}
            </Text>
            <TouchableOpacity onPress={() => setShowAllSteps(!showAllSteps)}>
              <Text style={styles.toggleText}>
                {showAllSteps ? 'Less' : 'More'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {stepsToShow.map((step) => (
              <TouchableOpacity
                key={step}
                style={[
                  styles.chip,
                  step === quantity && styles.chipSelected,
                ]}
                onPress={() => onQuantityChange(step)}
              >
                <Text
                  style={[
                    styles.chipText,
                    step === quantity && styles.chipTextSelected,
                  ]}
                >
                  {formatQuantity(step)}x
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Nutrition preview: base vs adjusted */}
      <View style={styles.nutritionPreview}>
        <NutritionRow label="Calories" base={base.calories} adjusted={display.calories} unit="kcal" />
        <NutritionRow label="Protein" base={base.protein_g} adjusted={display.protein_g} unit="g" />
        <NutritionRow label="Carbs" base={base.carbs_g} adjusted={display.carbs_g} unit="g" />
        <NutritionRow label="Fat" base={base.fat_g} adjusted={display.fat_g} unit="g" />
        <NutritionRow label="Fiber" base={base.fiber_g} adjusted={display.fiber_g} unit="g" />
        <NutritionRow label="Sugar" base={base.sugar_g} adjusted={display.sugar_g} unit="g" />
        <NutritionRow label="Sodium" base={base.sodium_mg} adjusted={display.sodium_mg} unit="mg" />
      </View>
    </View>
  );
}

function NutritionRow({
  label,
  base,
  adjusted,
  unit,
}: {
  label: string;
  base: number | null;
  adjusted: number | null;
  unit: string;
}) {
  const baseStr = base !== null ? `${base}${unit}` : '--';
  const adjStr = adjusted !== null ? `${adjusted}${unit}` : '--';
  const changed = base !== adjusted;

  return (
    <View style={styles.nutritionRow}>
      <Text style={styles.nutritionLabel}>{label}</Text>
      <View style={styles.nutritionValues}>
        {changed && <Text style={styles.nutritionBase}>{baseStr}</Text>}
        <Text style={[styles.nutritionAdjusted, changed && styles.nutritionHighlight]}>
          {adjStr}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  quantityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  chipTextSelected: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  customWeightSection: {
    marginBottom: 12,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: Colors.divider,
    fontVariant: ['tabular-nums'],
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  unitText: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '500',
  },
  unitTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  unitDivider: {
    color: Colors.divider,
    fontSize: 15,
  },
  gramsHint: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 4,
    paddingLeft: 4,
  },
  nutritionPreview: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  nutritionLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  nutritionValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nutritionBase: {
    color: Colors.secondaryText,
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  nutritionAdjusted: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  nutritionHighlight: {
    color: Colors.accent,
  },
});
