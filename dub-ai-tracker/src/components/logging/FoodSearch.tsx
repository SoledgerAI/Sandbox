// Food search with USDA API integration + cached/recent/favorites
// Phase 6: Food Logging -- Core

import { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { usdaSearch } from '../../services/usda';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import type { FoodItem } from '../../types/food';

const MAX_CACHE_SIZE = 500;

interface FoodSearchProps {
  onSelect: (food: FoodItem) => void;
  onManualEntry: () => void;
  onQuickLog: () => void;
}

export function FoodSearch({ onSelect, onManualEntry, onQuickLog }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent foods on first render
  const recentLoadedRef = useRef(false);
  if (!recentLoadedRef.current) {
    recentLoadedRef.current = true;
    storageGet<FoodItem[]>(STORAGE_KEYS.FOOD_RECENT).then((foods) => {
      if (foods) setRecentFoods(foods.slice(0, 10));
    });
  }

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      // Check cache first
      const cache = await storageGet<FoodItem[]>(STORAGE_KEYS.FOOD_CACHE);
      const cachedMatches = (cache ?? []).filter((f) =>
        f.name.toLowerCase().includes(text.toLowerCase()),
      );

      // Search USDA API
      const apiResults = await usdaSearch(text);

      // Merge: cached first (exact matches), then API results
      const seen = new Set<string>();
      const merged: FoodItem[] = [];
      for (const item of [...cachedMatches, ...apiResults]) {
        if (!seen.has(item.source_id)) {
          seen.add(item.source_id);
          merged.push(item);
        }
      }

      setResults(merged);

      // Update cache with new API results (LRU, max 500)
      if (apiResults.length > 0) {
        const existing = cache ?? [];
        const existingIds = new Set(existing.map((f) => f.source_id));
        const newItems = apiResults.filter((f) => !existingIds.has(f.source_id));
        const updated = [...newItems, ...existing].slice(0, MAX_CACHE_SIZE);
        await storageSet(STORAGE_KEYS.FOOD_CACHE, updated);
      }
    } catch (err) {
      // If API fails, show cached results only
      const cache = await storageGet<FoodItem[]>(STORAGE_KEYS.FOOD_CACHE);
      const cached = (cache ?? []).filter((f) =>
        f.name.toLowerCase().includes(text.toLowerCase()),
      );
      if (cached.length > 0) {
        setResults(cached);
        setError('Offline -- showing cached results');
      } else {
        setError('Search failed. Check your connection and try again.');
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(text), 400);
    },
    [search],
  );

  const handleSelect = useCallback(
    async (food: FoodItem) => {
      // Update recent foods
      const recent = await storageGet<FoodItem[]>(STORAGE_KEYS.FOOD_RECENT);
      const existing = recent ?? [];
      const filtered = existing.filter((f) => f.source_id !== food.source_id);
      const updated = [{ ...food, last_accessed: new Date().toISOString() }, ...filtered].slice(0, 50);
      await storageSet(STORAGE_KEYS.FOOD_RECENT, updated);
      onSelect(food);
    },
    [onSelect],
  );

  const showRecent = !searched && recentFoods.length > 0;

  return (
    <View style={styles.container}>
      {/* Search input */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color={Colors.secondaryText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search foods..."
            placeholderTextColor={Colors.secondaryText}
            value={query}
            onChangeText={onChangeText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => search(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setResults([]);
                setSearched(false);
              }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick action buttons */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={onManualEntry}>
          <Ionicons name="create-outline" size={18} color={Colors.accent} />
          <Text style={styles.quickBtnText}>Manual Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={onQuickLog}>
          <Ionicons name="flash-outline" size={18} color={Colors.accent} />
          <Text style={styles.quickBtnText}>Quick Log</Text>
        </TouchableOpacity>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Error message */}
      {error != null && (
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={16} color={Colors.warning} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Recent foods */}
      {showRecent && (
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={16} color={Colors.secondaryText} />
          <Text style={styles.sectionTitle}>Recent</Text>
        </View>
      )}

      {/* Search results or recents */}
      <FlatList
        data={showRecent ? recentFoods : results}
        keyExtractor={(item) => item.source_id}
        renderItem={({ item }) => (
          <FoodResultRow food={item} onPress={() => handleSelect(item)} />
        )}
        ListEmptyComponent={
          searched && !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results found</Text>
              <TouchableOpacity onPress={onManualEntry}>
                <Text style={styles.emptyLink}>Add manually</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
      />
    </View>
  );
}

function FoodResultRow({
  food,
  onPress,
}: {
  food: FoodItem;
  onPress: () => void;
}) {
  const cal = Math.round(food.nutrition_per_100g.calories);
  const defaultServing = food.serving_sizes[food.default_serving_index];

  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.resultDetails} numberOfLines={1}>
          {defaultServing?.description ?? '100g'}
          {food.brand ? ` \u2022 ${food.brand}` : ''}
        </Text>
      </View>
      <View style={styles.resultCal}>
        <Text style={styles.resultCalText}>{cal}</Text>
        <Text style={styles.resultCalUnit}>kcal/100g</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
    gap: 6,
  },
  quickBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  errorText: {
    color: Colors.warning,
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  sectionTitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  list: {
    flex: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  resultInfo: {
    flex: 1,
    marginRight: 12,
  },
  resultName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  resultDetails: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  resultCal: {
    alignItems: 'flex-end',
  },
  resultCalText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  resultCalUnit: {
    color: Colors.secondaryText,
    fontSize: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  emptyLink: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
});
