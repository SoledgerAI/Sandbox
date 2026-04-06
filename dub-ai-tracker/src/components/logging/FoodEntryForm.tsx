// Manual food entry form
// Phase 6: Food Logging -- Core

import { useState, useCallback } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../common/Button';
import type { FoodItem, FoodEntry, MealType, NutritionInfo } from '../../types/food';

interface FoodEntryFormProps {
  /** Pre-filled from search selection, or null for blank manual entry */
  food: FoodItem | null;
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

export function FoodEntryForm({ food, mealType, onSave, onCancel }: FoodEntryFormProps) {
  const [name, setName] = useState(food?.name ?? '');
  const [brand, setBrand] = useState(food?.brand ?? '');
  const [meal, setMeal] = useState<MealType>(mealType);
  const [calories, setCalories] = useState(food ? String(Math.round(food.nutrition_per_100g.calories)) : '');
  const [protein, setProtein] = useState(food ? String(Math.round(food.nutrition_per_100g.protein_g)) : '');
  const [carbs, setCarbs] = useState(food ? String(Math.round(food.nutrition_per_100g.carbs_g)) : '');
  const [fat, setFat] = useState(food ? String(Math.round(food.nutrition_per_100g.fat_g)) : '');
  const [fiber, setFiber] = useState(food?.nutrition_per_100g.fiber_g != null ? String(Math.round(food.nutrition_per_100g.fiber_g)) : '');
  const [sugar, setSugar] = useState(food?.nutrition_per_100g.sugar_g != null ? String(Math.round(food.nutrition_per_100g.sugar_g)) : '');
  const [sodium, setSodium] = useState(food?.nutrition_per_100g.sodium_mg != null ? String(Math.round(food.nutrition_per_100g.sodium_mg)) : '');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const handleAddPhoto = useCallback(async () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelIndex = 2;

    function handleChoice(index: number) {
      if (index === 0) {
        ImagePicker.requestCameraPermissionsAsync().then(({ status }) => {
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to photograph food.');
            return;
          }
          ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }).then((result) => {
            if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
          });
        });
      } else if (index === 1) {
        ImagePicker.requestMediaLibraryPermissionsAsync().then(({ status }) => {
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Photo library access is needed.');
            return;
          }
          ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 }).then((result) => {
            if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
          });
        });
      }
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        handleChoice,
      );
    } else {
      Alert.alert('Add Photo', '', [
        { text: options[0], onPress: () => handleChoice(0) },
        { text: options[1], onPress: () => handleChoice(1) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, []);

  const [servingDesc, setServingDesc] = useState(food?.serving_sizes[food.default_serving_index]?.description ?? '1 serving (100g)');
  const [servingGrams, setServingGrams] = useState(
    food?.serving_sizes[food.default_serving_index]?.gram_weight != null
      ? String(food.serving_sizes[food.default_serving_index].gram_weight)
      : '100',
  );

  const canSave = name.trim().length > 0 && calories.trim().length > 0;

  const handleSave = () => {
    const num = (s: string) => {
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };
    const numOrNull = (s: string) => {
      if (s.trim() === '') return null;
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    const nutrition: NutritionInfo = {
      calories: num(calories),
      protein_g: num(protein),
      carbs_g: num(carbs),
      fat_g: num(fat),
      fiber_g: numOrNull(fiber),
      sugar_g: numOrNull(sugar),
      added_sugar_g: null,
      sodium_mg: numOrNull(sodium),
      cholesterol_mg: null,
      saturated_fat_g: null,
      trans_fat_g: null,
      potassium_mg: null,
      vitamin_d_mcg: null,
      calcium_mg: null,
      iron_mg: null,
    };

    const gramWeight = num(servingGrams) || 100;

    const foodItem: FoodItem = food ?? {
      source: 'manual',
      source_id: `manual:${Date.now()}`,
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: null,
      nutrition_per_100g: nutrition,
      serving_sizes: [
        {
          description: servingDesc || `1 serving (${gramWeight}g)`,
          unit: 'g',
          gram_weight: gramWeight,
          quantity: 1,
        },
      ],
      default_serving_index: 0,
      ingredients: null,
      last_accessed: new Date().toISOString(),
    };

    const serving = foodItem.serving_sizes[foodItem.default_serving_index];

    onSave({
      meal_type: meal,
      food_item: foodItem,
      serving,
      quantity: 1,
      computed_nutrition: nutrition,
      source: 'manual',
      photo_uri: photoUri,
      photo_confidence: null,
      flagged_ingredients: [],
      notes: notes.trim() || null,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.heading}>
          {food ? 'Edit Food Entry' : 'Manual Entry'}
        </Text>

        {/* Meal type selector */}
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

        {/* F-04: Photo attachment */}
        {photoUri ? (
          <View style={styles.photoPreviewRow}>
            <Image source={{ uri: photoUri }} style={styles.photoThumb} />
            <TouchableOpacity
              style={styles.photoRemoveBtn}
              onPress={() => setPhotoUri(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={22} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoBtn} onPress={handleAddPhoto} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={20} color={Colors.accent} />
            <Text style={styles.photoBtnText}>Add Photo</Text>
          </TouchableOpacity>
        )}

        {/* Food name */}
        <FieldInput label="Food Name *" value={name} onChangeText={setName} placeholder="e.g., Chicken Breast" />
        <FieldInput label="Brand (optional)" value={brand} onChangeText={setBrand} placeholder="e.g., Tyson" />

        {/* Serving */}
        <View style={styles.row}>
          <View style={styles.flex2}>
            <FieldInput label="Serving Description" value={servingDesc} onChangeText={setServingDesc} placeholder="e.g., 1 cup (240g)" />
          </View>
          <View style={styles.flex1}>
            <FieldInput label="Grams" value={servingGrams} onChangeText={setServingGrams} keyboardType="numeric" />
          </View>
        </View>

        {/* Core nutrition */}
        <Text style={styles.sectionLabel}>Nutrition (per serving)</Text>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <FieldInput label="Calories *" value={calories} onChangeText={setCalories} keyboardType="numeric" />
          </View>
          <View style={styles.flex1}>
            <FieldInput label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <FieldInput label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
          </View>
          <View style={styles.flex1}>
            <FieldInput label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <FieldInput label="Fiber (g)" value={fiber} onChangeText={setFiber} keyboardType="numeric" />
          </View>
          <View style={styles.flex1}>
            <FieldInput label="Sugar (g)" value={sugar} onChangeText={setSugar} keyboardType="numeric" />
          </View>
        </View>
        <FieldInput label="Sodium (mg)" value={sodium} onChangeText={setSodium} keyboardType="numeric" />

        {/* Notes */}
        <FieldInput
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any notes..."
          multiline
        />

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.flex1}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} />
          </View>
          <View style={styles.flex1}>
            <Button title="Save" onPress={handleSave} disabled={!canSave} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.secondaryText}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heading: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  mealRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
  sectionLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  fieldInputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
    paddingVertical: 14,
    marginBottom: 16,
  },
  photoBtnText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
  },
  photoRemoveBtn: {
    marginLeft: -12,
    marginTop: -6,
  },
});
