// Log tab -- quick logging hub with food list, favorites, templates
// Phase 6: Food Logging -- Core
// Phase 10: Added sleep, mood, gratitude, meditation, stress, therapy entry points
// Phase 11: Added workout and strength entry points
// Phase 13: Added supplements, personal care, sexual, cycle, digestive, injury, bloodwork, custom

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

export default function LogScreen() {
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload when returning from food logging screen
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

      // Update last_used on template
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

  // Group entries by meal type
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

      {/* Quick log buttons */}
      <View style={styles.quickLogGrid}>
        <TouchableOpacity
          style={styles.addFoodBtn}
          onPress={() => router.push('/log/food')}
          activeOpacity={0.7}
        >
          <Ionicons name="restaurant-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Food</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/water')}
          activeOpacity={0.7}
        >
          <Ionicons name="water-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Water</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/caffeine')}
          activeOpacity={0.7}
        >
          <Ionicons name="cafe-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Caffeine</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/substances')}
          activeOpacity={0.7}
        >
          <Ionicons name="wine-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Substances</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/workout')}
          activeOpacity={0.7}
        >
          <Ionicons name="fitness-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Exercise</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/body')}
          activeOpacity={0.7}
        >
          <Ionicons name="scale-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Body</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/sleep')}
          activeOpacity={0.7}
        >
          <Ionicons name="moon-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Sleep</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/mood')}
          activeOpacity={0.7}
        >
          <Ionicons name="happy-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Mood</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/gratitude')}
          activeOpacity={0.7}
        >
          <Ionicons name="heart-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Gratitude</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/meditation')}
          activeOpacity={0.7}
        >
          <Ionicons name="leaf-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Meditation</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/stress')}
          activeOpacity={0.7}
        >
          <Ionicons name="pulse-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Stress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/therapy')}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubbles-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Therapy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/supplements')}
          activeOpacity={0.7}
        >
          <Ionicons name="flask-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Supplements</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/personalcare')}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Self Care</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/sexual')}
          activeOpacity={0.7}
        >
          <Ionicons name="heart-half-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Sexual</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/cycle')}
          activeOpacity={0.7}
        >
          <Ionicons name="flower-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Cycle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/digestive')}
          activeOpacity={0.7}
        >
          <Ionicons name="nutrition-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Digestive</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/injury')}
          activeOpacity={0.7}
        >
          <Ionicons name="bandage-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Injury</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/bloodwork')}
          activeOpacity={0.7}
        >
          <Ionicons name="water-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Bloodwork</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLogBtn}
          onPress={() => router.push('/log/custom')}
          activeOpacity={0.7}
        >
          <Ionicons name="pricetag-outline" size={20} color={Colors.primaryBackground} />
          <Text style={styles.addFoodText}>Custom</Text>
        </TouchableOpacity>
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

      {/* Food entries grouped by meal */}
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

      {foodEntries.length > 0 && (
        <TouchableOpacity style={styles.templateBtn} onPress={saveMealAsTemplate}>
          <Ionicons name="bookmark-outline" size={16} color={Colors.accent} />
          <Text style={styles.templateBtnText}>Save as Meal Template</Text>
        </TouchableOpacity>
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
      {foodEntries.length === 0 && favorites.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={48} color={Colors.divider} />
          <Text style={styles.emptyTitle}>No food logged today</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Log Food" to search, manually enter, or quick-log calories
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
  quickLogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  addFoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 48,
  },
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 48,
  },
  addFoodText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '700',
  },
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
  mealGroup: {
    marginBottom: 16,
  },
  mealGroupTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 16,
  },
  templateBtnText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
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
