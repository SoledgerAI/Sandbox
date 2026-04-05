// Full-screen chart detail view
// Phase 16: Trends and Charts
// Per spec: Full interactive chart with axis labels, data point tooltips,
// year-over-year overlay toggle. Rendered one at a time.
// Wave 3 P2: Interactive tooltip card, pinch-to-zoom, long-press drag delta

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { useTrendsData, TrendDataSet } from '../../src/hooks/useTrendsData';
import { useDailySummary } from '../../src/hooks/useDailySummary';
import { useStorage } from '../../src/hooks/useStorage';
import { STORAGE_KEYS } from '../../src/utils/storage';
import { LineChart } from '../../src/components/charts/LineChart';
import { BarChart } from '../../src/components/charts/BarChart';
import { StackedBar } from '../../src/components/charts/StackedBar';
import { DualAxis } from '../../src/components/charts/DualAxis';
import type { TimeRange, ChartDataPoint, PointSelectEvent, DeltaInfo } from '../../src/components/charts/types';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '6mo', label: '6M' },
  { key: '1yr', label: '1Y' },
  { key: 'all', label: 'All' },
];

/** Ordered zoom levels for pinch gesture (pinch-out = zoom out = wider range) */
const ZOOM_LEVELS: TimeRange[] = ['7d', '30d', '90d', '1yr'];

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
  energy: {
    title: 'Energy Trend',
    category: 'Mood',
    type: 'line',
    dataKey: 'energy',
    unit: '/5',
  },
  anxiety: {
    title: 'Anxiety Trend',
    category: 'Mood',
    type: 'line',
    dataKey: 'anxiety',
    unit: '/5',
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

  // MASTER-54: Load user targets for goal reference lines
  const { calorieTarget } = useDailySummary();
  const proteinTarget = calorieTarget > 0 ? Math.round(calorieTarget * 0.3 / 4) : 0;

  // --- Wave 3 P2: Interactive state ---
  const [selectedPoint, setSelectedPoint] = useState<PointSelectEvent | null>(null);
  const [deltaInfo, setDeltaInfo] = useState<DeltaInfo | null>(null);
  const [deltaAnchor, setDeltaAnchor] = useState<PointSelectEvent | null>(null);

  // Tap data point → show tooltip card
  const handlePointSelect = useCallback((event: PointSelectEvent) => {
    // If we have an anchor for delta mode, complete the delta
    if (deltaAnchor) {
      const delta = event.value - deltaAnchor.value;
      const pct = deltaAnchor.value !== 0 ? (delta / deltaAnchor.value) * 100 : 0;
      setDeltaInfo({
        from: { date: deltaAnchor.date, label: deltaAnchor.label, value: deltaAnchor.value, x: deltaAnchor.x, y: deltaAnchor.y },
        to: { date: event.date, label: event.label, value: event.value, x: event.x, y: event.y },
        delta,
        percentChange: pct,
      });
      setDeltaAnchor(null);
      setSelectedPoint(null);
      return;
    }
    setSelectedPoint(event);
    setDeltaInfo(null);
  }, [deltaAnchor]);

  // Dismiss tooltip / delta overlay
  const dismissOverlays = useCallback(() => {
    setSelectedPoint(null);
    setDeltaInfo(null);
    setDeltaAnchor(null);
  }, []);

  // Long-press on a point → enter delta anchor mode
  const startDeltaMode = useCallback(() => {
    if (selectedPoint) {
      setDeltaAnchor(selectedPoint);
      setSelectedPoint(null);
      setDeltaInfo(null);
    }
  }, [selectedPoint]);

  // Navigate to log tab filtered to the tapped date
  const viewDayLog = useCallback((date: string) => {
    setSelectedPoint(null);
    router.push({ pathname: '/(tabs)/log', params: { date } });
  }, []);

  // Pinch-to-zoom: cycle time range
  const pinchBaseScale = useRef(1);
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchBaseScale.current = 1;
    })
    .onEnd((e) => {
      const scale = e.scale;
      const currentIdx = ZOOM_LEVELS.indexOf(timeRange);
      if (scale < 0.75 && currentIdx > 0) {
        // Pinch-in = zoom in = narrower range
        setTimeRange(ZOOM_LEVELS[currentIdx - 1]);
      } else if (scale > 1.3 && currentIdx < ZOOM_LEVELS.length - 1) {
        // Pinch-out = zoom out = wider range
        setTimeRange(ZOOM_LEVELS[currentIdx + 1]);
      }
      dismissOverlays();
    });

  const rawMeta = CHART_META[chartId];
  // Inject dynamic goal lines for calorie and protein charts
  const meta = useMemo(() => {
    if (!rawMeta) return rawMeta;
    if (chartId === 'calories' && calorieTarget > 0) {
      return { ...rawMeta, thresholdValue: calorieTarget, thresholdLabel: `Target: ${calorieTarget} cal` };
    }
    if (chartId === 'protein' && proteinTarget > 0) {
      return { ...rawMeta, thresholdValue: proteinTarget, thresholdLabel: `Target: ${proteinTarget}g` };
    }
    return rawMeta;
  }, [rawMeta, chartId, calorieTarget, proteinTarget]);

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

        {/* Chart with pinch-to-zoom */}
        <GestureDetector gesture={pinchGesture}>
          <View style={styles.chartContainer}>
            {!hasData ? (
              <View style={[styles.emptyChart, { height: chartHeight }]}>
                <Text style={styles.emptyText}>No data for this time range</Text>
                <Text style={styles.emptyHint}>Start logging to see trends here</Text>
              </View>
            ) : (
              <Pressable onPress={dismissOverlays}>
                {renderFullChart(meta, data, chartWidth, chartHeight, showYoY, handlePointSelect)}
              </Pressable>
            )}

            {/* Delta anchor indicator */}
            {deltaAnchor && (
              <View style={styles.deltaAnchorBadge}>
                <Ionicons name="locate-outline" size={14} color={Colors.accent} />
                <Text style={styles.deltaAnchorText}>
                  Tap another point to see delta from {deltaAnchor.label}
                </Text>
                <Pressable onPress={dismissOverlays} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Colors.secondaryText} />
                </Pressable>
              </View>
            )}

            {/* Tooltip card overlay */}
            {selectedPoint && (
              <View style={styles.tooltipCard}>
                <View style={styles.tooltipHeader}>
                  <Text style={styles.tooltipDate}>{selectedPoint.label}</Text>
                  <Pressable onPress={dismissOverlays} hitSlop={8} accessibilityLabel="Dismiss tooltip">
                    <Ionicons name="close" size={18} color={Colors.secondaryText} />
                  </Pressable>
                </View>
                <Text style={styles.tooltipValue}>
                  {selectedPoint.value.toFixed(
                    selectedPoint.unit === 'cal' || selectedPoint.unit === 'steps' ? 0 : 1,
                  )}
                  {selectedPoint.unit ? ` ${selectedPoint.unit}` : ''}
                </Text>
                {selectedPoint.seriesLabel && (
                  <Text style={styles.tooltipSeries}>{selectedPoint.seriesLabel}</Text>
                )}
                <View style={styles.tooltipActions}>
                  <Pressable
                    style={styles.tooltipLink}
                    onPress={() => viewDayLog(selectedPoint.date)}
                    accessibilityRole="link"
                    accessibilityLabel={`View log for ${selectedPoint.label}`}
                  >
                    <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
                    <Text style={styles.tooltipLinkText}>View day's log</Text>
                  </Pressable>
                  <Pressable
                    style={styles.tooltipLink}
                    onPress={startDeltaMode}
                    accessibilityRole="button"
                    accessibilityLabel="Compare with another point"
                  >
                    <Ionicons name="swap-horizontal-outline" size={14} color={Colors.accent} />
                    <Text style={styles.tooltipLinkText}>Compare</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Delta result overlay */}
            {deltaInfo && (
              <View style={styles.deltaCard}>
                <View style={styles.tooltipHeader}>
                  <Text style={styles.tooltipDate}>Delta</Text>
                  <Pressable onPress={dismissOverlays} hitSlop={8} accessibilityLabel="Dismiss delta">
                    <Ionicons name="close" size={18} color={Colors.secondaryText} />
                  </Pressable>
                </View>
                <View style={styles.deltaRow}>
                  <View style={styles.deltaPoint}>
                    <Text style={styles.deltaLabel}>{deltaInfo.from.label}</Text>
                    <Text style={styles.deltaPointValue}>{deltaInfo.from.value.toFixed(1)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={Colors.secondaryText} />
                  <View style={styles.deltaPoint}>
                    <Text style={styles.deltaLabel}>{deltaInfo.to.label}</Text>
                    <Text style={styles.deltaPointValue}>{deltaInfo.to.value.toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={[
                  styles.deltaValue,
                  { color: deltaInfo.delta > 0 ? Colors.successText : deltaInfo.delta < 0 ? Colors.dangerText : Colors.text },
                ]}>
                  {deltaInfo.delta > 0 ? '+' : ''}{deltaInfo.delta.toFixed(1)}
                  {meta.unit ? ` ${meta.unit}` : ''}
                  {' ('}
                  {deltaInfo.percentChange > 0 ? '+' : ''}{deltaInfo.percentChange.toFixed(1)}%
                  {')'}
                </Text>
              </View>
            )}
          </View>
        </GestureDetector>

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
  onPointSelect?: (event: PointSelectEvent) => void,
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
          onPointSelect={onPointSelect}
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
          onPointSelect={onPointSelect}
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
          onPointSelect={onPointSelect}
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
          onPointSelect={onPointSelect}
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
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 4,
  },

  // --- Tooltip card ---
  tooltipCard: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    right: 16,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tooltipDate: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tooltipValue: {
    color: Colors.accentText,
    fontSize: 22,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  tooltipSeries: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  tooltipActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  tooltipLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingVertical: 4,
  },
  tooltipLinkText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '600',
  },

  // --- Delta card ---
  deltaCard: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    right: 16,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 8,
  },
  deltaPoint: {
    alignItems: 'center',
  },
  deltaLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  deltaPointValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  deltaValue: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  // --- Delta anchor badge ---
  deltaAnchorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  deltaAnchorText: {
    color: Colors.secondaryText,
    fontSize: 12,
    flex: 1,
  },
});
