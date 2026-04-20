// Food logging screen -- search, select, configure serving, save
// Phase 6: Food Logging -- Core
// Phase 19: NLP text entry and photo food entry integration
// Sprint 10: Food scanning MVP — scan/gallery/barcode → FoodScanResult review

import { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  Platform,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../../src/utils/storage';
import { scaleNutrition } from '../../src/utils/servingmath';
import { FoodSearch } from '../../src/components/logging/FoodSearch';
import { FoodEntryForm } from '../../src/components/logging/FoodEntryForm';
import { QuickLog } from '../../src/components/logging/QuickLog';
import { ServingSizeSelector } from '../../src/components/logging/ServingSizeSelector';
import { BarcodeScanner } from '../../src/components/logging/BarcodeScanner';
import { NLPFoodEntry } from '../../src/components/logging/NLPFoodEntry';
import { PhotoFoodEntry } from '../../src/components/logging/PhotoFoodEntry';
import { FoodScanResult, type LogEntry } from '../../src/components/logging/FoodScanResult';
import { scanFood, type FoodScanResult as ScanResultData, type MultiItemScanResult } from '../../src/services/foodScanService';
import { getSavedFoods, incrementTimesLogged, type SavedFood } from '../../src/utils/foodLibrary';
import { getMyRecipes } from '../../src/utils/recipeLibrary';
import { addToPantry, getPantryAutoAdd } from '../../src/utils/pantryLibrary';
import { useToast } from '../../src/contexts/ToastContext';
import type { MyRecipe } from '../../src/types/food';
import { Button } from '../../src/components/common/Button';
import { TimestampPicker } from '../../src/components/common/TimestampPicker';
import { RepeatLastEntry } from '../../src/components/logging/RepeatLastEntry';
import { useLastEntry } from '../../src/hooks/useLastEntry';
import { loadIngredientFlags, detectFlaggedIngredients } from '../../src/utils/ingredients';
import type { FoodItem, FoodEntry, MealType, IngredientFlag, RecentFoodInfo } from '../../src/types/food';
import { todayDateString } from '../../src/utils/dayBoundary';
import { getActiveDate } from '../../src/services/dateContextService';
import { DateContextBanner } from '../../src/components/DateContextBanner';
import type { AppSettings } from '../../src/types/profile';

type Screen =
  | 'search'
  | 'configure'
  | 'manual'
  | 'quicklog'
  | 'barcode'
  | 'nlp'
  | 'photo'
  | 'quickconfirm'
  | 'scanning'     // Sprint 10: photo captured, analyzing
  | 'scanresult';  // Sprint 10: scan result review


// Bug #18: Beverage keywords for detecting scanned products that are likely drinks.
// Multi-word keywords must come first so "energy drink" matches before "drink".
const BEVERAGE_KEYWORDS = [
  'energy drink', 'sports drink', 'protein shake',
  'juice', 'soda', 'cola', 'tea', 'coffee', 'milk',
  'beer', 'wine', 'shake', 'smoothie', 'lemonade',
  'cider', 'kombucha', 'sparkling', 'seltzer', 'beverage', 'drink',
];

function looksLikeBeverage(name: string | null | undefined, brand?: string | null): boolean {
  const haystack = `${name ?? ''} ${brand ?? ''}`.toLowerCase();
  return BEVERAGE_KEYWORDS.some((kw) => haystack.includes(kw));
}

function guessMealType(hour: number, settings?: AppSettings | null): MealType {
  if (settings?.fasting_enabled) {
    const start = settings.eating_window_start ?? 12;
    const end = settings.eating_window_end ?? 20;
    if (hour < start || hour >= end) {
      return 'snack'; // Outside eating window
    }
    // Inside window: divide into thirds for meal categorization
    const windowLength = end - start;
    const elapsed = hour - start;
    if (elapsed < windowLength / 3) return 'lunch';  // First meal (not "breakfast")
    if (elapsed < (windowLength * 2) / 3) return 'dinner';
    return 'snack';
  }
  // Original logic for non-fasting users
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

export default function FoodLogScreen() {
  const { showToast } = useToast();
  const [entryTimestamp, setEntryTimestamp] = useState(new Date());
  const [screen, setScreen] = useState<Screen>('search');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingIndex, setServingIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [customWeightGrams, setCustomWeightGrams] = useState<number | null>(null);
  const [mealType, setMealType] = useState<MealType>(() => guessMealType(new Date().getHours()));
  const [ingredientFlags, setIngredientFlags] = useState<IngredientFlag[]>([]);
  const [quickConfirmEntry, setQuickConfirmEntry] = useState<RecentFoodInfo | null>(null);
  const { lastEntry: lastFoodEntry, saveAsLast: saveLastFood } = useLastEntry<FoodEntry>('nutrition.food');

  // Sprint 10: scan state (Sprint 14: multi-item support)
  const [scanResultData, setScanResultData] = useState<ScanResultData | null>(null);
  const [multiScanResults, setMultiScanResults] = useState<ScanResultData[]>([]);
  const [scanPhotoUri, setScanPhotoUri] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [myFoods, setMyFoods] = useState<SavedFood[]>([]);
  const [myRecipes, setMyRecipes] = useState<MyRecipe[]>([]);

  // Bug #19/#20: React-rendered Not Found modal. The prior native Alert.alert
  // got trapped by iOS view-controller transitions (BarcodeScanner CameraView
  // → ImagePicker camera), leaving the alert stuck on top of the scan result.
  // Controlling visibility via React state guarantees reliable dismissal.
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);

  useEffect(() => {
    loadIngredientFlags().then(setIngredientFlags);
    // Load fasting settings to refine meal type guess
    storageGet<AppSettings>(STORAGE_KEYS.SETTINGS).then((settings) => {
      if (settings?.fasting_enabled) {
        setMealType(guessMealType(new Date().getHours(), settings));
      }
    });
    // Load My Foods
    getSavedFoods().then(setMyFoods);
    // Load My Recipes
    getMyRecipes().then(setMyRecipes);
  }, []);

  // Refresh My Foods and My Recipes when returning to search screen
  useEffect(() => {
    if (screen === 'search') {
      getSavedFoods().then(setMyFoods);
      getMyRecipes().then(setMyRecipes);
    }
  }, [screen]);

  const saveEntry = useCallback(
    async (partial: Omit<FoodEntry, 'id' | 'timestamp'>) => {
      const today = getActiveDate();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
      const existing = (await storageGet<FoodEntry[]>(key)) ?? [];

      const entry: FoodEntry = {
        ...partial,
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: entryTimestamp.toISOString(),
      };

      await storageSet(key, [...existing, entry]);
      await saveLastFood(entry);

      // F-03: Update recent foods with enriched serving info
      const recentList = (await storageGet<RecentFoodInfo[]>(STORAGE_KEYS.FOOD_RECENT)) ?? [];
      const recentEntry: RecentFoodInfo = {
        food_item: { ...partial.food_item, last_accessed: new Date().toISOString() },
        serving: partial.serving,
        quantity: partial.quantity,
        calories: Math.round(partial.computed_nutrition.calories),
      };
      const filteredRecent = recentList.filter((r) => r.food_item.source_id !== partial.food_item.source_id);
      await storageSet(STORAGE_KEYS.FOOD_RECENT, [recentEntry, ...filteredRecent].slice(0, 50));

      router.back();
    },
    [saveLastFood, entryTimestamp],
  );

  // Bug #18: Offer to route beverages to the Drinks logger. User decides —
  // this is a suggestion, not a hard redirect.
  const promptIfBeverageOrContinue = useCallback(
    (name: string | null | undefined, brand: string | null | undefined, continueAsFood: () => void) => {
      if (!looksLikeBeverage(name, brand)) {
        continueAsFood();
        return;
      }
      const display = [name, brand].filter(Boolean).join(' ');
      Alert.alert(
        'This looks like a drink',
        `"${display}" looks like a beverage. Log it in the Drinks screen instead?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log as Food', onPress: continueAsFood },
          {
            text: 'Log as Drink',
            onPress: () => router.replace('/log/water'),
          },
        ],
      );
    },
    [],
  );

  // Sprint 21: Auto-add helpers — declared before scan handlers that reference them
  // so React dependency tracking is clean. Fires on successful scan when pref is ON.
  const autoAddScanToPantry = useCallback(async (scan: ScanResultData, source: 'label_scan' | 'barcode_scan') => {
    try {
      const enabled = await getPantryAutoAdd();
      if (!enabled) return;
      const { added } = await addToPantry({
        name: scan.foodName,
        brand: scan.brand,
        barcode: null,
        serving_size: scan.servingSize,
        calories: scan.nutrition.calories,
        protein_g: scan.nutrition.protein,
        carbs_g: scan.nutrition.carbs,
        fat_g: scan.nutrition.fat,
        fiber_g: scan.nutrition.fiber,
        added_sugar_g: scan.nutrition.addedSugar,
        source,
        category: 'food',
      });
      if (added) showToast('Saved to Pantry', 'success');
    } catch (err) {
      console.warn('[Pantry] auto-add failed', err);
    }
  }, [showToast]);

  const autoAddFoodItemToPantry = useCallback(async (food: FoodItem) => {
    try {
      const enabled = await getPantryAutoAdd();
      if (!enabled) return;
      const defaultServing = food.serving_sizes[food.default_serving_index] ?? food.serving_sizes[0];
      if (!defaultServing) return;
      const factor = (defaultServing.gram_weight || 100) / 100;
      const n = food.nutrition_per_100g;
      const { added } = await addToPantry({
        name: food.name,
        brand: food.brand,
        barcode: food.barcode,
        serving_size: defaultServing.description,
        calories: Math.round(n.calories * factor),
        protein_g: Math.round(n.protein_g * factor * 10) / 10,
        carbs_g: Math.round(n.carbs_g * factor * 10) / 10,
        fat_g: Math.round(n.fat_g * factor * 10) / 10,
        fiber_g: n.fiber_g != null ? Math.round(n.fiber_g * factor * 10) / 10 : null,
        added_sugar_g: n.added_sugar_g != null ? Math.round(n.added_sugar_g * factor * 10) / 10 : null,
        sodium_mg: n.sodium_mg != null ? Math.round(n.sodium_mg * factor) : null,
        source: 'barcode_scan',
        category: 'food',
      });
      if (added) showToast('Saved to Pantry', 'success');
    } catch (err) {
      console.warn('[Pantry] auto-add failed', err);
    }
  }, [showToast]);

  // Sprint 10: Capture photo and analyze with Claude Vision
  const handleScanCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to scan food.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setScanPhotoUri(asset.uri);
      setScreen('scanning');
      setScanLoading(true);

      try {
        let base64 = asset.base64;
        if (!base64) {
          base64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
        }
        const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const multiResult = await scanFood(base64, mimeType);

        // Sprint 14: Handle low confidence (blurry/unreadable)
        if (multiResult.items.length === 1 && multiResult.items[0].confidence === 'low' && multiResult.items[0].foodName === 'Unknown Food') {
          Alert.alert(
            "Couldn't identify this food",
            'Try a clearer photo or enter manually.',
            [
              { text: 'Retake Photo', onPress: () => { setScreen('search'); handleScanCamera(); } },
              { text: 'Enter Manually', onPress: () => setScreen('manual') },
            ],
          );
          return;
        }

        // Sprint 14: Multi-item support
        const showResult = () => {
          if (multiResult.isMultiItem) {
            setMultiScanResults(multiResult.items);
            setScanResultData(multiResult.items[0]);
          } else {
            setMultiScanResults([]);
            setScanResultData(multiResult.items[0]);
            // Sprint 21: Auto-add single-item scans to Pantry if enabled
            autoAddScanToPantry(multiResult.items[0], 'label_scan');
          }
          setScreen('scanresult');
        };

        // Bug #18: Single-item scans that look like beverages get a routing prompt.
        // Skip for multi-item scans (mixed meals) — those belong as food.
        if (!multiResult.isMultiItem && multiResult.items.length === 1) {
          const first = multiResult.items[0];
          promptIfBeverageOrContinue(first.foodName, first.brand, () => {
            showResult();
          });
          if (looksLikeBeverage(first.foodName, first.brand)) {
            setScreen('search');
            return;
          }
        } else {
          showResult();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to analyze photo';
        Alert.alert('Scan Error', msg);
        setScreen('search');
      } finally {
        setScanLoading(false);
      }
    }
  }, [promptIfBeverageOrContinue, autoAddScanToPantry]);

  // Sprint 10: Pick from gallery and analyze
  const handleScanGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setScanPhotoUri(asset.uri);
      setScreen('scanning');
      setScanLoading(true);

      try {
        let base64 = asset.base64;
        if (!base64) {
          base64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
        }
        const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const multiResult = await scanFood(base64, mimeType);

        // Sprint 14: Handle low confidence (blurry/unreadable)
        if (multiResult.items.length === 1 && multiResult.items[0].confidence === 'low' && multiResult.items[0].foodName === 'Unknown Food') {
          Alert.alert(
            "Couldn't identify this food",
            'Try a clearer photo or enter manually.',
            [
              { text: 'Retake Photo', onPress: () => { setScreen('search'); handleScanGallery(); } },
              { text: 'Enter Manually', onPress: () => setScreen('manual') },
            ],
          );
          return;
        }

        const showResult = () => {
          if (multiResult.isMultiItem) {
            setMultiScanResults(multiResult.items);
            setScanResultData(multiResult.items[0]);
          } else {
            setMultiScanResults([]);
            setScanResultData(multiResult.items[0]);
            // Sprint 21: Auto-add single-item scans to Pantry if enabled
            autoAddScanToPantry(multiResult.items[0], 'label_scan');
          }
          setScreen('scanresult');
        };

        // Bug #18: Beverage routing prompt for single-item scans.
        if (!multiResult.isMultiItem && multiResult.items.length === 1) {
          const first = multiResult.items[0];
          promptIfBeverageOrContinue(first.foodName, first.brand, () => {
            showResult();
          });
          if (looksLikeBeverage(first.foodName, first.brand)) {
            setScreen('search');
            return;
          }
        } else {
          showResult();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to analyze photo';
        Alert.alert('Scan Error', msg);
        setScreen('search');
      } finally {
        setScanLoading(false);
      }
    }
  }, [promptIfBeverageOrContinue, autoAddScanToPantry]);

  // Sprint 10: Handle scan result log (batch-save, single navigation)
  const handleScanLog = useCallback(async (entries: LogEntry[]) => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);

    try {
      const existing = (await storageGet<FoodEntry[]>(key)) ?? [];

      const newEntries: FoodEntry[] = entries.map((entry) => {
        const sourceId = `scan:${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const serving = { description: entry.servingSize, unit: 'each' as const, gram_weight: 0, quantity: 1 };
        return {
          id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: entryTimestamp.toISOString(),
          meal_type: entry.mealType,
          food_item: {
            source: 'ai_photo' as const,
            source_id: sourceId,
            name: entry.foodName,
            brand: entry.brand,
            barcode: null,
            nutrition_per_100g: {
              calories: entry.nutrition.calories,
              protein_g: entry.nutrition.protein,
              carbs_g: entry.nutrition.carbs,
              fat_g: entry.nutrition.fat,
              fiber_g: entry.nutrition.fiber,
              sugar_g: null,
              added_sugar_g: entry.nutrition.addedSugar,
              sodium_mg: null,
              cholesterol_mg: null,
              saturated_fat_g: null,
              trans_fat_g: null,
              potassium_mg: null,
              vitamin_d_mcg: null,
              calcium_mg: null,
              iron_mg: null,
            },
            serving_sizes: [serving],
            default_serving_index: 0,
            ingredients: null,
            last_accessed: new Date().toISOString(),
          },
          serving,
          quantity: 1,
          computed_nutrition: {
            calories: entry.nutrition.calories,
            protein_g: entry.nutrition.protein,
            carbs_g: entry.nutrition.carbs,
            fat_g: entry.nutrition.fat,
            fiber_g: entry.nutrition.fiber,
            sugar_g: null,
            added_sugar_g: entry.nutrition.addedSugar,
            sodium_mg: null,
            cholesterol_mg: null,
            saturated_fat_g: null,
            trans_fat_g: null,
            potassium_mg: null,
            vitamin_d_mcg: null,
            calcium_mg: null,
            iron_mg: null,
          },
          source: 'ai_photo' as const,
          photo_uri: entry.photoUri,
          photo_confidence: entry.confidence,
          flagged_ingredients: [] as string[],
          notes: entry.isEstimate ? 'AI estimate' : 'Nutrition label scan',
        };
      });

      // Single batch write — all entries saved atomically
      await storageSet(key, [...existing, ...newEntries]);

      // Update last entry cache
      const lastNew = newEntries[newEntries.length - 1];
      await saveLastFood(lastNew);

      // Update recent foods
      const recentList = (await storageGet<RecentFoodInfo[]>(STORAGE_KEYS.FOOD_RECENT)) ?? [];
      const recentEntry: RecentFoodInfo = {
        food_item: { ...lastNew.food_item, last_accessed: new Date().toISOString() },
        serving: lastNew.serving,
        quantity: lastNew.quantity,
        calories: Math.round(lastNew.computed_nutrition.calories),
      };
      const filteredRecent = recentList.filter((r) => r.food_item.source_id !== lastNew.food_item.source_id);
      await storageSet(STORAGE_KEYS.FOOD_RECENT, [recentEntry, ...filteredRecent].slice(0, 50));

      // Navigate back ONCE (after all writes complete)
      router.back();

      // Toast confirmation
      const count = entries.length;
      const msg = count > 1 ? `${count} items logged` : `${entries[0].foodName} logged`;
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        Alert.alert('Logged', `${msg} added to food log`);
      }
    } catch (error) {
      console.error('[FoodLog] Failed to save scan entry:', error);
      Alert.alert('Save Error', 'Failed to save food entry. Please try again.');
    }
  }, [saveLastFood, entryTimestamp]);

  // Sprint 10: Log from My Foods (Sprint 14: photo thumbnail quick re-log)
  const handleMyFoodLog = useCallback((food: SavedFood) => {
    // Pre-populate scan result from saved food and show review screen
    const result: ScanResultData = {
      foodName: food.foodName,
      brand: food.brand ?? null,
      servingSize: food.servingSize,
      servingsPerContainer: null,
      isEstimate: false,
      confidence: 'high',
      nutrition: { ...food.nutrition },
    };
    setScanResultData(result);
    setMultiScanResults([]);
    setScanPhotoUri(food.photoUri ?? null);
    setScreen('scanresult');
    incrementTimesLogged(food.id);
  }, []);

  const handleBarcodeFound = useCallback((food: FoodItem) => {
    // Unmount BarcodeScanner CameraView before showing any alert or configure
    // screen. Avoids the iOS view-controller stacking that traps alerts.
    setScreen('search');
    // Sprint 21: Auto-add barcode scan to Pantry if enabled
    autoAddFoodItemToPantry(food);
    setTimeout(() => {
      const continueAsFood = () => {
        setSelectedFood(food);
        setServingIndex(food.default_serving_index);
        setQuantity(1);
        setScreen('configure');
      };
      promptIfBeverageOrContinue(food.name, food.brand, continueAsFood);
    }, 150);
  }, [promptIfBeverageOrContinue, autoAddFoodItemToPantry]);

  // Bug #19/#20: Show a React-controlled modal. The BarcodeScanner is already
  // unmounting via screen state — we no longer try to stack a native alert on
  // top of the CameraView.
  const handleBarcodeNotFound = useCallback((_barcode: string) => {
    setScreen('search');
    setShowNotFoundModal(true);
  }, []);

  const handleNotFoundScanLabel = useCallback(() => {
    setShowNotFoundModal(false);
    // Short delay so the modal fully dismisses before ImagePicker presents
    setTimeout(handleScanCamera, 150);
  }, [handleScanCamera]);

  const handleNotFoundManual = useCallback(() => {
    setShowNotFoundModal(false);
    setScreen('manual');
  }, []);

  const handleNotFoundCancel = useCallback(() => {
    setShowNotFoundModal(false);
  }, []);

  const repeatLastFood = useCallback(() => {
    if (!lastFoodEntry) return;
    setSelectedFood(lastFoodEntry.food_item);
    setServingIndex(
      lastFoodEntry.food_item.serving_sizes.findIndex(
        (s) => s.description === lastFoodEntry.serving.description,
      ) ?? 0,
    );
    setQuantity(lastFoodEntry.quantity);
    setCustomWeightGrams(null);
    setScreen('configure');
  }, [lastFoodEntry]);

  // F-03: Quick confirm for recent food (2-tap flow)
  const handleRecentTap = useCallback((entry: RecentFoodInfo) => {
    setQuickConfirmEntry(entry);
    setScreen('quickconfirm');
  }, []);

  const handleQuickConfirm = useCallback(() => {
    if (!quickConfirmEntry) return;
    const { food_item, serving, quantity: qty } = quickConfirmEntry;
    const computed = scaleNutrition(food_item.nutrition_per_100g, serving, qty);
    saveEntry({
      meal_type: mealType,
      food_item,
      serving,
      quantity: qty,
      computed_nutrition: computed,
      source: food_item.source,
      photo_uri: null,
      photo_confidence: null,
      flagged_ingredients: [],
      notes: null,
    });
  }, [quickConfirmEntry, mealType, saveEntry]);

  const handleFoodSelected = useCallback((food: FoodItem) => {
    setSelectedFood(food);
    setServingIndex(food.default_serving_index);
    setQuantity(1);
    setCustomWeightGrams(null);
    setScreen('configure');
  }, []);

  const handleConfirmServing = useCallback(() => {
    if (selectedFood == null) return;

    // Use custom weight serving if set, otherwise use the selected serving size
    const serving = customWeightGrams != null && customWeightGrams > 0
      ? { description: `${Math.round(customWeightGrams)}g (custom)`, unit: 'g' as const, gram_weight: customWeightGrams, quantity: 1 }
      : selectedFood.serving_sizes[servingIndex];
    const effectiveQty = customWeightGrams != null && customWeightGrams > 0 ? 1 : quantity;

    const computed = scaleNutrition(selectedFood.nutrition_per_100g, serving, effectiveQty);
    const flagged = detectFlaggedIngredients(selectedFood.ingredients, ingredientFlags);

    saveEntry({
      meal_type: mealType,
      food_item: selectedFood,
      serving,
      quantity: effectiveQty,
      computed_nutrition: computed,
      source: selectedFood.source,
      photo_uri: null,
      photo_confidence: null,
      flagged_ingredients: flagged,
      notes: null,
    });
  }, [selectedFood, servingIndex, quantity, customWeightGrams, mealType, saveEntry, ingredientFlags]);

  const handleNLPConfirm = useCallback(
    (items: Array<{ name: string; portion: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g?: number | null; sugar_g?: number | null; sodium_mg?: number | null }>) => {
      const today = getActiveDate();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);

      (async () => {
        const existing = (await storageGet<FoodEntry[]>(key)) ?? [];
        const newEntries: FoodEntry[] = items.map((item) => ({
          id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: entryTimestamp.toISOString(),
          meal_type: mealType,
          food_item: {
            source: 'nlp' as const,
            source_id: `nlp:${Date.now()}`,
            name: item.name,
            brand: null,
            barcode: null,
            nutrition_per_100g: {
              calories: item.calories,
              protein_g: item.protein_g,
              carbs_g: item.carbs_g,
              fat_g: item.fat_g,
              fiber_g: item.fiber_g ?? null,
              sugar_g: item.sugar_g ?? null,
              added_sugar_g: null,
              sodium_mg: item.sodium_mg ?? null,
              cholesterol_mg: null,
              saturated_fat_g: null,
              trans_fat_g: null,
              potassium_mg: null,
              vitamin_d_mcg: null,
              calcium_mg: null,
              iron_mg: null,
            },
            serving_sizes: [{ description: item.portion, unit: 'each', gram_weight: 0, quantity: 1 }],
            default_serving_index: 0,
            ingredients: null,
            last_accessed: new Date().toISOString(),
          },
          serving: { description: item.portion, unit: 'each', gram_weight: 0, quantity: 1 },
          quantity: 1,
          computed_nutrition: {
            calories: item.calories,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
            fiber_g: item.fiber_g ?? null,
            sugar_g: item.sugar_g ?? null,
            added_sugar_g: null,
            sodium_mg: item.sodium_mg ?? null,
            cholesterol_mg: null,
            saturated_fat_g: null,
            trans_fat_g: null,
            potassium_mg: null,
            vitamin_d_mcg: null,
            calcium_mg: null,
            iron_mg: null,
          },
          source: 'nlp' as const,
          photo_uri: null,
          photo_confidence: null,
          flagged_ingredients: [],
          notes: null,
        }));

        await storageSet(key, [...existing, ...newEntries]);
        router.back();
      })();
    },
    [mealType, entryTimestamp],
  );

  const handlePhotoConfirm = useCallback(
    (items: Array<{ name: string; portion: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; confidence: 'high' | 'medium' | 'low'; note: string | null }>, photoUri: string) => {
      const today = getActiveDate();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);

      (async () => {
        const existing = (await storageGet<FoodEntry[]>(key)) ?? [];
        const newEntries: FoodEntry[] = items.map((item) => ({
          id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: entryTimestamp.toISOString(),
          meal_type: mealType,
          food_item: {
            source: 'ai_photo' as const,
            source_id: `photo:${Date.now()}`,
            name: item.name,
            brand: null,
            barcode: null,
            nutrition_per_100g: {
              calories: item.calories,
              protein_g: item.protein_g,
              carbs_g: item.carbs_g,
              fat_g: item.fat_g,
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
            },
            serving_sizes: [{ description: item.portion, unit: 'each', gram_weight: 0, quantity: 1 }],
            default_serving_index: 0,
            ingredients: null,
            last_accessed: new Date().toISOString(),
          },
          serving: { description: item.portion, unit: 'each', gram_weight: 0, quantity: 1 },
          quantity: 1,
          computed_nutrition: {
            calories: item.calories,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
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
          },
          source: 'ai_photo' as const,
          photo_uri: photoUri,
          photo_confidence: item.confidence,
          flagged_ingredients: [],
          notes: item.note,
        }));

        await storageSet(key, [...existing, ...newEntries]);
        router.back();
      })();
    },
    [mealType, entryTimestamp],
  );

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <DateContextBanner />
        <TimestampPicker value={entryTimestamp} onChange={setEntryTimestamp} />

        {screen === 'search' && (
          <>
          {/* Sprint 21: My Pantry entry point */}
          <TouchableOpacity
            style={styles.pantryEntryBtn}
            onPress={() => router.push('/log/pantry' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="bookmark" size={18} color={Colors.accent} />
            <Text style={styles.pantryEntryText}>My Pantry</Text>
            <Text style={styles.pantryEntrySub}>Scan once, log forever</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
          </TouchableOpacity>

          {/* Sprint 10: Prominent scan area */}
          <View style={styles.scanArea}>
            <TouchableOpacity style={styles.scanBtn} onPress={handleScanCamera} activeOpacity={0.7}>
              <Ionicons name="camera" size={28} color={Colors.accent} />
              <Text style={styles.scanBtnTitle}>Scan</Text>
              <Text style={styles.scanBtnSub}>Food/Label</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanBtn} onPress={handleScanGallery} activeOpacity={0.7}>
              <Ionicons name="images" size={28} color={Colors.accent} />
              <Text style={styles.scanBtnTitle}>Gallery</Text>
              <Text style={styles.scanBtnSub}>Choose</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanBtn} onPress={() => setScreen('barcode')} activeOpacity={0.7}>
              <Ionicons name="barcode" size={28} color={Colors.accent} />
              <Text style={styles.scanBtnTitle}>Barcode</Text>
              <Text style={styles.scanBtnSub}>UPC/EAN</Text>
            </TouchableOpacity>
          </View>

          {/* Sprint 10: My Foods section */}
          {myFoods.length > 0 && (
            <View style={styles.myFoodsSection}>
              <View style={styles.myFoodsHeader}>
                <Ionicons name="star" size={14} color={Colors.accent} />
                <Text style={styles.myFoodsTitle}>My Foods</Text>
              </View>
              {myFoods.slice(0, 5).map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={styles.myFoodRow}
                  onPress={() => handleMyFoodLog(food)}
                  activeOpacity={0.7}
                >
                  {/* Sprint 14: Photo thumbnail for saved foods */}
                  {food.photoUri && (
                    <Image source={{ uri: food.photoUri }} style={styles.myFoodThumb} />
                  )}
                  <View style={styles.myFoodInfo}>
                    <Text style={styles.myFoodName} numberOfLines={1}>
                      {food.foodName}
                      {food.brand ? ` (${food.brand})` : ''}
                    </Text>
                    <Text style={styles.myFoodServing} numberOfLines={1}>
                      {food.servingSize}
                      {food.timesLogged > 0 ? ` \u2022 Logged ${food.timesLogged}x` : ''}
                    </Text>
                  </View>
                  <View style={styles.myFoodCalCol}>
                    <Text style={styles.myFoodCal}>{food.nutrition.calories}</Text>
                    <Text style={styles.myFoodCalUnit}>cal</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={Colors.accent} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Sprint 20: My Recipes section */}
          {myRecipes.length > 0 && (
            <View style={styles.myFoodsSection}>
              <View style={styles.myFoodsHeader}>
                <Ionicons name="book" size={14} color={Colors.accent} />
                <Text style={styles.myFoodsTitle}>My Recipes</Text>
              </View>
              {myRecipes.slice(0, 3).map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.myFoodRow}
                  onPress={() => router.push(`/settings/recipe-log?recipeId=${recipe.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.myFoodInfo}>
                    <Text style={styles.myFoodName} numberOfLines={1}>
                      {recipe.name}
                    </Text>
                    <Text style={styles.myFoodServing} numberOfLines={1}>
                      {recipe.totalServings} serving{recipe.totalServings !== 1 ? 's' : ''}
                      {recipe.timesLogged > 0 ? ` \u2022 Logged ${recipe.timesLogged}x` : ''}
                    </Text>
                  </View>
                  <View style={styles.myFoodCalCol}>
                    <Text style={styles.myFoodCal}>{recipe.macrosPerServing.calories}</Text>
                    <Text style={styles.myFoodCalUnit}>cal/srv</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={Colors.accent} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <RepeatLastEntry
            tagLabel="food"
            subtitle={lastFoodEntry?.food_item.name}
            visible={lastFoodEntry != null}
            onRepeat={repeatLastFood}
          />
          <FoodSearch
            onSelect={handleFoodSelected}
            onManualEntry={() => setScreen('manual')}
            onQuickLog={() => setScreen('quicklog')}
            onBarcodeScan={() => setScreen('barcode')}
            onNLPEntry={() => setScreen('nlp')}
            onPhotoEntry={() => setScreen('photo')}
            onRecentTap={handleRecentTap}
          />
          </>
        )}

        {screen === 'barcode' && (
          <BarcodeScanner
            onFoodFound={handleBarcodeFound}
            onNotFound={handleBarcodeNotFound}
            onCancel={() => setScreen('search')}
          />
        )}

        {/* Sprint 10: Scanning loading state */}
        {screen === 'scanning' && (
          <View style={styles.scanningContainer}>
            {scanPhotoUri && (
              <Image source={{ uri: scanPhotoUri }} style={styles.scanningPreview} resizeMode="cover" />
            )}
            <View style={styles.scanningRow}>
              <ActivityIndicator color={Colors.accent} size="large" />
              <Text style={styles.scanningText}>Scanning...</Text>
              <Text style={styles.scanningSubtext}>Analyzing your food with AI</Text>
            </View>
          </View>
        )}

        {/* Sprint 10/14: Scan result review (multi-item support) */}
        {screen === 'scanresult' && scanResultData && (
          <FoodScanResult
            result={scanResultData}
            multiItems={multiScanResults.length > 1 ? multiScanResults : undefined}
            photoUri={scanPhotoUri}
            mealType={mealType}
            timestamp={entryTimestamp}
            onLog={handleScanLog}
            scanSource="label_scan"
            onCancel={() => {
              setScanResultData(null);
              setMultiScanResults([]);
              setScanPhotoUri(null);
              setScreen('search');
            }}
          />
        )}

        {screen === 'configure' && selectedFood != null && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <ServingSizeSelector
              servingSizes={selectedFood.serving_sizes}
              selectedServingIndex={servingIndex}
              quantity={quantity}
              nutritionPer100g={selectedFood.nutrition_per_100g}
              onServingChange={(idx) => { setCustomWeightGrams(null); setServingIndex(idx); }}
              onQuantityChange={setQuantity}
              onCustomWeight={setCustomWeightGrams}
            />
            <View style={styles.configureActions}>
              <View style={styles.flex1}>
                <Button
                  title="Back"
                  variant="secondary"
                  onPress={() => {
                    setScreen('search');
                    setSelectedFood(null);
                  }}
                />
              </View>
              <View style={styles.flex1}>
                <Button title="Add Food" onPress={handleConfirmServing} />
              </View>
            </View>
          </ScrollView>
        )}

        {screen === 'manual' && (
          <FoodEntryForm
            food={null}
            mealType={mealType}
            onSave={saveEntry}
            onCancel={() => setScreen('search')}
          />
        )}

        {screen === 'quicklog' && (
          <QuickLog
            mealType={mealType}
            onSave={saveEntry}
            onCancel={() => setScreen('search')}
          />
        )}

        {screen === 'nlp' && (
          <NLPFoodEntry
            mealType={mealType}
            onConfirm={handleNLPConfirm}
            onCancel={() => setScreen('search')}
          />
        )}

        {screen === 'photo' && (
          <PhotoFoodEntry
            mealType={mealType}
            onConfirm={handlePhotoConfirm}
            onCancel={() => setScreen('search')}
          />
        )}

        {/* F-03: Quick confirm for recent food (2-tap flow) */}
        {screen === 'quickconfirm' && quickConfirmEntry && (
          <View style={styles.quickConfirmContainer}>
            <View style={styles.quickConfirmCard}>
              <Text style={styles.quickConfirmName}>{quickConfirmEntry.food_item.name}</Text>
              <Text style={styles.quickConfirmServing}>
                {quickConfirmEntry.serving?.description ?? 'Default serving'}
                {quickConfirmEntry.quantity > 1 ? ` x${quickConfirmEntry.quantity}` : ''}
              </Text>
              <Text style={styles.quickConfirmCal}>
                {quickConfirmEntry.calories} cal
              </Text>
            </View>
            <View style={styles.configureActions}>
              <View style={styles.flex1}>
                <Button
                  title="Change"
                  variant="secondary"
                  onPress={() => {
                    // Go to full configure mode
                    setSelectedFood(quickConfirmEntry.food_item);
                    const idx = quickConfirmEntry.food_item.serving_sizes.findIndex(
                      (s) => s.description === quickConfirmEntry.serving?.description,
                    );
                    setServingIndex(idx >= 0 ? idx : quickConfirmEntry.food_item.default_serving_index);
                    setQuantity(quickConfirmEntry.quantity);
                    setCustomWeightGrams(null);
                    setScreen('configure');
                  }}
                />
              </View>
              <View style={styles.flex2}>
                <Button title="Log" onPress={handleQuickConfirm} />
              </View>
            </View>
          </View>
        )}

        {/* Bug #19/#20: React-controlled "Product Not Found" modal. */}
        <Modal
          visible={showNotFoundModal}
          transparent
          animationType="fade"
          onRequestClose={handleNotFoundCancel}
        >
          <View style={styles.notFoundBackdrop}>
            <View style={styles.notFoundCard}>
              <Text style={styles.notFoundTitle}>Product Not Found</Text>
              <Text style={styles.notFoundBody}>
                Try scanning the nutrition label instead.
              </Text>
              <View style={styles.notFoundActions}>
                <TouchableOpacity
                  style={styles.notFoundSecondary}
                  onPress={handleNotFoundManual}
                  activeOpacity={0.7}
                >
                  <Text style={styles.notFoundSecondaryText}>Manual Entry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.notFoundPrimary}
                  onPress={handleNotFoundScanLabel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.notFoundPrimaryText}>Scan Label</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.notFoundCancel}
                onPress={handleNotFoundCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.notFoundCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 12,
  },
  // Sprint 21: Pantry entry
  pantryEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.accent + '55',
  },
  pantryEntryText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  pantryEntrySub: {
    flex: 1,
    color: Colors.secondaryText,
    fontSize: 12,
    marginLeft: 4,
  },
  // Sprint 10: Scan area
  scanArea: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  scanBtnTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  scanBtnSub: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  // Sprint 10: My Foods
  myFoodsSection: {
    marginBottom: 12,
  },
  myFoodsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  myFoodsTitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  myFoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
    minHeight: 56,
  },
  myFoodThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  myFoodInfo: {
    flex: 1,
    marginRight: 12,
  },
  myFoodName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  myFoodServing: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  myFoodCalCol: {
    alignItems: 'flex-end',
  },
  myFoodCal: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  myFoodCalUnit: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  // Sprint 10: Scanning state
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningPreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 24,
  },
  scanningRow: {
    alignItems: 'center',
    gap: 12,
  },
  scanningText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  scanningSubtext: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  // Existing styles
  configureContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  configureActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  quickConfirmContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  quickConfirmCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  quickConfirmName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickConfirmServing: {
    color: Colors.secondaryText,
    fontSize: 15,
    textAlign: 'center',
  },
  quickConfirmCal: {
    color: Colors.accentText,
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums' as const],
    marginTop: 8,
  },
  notFoundBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notFoundCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  notFoundTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  notFoundBody: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  notFoundActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  notFoundPrimary: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  notFoundPrimaryText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '600',
  },
  notFoundSecondary: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  notFoundSecondaryText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  notFoundCancel: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  notFoundCancelText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
});
