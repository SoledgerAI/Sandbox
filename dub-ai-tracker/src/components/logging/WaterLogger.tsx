// Drinks logging component -- beverage types, quick-add, daily total, goal progress
// Sprint 11: Hydration → Drinks rename, new beverages, caffeine logic, quick-add fixes

import { useState, useEffect, useCallback } from 'react';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { TimestampPicker } from '../common/TimestampPicker';
import { BarcodeScanner } from './BarcodeScanner';
import type { WaterEntry, BeverageType, FoodItem } from '../../types';
import { NON_HYDRATING_BEVERAGES } from '../../types';
import { todayDateString } from '../../utils/dayBoundary';
import { getActiveDate } from '../../services/dateContextService';

const QUICK_ADD_OPTIONS = [
  { label: '8 oz', amount: 8 },
  { label: '10 oz', amount: 10 },
  { label: '12 oz', amount: 12 },
  { label: '16 oz', amount: 16 },
  { label: '20 oz', amount: 20 },
  { label: '24 oz', amount: 24 },
  { label: '32 oz', amount: 32 },
];

const BEVERAGE_OPTIONS: { value: BeverageType; label: string }[] = [
  { value: 'water', label: 'Water' },
  { value: 'tea', label: 'Tea' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'juice', label: 'Juice' },
  { value: 'sparkling', label: 'Sparkling' },
  { value: 'energy_drink', label: 'Energy Drink' },
  { value: 'smoothie', label: 'Smoothie' },
  { value: 'protein_shake', label: 'Protein Shake' },
  { value: 'soda', label: 'Soda' },
  { value: 'milk', label: 'Milk' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_WATER_GOAL_OZ = 64;

function isHydrating(bev: BeverageType): boolean {
  return !NON_HYDRATING_BEVERAGES.includes(bev);
}

interface WaterLoggerProps {
  onEntryLogged?: () => void;
}

export function WaterLogger({ onEntryLogged }: WaterLoggerProps) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [waterGoal, setWaterGoal] = useState(DEFAULT_WATER_GOAL_OZ);
  const [selectedBeverage, setSelectedBeverage] = useState<BeverageType>('water');
  const [timestamp, setTimestamp] = useState(new Date());
  // Bug #17: Barcode scan state. When `scanning` is true, the scanner replaces
  // the rest of the UI. `scannedProduct` is populated on a successful lookup
  // and used to pre-fill the entry + show a preview card above the logger.
  const [scanning, setScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<{
    name: string;
    brand: string | null;
    calPer100g: number;
    beverage: BeverageType;
  } | null>(null);
  const { lastEntry: lastWater, saveAsLast: saveLastWater } = useLastEntry<WaterEntry>('hydration.water');

  const loadData = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_WATER, today);
    const stored = await storageGet<WaterEntry[]>(key);
    setEntries(stored ?? []);

    const profile = await storageGet<{ weight_lbs?: number }>(STORAGE_KEYS.PROFILE);
    if (profile?.weight_lbs) {
      setWaterGoal(Math.round(profile.weight_lbs / 2));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalOz = entries.reduce((sum, e) => sum + e.amount_oz, 0);

  // Hydrating total: only beverages that count toward the goal
  const hydratingOz = entries
    .filter((e) => isHydrating(e.beverage ?? 'water'))
    .reduce((sum, e) => sum + e.amount_oz, 0);

  // Caffeine subtotal: non-hydrating beverages
  const caffeineOz = entries
    .filter((e) => !isHydrating(e.beverage ?? 'water'))
    .reduce((sum, e) => sum + e.amount_oz, 0);

  const progressPct = Math.min(hydratingOz / waterGoal, 1);

  // Breakdown by beverage type
  const beverageBreakdown = entries.reduce<Record<string, number>>((acc, e) => {
    const bev = e.beverage ?? 'water';
    acc[bev] = (acc[bev] ?? 0) + e.amount_oz;
    return acc;
  }, {});
  const breakdownEntries = Object.entries(beverageBreakdown).filter(([, oz]) => oz > 0);

  // Bug #17: Convert oz volume to calories using the scanned product's
  // cal-per-100g. For beverages we treat 100g ≈ 100mL (density ≈ 1) and
  // convert 1 fl oz ≈ 29.5735 mL.
  const caloriesForOz = useCallback(
    (oz: number): number | null => {
      if (!scannedProduct) return null;
      const mL = oz * 29.5735;
      return Math.round((scannedProduct.calPer100g * mL) / 100);
    },
    [scannedProduct],
  );

  const logDrink = useCallback(
    async (amount: number) => {
      const today = getActiveDate();
      const key = dateKey(STORAGE_KEYS.LOG_WATER, today);

      const entry: WaterEntry = {
        id: `water_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: timestamp.toISOString(),
        amount_oz: amount,
        beverage: selectedBeverage,
        notes: null,
        product_name: scannedProduct
          ? [scannedProduct.name, scannedProduct.brand].filter(Boolean).join(' ')
          : null,
        calories: caloriesForOz(amount),
        source: scannedProduct ? 'scan' : 'manual',
      };

      const updated = [...entries, entry];
      await storageSet(key, updated);
      await saveLastWater(entry);
      setEntries(updated);

      // Check if hydration goal reached with this entry (only for hydrating drinks)
      if (isHydrating(selectedBeverage)) {
        const newHydrating = updated
          .filter((e) => isHydrating(e.beverage ?? 'water'))
          .reduce((sum, e) => sum + e.amount_oz, 0);
        if (newHydrating >= waterGoal && hydratingOz < waterGoal) {
          hapticSuccess();
        } else {
          hapticLight();
        }
      } else {
        hapticLight();
      }
      // Clear scanned product after logging — next entry starts fresh
      setScannedProduct(null);
      onEntryLogged?.();
    },
    [entries, onEntryLogged, selectedBeverage, saveLastWater, timestamp, waterGoal, hydratingOz, scannedProduct, caloriesForOz],
  );

  const logCustom = useCallback(() => {
    const trimmed = customAmount.trim();
    if (!trimmed) {
      Alert.alert('Invalid Amount', 'Please enter a valid number of ounces.');
      return;
    }
    const amount = parseFloat(trimmed);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid number of ounces.');
      return;
    }
    logDrink(amount);
    setCustomAmount('');
  }, [customAmount, logDrink]);

  const confirmDelete = useCallback(
    (entry: WaterEntry) => {
      const bev = beverageLabel(entry.beverage ?? 'water');
      Alert.alert(
        'Delete Entry?',
        `Remove this ${entry.amount_oz} oz ${bev} entry?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const today = getActiveDate();
              const key = dateKey(STORAGE_KEYS.LOG_WATER, today);
              const updated = entries.filter((e) => e.id !== entry.id);
              await storageSet(key, updated);
              setEntries(updated);
            },
          },
        ],
      );
    },
    [entries],
  );

  const repeatLastWater = useCallback(() => {
    if (!lastWater) return;
    setSelectedBeverage(lastWater.beverage ?? 'water');
    setCustomAmount(String(lastWater.amount_oz));
  }, [lastWater]);

  function beverageLabel(bev: string): string {
    return BEVERAGE_OPTIONS.find((b) => b.value === bev)?.label ?? bev;
  }

  // Bug #17: Map scanned product name keywords to a BeverageType so the
  // hydration-goal calculation stays correct (e.g., Coke → soda non-hydrating).
  const inferBeverageType = useCallback((name: string, brand: string | null): BeverageType => {
    const h = `${name} ${brand ?? ''}`.toLowerCase();
    if (/soda|cola|pop\b|dr pepper|sprite|mountain dew/.test(h)) return 'soda';
    if (/juice/.test(h)) return 'juice';
    if (/energy/.test(h)) return 'energy_drink';
    if (/protein/.test(h)) return 'protein_shake';
    if (/smoothie/.test(h)) return 'smoothie';
    if (/milk/.test(h)) return 'milk';
    if (/coffee|espresso|latte/.test(h)) return 'coffee';
    if (/tea\b|matcha/.test(h)) return 'tea';
    if (/sparkling|seltzer|la croix/.test(h)) return 'sparkling';
    if (/water/.test(h)) return 'water';
    return 'other';
  }, []);

  const handleBarcodeFound = useCallback((food: FoodItem) => {
    const bev = inferBeverageType(food.name, food.brand);
    setSelectedBeverage(bev);
    setScannedProduct({
      name: food.name,
      brand: food.brand,
      calPer100g: food.nutrition_per_100g.calories ?? 0,
      beverage: bev,
    });
    setScanning(false);
  }, [inferBeverageType]);

  const handleBarcodeNotFound = useCallback(() => {
    setScanning(false);
    Alert.alert(
      'Product Not Found',
      'Enter the drink manually — pick beverage type and volume below.',
      [{ text: 'OK' }],
    );
  }, []);

  const clearScannedProduct = useCallback(() => {
    setScannedProduct(null);
  }, []);

  const selectedIsNonHydrating = !isHydrating(selectedBeverage);

  // Bug #17: Render BarcodeScanner full-screen when scanning
  if (scanning) {
    return (
      <BarcodeScanner
        onFoodFound={handleBarcodeFound}
        onNotFound={handleBarcodeNotFound}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <RepeatLastEntry
        tagLabel="drinks"
        subtitle={lastWater ? `${lastWater.amount_oz} oz ${lastWater.beverage ?? 'water'}` : undefined}
        visible={lastWater != null}
        onRepeat={repeatLastWater}
      />

      {/* Bug #17: Scan Beverage entry point */}
      <TouchableOpacity
        style={styles.scanBtn}
        onPress={() => setScanning(true)}
        activeOpacity={0.7}
        accessibilityLabel="Scan beverage barcode"
        accessibilityRole="button"
      >
        <Ionicons name="barcode" size={22} color={Colors.accent} />
        <Text style={styles.scanBtnText}>Scan Beverage Barcode</Text>
      </TouchableOpacity>

      {/* Bug #17: Scanned product preview card */}
      {scannedProduct && (
        <View style={styles.scannedCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.scannedLabel}>Scanned</Text>
            <Text style={styles.scannedName} numberOfLines={1}>
              {scannedProduct.name}
              {scannedProduct.brand ? ` (${scannedProduct.brand})` : ''}
            </Text>
            <Text style={styles.scannedMeta}>
              {scannedProduct.calPer100g} cal/100mL &middot; Tap a volume below to log
            </Text>
          </View>
          <TouchableOpacity
            onPress={clearScannedProduct}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Clear scanned product"
          >
            <Ionicons name="close-circle" size={22} color={Colors.secondaryText} />
          </TouchableOpacity>
        </View>
      )}

      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Daily total and goal */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="water" size={28} color={Colors.accent} />
          <View style={styles.summaryText}>
            <Text style={styles.totalAmount}>{hydratingOz} oz</Text>
            <Text style={styles.goalText}>of {waterGoal} oz hydration goal</Text>
          </View>
        </View>

        {/* Progress bar — hydrating drinks only */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPct * 100}%`,
                backgroundColor:
                  progressPct >= 0.8
                    ? Colors.success
                    : progressPct >= 0.5
                      ? Colors.warning
                      : Colors.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {Math.round(progressPct * 100)}% of daily goal
        </Text>

        {/* Caffeine subtotal */}
        {caffeineOz > 0 && (
          <View style={styles.caffeineRow}>
            <Text style={styles.caffeineText}>
              ☕ Caffeine / Non-hydrating: {caffeineOz} oz
            </Text>
          </View>
        )}

        {/* Beverage breakdown */}
        {breakdownEntries.length > 1 && (
          <Text style={styles.breakdownText}>
            {breakdownEntries.map(([bev, oz]) => `${beverageLabel(bev)}: ${oz} oz`).join(' | ')}
          </Text>
        )}
      </View>

      {/* Beverage type selector */}
      <Text style={styles.sectionTitle}>Beverage</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.beverageRow}
      >
        {BEVERAGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.beverageBtn,
              selectedBeverage === opt.value && styles.beverageBtnSelected,
            ]}
            onPress={() => setSelectedBeverage(opt.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.beverageBtnText,
                selectedBeverage === opt.value && styles.beverageBtnTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Non-hydrating indicator */}
      {selectedIsNonHydrating && (
        <Text style={styles.nonHydratingNote}>
          ☕ Doesn&apos;t count toward hydration goal
        </Text>
      )}

      {/* Quick-add buttons — horizontal scrollable pills with fade edge */}
      <Text style={styles.sectionTitle}>Quick Add</Text>
      <View style={styles.quickAddWrapper}>
        <FlatList
          horizontal
          data={QUICK_ADD_OPTIONS}
          keyExtractor={(item) => String(item.amount)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickAddRow}
          renderItem={({ item: opt }) => (
            <TouchableOpacity
              style={styles.quickAddPill}
              onPress={() => logDrink(opt.amount)}
              activeOpacity={0.7}
              accessibilityLabel={`Add ${opt.label} of ${beverageLabel(selectedBeverage)}`}
            >
              <Text style={styles.quickAddText}>{opt.label}</Text>
            </TouchableOpacity>
          )}
        />
        {/* Fade edge indicator */}
        <LinearGradient
          colors={['transparent', Colors.primaryBackground]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fadeEdge}
          pointerEvents="none"
        />
      </View>

      {/* Custom amount */}
      <Text style={styles.sectionTitle}>Custom Amount</Text>
      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          value={customAmount}
          onChangeText={setCustomAmount}
          placeholder="oz"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={logCustom}
        />
        <TouchableOpacity
          style={[styles.customBtn, !customAmount.trim() && styles.customBtnDisabled]}
          onPress={logCustom}
          disabled={!customAmount.trim()}
          activeOpacity={0.7}
        >
          <Text style={styles.customBtnText}>Log</Text>
        </TouchableOpacity>
      </View>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Today&apos;s Entries</Text>
          {entries
            .slice()
            .reverse()
            .map((entry) => {
              const bev = entry.beverage ?? 'water';
              const nonHydrating = !isHydrating(bev);
              return (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryAmount}>{entry.amount_oz} oz</Text>
                    <Text style={[styles.entryBeverage, nonHydrating && styles.entryBeverageCaffeine]}>
                      {beverageLabel(bev)}{nonHydrating ? ' ☕' : ''}
                    </Text>
                    <Text style={styles.entryTime}>
                      {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmDelete(entry)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  scanBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  scannedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
    gap: 10,
  },
  scannedLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  scannedName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  scannedMeta: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  summaryText: {
    flex: 1,
  },
  totalAmount: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  goalText: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  caffeineRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  caffeineText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  breakdownText: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  beverageRow: {
    gap: 8,
    paddingRight: 16,
    paddingBottom: 8,
    marginBottom: 16,
  },
  beverageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  beverageBtnSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  beverageBtnText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  beverageBtnTextSelected: {
    color: Colors.primaryBackground,
  },
  nonHydratingNote: {
    color: Colors.warning,
    fontSize: 12,
    marginBottom: 16,
    marginTop: -8,
  },
  quickAddWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  quickAddRow: {
    gap: 8,
    paddingRight: 32,
  },
  quickAddPill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 44,
    minWidth: 64,
  },
  quickAddText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '700',
  },
  fadeEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  customBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 24,
    justifyContent: 'center',
    minHeight: 48,
  },
  customBtnDisabled: {
    opacity: 0.4,
  },
  customBtnText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '600',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  entryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  entryAmount: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  entryBeverage: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  entryBeverageCaffeine: {
    color: Colors.warning,
  },
  entryTime: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
});
