// Sprint 21: Personal Pantry — "Scan once, log forever."
// List, search, sort, quick-log bottom sheet, edit, delete.

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { useToast } from '../../src/contexts/ToastContext';
import {
  getPantryItems,
  filterPantryItems,
  sortPantryItems,
  deletePantryItem,
  logPantryItem,
  getPantryAutoAdd,
  setPantryAutoAdd,
  type PantrySortMode,
} from '../../src/utils/pantryLibrary';
import type { PantryItem, MealType } from '../../src/types/food';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const PORTIONS = [0.5, 1, 1.5, 2] as const;

function mealLabel(m: MealType): string {
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function guessMealType(hour: number): MealType {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PantryScreen() {
  const { showToast } = useToast();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PantrySortMode>('recency');
  const [selected, setSelected] = useState<PantryItem | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [mealType, setMealType] = useState<MealType>(() => guessMealType(new Date().getHours()));
  const [logging, setLogging] = useState(false);
  const [autoAdd, setAutoAdd] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const [loaded, autoAddVal] = await Promise.all([
      getPantryItems(sort),
      getPantryAutoAdd(),
    ]);
    setItems(loaded);
    setAutoAdd(autoAddVal);
    setLoading(false);
  }, [sort]);

  const handleAutoAddToggle = useCallback(async (val: boolean) => {
    setAutoAdd(val);
    await setPantryAutoAdd(val);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const displayItems = useMemo(() => {
    const sorted = sortPantryItems(items, sort);
    return filterPantryItems(sorted, search);
  }, [items, sort, search]);

  const openItem = useCallback((item: PantryItem) => {
    setSelected(item);
    setMultiplier(1);
    setMealType(guessMealType(new Date().getHours()));
  }, []);

  const closeSheet = useCallback(() => {
    setSelected(null);
  }, []);

  const handleLog = useCallback(async () => {
    if (!selected || logging) return;
    setLogging(true);
    try {
      await logPantryItem(selected, { multiplier, mealType });
      showToast(`${selected.name} logged`, 'success');
      closeSheet();
      await loadItems();
    } finally {
      setLogging(false);
    }
  }, [selected, multiplier, mealType, logging, loadItems, closeSheet, showToast]);

  const handleDelete = useCallback((item: PantryItem) => {
    Alert.alert(
      'Delete from Pantry?',
      `${item.name} will be removed. This won't affect past food log entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePantryItem(item.id);
            closeSheet();
            await loadItems();
            showToast('Removed from Pantry', 'info');
          },
        },
      ],
    );
  }, [loadItems, closeSheet, showToast]);

  const handleEdit = useCallback((item: PantryItem) => {
    // For v1, direct user to re-scan if they need to update macros.
    // Simple alert-based edit for name + serving would be a lot of UI for rare use.
    Alert.alert(
      'Edit Pantry Item',
      'To update nutrition, scan the item again and re-add to Pantry. The duplicate will update the existing entry.',
      [{ text: 'OK' }],
    );
  }, []);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.accent} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>My Pantry</Text>
            <Text style={styles.subtitle}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.secondaryText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pantry..."
            placeholderTextColor={Colors.divider}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Auto-add toggle */}
        <View style={styles.autoAddRow}>
          <View style={styles.autoAddText}>
            <Text style={styles.autoAddLabel}>Auto-add scanned foods</Text>
            <Text style={styles.autoAddSub}>Every scan saves to Pantry automatically</Text>
          </View>
          <Switch
            value={autoAdd}
            onValueChange={handleAutoAddToggle}
            trackColor={{ false: Colors.divider, true: Colors.accent }}
            thumbColor={Colors.text}
          />
        </View>

        {/* Sort */}
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortChip, sort === 'recency' && styles.sortChipActive]}
            onPress={() => setSort('recency')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortChipText, sort === 'recency' && styles.sortChipTextActive]}>
              Recently logged
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, sort === 'frequency' && styles.sortChipActive]}
            onPress={() => setSort('frequency')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortChipText, sort === 'frequency' && styles.sortChipTextActive]}>
              Most frequent
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : displayItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={48} color={Colors.secondaryText} />
            <Text style={styles.emptyText}>
              {search
                ? 'No items match that search.'
                : 'Your pantry is empty. Scan a food item and tap "Add to Pantry" to save it for quick logging.'}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {displayItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                onPress={() => openItem(item)}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons
                    name={item.category === 'drink' ? 'water-outline' : 'restaurant-outline'}
                    size={20}
                    color={Colors.accent}
                  />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[item.brand, item.serving_size].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.log_count > 0
                      ? `Logged ${item.log_count}x · ${relativeTime(item.last_logged)}`
                      : 'Not yet logged'}
                  </Text>
                </View>
                <View style={styles.rowCal}>
                  <Text style={styles.rowCalValue}>{item.calories}</Text>
                  <Text style={styles.rowCalUnit}>cal</Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        {/* Quick-log bottom sheet */}
        <Modal
          visible={selected != null}
          transparent
          animationType="slide"
          onRequestClose={closeSheet}
        >
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={closeSheet}
          >
            <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
              {selected && (
                <>
                  <Text style={styles.sheetName}>{selected.name}</Text>
                  <Text style={styles.sheetSub}>
                    {selected.serving_size} · {Math.round(selected.calories * multiplier)} cal
                  </Text>

                  <Text style={styles.sheetLabel}>PORTIONS</Text>
                  <View style={styles.portionRow}>
                    {PORTIONS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.portionBtn, multiplier === p && styles.portionBtnActive]}
                        onPress={() => setMultiplier(p)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.portionBtnText,
                            multiplier === p && styles.portionBtnTextActive,
                          ]}
                        >
                          {p}x
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.sheetLabel}>MEAL</Text>
                  <View style={styles.mealRow}>
                    {MEAL_TYPES.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.mealBtn, mealType === m && styles.mealBtnActive]}
                        onPress={() => setMealType(m)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.mealBtnText, mealType === m && styles.mealBtnTextActive]}
                        >
                          {mealLabel(m)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, logging && { opacity: 0.6 }]}
                    onPress={handleLog}
                    activeOpacity={0.7}
                    disabled={logging}
                  >
                    {logging ? (
                      <ActivityIndicator color={Colors.primaryBackground} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color={Colors.primaryBackground} />
                        <Text style={styles.primaryBtnText}>Log</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.sheetSecondaryRow}>
                    <TouchableOpacity
                      style={styles.sheetSecondaryBtn}
                      onPress={() => handleEdit(selected)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil" size={16} color={Colors.text} />
                      <Text style={styles.sheetSecondaryText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sheetSecondaryBtn}
                      onPress={() => handleDelete(selected)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      <Text style={[styles.sheetSecondaryText, { color: Colors.danger }]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  autoAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  autoAddText: {
    flex: 1,
    marginRight: 10,
  },
  autoAddLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  autoAddSub: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sortChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sortChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  sortChipText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    minHeight: 64,
  },
  rowIcon: {
    width: 36,
    alignItems: 'center',
  },
  rowInfo: {
    flex: 1,
    marginLeft: 8,
    marginRight: 12,
  },
  rowName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  rowMeta: {
    color: Colors.accent,
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },
  rowCal: {
    alignItems: 'flex-end',
  },
  rowCalValue: {
    color: Colors.accentText,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rowCalUnit: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 32,
  },
  sheetName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSub: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  sheetLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  portionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  portionBtn: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
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
  mealRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  mealBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  mealBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  mealBtnText: {
    color: Colors.text,
    fontSize: 13,
  },
  mealBtnTextActive: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  sheetSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sheetSecondaryText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
