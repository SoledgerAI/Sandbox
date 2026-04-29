// Log tab — Sprint 21: Collapsible domain groups + elect-in categories + quick access
// Reorganized from flat list into structured sections with persisted collapse state

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
  LayoutAnimation,
  UIManager,
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
import { getStravaSyncState } from '../../src/services/strava';
import { todayDateString } from '../../src/utils/dayBoundary';
import { getActiveDate, setActiveDate as setContextDate, resetToToday } from '../../src/services/dateContextService';
import { DateContextBanner } from '../../src/components/DateContextBanner';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import {
  getEnabledCategories,
  getCollapsedSections,
  toggleSectionCollapsed,
  getQuickAccessCategories,
} from '../../src/utils/categoryElection';
import type { ElectInCategoryId } from '../../src/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

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
// Category Item + Section Definitions
// ============================================================

interface CategoryItem {
  id: string; // unique key for quick access matching
  label: string;
  icon: string;
  route: string;
  storageKey?: string;
  searchTerms: string;
  electInCategory?: ElectInCategoryId; // if item belongs to an elect-in category
}

interface SectionDef {
  id: string;
  title: string;
  alwaysVisible: boolean; // false = only show if at least one item visible
  items: CategoryItem[];
}

const SECTION_DEFS: SectionDef[] = [
  {
    id: 'nutrition',
    title: 'NUTRITION',
    alwaysVisible: true,
    items: [
      { id: 'food', label: 'Food Log', icon: 'restaurant-outline', route: '/log/food', storageKey: STORAGE_KEYS.LOG_FOOD, searchTerms: 'food nutrition meal calories macros ai scan' },
      { id: 'pantry', label: 'My Pantry', icon: 'bookmark-outline', route: '/log/pantry', searchTerms: 'pantry scan saved quick log barcode' },
      { id: 'recipes', label: 'My Recipes', icon: 'book-outline', route: '/settings/recipes', searchTerms: 'recipe recipes cook cooking meal prep batch' },
      { id: 'my_foods', label: 'My Foods', icon: 'star-outline', route: '/settings/taste', searchTerms: 'my foods favorites saved custom' },
      { id: 'water', label: 'Drinks', icon: 'water-outline', route: '/log/water', storageKey: STORAGE_KEYS.LOG_WATER, searchTerms: 'water hydration drink beverages coffee tea alcohol' },
      { id: 'supplements', label: 'Supplements', icon: 'flask-outline', route: '/log/supplements', storageKey: STORAGE_KEYS.LOG_SUPPLEMENTS, searchTerms: 'supplements vitamins medication pills' },
    ],
  },
  {
    id: 'movement',
    title: 'MOVEMENT',
    alwaysVisible: true,
    items: [
      { id: 'workout', label: 'Exercise', icon: 'fitness-outline', route: '/log/workout', storageKey: STORAGE_KEYS.LOG_WORKOUT, searchTerms: 'workout exercise cardio run sports' },
      { id: 'reps', label: 'Bodyweight Reps', icon: 'body-outline', route: '/log/reps', storageKey: STORAGE_KEYS.LOG_REPS, searchTerms: 'bodyweight reps pushups pullups situps jumping jacks squats calisthenics' },
      { id: 'mobility', label: 'Stretching & Mobility', icon: 'body-outline', route: '/log/mobility', storageKey: STORAGE_KEYS.LOG_MOBILITY, searchTerms: 'stretching mobility foam roll yoga massage ice bath sauna cold shower recovery' },
      { id: 'strava', label: 'Strava', icon: 'bicycle-outline', route: '/settings/devices', searchTerms: 'strava cycling running activity sync' },
    ],
  },
  {
    id: 'mind_wellness',
    title: 'MIND & WELLNESS',
    alwaysVisible: true,
    items: [
      { id: 'mood', label: 'Mood', icon: 'happy-outline', route: '/log/mood', storageKey: STORAGE_KEYS.LOG_MOOD, searchTerms: 'mood feeling emotion mental anxiety crisis 988' },
      { id: 'stress', label: 'Stress', icon: 'pulse-outline', route: '/log/stress', searchTerms: 'stress anxiety tension' },
      { id: 'meditation', label: 'Meditation & Breathwork', icon: 'leaf-outline', route: '/log/meditation', storageKey: STORAGE_KEYS.LOG_MEDITATION, searchTerms: 'meditation mindfulness breathe calm breathwork box breathing body scan' },
      { id: 'journal', label: 'Journaling', icon: 'book-outline', route: '/log/journal', storageKey: STORAGE_KEYS.LOG_JOURNAL, searchTerms: 'journal writing diary free-form private' },
      { id: 'gratitude', label: 'Gratitude', icon: 'heart-outline', route: '/log/gratitude', searchTerms: 'gratitude thankful journal' },
      { id: 'therapy', label: 'Therapy', icon: 'chatbubbles-outline', route: '/log/therapy', searchTerms: 'therapy counseling therapist session' },
      { id: 'social', label: 'Social Connection', icon: 'people-outline', route: '/log/social', storageKey: STORAGE_KEYS.LOG_SOCIAL, searchTerms: 'social connection friends family phone call video group' },
    ],
  },
  {
    id: 'daily_habits',
    title: 'DAILY HABITS',
    alwaysVisible: true,
    items: [
      { id: 'habits', label: 'Daily Habits', icon: 'checkbox-outline', route: '/log/habits', storageKey: STORAGE_KEYS.LOG_HABITS, searchTerms: 'habits daily checklist routine brush floss bed cream' },
    ],
  },
  {
    id: 'sleep',
    title: 'SLEEP',
    alwaysVisible: true,
    items: [
      { id: 'sleep_log', label: 'Sleep Log', icon: 'moon-outline', route: '/log/sleep', searchTerms: 'sleep rest bedtime wake hours quality' },
      { id: 'sleep_schedule', label: 'Sleep Schedule Adherence', icon: 'alarm-outline', route: '/settings/sleep-schedule', searchTerms: 'sleep schedule adherence bedtime wake routine' },
    ],
  },
  {
    id: 'medical',
    title: 'MEDICAL',
    alwaysVisible: true,
    items: [
      { id: 'doctor', label: 'Doctor Visits', icon: 'medkit-outline', route: '/log/doctor', storageKey: STORAGE_KEYS.LOG_DOCTOR_VISITS, searchTerms: 'doctor visit appointment physical checkup dentist therapist psychiatrist specialist follow-up' },
    ],
  },
  {
    id: 'health_metrics',
    title: 'HEALTH METRICS',
    alwaysVisible: false,
    items: [
      { id: 'blood_pressure', label: 'Blood Pressure', icon: 'heart-circle-outline', route: '/log/bloodpressure', searchTerms: 'blood pressure bp systolic diastolic', electInCategory: 'blood_pressure' },
      { id: 'glucose', label: 'Glucose', icon: 'fitness-outline', route: '/log/glucose', searchTerms: 'blood glucose sugar diabetes a1c', electInCategory: 'glucose' },
      { id: 'bloodwork', label: 'Bloodwork', icon: 'water-outline', route: '/log/bloodwork', searchTerms: 'bloodwork labs markers cholesterol iron', electInCategory: 'bloodwork' },
      { id: 'allergies', label: 'Allergies', icon: 'alert-circle-outline', route: '/log/allergies', storageKey: STORAGE_KEYS.LOG_ALLERGIES, searchTerms: 'allergy allergies pollen dust congestion sneezing severity symptoms', electInCategory: 'allergies' },
      { id: 'migraine', label: 'Migraine Tracker', icon: 'flash-outline', route: '/log/migraine', storageKey: STORAGE_KEYS.LOG_MIGRAINE, searchTerms: 'migraine headache aura trigger severity medication weather zip code', electInCategory: 'migraine_tracking' },
      { id: 'body_measurements', label: 'Body Measurements', icon: 'resize-outline', route: '/log/body-measurements', storageKey: STORAGE_KEYS.LOG_BODY_MEASUREMENTS, searchTerms: 'body measurements weight tape waist hips chest bicep thigh body fat', electInCategory: 'body_measurements' },
      { id: 'medications', label: 'Medications', icon: 'medical-outline', route: '/log/medications', storageKey: STORAGE_KEYS.LOG_MEDICATIONS, searchTerms: 'medication medications pills prescription adherence taken skipped dosage', electInCategory: 'medication_tracking' },
    ],
  },
  {
    id: 'womens_health',
    title: "WOMEN'S HEALTH",
    alwaysVisible: false,
    items: [
      { id: 'cycle', label: 'Cycle Tracking', icon: 'flower-outline', route: '/log/cycle', searchTerms: 'cycle period menstrual ovulation reproductive', electInCategory: 'cycle_tracking' },
      { id: 'breastfeeding', label: 'Breastfeeding', icon: 'heart-outline', route: '/log/breastfeeding', searchTerms: 'breastfeeding nursing pumping bottle feeding baby', electInCategory: 'breastfeeding' },
      { id: 'perimenopause', label: 'Perimenopause', icon: 'thermometer-outline', route: '/log/perimenopause', searchTerms: 'perimenopause menopause hot flash night sweat brain fog joint pain', electInCategory: 'perimenopause' },
    ],
  },
  {
    id: 'substances',
    title: 'SUBSTANCES',
    alwaysVisible: false,
    items: [
      { id: 'substances_log', label: 'Hemp / Cannabis', icon: 'wine-outline', route: '/log/substances', searchTerms: 'substances hemp cannabis terpenes strains monitor reduce quit alcohol tobacco sobriety', electInCategory: 'substances' },
    ],
  },
  {
    id: 'other_electin',
    title: 'OTHER',
    alwaysVisible: false,
    items: [
      { id: 'sexual_health', label: 'Sexual Health', icon: 'heart-half-outline', route: '/log/sexual', searchTerms: 'sexual activity intimacy', electInCategory: 'sexual_health' },
      { id: 'injuries', label: 'Injuries', icon: 'bandage-outline', route: '/log/injury', searchTerms: 'injury pain hurt sore recovery', electInCategory: 'injuries' },
      { id: 'pain', label: 'Pain', icon: 'pulse-outline', route: '/log/pain', searchTerms: 'pain ache sore chronic ongoing joints back knees shoulders', electInCategory: 'injuries' },
    ],
  },
  {
    id: 'reports',
    title: 'REPORTS',
    alwaysVisible: true,
    items: [
      { id: 'nutrient_report', label: 'Daily Nutrient Report', icon: 'analytics-outline', route: '/log/nutrient-report', searchTerms: 'nutrient report daily vitamins minerals macros iron ul rda p&l' },
    ],
  },
];

const ALL_CATEGORY_ITEMS: CategoryItem[] = SECTION_DEFS.flatMap((s) => s.items);

// Quick access default categories with icons and routes
const QUICK_ACCESS_MAP: Record<string, { icon: string; route: string; label: string }> = {
  food: { icon: 'restaurant-outline', route: '/log/food', label: 'Food' },
  water: { icon: 'water-outline', route: '/log/water', label: 'Water' },
  workout: { icon: 'fitness-outline', route: '/log/workout', label: 'Exercise' },
  mood: { icon: 'happy-outline', route: '/log/mood', label: 'Mood' },
  habits: { icon: 'checkbox-outline', route: '/log/habits', label: 'Habits' },
  sleep_log: { icon: 'moon-outline', route: '/log/sleep', label: 'Sleep' },
  supplements: { icon: 'flask-outline', route: '/log/supplements', label: 'Supps' },
  meditation: { icon: 'leaf-outline', route: '/log/meditation', label: 'Meditate' },
  reps: { icon: 'body-outline', route: '/log/reps', label: 'Reps' },
  social: { icon: 'people-outline', route: '/log/social', label: 'Social' },
  journal: { icon: 'book-outline', route: '/log/journal', label: 'Journal' },
  stress: { icon: 'pulse-outline', route: '/log/stress', label: 'Stress' },
};

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

  // Elect-in categories
  const [enabledCategories, setEnabledCategories] = useState<ElectInCategoryId[]>([]);

  // Collapsible sections
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  // Quick access
  const [quickAccessIds, setQuickAccessIds] = useState<string[]>(['food', 'water', 'workout', 'mood', 'habits']);

  // Strava connected
  const [stravaConnected, setStravaConnected] = useState(false);

  const loadData = useCallback(async () => {
    const dateStr = selectedDate;
    const entries: Record<string, LastEntry> = {};

    // Load elect-in categories, collapsed state, quick access, strava in parallel
    // S34-A PQ-A7: Strava state comes through the service (SecureStore-backed).
    const [enabled, collapsed, quickAccess, strava] = await Promise.all([
      getEnabledCategories(),
      getCollapsedSections(),
      getQuickAccessCategories(),
      getStravaSyncState(),
    ]);
    setEnabledCategories(enabled);
    setCollapsedSections(collapsed);
    setQuickAccessIds(quickAccess);
    setStravaConnected(strava?.connected === true);

    // Load all last-entry data in parallel
    const [
      foods, waters, workouts, supps, moods, reps, habits,
      doctorVisits, allergyLog, medEntries, socialEntries, sunEntries,
      mobEntries, journalEntries, bfEntries, periEntry, migraineEntry,
      bodyMeasEntry, medEntry,
    ] = await Promise.all([
      storageGet<{ food_item: { name: string }; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_FOOD, dateStr)),
      storageGet<{ timestamp: string; amount_oz: number }[]>(dateKey(STORAGE_KEYS.LOG_WATER, dateStr)),
      storageGet<{ timestamp: string; activity_name?: string }[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, dateStr)),
      storageGet<{ timestamp: string; name: string; taken: boolean }[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, dateStr)),
      storageGet<{ timestamp: string; score: number }[]>(dateKey(STORAGE_KEYS.LOG_MOOD, dateStr)),
      storageGet<{ exercise_type: string; reps: number; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_REPS, dateStr)),
      storageGet<{ name: string; completed: boolean }[]>(dateKey(STORAGE_KEYS.LOG_HABITS, dateStr)),
      storageGet<{ visit_type: string; visit_date: string; timestamp: string }[]>(STORAGE_KEYS.LOG_DOCTOR_VISITS),
      storageGet<{ severity: string; timestamp: string }>(dateKey(STORAGE_KEYS.LOG_ALLERGIES, dateStr)),
      storageGet<{ duration_minutes: number; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_MEDITATION, dateStr)),
      storageGet<{ type: string; who: string | null; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_SOCIAL, dateStr)),
      storageGet<{ duration_minutes: number; nature: boolean; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_SUNLIGHT, dateStr)),
      storageGet<{ type: string; duration_minutes: number; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_MOBILITY, dateStr)),
      storageGet<{ text: string; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_JOURNAL, dateStr)),
      storageGet<{ type: string; duration_minutes: number; timestamp: string }[]>(dateKey(STORAGE_KEYS.LOG_BREASTFEEDING, dateStr)),
      storageGet<{ hot_flashes_count: number; energy_level: number }>(dateKey(STORAGE_KEYS.LOG_PERIMENOPAUSE, dateStr)),
      storageGet<{ occurred: boolean; severity: number | null }>(dateKey(STORAGE_KEYS.LOG_MIGRAINE, dateStr)),
      storageGet<{ weight: number | null; weight_unit: string; body_fat_percentage: number | null }>(dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, dateStr)),
      storageGet<{ medications: { taken: boolean }[] }>(dateKey(STORAGE_KEYS.LOG_MEDICATIONS, dateStr)),
    ]);

    // Process results into last-entry labels
    if (foods?.length) {
      const last = foods[foods.length - 1];
      entries['/log/food'] = {
        label: last.food_item.name,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }
    if (waters?.length) {
      const last = waters[waters.length - 1];
      entries['/log/water'] = {
        label: `${last.amount_oz} oz`,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }
    if (workouts?.length) {
      const last = workouts[workouts.length - 1];
      entries['/log/workout'] = {
        label: last.activity_name ?? 'Workout',
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }
    const takenSupps = (supps ?? []).filter(s => s.taken);
    if (takenSupps.length) {
      const last = takenSupps[takenSupps.length - 1];
      entries['/log/supplements'] = {
        label: last.name,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }
    if (moods?.length) {
      const labels = ['', 'Bad', 'Poor', 'OK', 'Good', 'Great'];
      const last = moods[moods.length - 1];
      entries['/log/mood'] = {
        label: labels[last.score] ?? `${last.score}/5`,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }
    if (reps?.length) {
      const totalReps = reps.reduce((s, r) => s + r.reps, 0);
      const last = reps[reps.length - 1];
      entries['/log/reps'] = {
        label: `${totalReps} total reps`,
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }
    if (habits?.length) {
      const done = habits.filter(h => h.completed).length;
      entries['/log/habits'] = { label: `${done}/${habits.length} done`, time: '' };
    }
    if (doctorVisits?.length) {
      const last = doctorVisits[doctorVisits.length - 1];
      entries['/log/doctor'] = { label: last.visit_type.replace(/_/g, ' '), time: last.visit_date };
    }
    if (allergyLog) {
      entries['/log/allergies'] = {
        label: allergyLog.severity.charAt(0).toUpperCase() + allergyLog.severity.slice(1),
        time: new Date(allergyLog.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }
    if (Array.isArray(medEntries) && medEntries.length > 0) {
      const totalMin = medEntries.reduce((s, m) => s + m.duration_minutes, 0);
      entries['/log/meditation'] = { label: `${totalMin} min total`, time: `${medEntries.length} session${medEntries.length > 1 ? 's' : ''}` };
    }
    if (socialEntries?.length) {
      const last = socialEntries[socialEntries.length - 1];
      entries['/log/social'] = {
        label: last.type.replace(/_/g, ' ') + (last.who ? ` with ${last.who}` : ''),
        time: new Date(last.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };
    }
    if (sunEntries?.length) {
      const totalMin = sunEntries.reduce((s, e) => s + e.duration_minutes, 0);
      entries['/log/sunlight'] = { label: `${totalMin} min outdoors`, time: '' };
    }
    if (mobEntries?.length) {
      const totalMin = mobEntries.reduce((s, e) => s + e.duration_minutes, 0);
      entries['/log/mobility'] = { label: `${totalMin} min`, time: `${mobEntries.length} session${mobEntries.length > 1 ? 's' : ''}` };
    }
    if (journalEntries?.length) {
      entries['/log/journal'] = { label: `${journalEntries.length} entr${journalEntries.length > 1 ? 'ies' : 'y'}`, time: '' };
    }
    if (bfEntries?.length) {
      const totalMin = bfEntries.reduce((s, e) => s + e.duration_minutes, 0);
      entries['/log/breastfeeding'] = { label: `${bfEntries.length} sessions, ${totalMin} min`, time: '' };
    }
    if (periEntry) {
      entries['/log/perimenopause'] = { label: `${periEntry.hot_flashes_count} hot flashes, energy ${periEntry.energy_level}/5`, time: '' };
    }
    if (migraineEntry) {
      entries['/log/migraine'] = {
        label: migraineEntry.occurred ? `Severity ${migraineEntry.severity}/10` : 'No migraine',
        time: '',
      };
    }
    if (bodyMeasEntry) {
      const parts: string[] = [];
      if (bodyMeasEntry.weight != null) parts.push(`${bodyMeasEntry.weight} ${bodyMeasEntry.weight_unit}`);
      if (bodyMeasEntry.body_fat_percentage != null) parts.push(`${bodyMeasEntry.body_fat_percentage}% BF`);
      entries['/log/body-measurements'] = { label: parts.join(', ') || 'Entry logged', time: '' };
    }
    if (medEntry?.medications?.length) {
      const taken = medEntry.medications.filter((m) => m.taken).length;
      entries['/log/medications'] = { label: `${taken}/${medEntry.medications.length} taken`, time: '' };
    }

    setLastEntries(entries);
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

  // Toggle section collapsed/expanded
  const handleToggleSection = useCallback(async (sectionId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nowCollapsed = await toggleSectionCollapsed(sectionId);
    setCollapsedSections((prev) =>
      nowCollapsed
        ? [...prev, sectionId]
        : prev.filter((id) => id !== sectionId),
    );
  }, []);

  // Build visible sections based on elect-in state + strava
  const visibleSections = useMemo(() => {
    return SECTION_DEFS.map((section) => {
      // Filter items: remove elect-in items whose category is not enabled
      const visibleItems = section.items.filter((item) => {
        // Strava: only visible if connected
        if (item.id === 'strava' && !stravaConnected) return false;
        // Elect-in items: only visible if category enabled
        if (item.electInCategory) {
          return enabledCategories.includes(item.electInCategory);
        }
        return true;
      });

      return { ...section, items: visibleItems };
    }).filter((section) => {
      // Always-visible sections always show
      if (section.alwaysVisible) return true;
      // Elect-in sections: only show if at least one item is visible
      return section.items.length > 0;
    });
  }, [enabledCategories, stravaConnected]);

  // Search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return ALL_CATEGORY_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.searchTerms.includes(q),
    );
  }, [searchQuery]);

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
              ? `Last: ${lastEntry.label}${lastEntry.time ? `, ${lastEntry.time}` : ''}`
              : 'No entries today'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
      </TouchableOpacity>
    );
  };

  const renderQuickAccess = () => {
    const items = quickAccessIds
      .map((id) => QUICK_ACCESS_MAP[id])
      .filter(Boolean);
    if (items.length === 0) return null;

    return (
      <View style={styles.quickAccessRow}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.quickAccessBtn}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.quickAccessIconWrap}>
              <Ionicons name={item.icon as any} size={22} color={Colors.accent} />
            </View>
            <Text style={styles.quickAccessLabel} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
          <TouchableOpacity
            onPress={() => router.push('/settings/categories' as any)}
            hitSlop={12}
            style={styles.headerGear}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.accent} />
          </TouchableOpacity>
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

        {/* Quick Access */}
        {!searchQuery && renderQuickAccess()}

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
          /* Collapsible Sections */
          visibleSections.map((section) => {
            const isCollapsed = collapsedSections.includes(section.id);
            return (
              <View key={section.id} style={styles.sectionContainer}>
                <TouchableOpacity
                  style={styles.sectionHeaderRow}
                  onPress={() => handleToggleSection(section.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionHeader}>{section.title}</Text>
                  <Ionicons
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={16}
                    color={Colors.accent}
                  />
                </TouchableOpacity>
                {!isCollapsed && (
                  <View style={styles.sectionList}>
                    {section.items.map((item) => renderCategoryRow(item))}
                  </View>
                )}
              </View>
            );
          })
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerGear: {
    padding: 4,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
  },

  // Quick Access
  quickAccessRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  quickAccessBtn: {
    alignItems: 'center',
    minWidth: 56,
  },
  quickAccessIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 168, 67, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickAccessLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
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

  // Collapsible Section Headers
  sectionContainer: {
    marginBottom: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
    marginRight: 4,
  },
  sectionHeader: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  sectionList: {
    gap: 8,
  },

  // Category Rows
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
