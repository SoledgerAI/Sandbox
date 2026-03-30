// Full-screen chart detail view
// Phase 16: Trends and Charts
// Per spec: Full interactive chart with axis labels, data point tooltips,
// year-over-year overlay toggle. Rendered one at a time.

import { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { useTrendsData, TrendDataSet } from '../../src/hooks/useTrendsData';
import { useStorage } from '../../src/hooks/useStorage';
import { STORAGE_KEYS } from '../../src/utils/storage';
import { LineChart } from '../../src/components/charts/LineChart';
import { BarChart } from '../../src/components/charts/BarChart';
import { StackedBar } from '../../src/components/charts/StackedBar';
import { DualAxis } from '../../src/components/charts/DualAxis';
import type { TimeRange, ChartDataPoint } from '../../src/components/charts/types';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '6mo', label: '6M' },
  { key: '1yr', label: '1Y' },
  { key: 'all', label: 'All' },
];

interface ChartMeta {
  title: string;
  category: string;
  type: 'line' | 'bar' | 'stacked' | 'dual' | 'scatter' | 'heatmap';
  dataKey: keyof TrendDataSet;
  unit?: string;
  yoyDataKey?: keyof TrendDataSet;
  secondaryDataKey?: keyof TrendDataSet;
  secondaryUnit?: string;
  goalValue?: number;
  goalLabel?: string;
  thresholdValue?: number;
  thresholdLabel?: string;
  segments?: { label: string; color: string; dataKey: keyof TrendDataSet }[];
}

const CHART_META: Record<string, ChartMeta> = {
  calories: {
    title: 'Calorie Trend',
    category: 'Nutrition',
    type: 'line',
    dataKey: 'calories',
    unit: 'cal',
    yoyDataKey: 'yoyCalories',
  },
  macros: {
    title: 'Macro Split',
    category: 'Nutrition',
    type: 'stacked',
    dataKey: 'protein',
    unit: 'g',
    segments: [
      { label: 'Protein', color: '#4CAF50', dataKey: 'protein' },
      { label: 'Carbs', color: '#D4A843', dataKey: 'carbs' },
      { label: 'Fat', color: '#EF5350', dataKey: 'fat' },
    ],
  },
  protein: {
    title: 'Protein Trend',
    category: 'Nutrition',
    type: 'line',
    dataKey: 'protein',
    unit: 'g',
  },
  water: {
    title: 'Daily Water Intake',
    category: 'Hydration',
    type: 'bar',
    dataKey: 'water',
    unit: 'oz',
    goalValue: 128,
    goalLabel: 'Goal: 128 oz',
  },
  caffeine: {
    title: 'Caffeine Intake',
    category: 'Hydration',
    type: 'bar',
    dataKey: 'caffeine',
    unit: 'mg',
    thresholdValue: 400,
    thresholdLabel: 'FDA limit: 400 mg',
  },
  steps: {
    title: 'Daily Steps',
    category: 'Fitness',
    type: 'bar',
    dataKey: 'steps',
    unit: 'steps',
    goalValue: 10000,
    goalLabel: 'Goal: 10K',
  },
  'active-cal': {
    title: 'Active Minutes & Calories Burned',
    category: 'Fitness',
    type: 'dual',
    dataKey: 'activeMinutes',
    unit: 'min',
    secondaryDataKey: 'caloriesBurned',
    secondaryUnit: 'cal',
  },
  workouts: {
    title: 'Workout Frequency',
    category: 'Fitness',
    type: 'bar',
    dataKey: 'workoutCount',
    unit: 'sessions',
  },
  weight: {
    title: 'Weight Trend',
    category: 'Body',
    type: 'line',
    dataKey: 'weight',
    unit: 'lbs',
    yoyDataKey: 'yoyWeight',
  },
  'sleep-duration': {
    title: 'Sleep Duration',
    category: 'Sleep',
    type: 'bar',
    dataKey: 'sleepHours',
    unit: 'hrs',
    goalValue: 8,
    goalLabel: 'Target: 8 hrs',
  },
  'sleep-quality': {
    title: 'Sleep Quality',
    category: 'Sleep',
    type: 'line',
    dataKey: 'sleepQuality',
    unit: '/5',
    yoyDataKey: 'yoySleep',
  },
  recovery: {
    title: 'Recovery Score',
    category: 'Recovery',
    type: 'line',
    dataKey: 'recovery',
    unit: '/100',
  },
  mood: {
    title: 'Mood Trend',
    category: 'Mood',
    type: 'line',
    dataKey: 'mood',
    unit: '/5',
    yoyDataKey: 'yoyMood',
  },
};

export default function TrendsDetailScreen() {
  const params = useLocalSearchParams<{ chartId: string; timeRange: string }>();
  const chartId = params.chartId ?? 'calories';
  const initialRange = (params.timeRange as TimeRange) ?? '7d';

  const [timeRange, setTimeRange] = useState<TimeRange>(initialRange);
  const [showYoY, setShowYoY] = useState(true);
  const { data: enabledTags } = useStorage<string[]>(STORAGE_KEYS.TAGS_ENABLED, []);
  const { data } = useTrendsData(timeRange, enabledTags ?? []);
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 32;
  const chartHeight = 280;

  const meta = CHART_META[chartId];
  if (!meta) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.title}>Chart Not Found</Text>
        </View>
      </View>
    );
  }

  const chartData = data[meta.dataKey] as ChartDataPoint[];
  const hasData = chartData && chartData.length > 0;

  // Stats
  const stats = useMemo(() => {
    if (!hasData) return null;
    const values = chartData.map((d) => d.value);
    const current = values[values.length - 1];
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const change = values.length >= 2 ? current - values[0] : 0;
    return { current, avg, min, max, change };
  }, [chartData, hasData]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{meta.title}</Text>
          <Text style={styles.subtitle}>{meta.category}</Text>
        </View>
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

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* YoY toggle */}
        {meta.yoyDataKey && (
          <Pressable
            style={styles.yoyToggle}
            onPress={() => setShowYoY(!showYoY)}
            accessibilityRole="switch"
            accessibilityState={{ checked: showYoY }}
            accessibilityLabel="Toggle year-over-year overlay"
          >
            <Ionicons
              name={showYoY ? 'checkbox' : 'square-outline'}
              size={20}
              color={Colors.accent}
            />
            <Text style={styles.yoyToggleText}>
              {data.hasYoYData
                ? 'Year-over-year overlay'
                : 'YoY overlay (available after 12 months)'}
            </Text>
          </Pressable>
        )}

        {/* Chart */}
        <View style={styles.chartContainer}>
          {!hasData ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <Text style={styles.emptyText}>No data for this time range</Text>
              <Text style={styles.emptyHint}>Start logging to see trends here</Text>
            </View>
          ) : (
            renderFullChart(meta, data, chartWidth, chartHeight, showYoY)
          )}
        </View>

        {/* Stats */}
        {stats && (
          <View style={styles.statsGrid}>
            <StatCard label="Current" value={formatStat(stats.current, meta.unit)} />
            <StatCard label="Average" value={formatStat(stats.avg, meta.unit)} />
            <StatCard label="Min" value={formatStat(stats.min, meta.unit)} />
            <StatCard label="Max" value={formatStat(stats.max, meta.unit)} />
            <StatCard
              label="Change"
              value={`${stats.change > 0 ? '+' : ''}${formatStat(stats.change, meta.unit)}`}
              color={
                stats.change > 0
                  ? Colors.success
                  : stats.change < 0
                    ? Colors.danger
                    : Colors.text
              }
            />
            <StatCard label="Data Points" value={`${chartData.length}`} />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function renderFullChart(
  meta: ChartMeta,
  data: TrendDataSet,
  width: number,
  height: number,
  showYoY: boolean,
) {
  const chartData = data[meta.dataKey] as ChartDataPoint[];

  switch (meta.type) {
    case 'line': {
      const series: any[] = [
        { data: chartData, color: Colors.accent, label: meta.title },
      ];
      if (showYoY && meta.yoyDataKey && data.hasYoYData) {
        const yoyData = data[meta.yoyDataKey] as ChartDataPoint[];
        if (yoyData.length > 0) {
          series.push({
            data: yoyData,
            color: Colors.secondaryText,
            label: 'Last Year',
            dashed: true,
          });
        }
      }
      return (
        <LineChart
          series={series}
          width={width}
          height={height}
          title={meta.title}
          unit={meta.unit}
          thresholdValue={meta.thresholdValue}
          thresholdLabel={meta.thresholdLabel}
        />
      );
    }
    case 'bar':
      return (
        <BarChart
          data={chartData}
          width={width}
          height={height}
          title={meta.title}
          unit={meta.unit}
          goalValue={meta.goalValue}
          goalLabel={meta.goalLabel}
        />
      );
    case 'stacked': {
      if (!meta.segments) return null;
      const stackedData = chartData.map((point, i) => ({
        label: point.label,
        date: point.date,
        values: meta.segments!.map((seg) => {
          const segData = data[seg.dataKey] as ChartDataPoint[];
          return segData[i]?.value ?? 0;
        }),
      }));
      const segments = meta.segments.map((s) => ({ label: s.label, color: s.color }));
      return (
        <StackedBar
          data={stackedData}
          segments={segments}
          width={width}
          height={height}
          title={meta.title}
          unit={meta.unit}
        />
      );
    }
    case 'dual': {
      const secondaryData = meta.secondaryDataKey
        ? (data[meta.secondaryDataKey] as ChartDataPoint[])
        : [];
      return (
        <DualAxis
          left={{
            data: chartData,
            color: Colors.accent,
            label: 'Active Min',
            unit: meta.unit ?? '',
          }}
          right={{
            data: secondaryData,
            color: Colors.success,
            label: 'Calories',
            unit: meta.secondaryUnit ?? '',
          }}
          width={width}
          height={height}
          title={meta.title}
        />
      );
    }
    default:
      return null;
  }
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatStat(val: number, unit?: string): string {
  const formatted = Math.abs(val) >= 100 ? val.toFixed(0) : val.toFixed(1);
  return unit ? `${formatted} ${unit}` : formatted;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
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
  scrollContent: {
    flex: 1,
  },
  yoyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    minHeight: 44,
  },
  yoyToggleText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  chartContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyChart: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  emptyHint: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 16,
  },
  statCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    padding: 12,
    minWidth: '30%',
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 4,
  },
});
