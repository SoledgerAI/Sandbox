// Serving size selector with quantity multiplier (0.25x - 10x)
// Phase 6: Food Logging -- Core

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../../constants/colors';
import type { ServingSize, NutritionInfo } from '../../types/food';
import { scaleNutrition, displayNutrition, formatQuantity, QUANTITY_STEPS } from '../../utils/servingmath';

interface ServingSizeSelectorProps {
  servingSizes: ServingSize[];
  selectedServingIndex: number;
  quantity: number;
  nutritionPer100g: NutritionInfo;
  onServingChange: (index: number) => void;
  onQuantityChange: (quantity: number) => void;
}

export function ServingSizeSelector({
  servingSizes,
  selectedServingIndex,
  quantity,
  nutritionPer100g,
  onServingChange,
  onQuantityChange,
}: ServingSizeSelectorProps) {
  const [showAllSteps, setShowAllSteps] = useState(false);

  const selectedServing = servingSizes[selectedServingIndex];
  const scaled = scaleNutrition(nutritionPer100g, selectedServing, quantity);
  const display = displayNutrition(scaled);
  const base = displayNutrition(
    scaleNutrition(nutritionPer100g, selectedServing, 1),
  );

  const quickSteps = [0.5, 1, 1.5, 2] as const;
  const stepsToShow = showAllSteps ? QUANTITY_STEPS : quickSteps;

  return (
    <View style={styles.container}>
      {/* Serving size picker */}
      {servingSizes.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Serving Size</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {servingSizes.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.chip,
                  i === selectedServingIndex && styles.chipSelected,
                ]}
                onPress={() => onServingChange(i)}
              >
                <Text
                  style={[
                    styles.chipText,
                    i === selectedServingIndex && styles.chipTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {s.description}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quantity selector */}
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
