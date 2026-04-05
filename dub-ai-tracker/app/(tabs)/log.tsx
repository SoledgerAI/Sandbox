// Log tab -- quick logging hub with date selector, search, favorites, grouped categories
// Phase 6: Food Logging -- Core
// MASTER-13: Restructured from flat 20-button grid to hero + collapsible categories + recent entries
// MASTER-49: Shows today's activity across ALL enabled tags, not just food
// P1-02: Date selector, search, favorites, category grouping, repeat last entry

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../src/utils/storage';
import { FoodEntryCard } from '../../src/components/logging/FoodEntryCard';
import type {
  FoodEntry,
  FavoriteFood,
  MealTemplate,
  MealType,
} from '../../src/types/food';
import { scaleNutrition } from '../../src/utils/servingmath';

// ============================================================
// Date Helpers
// ============================================================

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayDateString(): string {
  return formatDate(new Date());
}

function displayDate(dateStr: string): string {
  const today = todayDateString();
  if (dateStr === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === formatDate(yesterday)) return 'Yesterday';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function shiftDate(dateStr: string, offset: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  return formatDate(d);
}

function guessMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

// ============================================================
// Category Definitions (grouped per task spec)
// ============================================================

interface CategoryItem {
  label: string;
  icon: string;
  route: string;
  searchTerms: string; // lowercase, for fuzzy search
}

interface CategorySection {
  title: string;
  items: CategoryItem[];
}

const CATEGORY_SECTIONS: CategorySection[] = [
  {
    title: 'Nutrition',
    items: [
      { label: 'Food', icon: 'restaurant-outline', route: '/log/food', searchTerms: 'food nutrition meal calories macros' },
      { label: 'Water', icon: 'water-outline', route: '/log/water', searchTerms: 'water hydration drink' },
      { label: 'Caffeine', icon: 'cafe-outline', route: '/log/caffeine', searchTerms: 'caffeine coffee tea energy' },
      { label: 'Supplements', icon: 'flask-outline', route: '/log/supplements', searchTerms: 'supplements vitamins medication pills' },
    ],
  },
  {
    title: 'Fitness',
    items: [
      { label: 'Workout', icon: 'fitness-outline', route: '/log/workout', searchTerms: 'workout exercise cardio run' },
      { label: 'Strength', icon: 'barbell-outline', route: '/log/strength', searchTerms: 'strength weight lifting gym' },
      { label: 'Steps', icon: 'walk-outline', route: '/log/steps', searchTerms: 'steps walking pedometer' },
    ],
  },
  {
    title: 'Body',
    items: [
      { label: 'Weight & Body', icon: 'scale-outline', route: '/log/body', searchTerms: 'weight body measurements scale bmi' },
      { label: 'Bloodwork', icon: 'water-outline', route: '/log/bloodwork', searchTerms: 'bloodwork labs markers cholesterol iron' },
      { label: 'Blood Glucose', icon: 'fitness-outline', route: '/log/glucose', searchTerms: 'blood glucose sugar diabetes a1c' },
      { label: 'Blood Pressure', icon: 'heart-circle-outline', route: '/log/bloodpressure', searchTerms: 'blood pressure bp systolic diastolic hypertension' },
    ],
  },
  {
    title: 'Mind',
    items: [
      { label: 'Mood', icon: 'happy-outline', route: '/log/mood', searchTerms: 'mood feeling emotion mental' },
      { label: 'Stress', icon: 'pulse-outline', route: '/log/stress', searchTerms: 'stress anxiety tension' },
      { label: 'Gratitude', icon: 'heart-outline', route: '/log/gratitude', searchTerms: 'gratitude thankful journal' },
      { label: 'Meditation', icon: 'leaf-outline', route: '/log/meditation', searchTerms: 'meditation mindfulness breathe calm' },
      { label: 'Therapy', icon: 'chatbubbles-outline', route: '/log/therapy', searchTerms: 'therapy counseling therapist session' },
      { label: 'Substances', icon: 'wine-outline', route: '/log/substances', searchTerms: 'substances alcohol cannabis tobacco sobriety' },
    ],
  },
  {
    title: 'Health',
    items: [
      { label: 'Sleep', icon: 'moon-outline', route: '/log/sleep', searchTerms: 'sleep rest bedtime wake hours' },
      { label: 'Cycle', icon: 'flower-outline', route: '/log/cycle', searchTerms: 'cycle period menstrual ovulation reproductive' },
      { label: 'Digestive', icon: 'nutrition-outline', route: '/log/digestive', searchTerms: 'digestive gut stomach bowel bristol' },
      { label: 'Injury', icon: 'bandage-outline', route: '/log/injury', searchTerms: 'injury pain hurt sore recovery' },
      { label: 'Sexual', icon: 'heart-half-outline', route: '/log/sexual', searchTerms: 'sexual activity intimacy' },
      { label: 'Self Care', icon: 'sparkles-outline', route: '/log/personalcare', searchTerms: 'self care hygiene skincare grooming personal' },
      { label: 'Custom', icon: 'pricetag-outline', route: '/log/custom', searchTerms: 'custom tag create' },
    ],
  },
];

// Flat list of all items for search
const ALL_CATEGORY_ITEMS: CategoryItem[] = CATEGORY_SECTIONS.flatMap((s) => s.items);

// ============================================================
// Recent entry from any tag
// ============================================================

interface RecentEntry {
  id: string;
  tag: string;
  label: string;
  detail: string;
  time: string;
  timestamp: number;
}

// ============================================================
// Component
// ============================================================

export default function LogScreen() {
  // Date selector state
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const isToday = selectedDate === todayDateString();

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Favorites (pinned tag routes)
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);

  // Sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Nutrition']));

  // Food data
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);

  // ---- Data Loading ----
  const loadData = useCallback(async () => {
    const dateStr = selectedDate;
    const [foods, favs, tmpls, pinnedTags] = await Promise.all([
      storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, dateStr)),
      storageGet<FavoriteFood[]>(STORAGE_KEYS.FOOD_FAVORITES),
      storageGet<MealTemplate[]>(STORAGE_KEYS.FOOD_TEMPLATES),
      storageGet<string[]>(STORAGE_KEYS.FAVORITE_TAGS),
    ]);
    setFoodEntries(foods ?? []);
    setFavorites(favs ?? []);
    setTemplates(tmpls ?? []);
    setFavoriteTags(pinnedTags ?? []);

    // Load recent entries across common tags
    const recents: RecentEntry[] = [];

    for (const f of foods ?? []) {
      recents.push({
        id: f.id,
        tag: 'Food',
        label: f.food_item.name,
        detail: `${Math.round(f.computed_nutrition.calories)} cal`,
        time: new Date(f.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        timestamp: new Date(f.timestamp).getTime(),
      });
    }

    const waters = await storageGet<{ id: string; timestamp: string; amount_oz: number }[]>(dateKey(STORAGE_KEYS.LOG_WATER, dateStr));
    for (const w of waters ?? []) {
      recents.push({
        id: w.id,
        tag: 'Water',
        label: 'Water',
        detail: `${w.amount_oz} oz`,
        time: new Date(w.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        timestamp: new Date(w.timestamp).getTime(),
      });
    }

    const workouts = await storageGet<{ id: string; timestamp: string; type: string; duration_minutes?: number; calories_burned?: number }[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, dateStr));
    for (const w of workouts ?? []) {
      recents.push({
        id: w.id,
        tag: 'Exercise',
        label: w.type ?? 'Workout',
        detail: `${w.duration_minutes ?? 0} min${w.calories_burned ? ` · ${w.calories_burned} cal` : ''}`,
        time: new Date(w.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        timestamp: new Date(w.timestamp).getTime(),
      });
    }

    const supps = await storageGet<{ id: string; timestamp: string; name: string; taken: boolean }[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, dateStr));
    for (const s of (supps ?? []).filter(s => s.taken)) {
      recents.push({
        id: s.id,
        tag: 'Supplement',
        label: s.name,
        detail: 'taken',
        time: new Date(s.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        timestamp: new Date(s.timestamp).getTime(),
      });
    }

    const moods = await storageGet<{ id: string; timestamp: string; score: number }[]>(dateKey(STORAGE_KEYS.LOG_MOOD, dateStr));
    for (const m of moods ?? []) {
      const labels = ['', 'Bad', 'Poor', 'OK', 'Good', 'Great'];
      recents.push({
        id: m.id,
        tag: 'Mood',
        label: 'Mood',
        detail: labels[m.score] ?? `${m.score}/5`,
        time: new Date(m.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        timestamp: new Date(m.timestamp).getTime(),
      });
    }

    recents.sort((a, b) => b.timestamp - a.timestamp);
    setRecentEntries(recents.slice(0, 20));
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ---- Date Navigation ----
  const goBack = useCallback(() => {
    setSelectedDate((d) => shiftDate(d, -1));
  }, []);

  const goForward = useCallback(() => {
    setSelectedDate((d) => {
      const next = shiftDate(d, 1);
      // Don't go past today
      return next > todayDateString() ? d : next;
    });
  }, []);

  const goToday = useCallback(() => {
    setSelectedDate(todayDateString());
  }, []);

  // ---- Search filtering ----
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return ALL_CATEGORY_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.searchTerms.includes(q),
    );
  }, [searchQuery]);

  // ---- Favorite tags ----
  const favoriteCategoryItems = useMemo(() => {
    return ALL_CATEGORY_ITEMS.filter((item) => favoriteTags.includes(item.route));
  }, [favoriteTags]);

  const toggleFavoriteTag = useCallback(async (route: string) => {
    setFavoriteTags((prev) => {
      const next = prev.includes(route)
        ? prev.filter((r) => r !== route)
        : [...prev, route];
      storageSet(STORAGE_KEYS.FAVORITE_TAGS, next);
      return next;
    });
  }, []);

  // ---- Food operations ----
  const totalCalories = foodEntries.reduce(
    (sum, e) => sum + Math.round(e.computed_nutrition.calories),
    0,
  );
  const totalProtein = foodEntries.reduce(
    (sum, e) => sum + Math.round(e.computed_nutrition.protein_g),
    0,
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, selectedDate);
      const updated = foodEntries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setFoodEntries(updated);
    },
    [foodEntries, selectedDate],
  );

  const addToFavorites = useCallback(
    async (entry: FoodEntry) => {
      const existing = favorites.find(
        (f) => f.food_item.source_id === entry.food_item.source_id,
      );
      if (existing) {
        Alert.alert('Already in Favorites', `${entry.food_item.name} is already a favorite.`);
        return;
      }

      const fav: FavoriteFood = {
        id: `fav_${Date.now()}`,
        food_item: entry.food_item,
        serving: entry.serving,
        quantity: entry.quantity,
        meal_type: entry.meal_type,
        added_at: new Date().toISOString(),
      };

      const updated = [fav, ...favorites];
      await storageSet(STORAGE_KEYS.FOOD_FAVORITES, updated);
      setFavorites(updated);
    },
    [favorites],
  );

  const relogFavorite = useCallback(
    async (fav: FavoriteFood) => {
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, selectedDate);
      const serving = fav.serving;
      const computed = scaleNutrition(
        fav.food_item.nutrition_per_100g,
        serving,
        fav.quantity,
      );

      const entry: FoodEntry = {
        id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        meal_type: fav.meal_type ?? guessMealType(),
        food_item: fav.food_item,
        serving,
        quantity: fav.quantity,
        computed_nutrition: computed,
        source: fav.food_item.source,
        photo_uri: null,
        photo_confidence: null,
        flagged_ingredients: [],
        notes: null,
      };

      const updated = [...foodEntries, entry];
      await storageSet(key, updated);
      setFoodEntries(updated);
    },
    [foodEntries, selectedDate],
  );

  const relogTemplate = useCallback(
    async (template: MealTemplate) => {
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, selectedDate);
      const now = new Date();

      const newEntries: FoodEntry[] = template.entries.map((e, i) => ({
        ...e,
        id: `food_${now.getTime()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now.toISOString(),
      }));

      const updated = [...foodEntries, ...newEntries];
      await storageSet(key, updated);
      setFoodEntries(updated);

      const updatedTemplates = templates.map((t) =>
        t.id === template.id ? { ...t, last_used: now.toISOString() } : t,
      );
      await storageSet(STORAGE_KEYS.FOOD_TEMPLATES, updatedTemplates);
      setTemplates(updatedTemplates);
    },
    [foodEntries, templates, selectedDate],
  );

  const saveMealAsTemplate = useCallback(async () => {
    if (foodEntries.length === 0) return;

    Alert.prompt
      ? Alert.prompt('Save Meal Template', 'Enter a name for this meal:', async (name) => {
          if (!name?.trim()) return;
          const template: MealTemplate = {
            id: `tmpl_${Date.now()}`,
            name: name.trim(),
            entries: foodEntries.map(({ id, timestamp, ...rest }) => rest),
            created_at: new Date().toISOString(),
            last_used: null,
          };
          const updated = [template, ...templates];
          await storageSet(STORAGE_KEYS.FOOD_TEMPLATES, updated);
          setTemplates(updated);
        })
      : Alert.alert(
          'Save Meal Template',
          `Save today's ${foodEntries.length} item(s) as a reusable meal template?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save',
              onPress: async () => {
                const template: MealTemplate = {
                  id: `tmpl_${Date.now()}`,
                  name: `Meal ${new Date().toLocaleDateString()}`,
                  entries: foodEntries.map(({ id, timestamp, ...rest }) => rest),
                  created_at: new Date().toISOString(),
                  last_used: null,
                };
                const updated = [template, ...templates];
                await storageSet(STORAGE_KEYS.FOOD_TEMPLATES, updated);
                setTemplates(updated);
              },
            },
          ],
        );
  }, [foodEntries, templates]);

  const toggleSection = useCallback((title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }, []);

  // Group food entries by meal type
  const mealGroups = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const grouped = mealGroups
    .map((meal) => ({
      meal,
      entries: foodEntries.filter((e) => e.meal_type === meal),
    }))
    .filter((g) => g.entries.length > 0);

  // ---- Render helpers ----
  const renderCategoryButton = (item: CategoryItem, showPinAction: boolean) => (
    <TouchableOpacity
      key={item.route}
      style={styles.categoryBtn}
      onPress={() => router.push(item.route as any)}
      onLongPress={showPinAction ? () => toggleFavoriteTag(item.route) : undefined}
      activeOpacity={0.7}
    >
      <Ionicons name={item.icon as any} size={18} color={Colors.accent} />
      <Text style={styles.categoryBtnText}>{item.label}</Text>
      {favoriteTags.includes(item.route) && (
        <Ionicons name="star" size={12} color={Colors.accent} style={styles.pinIcon} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Log</Text>
      </View>

      {/* ========== DATE SELECTOR ========== */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={22} color={Colors.accentText} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday} style={styles.dateLabelWrap}>
          <Ionicons name="calendar-outline" size={16} color={Colors.accent} style={{ marginRight: 6 }} />
          <Text style={styles.dateLabel}>Logging for: {displayDate(selectedDate)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goForward}
          hitSlop={12}
          style={[styles.dateArrow, isToday && { opacity: 0.3 }]}
          disabled={isToday}
        >
          <Ionicons name="chevron-forward" size={22} color={Colors.accentText} />
        </TouchableOpacity>
      </View>

      {/* ========== SEARCH BAR ========== */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.secondaryText} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search categories..."
          placeholderTextColor={Colors.divider}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* ========== SEARCH RESULTS ========== */}
      {searchResults != null ? (
        <View style={styles.searchResults}>
          {searchResults.length === 0 ? (
            <Text style={styles.searchEmpty}>No matching categories</Text>
          ) : (
            <View style={styles.categoryGrid}>
              {searchResults.map((item) => renderCategoryButton(item, true))}
            </View>
          )}
        </View>
      ) : (
        <>
          {/* ========== HERO ACTIONS ========== */}
          <View style={styles.heroSection}>
            <TouchableOpacity
              style={styles.heroFoodBtn}
              onPress={() => router.push('/log/food')}
              activeOpacity={0.7}
            >
              <Ionicons name="restaurant-outline" size={24} color={Colors.primaryBackground} />
              <Text style={styles.heroFoodText}>Log Food</Text>
              {totalCalories > 0 && (
                <Text style={styles.heroFoodSub}>{totalCalories} cal · {totalProtein}g protein</Text>
              )}
            </TouchableOpacity>

            <View style={styles.heroRow}>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => router.push('/log/water')}
                activeOpacity={0.7}
              >
                <Ionicons name="water-outline" size={20} color={Colors.primaryBackground} />
                <Text style={styles.heroBtnText}>Water</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => router.push('/log/workout')}
                activeOpacity={0.7}
              >
                <Ionicons name="fitness-outline" size={20} color={Colors.primaryBackground} />
                <Text style={styles.heroBtnText}>Exercise</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.heroRow}>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => router.push('/log/supplements')}
                activeOpacity={0.7}
              >
                <Ionicons name="flask-outline" size={20} color={Colors.primaryBackground} />
                <Text style={styles.heroBtnText}>Supplements</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => router.push('/log/strength')}
                activeOpacity={0.7}
              >
                <Ionicons name="barbell-outline" size={20} color={Colors.primaryBackground} />
                <Text style={styles.heroBtnText}>Strength</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Daily totals */}
          {foodEntries.length > 0 && (
            <View style={styles.totalsCard}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totalCalories}</Text>
                <Text style={styles.totalLabel}>kcal</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totalProtein}g</Text>
                <Text style={styles.totalLabel}>protein</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{foodEntries.length}</Text>
                <Text style={styles.totalLabel}>items</Text>
              </View>
            </View>
          )}

          {/* ========== FAVORITES (pinned tags) ========== */}
          {favoriteCategoryItems.length > 0 && (
            <View style={styles.favTagsSection}>
              <Text style={styles.sectionTitle}>Favorites</Text>
              <Text style={styles.sectionHint}>Long-press any category to pin/unpin</Text>
              <View style={styles.categoryGrid}>
                {favoriteCategoryItems.map((item) => renderCategoryButton(item, true))}
              </View>
            </View>
          )}

          {/* ========== GROUPED CATEGORIES ========== */}
          <View style={styles.categoriesSection}>
            <Text style={styles.sectionTitle}>Quick Log</Text>
            {favoriteCategoryItems.length === 0 && (
              <Text style={styles.sectionHint}>Long-press any category to add to Favorites</Text>
            )}
            {CATEGORY_SECTIONS.map((section) => {
              const isExpanded = expandedSections.has(section.title);
              return (
                <View key={section.title}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(section.title)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionHeaderText}>{section.title}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.secondaryText}
                    />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.categoryGrid}>
                      {section.items.map((item) => renderCategoryButton(item, true))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* ========== RECENT ENTRIES (all tags) ========== */}
          {recentEntries.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>
                {isToday ? "Today's Activity" : `Activity for ${displayDate(selectedDate)}`}
              </Text>
              {recentEntries.slice(0, 15).map((entry) => (
                <View key={entry.id} style={styles.recentRow}>
                  <View style={styles.recentTagBadge}>
                    <Text style={styles.recentTagText}>{entry.tag}</Text>
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentLabel} numberOfLines={1}>{entry.label}</Text>
                    <Text style={styles.recentDetail}>{entry.detail}</Text>
                  </View>
                  <Text style={styles.recentTime}>{entry.time}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Food entries grouped by meal */}
          {grouped.length > 0 && (
            <View style={styles.foodSection}>
              <Text style={styles.sectionTitle}>Food Log</Text>
              {grouped.map(({ meal, entries }) => (
                <View key={meal} style={styles.mealGroup}>
                  <Text style={styles.mealGroupTitle}>
                    {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  </Text>
                  {entries.map((entry) => (
                    <FoodEntryCard
                      key={entry.id}
                      entry={entry}
                      onDelete={() => deleteEntry(entry.id)}
                      onFavorite={() => addToFavorites(entry)}
                    />
                  ))}
                </View>
              ))}
              <TouchableOpacity style={styles.templateBtn} onPress={saveMealAsTemplate}>
                <Ionicons name="bookmark-outline" size={16} color={Colors.accent} />
                <Text style={styles.templateBtnText}>Save as Meal Template</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Food Favorites section */}
          {favorites.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Food Favorites</Text>
              {favorites.slice(0, 5).map((fav) => (
                <TouchableOpacity
                  key={fav.id}
                  style={styles.favRow}
                  onPress={() => relogFavorite(fav)}
                  activeOpacity={0.7}
                >
                  <View style={styles.favInfo}>
                    <Text style={styles.favName} numberOfLines={1}>
                      {fav.food_item.name}
                    </Text>
                    <Text style={styles.favDetails}>
                      {Math.round(fav.food_item.nutrition_per_100g.calories)} kcal/100g
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Templates section */}
          {templates.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Meal Templates</Text>
              {templates.slice(0, 5).map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={styles.favRow}
                  onPress={() => relogTemplate(tmpl)}
                  activeOpacity={0.7}
                >
                  <View style={styles.favInfo}>
                    <Text style={styles.favName} numberOfLines={1}>
                      {tmpl.name}
                    </Text>
                    <Text style={styles.favDetails}>
                      {tmpl.entries.length} item{tmpl.entries.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name="copy-outline" size={20} color={Colors.accent} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Empty state */}
          {recentEntries.length === 0 && foodEntries.length === 0 && favorites.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={48} color={Colors.divider} />
              <Text style={styles.emptyTitle}>Nothing logged {isToday ? 'today' : 'this day'}</Text>
              <Text style={styles.emptySubtitle}>
                Tap one of the buttons above to start logging
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: 'bold',
  },

  // Date Selector
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  dateArrow: {
    padding: 6,
  },
  dateLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  searchResults: {
    marginBottom: 16,
  },
  searchEmpty: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // Hero Actions
  heroSection: {
    marginBottom: 16,
  },
  heroFoodBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  heroFoodText: {
    color: Colors.primaryBackground,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  heroFoodSub: {
    color: Colors.primaryBackground,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
    marginTop: 2,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  heroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    minHeight: 48,
  },
  heroBtnText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '700',
  },

  // Daily totals
  totalsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    color: Colors.accentText,
    fontSize: 22,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  totalLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
  totalDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.divider,
  },

  // Favorite tags section
  favTagsSection: {
    marginBottom: 16,
  },

  // Collapsible Categories
  categoriesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionHint: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  sectionHeaderText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 44,
  },
  categoryBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  pinIcon: {
    marginLeft: 2,
  },

  // Recent Entries
  recentSection: {
    marginBottom: 16,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
    gap: 8,
  },
  recentTagBadge: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 56,
    alignItems: 'center',
  },
  recentTagText: {
    color: Colors.accentText,
    fontSize: 10,
    fontWeight: '600',
  },
  recentInfo: {
    flex: 1,
  },
  recentLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  recentDetail: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 1,
  },
  recentTime: {
    color: Colors.secondaryText,
    fontSize: 11,
  },

  // Food log section
  foodSection: {
    marginBottom: 16,
  },
  mealGroup: {
    marginBottom: 12,
  },
  mealGroupTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  templateBtnText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  favInfo: {
    flex: 1,
    marginRight: 12,
  },
  favName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  favDetails: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});
