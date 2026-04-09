// Log tab — Strava-inspired category list with last entry preview (Sprint 9)
// Clean, well-spaced, succinct. Every element earns its space.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import {
  storageGet,
  STORAGE_KEYS,
  dateKey,
} from '../../src/utils/storage';
import { todayDateString } from '../../src/utils/dayBoundary';
import { getActiveDate, setActiveDate as setContextDate, resetToToday } from '../../src/services/dateContextService';
import { DateContextBanner } from '../../src/components/DateContextBanner';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';

// ============================================================
// Date Helpers
// ============================================================

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// ============================================================
// Category Definitions — Strava-inspired flat list
// ============================================================

interface CategoryItem {
  label: string;
  icon: string;
  route: string;
  storageKey?: string; // for loading last entry
  searchTerms: string;
}

interface CategorySection {
  title: string;
  items: CategoryItem[];
}

const CATEGORY_SECTIONS: CategorySection[] = [
  {
    title: 'NUTRITION',
    items: [
      { label: 'Food', icon: 'restaurant-outline', route: '/log/food', storageKey: STORAGE_KEYS.LOG_FOOD, searchTerms: 'food nutrition meal calories macros' },
      { label: 'Drinks', icon: 'water-outline', route: '/log/water', storageKey: STORAGE_KEYS.LOG_WATER, searchTerms: 'water hydration drink beverages' },
      { label: 'Caffeine', icon: 'cafe-outline', route: '/log/caffeine', searchTerms: 'caffeine coffee tea energy' },
      { label: 'Supplements', icon: 'flask-outline', route: '/log/supplements', storageKey: STORAGE_KEYS.LOG_SUPPLEMENTS, searchTerms: 'supplements vitamins medication pills' },
    ],
  },
  {
    title: 'FITNESS',
    items: [
      { label: 'Exercise', icon: 'fitness-outline', route: '/log/workout', storageKey: STORAGE_KEYS.LOG_WORKOUT, searchTerms: 'workout exercise cardio run' },
      { label: 'Strength', icon: 'barbell-outline', route: '/log/strength', searchTerms: 'strength weight lifting gym' },
    ],
  },
  {
    title: 'BODY',
    items: [
      { label: 'Weight & Body', icon: 'scale-outline', route: '/log/body', searchTerms: 'weight body measurements scale bmi' },
      { label: 'Sleep', icon: 'moon-outline', route: '/log/sleep', searchTerms: 'sleep rest bedtime wake hours' },
      { label: 'Blood Pressure', icon: 'heart-circle-outline', route: '/log/bloodpressure', searchTerms: 'blood pressure bp systolic diastolic' },
      { label: 'Glucose', icon: 'fitness-outline', route: '/log/glucose', searchTerms: 'blood glucose sugar diabetes a1c' },
      { label: 'Bloodwork', icon: 'water-outline', route: '/log/bloodwork', searchTerms: 'bloodwork labs markers cholesterol iron' },
    ],
  },
  {
    title: 'MIND',
    items: [
      { label: 'Mood', icon: 'happy-outline', route: '/log/mood', storageKey: STORAGE_KEYS.LOG_MOOD, searchTerms: 'mood feeling emotion mental' },
      { label: 'Stress', icon: 'pulse-outline', route: '/log/stress', searchTerms: 'stress anxiety tension' },
      { label: 'Gratitude', icon: 'heart-outline', route: '/log/gratitude', searchTerms: 'gratitude thankful journal' },
      { label: 'Meditation', icon: 'leaf-outline', route: '/log/meditation', searchTerms: 'meditation mindfulness breathe calm' },
      { label: 'Therapy', icon: 'chatbubbles-outline', route: '/log/therapy', searchTerms: 'therapy counseling therapist session' },
    ],
  },
  {
    title: 'LIFESTYLE',
    items: [
      { label: 'Substances', icon: 'wine-outline', route: '/log/substances', searchTerms: 'substances alcohol cannabis tobacco sobriety' },
      { label: 'Cycle', icon: 'flower-outline', route: '/log/cycle', searchTerms: 'cycle period menstrual ovulation reproductive' },
      { label: 'Digestive', icon: 'nutrition-outline', route: '/log/digestive', searchTerms: 'digestive gut stomach bowel bristol' },
      { label: 'Injury', icon: 'bandage-outline', route: '/log/injury', searchTerms: 'injury pain hurt sore recovery' },
      { label: 'Sexual Health', icon: 'heart-half-outline', route: '/log/sexual', searchTerms: 'sexual activity intimacy' },
      { label: 'Personal Care', icon: 'sparkles-outline', route: '/log/personalcare', searchTerms: 'self care hygiene skincare grooming personal' },
      { label: 'Custom', icon: 'pricetag-outline', route: '/log/custom', searchTerms: 'custom tag create' },
    ],
  },
];

const ALL_CATEGORY_ITEMS: CategoryItem[] = CATEGORY_SECTIONS.flatMap((s) => s.items);

// ============================================================
// Last Entry type
// ============================================================

interface LastEntry {
  label: string;
  time: string;
}

// ============================================================
// Component
// ============================================================

export default function LogScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { date: paramDate } = useLocalSearchParams<{ date?: string }>();

  // Date selector state
  const [selectedDate, setSelectedDateLocal] = useState(paramDate ?? getActiveDate());
  const isToday = selectedDate === todayDateString();

  const setSelectedDate = useCallback((dateOrUpdater: string | ((prev: string) => string)) => {
    setSelectedDateLocal((prev) => {
      const next = typeof dateOrUpdater === 'function' ? dateOrUpdater(prev) : dateOrUpdater;
      setContextDate(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (paramDate && paramDate !== selectedDate) {
      setSelectedDate(paramDate);
    }
  }, [paramDate]);

  useFocusEffect(
    useCallback(() => {
      const contextDate = getActiveDate();
      if (contextDate !== selectedDate) {
        setSelectedDateLocal(contextDate);
      }
    }, []),
  );

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Last entries per category
  const [lastEntries, setLastEntries] = useState<Record<string, LastEntry>>({});

  // Sex setting for Cycle visibility
  const [showCycle, setShowCycle] = useState(true);

  const loadData = useCallback(async () => {
    const dateStr = selectedDate;
    const entries: Record<string, LastEntry> = {};

    // Load food
    const foods = await storageGet<{ food_item: { name: string }; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_FOOD, dateStr));
    if (foods?.length) {
      const last = foods[foods.length - 1];
      entries['/log/food'] = {
        label: last.food_item.name,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }

    // Load water/drinks
    const waters = await storageGet<{ timestamp: string; amount_oz: number }[]>(dateKey(STORAGE_KEYS.LOG_WATER, dateStr));
    if (waters?.length) {
      const last = waters[waters.length - 1];
      entries['/log/water'] = {
        label: `${last.amount_oz} oz`,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }

    // Load workouts
    const workouts = await storageGet<{ timestamp: string; type: string }[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, dateStr));
    if (workouts?.length) {
      const last = workouts[workouts.length - 1];
      entries['/log/workout'] = {
        label: last.type ?? 'Workout',
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }

    // Load supplements
    const supps = await storageGet<{ timestamp: string; name: string; taken: boolean }[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, dateStr));
    const takenSupps = (supps ?? []).filter(s => s.taken);
    if (takenSupps.length) {
      const last = takenSupps[takenSupps.length - 1];
      entries['/log/supplements'] = {
        label: last.name,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }

    // Load mood
    const moods = await storageGet<{ timestamp: string; score: number }[]>(dateKey(STORAGE_KEYS.LOG_MOOD, dateStr));
    if (moods?.length) {
      const labels = ['', 'Bad', 'Poor', 'OK', 'Good', 'Great'];
      const last = moods[moods.length - 1];
      entries['/log/mood'] = {
        label: labels[last.score] ?? `${last.score}/5`,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }

    setLastEntries(entries);

    // Check sex setting for Cycle visibility
    const settings = await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
    const profile = await storageGet<{ sex?: string }>(STORAGE_KEYS.PROFILE);
    const sex = profile?.sex;
    setShowCycle(sex !== 'male');
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Date navigation
  const goBack = useCallback(() => {
    setSelectedDate((d) => shiftDate(d, -1));
  }, []);

  const goForward = useCallback(() => {
    setSelectedDate((d) => {
      const next = shiftDate(d, 1);
      return next > todayDateString() ? d : next;
    });
  }, []);

  const goToday = useCallback(() => {
    resetToToday();
    setSelectedDateLocal(todayDateString());
  }, []);

  // Search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return ALL_CATEGORY_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.searchTerms.includes(q),
    );
  }, [searchQuery]);

  // Filter sections for visibility (Cycle based on sex)
  const visibleSections = useMemo(() => {
    return CATEGORY_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.route === '/log/cycle' && !showCycle) return false;
        return true;
      }),
    }));
  }, [showCycle]);

  const renderCategoryRow = (item: CategoryItem) => {
    const lastEntry = lastEntries[item.route];
    return (
      <TouchableOpacity
        key={item.route}
        style={styles.categoryRow}
        onPress={() => router.push(item.route as any)}
        activeOpacity={0.7}
      >
        <View style={styles.categoryIcon}>
          <Ionicons name={item.icon as any} size={24} color={Colors.accent} />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.label}</Text>
          <Text style={styles.categoryLastEntry} numberOfLines={1}>
            {lastEntry
              ? `Last: ${lastEntry.label}, ${lastEntry.time}`
              : 'No entries today'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper>
      <ScrollView
        ref={scrollRef}
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

        {/* Backfill Banner */}
        <DateContextBanner />

        {/* Date Navigator */}
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

        {/* Search Bar */}
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

        {/* Search Results */}
        {searchResults != null ? (
          <View style={styles.searchResultsSection}>
            {searchResults.length === 0 ? (
              <Text style={styles.searchEmpty}>No matching categories</Text>
            ) : (
              searchResults.map((item) => renderCategoryRow(item))
            )}
          </View>
        ) : (
          /* Category List */
          visibleSections.map((section) => (
            <View key={section.title} style={styles.sectionContainer}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              <View style={styles.sectionList}>
                {section.items.map((item) => renderCategoryRow(item))}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 12,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
  },

  // Date Navigator
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
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
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
  searchResultsSection: {
    marginBottom: 16,
    gap: 8,
  },
  searchEmpty: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // Section Headers
  sectionContainer: {
    marginBottom: 0,
  },
  sectionHeader: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionList: {
    gap: 8,
  },

  // Category Rows — Strava-inspired
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  categoryIcon: {
    width: 40,
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 8,
  },
  categoryName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  categoryLastEntry: {
    color: '#8899AA',
    fontSize: 12,
    marginTop: 2,
  },
});
