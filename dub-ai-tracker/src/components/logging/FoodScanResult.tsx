// Food scan review screen with serving multiplier
// Sprint 10: Food Scanning MVP
// Shows scanned food result, lets user adjust portions/macros, then save/log.

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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { saveFood as saveToMyFoods, type SavedFood } from '../../utils/foodLibrary';
import type { FoodScanResult as ScanResult } from '../../services/foodScanService';
import type { MealType } from '../../types/food';

interface FoodScanResultProps {
  result: ScanResult;
  photoUri: string | null;
  mealType: MealType;
  timestamp: Date;
  onLog: (entry: LogEntry) => void;
  onCancel: () => void;
}

export interface LogEntry {
  foodName: string;
  brand: string | null;
  servingSize: string;
  mealType: MealType;
  photoUri: string | null;
  confidence: 'high' | 'medium' | 'low';
  isEstimate: boolean;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    addedSugar: number;
    fiber: number;
  };
}

const PORTION_PRESETS = [0.5, 1, 1.5, 2] as const;

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function mealLabel(m: MealType): string {
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export function FoodScanResult({
  result,
  photoUri,
  mealType: initialMealType,
  timestamp,
  onLog,
  onCancel,
}: FoodScanResultProps) {
  const [multiplier, setMultiplier] = useState(1);
  const [customMultiplier, setCustomMultiplier] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [mealType, setMealType] = useState<MealType>(initialMealType);

  // Editable base values (before multiplier)
  const [foodName, setFoodName] = useState(result.foodName);
  const [servingSize, setServingSize] = useState(result.servingSize);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [baseNutrition, setBaseNutrition] = useState({ ...result.nutrition });

  const scaled = (val: number) => Math.round(val * multiplier);

  const updateMacro = useCallback((field: keyof typeof baseNutrition, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setBaseNutrition((prev) => ({ ...prev, [field]: num }));
    }
  }, []);

  const applyCustomMultiplier = useCallback(() => {
    const val = parseFloat(customMultiplier);
    if (!isNaN(val) && val > 0 && val <= 20) {
      setMultiplier(val);
      setShowCustomInput(false);
    }
  }, [customMultiplier]);

  const handleLog = useCallback(() => {
    onLog({
      foodName,
      brand: result.brand,
      servingSize,
      mealType,
      photoUri,
      confidence: result.confidence,
      isEstimate: result.isEstimate,
      nutrition: {
        calories: scaled(baseNutrition.calories),
        protein: scaled(baseNutrition.protein),
        carbs: scaled(baseNutrition.carbs),
        fat: scaled(baseNutrition.fat),
        addedSugar: scaled(baseNutrition.addedSugar),
        fiber: scaled(baseNutrition.fiber),
      },
    });
  }, [foodName, result.brand, servingSize, mealType, photoUri, result.confidence, result.isEstimate, baseNutrition, multiplier, onLog]);

  const handleSaveToMyFoods = useCallback(async () => {
    const saved: SavedFood = {
      id: `myfood_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      timesLogged: 0,
      lastLogged: new Date().toISOString(),
      foodName,
      brand: result.brand ?? undefined,
      servingSize,
      photoUri: photoUri ?? undefined,
      nutrition: { ...baseNutrition }, // Save BASE, not multiplied
    };
    await saveToMyFoods(saved);
    Alert.alert('Saved', `${foodName} added to My Foods`);
  }, [foodName, result.brand, servingSize, photoUri, baseNutrition]);

  const confidenceConfig = result.isEstimate
    ? result.confidence === 'low'
      ? { color: Colors.danger, bg: Colors.danger + '15', icon: 'warning' as const, text: 'Low confidence — please review and adjust these values' }
      : result.confidence === 'medium'
        ? { color: Colors.accent, bg: Colors.accent + '15', icon: 'alert-circle' as const, text: 'Estimate — adjust as needed' }
        : { color: Colors.success, bg: Colors.success + '15', icon: 'checkmark-circle' as const, text: 'High confidence estimate' }
    : { color: Colors.success, bg: Colors.success + '15', icon: 'checkmark-circle' as const, text: 'Extracted from label' };

  const formattedTime = timestamp.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }) + ' at ' + timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Photo thumbnail */}
      {photoUri && (
        <Image source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />
      )}

      {/* Food name + edit */}
      <View style={styles.nameRow}>
        {editingField === 'name' ? (
          <TextInput
            style={styles.nameInput}
            value={foodName}
            onChangeText={setFoodName}
            onBlur={() => setEditingField(null)}
            autoFocus
          />
        ) : (
          <TouchableOpacity style={styles.nameRow} onPress={() => setEditingField('name')} activeOpacity={0.7}>
            <Text style={styles.foodName} numberOfLines={2}>
              {foodName}
              {result.brand ? ` (${result.brand})` : ''}
            </Text>
            <Ionicons name="pencil" size={16} color={Colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Serving size */}
      <TouchableOpacity onPress={() => setEditingField('serving')} activeOpacity={0.7}>
        {editingField === 'serving' ? (
          <TextInput
            style={styles.servingInput}
            value={servingSize}
            onChangeText={setServingSize}
            onBlur={() => setEditingField(null)}
            autoFocus
          />
        ) : (
          <Text style={styles.servingText}>Serving: {servingSize}</Text>
        )}
      </TouchableOpacity>

      {/* Confidence badge */}
      <View style={[styles.confidenceBanner, { backgroundColor: confidenceConfig.bg }]}>
        <Ionicons name={confidenceConfig.icon} size={16} color={confidenceConfig.color} />
        <Text style={[styles.confidenceText, { color: confidenceConfig.color }]}>
          {confidenceConfig.text}
        </Text>
      </View>

      {/* Portions multiplier */}
      <Text style={styles.sectionLabel}>PORTIONS</Text>
      <View style={styles.portionRow}>
        {PORTION_PRESETS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.portionBtn, multiplier === p && styles.portionBtnActive]}
            onPress={() => { setMultiplier(p); setShowCustomInput(false); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.portionBtnText, multiplier === p && styles.portionBtnTextActive]}>
              {p}x
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.portionBtn, showCustomInput && styles.portionBtnActive]}
          onPress={() => setShowCustomInput(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="settings-outline"
            size={16}
            color={showCustomInput ? Colors.primaryBackground : Colors.accent}
          />
        </TouchableOpacity>
      </View>

      {showCustomInput && (
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="e.g. 2.5"
            placeholderTextColor={Colors.secondaryText}
            value={customMultiplier}
            onChangeText={setCustomMultiplier}
            keyboardType="decimal-pad"
            autoFocus
          />
          <TouchableOpacity style={styles.customApplyBtn} onPress={applyCustomMultiplier}>
            <Text style={styles.customApplyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Macros */}
      <Text style={styles.sectionLabel}>YOUR MACROS</Text>
      <View style={styles.macroCard}>
        <MacroRow label="Calories" value={scaled(baseNutrition.calories)} unit="" baseValue={baseNutrition.calories} field="calories" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
        <MacroRow label="Protein" value={scaled(baseNutrition.protein)} unit="g" baseValue={baseNutrition.protein} field="protein" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
        <MacroRow label="Carbs" value={scaled(baseNutrition.carbs)} unit="g" baseValue={baseNutrition.carbs} field="carbs" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
        <MacroRow label="Fat" value={scaled(baseNutrition.fat)} unit="g" baseValue={baseNutrition.fat} field="fat" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
        <MacroRow label="Added Sugar" value={scaled(baseNutrition.addedSugar)} unit="g" baseValue={baseNutrition.addedSugar} field="addedSugar" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
        <MacroRow label="Fiber" value={scaled(baseNutrition.fiber)} unit="g" baseValue={baseNutrition.fiber} field="fiber" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
      </View>

      {/* Meal type selector */}
      <Text style={styles.sectionLabel}>Meal</Text>
      <View style={styles.mealRow}>
        {MEAL_TYPES.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.mealBtn, mealType === m && styles.mealBtnActive]}
            onPress={() => setMealType(m)}
            activeOpacity={0.7}
          >
            <Text style={[styles.mealBtnText, mealType === m && styles.mealBtnTextActive]}>
              {mealLabel(m)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timestamp */}
      <Text style={styles.timeText}>Time: {formattedTime}</Text>

      {/* Actions */}
      <TouchableOpacity style={styles.saveLogBtn} onPress={handleLog} activeOpacity={0.7}>
        <Ionicons name="save-outline" size={18} color={Colors.primaryBackground} />
        <Text style={styles.saveLogText}>Save & Log</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveMyFoodsBtn} onPress={handleSaveToMyFoods} activeOpacity={0.7}>
        <Ionicons name="star-outline" size={18} color={Colors.accent} />
        <Text style={styles.saveMyFoodsText}>Save to My Foods</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function MacroRow({
  label,
  value,
  unit,
  baseValue,
  field,
  editing,
  onEdit,
  onUpdate,
}: {
  label: string;
  value: number;
  unit: string;
  baseValue: number;
  field: string;
  editing: string | null;
  onEdit: (f: string | null) => void;
  onUpdate: (field: any, value: string) => void;
}) {
  if (editing === field) {
    return (
      <View style={styles.macroRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <TextInput
          style={styles.macroInput}
          defaultValue={String(baseValue)}
          onChangeText={(v) => onUpdate(field, v)}
          onBlur={() => onEdit(null)}
          keyboardType="decimal-pad"
          autoFocus
        />
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.macroRow} onPress={() => onEdit(field)} activeOpacity={0.7}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {value}{unit}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  thumbnail: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  foodName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  nameInput: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  servingText: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginBottom: 12,
  },
  servingInput: {
    color: Colors.text,
    fontSize: 14,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  confidenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  sectionLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  portionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  portionBtn: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  portionBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  portionBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  portionBtnTextActive: {
    color: Colors.primaryBackground,
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: -8,
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  customApplyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  customApplyText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '600',
  },
  macroCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  macroLabel: {
    color: Colors.text,
    fontSize: 15,
  },
  macroValue: {
    color: Colors.accentText,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  macroInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: Colors.accentText,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 80,
  },
  mealRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  mealBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  mealBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  mealBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  mealBtnTextActive: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  timeText: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginBottom: 20,
  },
  saveLogBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  saveLogText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  saveMyFoodsBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    marginBottom: 10,
  },
  saveMyFoodsText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: Colors.secondaryText,
    fontSize: 15,
  },
});
