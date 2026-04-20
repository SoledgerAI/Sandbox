// Food scan review screen with serving multiplier
// Sprint 10: Food Scanning MVP
// Shows scanned food result, lets user adjust portions/macros, then save/log.

import { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
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
import { addToPantry, isInPantry } from '../../utils/pantryLibrary';
import type { FoodScanResult as ScanResult } from '../../services/foodScanService';
import type { MealType } from '../../types/food';

interface FoodScanResultProps {
  result: ScanResult;
  multiItems?: ScanResult[];
  photoUri: string | null;
  mealType: MealType;
  timestamp: Date;
  onLog: (entries: LogEntry[]) => void | Promise<void>;
  onCancel: () => void;
  barcode?: string | null;
  scanSource?: 'barcode_scan' | 'label_scan' | 'manual';
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
  multiItems,
  photoUri,
  mealType: initialMealType,
  timestamp,
  onLog,
  onCancel,
  barcode,
  scanSource = 'label_scan',
}: FoodScanResultProps) {
  const isMultiItem = multiItems != null && multiItems.length > 1;

  // Multi-item state: track which items are selected
  const [selectedItems, setSelectedItems] = useState<Set<number>>(
    () => new Set(multiItems ? multiItems.map((_, i) => i) : []),
  );
  // Currently editing item index in multi-item mode
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  // Use active item for single-item editing
  const activeResult = isMultiItem ? (multiItems![activeItemIndex] ?? result) : result;

  const [multiplier, setMultiplier] = useState(1);
  const [customMultiplier, setCustomMultiplier] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [mealType, setMealType] = useState<MealType>(initialMealType);

  // Editable base values (before multiplier)
  const [foodName, setFoodName] = useState(activeResult.foodName);
  const [servingSize, setServingSize] = useState(activeResult.servingSize);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [baseNutrition, setBaseNutrition] = useState({ ...activeResult.nutrition });

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

  const [saving, setSaving] = useState(false);

  // Sprint 21: Pantry state
  const [inPantry, setInPantry] = useState(false);
  const [pantrySaving, setPantrySaving] = useState(false);

  useEffect(() => {
    if (isMultiItem) return;
    isInPantry({
      barcode: barcode ?? null,
      name: foodName,
      brand: result.brand,
    }).then(setInPantry);
  }, [barcode, foodName, result.brand, isMultiItem]);

  const handleAddToPantry = useCallback(async () => {
    if (pantrySaving || inPantry) return;
    setPantrySaving(true);
    try {
      const { added } = await addToPantry({
        name: foodName,
        brand: result.brand,
        barcode: barcode ?? null,
        serving_size: servingSize,
        calories: baseNutrition.calories,
        protein_g: baseNutrition.protein,
        carbs_g: baseNutrition.carbs,
        fat_g: baseNutrition.fat,
        fiber_g: baseNutrition.fiber,
        added_sugar_g: baseNutrition.addedSugar,
        source: scanSource,
        category: 'food',
      });
      setInPantry(true);
      Alert.alert(added ? 'Added' : 'Already in Pantry', added ? `${foodName} saved to Pantry` : `${foodName} is already in your Pantry`);
    } finally {
      setPantrySaving(false);
    }
  }, [foodName, result.brand, barcode, servingSize, baseNutrition, scanSource, pantrySaving, inPantry]);

  const handleLog = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const entries: LogEntry[] = [];
      if (isMultiItem && multiItems) {
        // Batch all selected items
        for (const idx of Array.from(selectedItems).sort()) {
          const item = multiItems[idx];
          entries.push({
            foodName: item.foodName,
            brand: item.brand,
            servingSize: item.servingSize,
            mealType,
            photoUri,
            confidence: item.confidence,
            isEstimate: item.isEstimate,
            nutrition: { ...item.nutrition },
          });
        }
      } else {
        entries.push({
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
      }
      await onLog(entries);
    } finally {
      setSaving(false);
    }
  }, [foodName, result.brand, servingSize, mealType, photoUri, result.confidence, result.isEstimate, baseNutrition, multiplier, onLog, saving, isMultiItem, multiItems, selectedItems]);

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

  // Sprint 14: Restaurant food note
  const isRestaurantFood = activeResult.isEstimate && activeResult.confidence === 'medium';

  const confidenceConfig = activeResult.isEstimate
    ? activeResult.confidence === 'low'
      ? { color: Colors.danger, bg: Colors.danger + '15', icon: 'warning' as const, text: 'Low confidence — please review and adjust these values' }
      : result.confidence === 'medium'
        ? { color: Colors.accent, bg: Colors.accent + '15', icon: 'alert-circle' as const, text: 'Estimate — adjust as needed' }
        : { color: Colors.success, bg: Colors.success + '15', icon: 'checkmark-circle' as const, text: 'High confidence estimate' }
    : { color: Colors.success, bg: Colors.success + '15', icon: 'checkmark-circle' as const, text: 'Extracted from label' };

  const toggleItemSelection = useCallback((idx: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

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

      {/* Sprint 14: Multi-item cards */}
      {isMultiItem && multiItems && (
        <View style={styles.multiItemSection}>
          <Text style={styles.sectionLabel}>ITEMS FOUND ({multiItems.length})</Text>
          {multiItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.multiItemCard, !selectedItems.has(idx) && styles.multiItemCardUnselected]}
              onPress={() => toggleItemSelection(idx)}
              activeOpacity={0.7}
            >
              <View style={styles.multiItemCheck}>
                <Ionicons
                  name={selectedItems.has(idx) ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={selectedItems.has(idx) ? Colors.accent : Colors.secondaryText}
                />
              </View>
              <View style={styles.multiItemInfo}>
                <Text style={styles.multiItemName} numberOfLines={1}>{item.foodName}</Text>
                <Text style={styles.multiItemServing}>{item.servingSize}</Text>
              </View>
              <View style={styles.multiItemCals}>
                <Text style={styles.multiItemCalValue}>{item.nutrition.calories}</Text>
                <Text style={styles.multiItemCalUnit}>cal</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={styles.multiItemTotal}>
            <Text style={styles.multiItemTotalLabel}>Selected Total</Text>
            <Text style={styles.multiItemTotalValue}>
              {Array.from(selectedItems).reduce((sum, idx) => sum + (multiItems[idx]?.nutrition.calories ?? 0), 0)} cal
            </Text>
          </View>
        </View>
      )}

      {/* Restaurant food note — Sprint 14 */}
      {isRestaurantFood && !isMultiItem && (
        <View style={[styles.confidenceBanner, { backgroundColor: Colors.accent + '15' }]}>
          <Ionicons name="restaurant-outline" size={16} color={Colors.accent} />
          <Text style={[styles.confidenceText, { color: Colors.accent }]}>
            Restaurant portions vary. Adjust the multiplier for your serving size.
          </Text>
        </View>
      )}

      {/* Single-item editing UI (hidden in multi-item mode) */}
      {!isMultiItem && (
        <>
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

        <View style={[styles.confidenceBanner, { backgroundColor: confidenceConfig.bg }]}>
          <Ionicons name={confidenceConfig.icon} size={16} color={confidenceConfig.color} />
          <Text style={[styles.confidenceText, { color: confidenceConfig.color }]}>
            {confidenceConfig.text}
          </Text>
        </View>

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

        <Text style={styles.sectionLabel}>YOUR MACROS</Text>
        <View style={styles.macroCard}>
          <MacroRow label="Calories" value={scaled(baseNutrition.calories)} unit="" baseValue={baseNutrition.calories} field="calories" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
          <MacroRow label="Protein" value={scaled(baseNutrition.protein)} unit="g" baseValue={baseNutrition.protein} field="protein" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
          <MacroRow label="Carbs" value={scaled(baseNutrition.carbs)} unit="g" baseValue={baseNutrition.carbs} field="carbs" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
          <MacroRow label="Fat" value={scaled(baseNutrition.fat)} unit="g" baseValue={baseNutrition.fat} field="fat" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
          <MacroRow label="Added Sugar" value={scaled(baseNutrition.addedSugar)} unit="g" baseValue={baseNutrition.addedSugar} field="addedSugar" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
          <MacroRow label="Fiber" value={scaled(baseNutrition.fiber)} unit="g" baseValue={baseNutrition.fiber} field="fiber" editing={editingField} onEdit={setEditingField} onUpdate={updateMacro} />
        </View>
        </>
      )}

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
      <TouchableOpacity style={[styles.saveLogBtn, saving && styles.saveLogBtnDisabled]} onPress={handleLog} activeOpacity={0.7} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={Colors.primaryBackground} size="small" />
        ) : (
          <Ionicons name="save-outline" size={18} color={Colors.primaryBackground} />
        )}
        <Text style={styles.saveLogText}>{saving ? 'Saving...' : isMultiItem ? `Log ${selectedItems.size} Items` : 'Save & Log'}</Text>
      </TouchableOpacity>

      {!isMultiItem && (
        <TouchableOpacity style={styles.saveMyFoodsBtn} onPress={handleSaveToMyFoods} activeOpacity={0.7}>
          <Ionicons name="star-outline" size={18} color={Colors.accent} />
          <Text style={styles.saveMyFoodsText}>Save to My Foods</Text>
        </TouchableOpacity>
      )}

      {!isMultiItem && (
        <TouchableOpacity
          style={[styles.saveMyFoodsBtn, inPantry && styles.pantryBtnDisabled]}
          onPress={handleAddToPantry}
          activeOpacity={0.7}
          disabled={inPantry || pantrySaving}
        >
          {pantrySaving ? (
            <ActivityIndicator color={Colors.accent} size="small" />
          ) : (
            <Ionicons
              name={inPantry ? 'checkmark-circle' : 'bookmark-outline'}
              size={18}
              color={inPantry ? Colors.accent + '99' : Colors.accent}
            />
          )}
          <Text style={[styles.saveMyFoodsText, inPantry && styles.pantryTextDisabled]}>
            {inPantry ? 'Already in Pantry ✓' : 'Add to Pantry'}
          </Text>
        </TouchableOpacity>
      )}

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
  saveLogBtnDisabled: {
    opacity: 0.6,
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
  pantryBtnDisabled: {
    opacity: 0.55,
    borderColor: Colors.accent + '55',
  },
  pantryTextDisabled: {
    color: Colors.accent + '99',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: Colors.secondaryText,
    fontSize: 15,
  },
  // Sprint 14: Multi-item styles
  multiItemSection: {
    marginBottom: 16,
  },
  multiItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  multiItemCardUnselected: {
    opacity: 0.5,
    borderColor: Colors.divider,
  },
  multiItemCheck: {
    marginRight: 10,
  },
  multiItemInfo: {
    flex: 1,
  },
  multiItemName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  multiItemServing: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  multiItemCals: {
    alignItems: 'flex-end',
  },
  multiItemCalValue: {
    color: Colors.accentText,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  multiItemCalUnit: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  multiItemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: 4,
  },
  multiItemTotalLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  multiItemTotalValue: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
