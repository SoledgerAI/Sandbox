// Trends tab: chart grid with time range selector
// Phase 16: Trends and Charts
// Per spec: FlatList with getItemLayout, sparkline thumbnails, tap to open detail

import { useState, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { LoadingIndicator } from '../../src/components/common/LoadingIndicator';
import { useTrendsData, TrendDataSet } from '../../src/hooks/useTrendsData';
import { useDailySummary } from '../../src/hooks/useDailySummary';
import { useBloodworkSummaries, type BloodworkMarkerSummary } from '../../src/hooks/useBloodworkTrends';
import { useStorage } from '../../src/hooks/useStorage';
import { STORAGE_KEYS } from '../../src/utils/storage';
import { LineChart } from '../../src/components/charts/LineChart';
import { BarChart } from '../../src/components/charts/BarChart';
import { StackedBar } from '../../src/components/charts/StackedBar';
import { DualAxis } from '../../src/components/charts/DualAxis';
import type { TimeRange, ChartDataPoint, ChartSeries } from '../../src/components/charts/types';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '6mo', label: '6M' },
  { key: '1yr', label: '1Y' },
  { key: 'all', label: 'All' },
];

// Fixed card dimensions for getItemLayout
const CARD_HEIGHT = 180;
const CARD_MARGIN = 12;
const ITEM_HEIGHT = CARD_HEIGHT + CARD_MARGIN;
const SPARKLINE_HEIGHT = 60;
const SPARKLINE_WIDTH_RATIO = 0.42; // each card takes ~42% of width

type ChartType = 'line' | 'bar' | 'stacked' | 'dual';

interface ChartConfig {
  id: string;
  title: string;
  category: string;
  type: ChartType;
  dataKey: keyof TrendDataSet;
  unit?: string;
  secondaryDataKey?: keyof TrendDataSet;
  yoyDataKey?: keyof TrendDataSet;
  goalValue?: number;
  goalLabel?: string;
  /** For line charts, rendered as dashed threshold line */
  thresholdKey?: 'calorieTarget' | 'proteinTarget' | 'waterGoal';
  segments?: { label: string; color: string; dataKey: keyof TrendDataSet }[];
  secondaryUnit?: string;
}

const CHART_CONFIGS: ChartConfig[] = [
  // Nutrition
  {
    id: 'calories',
    title: 'Calorie Trend',
    category: 'Nutrition',
    type: 'line',
    dataKey: 'calories',
    unit: 'cal',
    yoyDataKey: 'yoyCalories',
    thresholdKey: 'calorieTarget',
  },
  {
    id: 'macros',
    title: 'Macro Split',
    category: 'Nutrition',
    type: 'stacked',
    dataKey: 'protein',
    segments: [
      { label: 'Protein', color: '#4CAF50', dataKey: 'protein' },
      { label: 'Carbs', color: '#D4A843', dataKey: 'carbs' },
      { label: 'Fat', color: '#EF5350', dataKey: 'fat' },
    ],
    unit: 'g',
  },
  {
    id: 'protein',
    title: 'Protein Trend',
    category: 'Nutrition',
    type: 'line',
    dataKey: 'protein',
    unit: 'g',
    thresholdKey: 'proteinTarget',
  },

  // Hydration
  {
    id: 'water',
    title: 'Daily Water',
    category: 'Hydration',
    type: 'bar',
    dataKey: 'water',
    unit: 'oz',
    goalValue: 128,
    goalLabel: 'Goal: 128 oz',
  },
  {
    id: 'caffeine',
    title: 'Caffeine Intake',
    category: 'Hydration',
    type: 'bar',
    dataKey: 'caffeine',
    unit: 'mg',
    goalValue: 400,
    goalLabel: 'Limit: 400 mg',
  },

  // Fitness
  {
    id: 'steps',
    title: 'Step Count',
    category: 'Fitness',
    type: 'bar',
    dataKey: 'steps',
    unit: 'steps',
  },
  {
    id: 'active-cal',
    title: 'Active Minutes & Calories',
    category: 'Fitness',
    type: 'dual',
    dataKey: 'activeMinutes',
    unit: 'min',
    secondaryDataKey: 'caloriesBurned',
    secondaryUnit: 'cal',
  },
  {
    id: 'workouts',
    title: 'Workout Frequency',
    category: 'Fitness',
    type: 'bar',
    dataKey: 'workoutCount',
    unit: 'sessions',
  },

  // Body
  {
    id: 'weight',
    title: 'Weight Trend',
    category: 'Body',
    type: 'line',
    dataKey: 'weight',
    unit: 'lbs',
    yoyDataKey: 'yoyWeight',
  },
  {
    id: 'glucose',
    title: 'Blood Glucose',
    category: 'Body',
    type: 'line',
    dataKey: 'glucose',
    unit: 'mg/dL',
  },
  {
    id: 'bp-systolic',
    title: 'Blood Pressure (Systolic)',
    category: 'Body',
    type: 'line',
    dataKey: 'bpSystolic',
    unit: 'mmHg',
  },

  // Sleep
  {
    id: 'sleep-duration',
    title: 'Sleep Duration',
    category: 'Sleep',
    type: 'bar',
    dataKey: 'sleepHours',
    unit: 'hrs',
    goalValue: 8,
    goalLabel: 'Target: 8 hrs',
  },
  {
    id: 'sleep-quality',
    title: 'Sleep Quality',
    category: 'Sleep',
    type: 'line',
    dataKey: 'sleepQuality',
    unit: '/5',
    yoyDataKey: 'yoySleep',
  },

  // Recovery
  {
    id: 'recovery',
    title: 'Recovery Score',
    category: 'Recovery',
    type: 'line',
    dataKey: 'recovery',
    unit: '/100',
  },

  // Mood (3-axis)
  {
    id: 'mood',
    title: 'Mood Trend',
    category: 'Mood',
    type: 'line',
    dataKey: 'mood',
    unit: '/5',
    yoyDataKey: 'yoyMood',
  },
  {
    id: 'energy',
    title: 'Energy Trend',
    category: 'Mood',
    type: 'line',
    dataKey: 'energy',
    unit: '/5',
  },
  {
    id: 'anxiety',
    title: 'Anxiety Trend',
    category: 'Mood',
    type: 'line',
    dataKey: 'anxiety',
    unit: '/5',
  },
];


// MASTER-51: Category filter pills
const CATEGORY_FILTERS = ['All', 'Nutrition', 'Hydration', 'Fitness', 'Body', 'Bloodwork', 'Sleep', 'Recovery', 'Mood', 'Substances'] as const;
type CategoryFilter = typeof CATEGORY_FILTERS[number];

// MASTER-104: Extended tag-to-category mapping for all tag types
const TAG_TO_CATEGORY: Record<string, string> = {
  'nutrition.food': 'Nutrition',
  'hydration.water': 'Hydration',
  'fitness.workout': 'Fitness',
  'strength.training': 'Fitness',
  'body.measurements': 'Body',
  'sleep.tracking': 'Sleep',
  'recovery.score': 'Recovery',
  'mental.wellness': 'Mood',
  'substances.tracking': 'Substances',
  'supplements.daily': 'Nutrition',
  'health.markers': 'Body',
  'digestive.health': 'Body',
  'womens.health': 'Body',
  'injury.pain': 'Body',
  'personal.care': 'Mood',
  'blood.glucose': 'Body',
  'blood.pressure': 'Body',
};

export default function TrendsScreen() {
  // Fix 3: Scroll-to-top on tab re-tap
  const chartListRef = useRef<FlatList>(null);
  useScrollToTop(chartListRef);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const { data: enabledTags } = useStorage<string[]>(STORAGE_KEYS.TAGS_ENABLED, []);
  const { data, loading, reload: reloadTrends } = useTrendsData(timeRange, enabledTags ?? []);
  const { calorieTarget, summary: dailySummary, refresh: refreshSummary } = useDailySummary();
  const { summaries: bloodworkSummaries, reload: reloadBloodwork } = useBloodworkSummaries();

  // F-02: Refresh all data when tab gains focus
  useFocusEffect(
    useCallback(() => {
      reloadTrends();
      refreshSummary();
      reloadBloodwork();
    }, [reloadTrends, refreshSummary, reloadBloodwork]),
  );
  const { width: screenWidth } = useWindowDimensions();
  const sparkWidth = Math.floor(screenWidth * SPARKLINE_WIDTH_RATIO);

  // MASTER-54: Goal reference values for charts
  const goalTargets = useMemo(() => ({
    calorieTarget: calorieTarget > 0 ? calorieTarget : undefined,
    proteinTarget: calorieTarget > 0 ? Math.round(calorieTarget * 0.3 / 4) : undefined,
    waterGoal: 128,
  }), [calorieTarget]);

  // Filter charts to only show categories for enabled tags
  const enabledCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const tag of enabledTags ?? []) {
      const cat = TAG_TO_CATEGORY[tag];
      if (cat) cats.add(cat);
    }
    // Always show at minimum Nutrition and Hydration if user has any tags
    if (cats.size === 0 && (enabledTags ?? []).length > 0) {
      cats.add('Nutrition');
      cats.add('Hydration');
    }
    return cats;
  }, [enabledTags]);

  const visibleCharts = useMemo(() => {
    const byEnabled = CHART_CONFIGS.filter((c) => enabledCategories.has(c.category));
    // MASTER-51: Apply category filter
    if (categoryFilter === 'All') return byEnabled;
    return byEnabled.filter((c) => c.category === categoryFilter);
  }, [enabledCategories, categoryFilter]);

  // P1-05: Filter out charts with 0 data points, then group by category
  const chartItems = useMemo(() => {
    const chartsWithData = visibleCharts.filter((c) => {
      const chartData = data[c.dataKey] as ChartDataPoint[] | undefined;
      return chartData && chartData.length > 0;
    });

    const items: { type: 'header' | 'chart'; category?: string; chart?: ChartConfig }[] = [];
    let lastCat = '';
    for (const chart of chartsWithData) {
      if (chart.category !== lastCat) {
        items.push({ type: 'header', category: chart.category });
        lastCat = chart.category;
      }
      items.push({ type: 'chart', chart });
    }
    return items;
  }, [visibleCharts, data]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof chartItems)[0] }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{item.category}</Text>
          </View>
        );
      }

      const config = item.chart!;
      const chartData = data[config.dataKey] as ChartDataPoint[];

      return (
        <Pressable
          style={styles.chartCard}
          onPress={() =>
            router.push({
              pathname: '/trends/detail',
              params: { chartId: config.id, timeRange },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`${config.title}. Tap to view full chart`}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{config.title}</Text>
            <Text style={styles.cardValue}>
              {chartData[chartData.length - 1].value.toFixed(
                config.unit === 'cal' || config.unit === 'steps' ? 0 : 1,
              )}
              {config.unit ? ` ${config.unit}` : ''}
            </Text>
          </View>

          <View style={styles.sparklineContainer}>
            {renderSparkline(config, data, sparkWidth, SPARKLINE_HEIGHT, goalTargets)}
          </View>
        </Pressable>
      );
    },
    [data, timeRange, sparkWidth, goalTargets],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Trends</Text>
      </View>

      {/* Time Range Selector */}
      <View style={styles.rangeSelector}>
        {TIME_RANGES.map((tr) => (
          <Pressable
            key={tr.key}
            style={[
              styles.rangeButton,
              timeRange === tr.key && styles.rangeButtonActive,
            ]}
            onPress={() => setTimeRange(tr.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: timeRange === tr.key }}
            accessibilityLabel={`Time range: ${tr.label}`}
          >
            <Text
              style={[
                styles.rangeText,
                timeRange === tr.key && styles.rangeTextActive,
              ]}
            >
              {tr.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* MASTER-51: Category filter pills */}
      <View style={[styles.categoryFilterRow, loading && { opacity: 0.4, pointerEvents: 'none' as const }]}>
        <FlatList
          horizontal
          data={CATEGORY_FILTERS as unknown as CategoryFilter[]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterContent}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.categoryPill,
                categoryFilter === item && styles.categoryPillActive,
              ]}
              onPress={() => setCategoryFilter(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: categoryFilter === item }}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  categoryFilter === item && styles.categoryPillTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Year-over-Year indicator */}
      {data.hasYoYData && (
        <View style={styles.yoyBadge}>
          <Text style={styles.yoyText}>Year-over-year overlay available</Text>
        </View>
      )}
      {!data.hasYoYData && (
        <View style={styles.yoyBadge}>
          <Text style={styles.yoyTextMuted}>YoY overlay available after 12 months</Text>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <LoadingIndicator size="small" />
        </View>
      )}

      {/* P1-05: All empty state */}
      {!loading && chartItems.length === 0 && (
        <View style={styles.allEmptyContainer}>
          <Text style={styles.allEmptyText}>Start logging to see your trends</Text>
        </View>
      )}

      {/* Chart Grid */}
      <FlatList
        ref={chartListRef}
        data={chartItems}
        renderItem={renderItem}
        keyExtractor={(item, i) =>
          item.type === 'header' ? `h-${item.category}` : `c-${item.chart!.id}`
        }
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={6}
        windowSize={5}
        ListFooterComponent={
          (categoryFilter === 'All' || categoryFilter === 'Bloodwork') &&
          bloodworkSummaries.length > 0 ? (
            <View style={styles.bloodworkSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Lab Results</Text>
              </View>
              {bloodworkSummaries.map((marker) => (
                <View key={marker.name} style={styles.bloodworkCard}>
                  <View style={styles.bloodworkCardHeader}>
                    <Text style={styles.bloodworkMarkerName}>{marker.name}</Text>
                    <View style={styles.bloodworkValueRow}>
                      <Text
                        style={[
                          styles.bloodworkValue,
                          marker.flagged && styles.bloodworkValueFlagged,
                        ]}
                      >
                        {marker.latestValue} {marker.unit}
                      </Text>
                      <Text style={styles.bloodworkDirection}>
                        {marker.direction === 'up'
                          ? '\u2191'
                          : marker.direction === 'down'
                            ? '\u2193'
                            : '\u2192'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bloodworkMeta}>
                    {marker.dataPointCount} results
                    {marker.previousValue != null
                      ? ` \u00B7 prev: ${marker.previousValue} ${marker.unit}`
                      : ''}
                    {marker.referenceLow != null || marker.referenceHigh != null
                      ? ` \u00B7 ref: ${marker.referenceLow ?? ''}-${marker.referenceHigh ?? ''} ${marker.unit}`
                      : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </View>
  );
}

function renderSparkline(
  config: ChartConfig,
  data: TrendDataSet,
  width: number,
  height: number,
  goalTargets?: Record<string, number | undefined>,
) {
  const chartData = data[config.dataKey] as ChartDataPoint[];

  switch (config.type) {
    case 'line': {
      const series: ChartSeries[] = [
        { data: chartData, color: Colors.accent, label: config.title },
      ];
      // Add YoY overlay if available
      if (config.yoyDataKey && data.hasYoYData) {
        const yoyData = data[config.yoyDataKey] as ChartDataPoint[];
        if (yoyData.length > 0) {
          series.push({
            data: yoyData,
            color: Colors.secondaryText,
            label: 'Last Year',
            dashed: true,
          });
        }
      }
      return <LineChart series={series} width={width} height={height} title={config.title} unit={config.unit} thumbnail />;
    }
    case 'bar':
      return (
        <BarChart
          data={chartData}
          width={width}
          height={height}
          title={config.title}
          unit={config.unit}
          goalValue={config.goalValue}
          thumbnail
        />
      );
    case 'stacked': {
      if (!config.segments) return null;
      const stackedData = chartData.map((point, i) => ({
        label: point.label,
        date: point.date,
        values: config.segments!.map((seg) => {
          const segData = data[seg.dataKey] as ChartDataPoint[];
          return segData[i]?.value ?? 0;
        }),
      }));
      const segments = config.segments.map((s) => ({ label: s.label, color: s.color }));
      return <StackedBar data={stackedData} segments={segments} width={width} height={height} title={config.title} thumbnail />;
    }
    case 'dual': {
      const primaryData = chartData;
      const secondaryData = config.secondaryDataKey
        ? (data[config.secondaryDataKey] as ChartDataPoint[])
        : [];
      return (
        <DualAxis
          left={{ data: primaryData, color: Colors.accent, label: config.title.split(' ')[0], unit: config.unit ?? '' }}
          right={{ data: secondaryData, color: Colors.success, label: 'Calories', unit: config.secondaryUnit ?? '' }}
          width={width}
          height={height}
          title={config.title}
          thumbnail
        />
      );
    }
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: 'bold',
  },
  rangeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    minHeight: 44,
    justifyContent: 'center',
  },
  rangeButtonActive: {
    backgroundColor: Colors.accent,
  },
  rangeText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  rangeTextActive: {
    color: Colors.primaryBackground,
  },
  categoryFilterRow: {
    paddingVertical: 4,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    minHeight: 34,
    justifyContent: 'center',
  },
  categoryPillActive: {
    backgroundColor: Colors.primaryBackground,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  categoryPillText: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: Colors.accentText,
  },
  yoyBadge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  yoyText: {
    color: Colors.accentText,
    fontSize: 11,
  },
  yoyTextMuted: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  loadingContainer: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chartCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: CARD_MARGIN,
    minHeight: CARD_HEIGHT,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  cardValue: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  sparklineContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allEmptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  allEmptyText: {
    color: Colors.secondaryText,
    fontSize: 16,
    textAlign: 'center',
  },
  bloodworkSection: {
    marginTop: 8,
  },
  bloodworkCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: CARD_MARGIN,
  },
  bloodworkCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bloodworkMarkerName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  bloodworkValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bloodworkValue: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'] as const,
  },
  bloodworkValueFlagged: {
    color: Colors.danger,
  },
  bloodworkDirection: {
    fontSize: 16,
    color: Colors.secondaryText,
  },
  bloodworkMeta: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
});
