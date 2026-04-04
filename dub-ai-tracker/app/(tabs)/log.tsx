// Log tab -- quick logging hub with 3-zone hierarchy
// Phase 6: Food Logging -- Core
// MASTER-13: Restructured from flat 20-button grid to hero + collapsible categories + recent entries
// MASTER-49: Shows today's activity across ALL enabled tags, not just food

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  FlatList,
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

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function guessMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

// Category section definitions for Zone 2
interface CategorySection {
  title: string;
  items: { label: string; icon: string; route: string }[];
}

const CATEGORY_SECTIONS: CategorySection[] = [
  {
    title: 'Health & Fitness',
    items: [
      { label: 'Body', icon: 'scale-outline', route: '/log/body' },
      { label: 'Sleep', icon: 'moon-outline', route: '/log/sleep' },
      { label: 'Steps', icon: 'walk-outline', route: '/log/steps' },
      { label: 'Caffeine', icon: 'cafe-outline', route: '/log/caffeine' },
    ],
  },
  {
    title: 'Mind & Wellness',
    items: [
      { label: 'Mood', icon: 'happy-outline', route: '/log/mood' },
      { label: 'Stress', icon: 'pulse-outline', route: '/log/stress' },
      { label: 'Gratitude', icon: 'heart-outline', route: '/log/gratitude' },
      { label: 'Meditation', icon: 'leaf-outline', route: '/log/meditation' },
    ],
  },
  {
    title: 'Tracking',
    items: [
      { label: 'Substances', icon: 'wine-outline', route: '/log/substances' },
      { label: 'Sexual', icon: 'heart-half-outline', route: '/log/sexual' },
      { label: 'Digestive', icon: 'nutrition-outline', route: '/log/digestive' },
      { label: 'Cycle', icon: 'flower-outline', route: '/log/cycle' },
    ],
  },
  {
    title: 'Other',
    items: [
      { label: 'Injury', icon: 'bandage-outline', route: '/log/injury' },
      { label: 'Bloodwork', icon: 'water-outline', route: '/log/bloodwork' },
      { label: 'Glucose', icon: 'fitness-outline', route: '/log/glucose' },
      { label: 'BP', icon: 'heart-circle-outline', route: '/log/bloodpressure' },
      { label: 'Self Care', icon: 'sparkles-outline', route: '/log/personalcare' },
      { label: 'Therapy', icon: 'chatbubbles-outline', route: '/log/therapy' },
      { label: 'Custom', icon: 'pricetag-outline', route: '/log/custom' },
    ],
  },
];

// Recent entry from any tag
interface RecentEntry {
  id: string;
  tag: string;
  label: string;
  detail: string;
  time: string;
  timestamp: number;
}

export default function LogScreen() {
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Health & Fitness']));
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const [foods, favs, tmpls] = await Promise.all([
      storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, today)),
      storageGet<FavoriteFood[]>(STORAGE_KEYS.FOOD_FAVORITES),
      storageGet<MealTemplate[]>(STORAGE_KEYS.FOOD_TEMPLATES),
    ]);
    setFoodEntries(foods ?? []);
    setFavorites(favs ?? []);
    setTemplates(tmpls ?? []);

    // MASTER-49: Load recent entries across all tags
    const recents: RecentEntry[] = [];

    // Food entries
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

    // Water
    const waters = await storageGet<{ id: string; timestamp: string; amount_oz: number }[]>(dateKey(STORAGE_KEYS.LOG_WATER, today));
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

    // Workouts
    const workouts = await storageGet<{ id: string; timestamp: string; type: string; duration_minutes?: number; calories_burned?: number }[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, today));
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

    // Supplements
    const supps = await storageGet<{ id: string; timestamp: string; name: string; taken: boolean }[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today));
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

    // Mood
    const moods = await storageGet<{ id: string; timestamp: string; score: number }[]>(dateKey(STORAGE_KEYS.LOG_MOOD, today));
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

    // Sort by most recent first, limit to 20
    recents.sort((a, b) => b.timestamp - a.timestamp);
    setRecentEntries(recents.slice(0, 20));
  }, []);

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
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
      const updated = foodEntries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setFoodEntries(updated);
    },
    [foodEntries],
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
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
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
    [foodEntries],
  );

  const relogTemplate = useCallback(
    async (template: MealTemplate) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
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
    [foodEntries, templates],
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
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* ========== ZONE 1: HERO ACTIONS ========== */}
      <View style={styles.heroSection}>
        {/* Food — full width, gold accent, dominant */}
        <TouchableOpacity
          style={styles.heroFoodBtn}
          onPress={() => router.push('/log/food')}
          activeOpacity={0.7}
        >
          <Ionicons name="restaurant-outline" size={24} color={Colors.primaryBackground} />
          <Text style={styles.heroFoodText}>Log Food</Text>
          {totalCalories > 0 && (
            <Text style={styles.heroFoodSub}>{totalCalories} cal today</Text>
          )}
        </TouchableOpacity>

        {/* Water, Exercise, Supplements — half width */}
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

      {/* ========== ZONE 2: COLLAPSIBLE CATEGORIES ========== */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Quick Log</Text>
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
                  {section.items.map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={styles.categoryBtn}
                      onPress={() => router.push(item.route as any)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={item.icon as any} size={18} color={Colors.accent} />
                      <Text style={styles.categoryBtnText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ========== ZONE 3: RECENT ENTRIES (all tags) ========== */}
      {recentEntries.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Today's Activity</Text>
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

      {/* Favorites section */}
      {favorites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorites</Text>
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
          <Text style={styles.emptyTitle}>Nothing logged today</Text>
          <Text style={styles.emptySubtitle}>
            Tap one of the buttons above to start logging
          </Text>
        </View>
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
    marginBottom: 20,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: 'bold',
  },
  date: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginTop: 4,
  },

  // Zone 1: Hero Actions
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

  // Zone 2: Collapsible Categories
  categoriesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
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
  },

  // Zone 3: Recent Entries
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
