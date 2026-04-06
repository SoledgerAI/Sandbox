// Food search with recent foods first, barcode elevation, and improved row sizing
// Phase 6/7: Food Logging -- Core + Additional APIs
// F-03: Recent foods as default view, 2-tap repeat, barcode elevation

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { parallelFoodSearch } from '../../utils/foodwaterfall';
import type { GroupedSearchResult } from '../../utils/foodwaterfall';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import type { FoodItem, FavoriteFood, NutritionInfo, RecentFoodInfo } from '../../types/food';

const MAX_CACHE_SIZE = 500;
const MACRO_FIELDS: (keyof NutritionInfo)[] = [
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g',
];

interface FoodSearchProps {
  onSelect: (food: FoodItem) => void;
  onManualEntry: () => void;
  onQuickLog: () => void;
  onBarcodeScan?: () => void;
  onNLPEntry?: () => void;
  onPhotoEntry?: () => void;
  /** Called when a recent food is tapped for quick-repeat (F-03) */
  onRecentTap?: (entry: RecentFoodInfo) => void;
}

type SectionData = {
  title: string;
  badge: string;
  badgeColor: string;
  data: FoodItem[];
};

function countAvailableMacros(nutrition: NutritionInfo): number {
  return MACRO_FIELDS.filter((k) => nutrition[k] != null && nutrition[k] !== 0).length;
}

export function FoodSearch({ onSelect, onManualEntry, onQuickLog, onBarcodeScan, onNLPEntry, onPhotoEntry, onRecentTap }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [sections, setSections] = useState<SectionData[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentFoodInfo[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent food entries and favorites on mount
  useEffect(() => {
    storageGet<RecentFoodInfo[]>(STORAGE_KEYS.FOOD_RECENT).then((entries) => {
      if (entries && entries.length > 0) {
        // Handle backward compat: old format was FoodItem[], new format is RecentFoodInfo[]
        if ((entries[0] as any).food_item) {
          setRecentEntries(entries.slice(0, 15));
        } else {
          // Old format — convert FoodItem[] to RecentFoodInfo[]
          const items = entries as unknown as FoodItem[];
          const converted: RecentFoodInfo[] = items.slice(0, 15).map((f) => {
            const serving = f.serving_sizes[f.default_serving_index];
            const scale = serving?.gram_weight ? serving.gram_weight / 100 : 1;
            return {
              food_item: f,
              serving,
              quantity: 1,
              calories: Math.round(f.nutrition_per_100g.calories * scale),
            };
          });
          setRecentEntries(converted);
        }
      }
    });
    storageGet<FavoriteFood[]>(STORAGE_KEYS.FOOD_FAVORITES).then((favs) => {
      if (favs) {
        setFavorites(favs);
        setFavoriteIds(new Set(favs.map((f) => f.food_item.source_id)));
      }
    });
  }, []);

  const toggleFavorite = useCallback(async (food: FoodItem) => {
    const existing = await storageGet<FavoriteFood[]>(STORAGE_KEYS.FOOD_FAVORITES) ?? [];
    const isFav = existing.some((f) => f.food_item.source_id === food.source_id);

    let updated: FavoriteFood[];
    if (isFav) {
      updated = existing.filter((f) => f.food_item.source_id !== food.source_id);
    } else {
      const newFav: FavoriteFood = {
        id: `fav_${Date.now()}`,
        food_item: food,
        serving: food.serving_sizes[food.default_serving_index],
        quantity: 1,
        meal_type: null,
        added_at: new Date().toISOString(),
      };
      updated = [newFav, ...existing];
    }

    await storageSet(STORAGE_KEYS.FOOD_FAVORITES, updated);
    setFavorites(updated);
    setFavoriteIds(new Set(updated.map((f) => f.food_item.source_id)));
  }, []);

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setSections([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      // Check cache first, applying 30-day TTL eviction
      const rawCache = await storageGet<FoodItem[]>(STORAGE_KEYS.FOOD_CACHE);
      const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
      const cache = (rawCache ?? []).filter(
        (f) => new Date(f.last_accessed).getTime() > thirtyDaysAgo,
      );
      if (rawCache && cache.length < rawCache.length) {
        await storageSet(STORAGE_KEYS.FOOD_CACHE, cache);
      }

      const now = new Date().toISOString();
      const cachedMatches = cache
        .filter((f) => f.name.toLowerCase().includes(text.toLowerCase()))
        .map((f) => ({ ...f, last_accessed: now }));

      if (cachedMatches.length > 0) {
        const hitIds = new Set(cachedMatches.map((f) => f.source_id));
        const updatedCache = cache.map((f) =>
          hitIds.has(f.source_id) ? { ...f, last_accessed: now } : f,
        );
        await storageSet(STORAGE_KEYS.FOOD_CACHE, updatedCache);
      }

      // Parallel search: USDA + OFF + FatSecret simultaneously
      const grouped: GroupedSearchResult = await parallelFoodSearch(text);

      // Merge all API results for dedup
      const allApiResults = [...grouped.fatsecret, ...grouped.usda, ...grouped.openFoodFacts];

      // Dedup: cached first, then API
      const seen = new Set<string>();
      const deduped: FoodItem[] = [];
      for (const item of [...cachedMatches, ...allApiResults]) {
        if (!seen.has(item.source_id)) {
          seen.add(item.source_id);
          deduped.push(item);
        }
      }

      // Build sections grouped by source
      const newSections: SectionData[] = [];

      const usdaItems = deduped.filter((f) => f.source === 'usda');
      if (usdaItems.length > 0) {
        newSections.push({
          title: 'USDA Database',
          badge: 'USDA Verified',
          badgeColor: '#4CAF50',
          data: usdaItems,
        });
      }

      const fsItems = deduped.filter((f) => f.source === 'fatsecret');
      if (fsItems.length > 0) {
        newSections.push({
          title: 'FatSecret',
          badge: 'FatSecret',
          badgeColor: Colors.accent,
          data: fsItems,
        });
      }

      const offItems = deduped.filter((f) => f.source === 'open_food_facts');
      if (offItems.length > 0) {
        newSections.push({
          title: 'Community Database',
          badge: 'Community',
          badgeColor: '#FF9800',
          data: offItems,
        });
      }

      // Any other cached sources (manual, nlp, etc.)
      const otherItems = deduped.filter(
        (f) => f.source !== 'usda' && f.source !== 'open_food_facts' && f.source !== 'fatsecret',
      );
      if (otherItems.length > 0) {
        newSections.push({
          title: 'Cached Results',
          badge: 'Cached',
          badgeColor: Colors.secondaryText,
          data: otherItems,
        });
      }

      setSections(newSections);

      // Update cache with new API results (LRU, max 500)
      if (allApiResults.length > 0) {
        const currentCache = await storageGet<FoodItem[]>(STORAGE_KEYS.FOOD_CACHE) ?? [];
        const existingIds = new Set(currentCache.map((f) => f.source_id));
        const newItems = allApiResults
          .filter((f) => !existingIds.has(f.source_id))
          .map((f) => ({ ...f, last_accessed: now }));
        let updated = [...newItems, ...currentCache];
        if (updated.length > MAX_CACHE_SIZE) {
          updated.sort((a, b) =>
            new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime(),
          );
          updated = updated.slice(0, MAX_CACHE_SIZE);
        }
        await storageSet(STORAGE_KEYS.FOOD_CACHE, updated);
      }
    } catch {
      // If all APIs fail, show cached results only
      const cache = await storageGet<FoodItem[]>(STORAGE_KEYS.FOOD_CACHE);
      const cached = (cache ?? []).filter((f) =>
        f.name.toLowerCase().includes(text.toLowerCase()),
      );
      if (cached.length > 0) {
        setSections([{
          title: 'Cached Results',
          badge: 'Offline',
          badgeColor: Colors.secondaryText,
          data: cached,
        }]);
        setError('Offline -- showing cached results');
      } else {
        setError('Search failed. Check your connection and try again.');
        setSections([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(text), 300);
    },
    [search],
  );

  const handleSelect = useCallback(
    async (food: FoodItem) => {
      // Update recent foods (keep enriched format)
      const recent = await storageGet<RecentFoodInfo[]>(STORAGE_KEYS.FOOD_RECENT) ?? [];
      const serving = food.serving_sizes[food.default_serving_index];
      const scale = serving?.gram_weight ? serving.gram_weight / 100 : 1;
      const newEntry: RecentFoodInfo = {
        food_item: { ...food, last_accessed: new Date().toISOString() },
        serving,
        quantity: 1,
        calories: Math.round(food.nutrition_per_100g.calories * scale),
      };
      const filtered = recent.filter((r) => r.food_item.source_id !== food.source_id);
      const updated = [newEntry, ...filtered].slice(0, 50);
      await storageSet(STORAGE_KEYS.FOOD_RECENT, updated);
      onSelect(food);
    },
    [onSelect],
  );

  // Show favorites when no search has been performed (recents are above search now)
  const showFavorites = !searched && favorites.length > 0;
  const totalResults = sections.reduce((sum, s) => sum + s.data.length, 0);

  // Build sections for favorites-only view (recents moved above search)
  const idleSections: SectionData[] = [];
  if (showFavorites) {
    idleSections.push({
      title: 'Favorites',
      badge: '',
      badgeColor: '',
      data: favorites.map((f) => f.food_item),
    });
  }

  const displaySections = searched ? sections : idleSections;

  return (
    <View style={styles.container}>
      {/* F-03: Recent Foods — FIRST visible element */}
      {!searched && recentEntries.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Ionicons name="time-outline" size={16} color={Colors.secondaryText} />
            <Text style={styles.recentTitle}>Recent Foods</Text>
          </View>
          {recentEntries.map((entry) => (
            <TouchableOpacity
              key={entry.food_item.source_id}
              style={styles.recentRow}
              onPress={() => onRecentTap?.(entry)}
              activeOpacity={0.7}
            >
              <View style={styles.recentInfo}>
                <Text style={styles.recentName} numberOfLines={1}>
                  {entry.food_item.name}
                </Text>
                <Text style={styles.recentServing} numberOfLines={1}>
                  {entry.serving?.description ?? 'Default serving'}
                </Text>
              </View>
              <View style={styles.recentCalCol}>
                <Text style={styles.recentCal}>{entry.calories}</Text>
                <Text style={styles.recentCalUnit}>cal</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty state for new users */}
      {!searched && recentEntries.length === 0 && favorites.length === 0 && (
        <View style={styles.emptyStateCard}>
          <Ionicons name="nutrition-outline" size={32} color={Colors.secondaryText} />
          <Text style={styles.emptyStateText}>
            Search for your first food or scan a barcode to get started.
          </Text>
        </View>
      )}

      {/* Search input + barcode button */}
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
                setSections([]);
                setSearched(false);
              }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
        {/* F-03: Barcode button elevated to search bar level */}
        {onBarcodeScan && (
          <TouchableOpacity style={styles.barcodeBtn} onPress={onBarcodeScan} activeOpacity={0.7}>
            <Ionicons name="barcode-outline" size={24} color={Colors.primaryBackground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick action buttons (barcode moved to search row) */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={onManualEntry}>
          <Ionicons name="create-outline" size={18} color={Colors.accent} />
          <Text style={styles.quickBtnText}>Manual Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={onQuickLog}>
          <Ionicons name="flash-outline" size={18} color={Colors.accent} />
          <Text style={styles.quickBtnText}>Quick Log</Text>
        </TouchableOpacity>
        {onNLPEntry && (
          <TouchableOpacity style={styles.quickBtn} onPress={onNLPEntry}>
            <Ionicons name="chatbubble-outline" size={18} color={Colors.accent} />
            <Text style={styles.quickBtnText}>Describe</Text>
          </TouchableOpacity>
        )}
        {onPhotoEntry && (
          <TouchableOpacity style={styles.quickBtn} onPress={onPhotoEntry}>
            <Ionicons name="camera-outline" size={18} color={Colors.accent} />
            <Text style={styles.quickBtnText}>Photo</Text>
          </TouchableOpacity>
        )}
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

      {/* Grouped search results or favorites */}
      <SectionList
        sections={displaySections}
        keyExtractor={(item) => item.source_id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            {section.title === 'Favorites' ? (
              <Ionicons name="star" size={14} color={Colors.accent} />
            ) : (
              <Ionicons name="restaurant-outline" size={14} color={Colors.secondaryText} />
            )}
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.badge.length > 0 && (
              <View style={[styles.sectionBadge, { backgroundColor: section.badgeColor }]}>
                <Text style={styles.sectionBadgeText}>{section.badge}</Text>
              </View>
            )}
          </View>
        )}
        renderItem={({ item, section }) => (
          <FoodResultRow
            food={item}
            onPress={() => handleSelect(item)}
            onToggleFavorite={() => toggleFavorite(item)}
            isFavorite={favoriteIds.has(item.source_id)}
            badge={section.badge}
            badgeColor={section.badgeColor}
          />
        )}
        ListEmptyComponent={
          searched && !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results found</Text>
              <TouchableOpacity onPress={onManualEntry}>
                <Text style={styles.emptyLink}>Can't find it? Enter manually</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={
          searched && totalResults > 0 ? (
            <TouchableOpacity style={styles.manualFallback} onPress={onManualEntry}>
              <Ionicons name="create-outline" size={16} color={Colors.accent} />
              <Text style={styles.manualFallbackText}>Can't find it? Enter manually</Text>
            </TouchableOpacity>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

function FoodResultRow({
  food,
  onPress,
  onToggleFavorite,
  isFavorite,
  badge,
  badgeColor,
}: {
  food: FoodItem;
  onPress: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  badge: string;
  badgeColor: string;
}) {
  const defaultServing = food.serving_sizes[food.default_serving_index];
  const scale = defaultServing?.gram_weight ? defaultServing.gram_weight / 100 : 1;
  const cal = Math.round(food.nutrition_per_100g.calories * scale);
  const macroCount = countAvailableMacros(food.nutrition_per_100g);
  const showCompleteness = macroCount < MACRO_FIELDS.length;

  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      {/* Favorite star */}
      <TouchableOpacity
        onPress={onToggleFavorite}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.starBtn}
      >
        <Ionicons
          name={isFavorite ? 'star' : 'star-outline'}
          size={18}
          color={isFavorite ? Colors.accent : Colors.divider}
        />
      </TouchableOpacity>

      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.resultServing} numberOfLines={1}>
          {defaultServing?.description ?? '100g'}
          {food.brand ? ` \u2022 ${food.brand}` : ''}
        </Text>
        {/* Source badge + completeness indicator */}
        {(badge.length > 0 || showCompleteness) && (
          <View style={styles.resultBadgeRow}>
            {badge.length > 0 && (
              <View style={[styles.resultBadge, { backgroundColor: badgeColor + '22', borderColor: badgeColor + '55' }]}>
                <Text style={[styles.resultBadgeText, { color: badgeColor }]}>{badge}</Text>
              </View>
            )}
            {showCompleteness && (
              <Text style={styles.completenessText}>
                {macroCount} of {MACRO_FIELDS.length} macros
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.resultCal}>
        <Text style={styles.resultCalText}>{cal}</Text>
        <Text style={styles.resultCalUnit}>cal</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Recent Foods (F-03) ──
  recentSection: {
    marginBottom: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  recentTitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
    minHeight: 56,
  },
  recentInfo: {
    flex: 1,
    marginRight: 12,
  },
  recentName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  recentServing: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  recentCalCol: {
    alignItems: 'flex-end',
  },
  recentCal: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  recentCalUnit: {
    color: Colors.secondaryText,
    fontSize: 11,
  },

  // ── Empty state (new user) ──
  emptyStateCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  emptyStateText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Search + Barcode ──
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
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
  barcodeBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Quick Actions ──
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
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
    minHeight: 48,
  },
  quickBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Loading / Error ──
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

  // ── Section Headers ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    gap: 6,
  },
  sectionTitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 4,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Results List ──
  list: {
    flex: 1,
  },
  separator: {
    height: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  starBtn: {
    marginRight: 10,
    padding: 2,
  },
  resultInfo: {
    flex: 1,
    marginRight: 12,
  },
  resultName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  resultServing: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  resultBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  resultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  completenessText: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontStyle: 'italic',
  },
  resultCal: {
    alignItems: 'flex-end',
  },
  resultCalText: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  resultCalUnit: {
    color: Colors.secondaryText,
    fontSize: 11,
  },

  // ── Empty / Fallback ──
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
  manualFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  manualFallbackText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
