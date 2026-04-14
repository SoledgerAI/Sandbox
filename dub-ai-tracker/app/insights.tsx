// Sprint 25: Insights & Trends Screen
// Accessible from dashboard — shows trend summaries, correlation insights

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Spacing } from '../src/constants/spacing';
import { PremiumCard } from '../src/components/common/PremiumCard';
import { LoadingIndicator } from '../src/components/common/LoadingIndicator';
import { LineChart } from '../src/components/charts/LineChart';
import { BarChart } from '../src/components/charts/BarChart';
import ScreenWrapper from '../src/components/common/ScreenWrapper';
import { isCategoryEnabled } from '../src/utils/categoryElection';
import {
  calculateMoodTrend,
  calculateSleepTrend,
  calculateExerciseTrend,
  calculateNutritionTrend,
  calculateComplianceTrend,
  calculateWeightTrend,
  type TrendTimeRange,
  type MoodTrendData,
  type SleepTrendData,
  type ExerciseTrendData,
  type NutritionTrendData,
  type ComplianceTrendData,
  type WeightTrendData,
} from '../src/utils/trendCalculator';
import {
  calculateCorrelationInsights,
  type CorrelationInsight,
} from '../src/utils/insightCorrelations';
import type { ChartDataPoint, ChartSeries } from '../src/components/charts/types';

const TIME_RANGES: { key: TrendTimeRange; label: string }[] = [
  { key: 7, label: '7 Days' },
  { key: 30, label: '30 Days' },
  { key: 90, label: '90 Days' },
];

function formatDateLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

export default function InsightsScreen() {
  const [timeRange, setTimeRange] = useState<TrendTimeRange>(7);
  const [loading, setLoading] = useState(true);

  const [moodTrend, setMoodTrend] = useState<MoodTrendData | null>(null);
  const [sleepTrend, setSleepTrend] = useState<SleepTrendData | null>(null);
  const [exerciseTrend, setExerciseTrend] = useState<ExerciseTrendData | null>(null);
  const [nutritionTrend, setNutritionTrend] = useState<NutritionTrendData | null>(null);
  const [complianceTrend, setComplianceTrend] = useState<ComplianceTrendData | null>(null);
  const [weightTrend, setWeightTrend] = useState<WeightTrendData | null>(null);
  const [showWeight, setShowWeight] = useState(false);
  const [correlations, setCorrelations] = useState<CorrelationInsight[]>([]);

  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - Spacing.lg * 2 - 32; // PremiumCard padding

  const loadTrends = useCallback(async () => {
    setLoading(true);
    try {
      const [mood, sleep, exercise, nutrition, compliance, weight, bmEnabled, insights] =
        await Promise.all([
          calculateMoodTrend(timeRange),
          calculateSleepTrend(timeRange),
          calculateExerciseTrend(timeRange),
          calculateNutritionTrend(timeRange),
          calculateComplianceTrend(timeRange),
          calculateWeightTrend(timeRange),
          isCategoryEnabled('body_measurements'),
          calculateCorrelationInsights(),
        ]);

      setMoodTrend(mood);
      setSleepTrend(sleep);
      setExerciseTrend(exercise);
      setNutritionTrend(nutrition);
      setComplianceTrend(compliance);
      setWeightTrend(weight);
      setShowWeight(bmEnabled || (weight.hasData));
      setCorrelations(insights);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const hasAnyData = (moodTrend?.hasData || sleepTrend?.hasData || exerciseTrend?.hasData ||
    nutritionTrend?.hasData || complianceTrend?.hasData || weightTrend?.hasData);

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Insights</Text>
          <View style={styles.backButton} />
        </View>

        {/* Time Range Selector */}
        <View style={styles.rangeSelector}>
          {TIME_RANGES.map((tr) => (
            <TouchableOpacity
              key={tr.key}
              style={[styles.rangeButton, timeRange === tr.key && styles.rangeButtonActive]}
              onPress={() => setTimeRange(tr.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rangeText, timeRange === tr.key && styles.rangeTextActive]}>
                {tr.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <LoadingIndicator size="small" />
            <Text style={styles.loadingText}>Analyzing your data...</Text>
          </View>
        )}

        {!loading && !hasAnyData && (
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={48} color={Colors.secondaryText} />
            <Text style={styles.emptyTitle}>No Insights Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start logging to see trends and patterns in your health data.
            </Text>
          </View>
        )}

        {/* Mood Trend */}
        {!loading && moodTrend?.hasData && (
          <PremiumCard>
            <Text style={styles.cardTitle}>Mood Trend</Text>
            <LineChart
              series={[{
                data: moodTrend.dailyScores.map((d) => ({
                  label: formatDateLabel(d.date),
                  value: d.score,
                  date: d.date,
                })),
                color: Colors.accent,
                label: 'Mood',
              }]}
              width={chartWidth}
              height={160}
              title="Mood"
              unit="/10"
            />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{moodTrend.averageMood}</Text>
                <Text style={styles.statLabel}>Avg Mood</Text>
              </View>
            </View>
            {moodTrend.topEmotions.length > 0 && (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Top emotions: </Text>
                <Text style={styles.tagValues}>
                  {moodTrend.topEmotions.map((e) => e.emotion.replace(/_/g, ' ')).join(', ')}
                </Text>
              </View>
            )}
            {moodTrend.topTriggers.length > 0 && (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Top triggers: </Text>
                <Text style={styles.tagValues}>
                  {moodTrend.topTriggers.map((t) => t.trigger.replace(/_/g, ' ')).join(', ')}
                </Text>
              </View>
            )}
          </PremiumCard>
        )}

        {/* Sleep Trend */}
        {!loading && sleepTrend?.hasData && (
          <PremiumCard>
            <Text style={styles.cardTitle}>Sleep Trend</Text>
            <LineChart
              series={[{
                data: sleepTrend.dailyDurations.map((d) => ({
                  label: formatDateLabel(d.date),
                  value: d.hours,
                  date: d.date,
                })),
                color: '#7E57C2',
                label: 'Sleep',
              }]}
              width={chartWidth}
              height={160}
              title="Sleep"
              unit="hrs"
            />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{sleepTrend.averageDuration}h</Text>
                <Text style={styles.statLabel}>Avg Duration</Text>
              </View>
              {sleepTrend.averageQuality != null && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{sleepTrend.averageQuality}/5</Text>
                  <Text style={styles.statLabel}>Avg Quality</Text>
                </View>
              )}
            </View>
            {sleepTrend.topDisturbances.length > 0 && (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Common disturbances: </Text>
                <Text style={styles.tagValues}>
                  {sleepTrend.topDisturbances.map((d) => d.disturbance.replace(/_/g, ' ')).join(', ')}
                </Text>
              </View>
            )}
          </PremiumCard>
        )}

        {/* Exercise Trend */}
        {!loading && exerciseTrend?.hasData && (
          <PremiumCard>
            <Text style={styles.cardTitle}>Exercise Trend</Text>
            <BarChart
              data={exerciseTrend.dailyMinutes.map((d) => ({
                label: formatDateLabel(d.date),
                value: d.minutes,
                date: d.date,
              }))}
              width={chartWidth}
              height={160}
              title="Exercise"
              unit="min"
              color={Colors.success}
            />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{exerciseTrend.totalMinutes}</Text>
                <Text style={styles.statLabel}>Total Minutes</Text>
              </View>
            </View>
            {exerciseTrend.workoutTypeBreakdown.length > 0 && (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Top workouts: </Text>
                <Text style={styles.tagValues}>
                  {exerciseTrend.workoutTypeBreakdown.map((t) => t.type).join(', ')}
                </Text>
              </View>
            )}
          </PremiumCard>
        )}

        {/* Nutrition Trend */}
        {!loading && nutritionTrend?.hasData && (
          <PremiumCard>
            <Text style={styles.cardTitle}>Nutrition Trend</Text>
            <LineChart
              series={[{
                data: nutritionTrend.dailyCalories.map((d) => ({
                  label: formatDateLabel(d.date),
                  value: d.calories,
                  date: d.date,
                })),
                color: Colors.accent,
                label: 'Calories',
              }]}
              width={chartWidth}
              height={160}
              title="Calories"
              unit="cal"
            />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{nutritionTrend.averageCalories}</Text>
                <Text style={styles.statLabel}>Avg Cal/Day</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{nutritionTrend.mealsPerDayAverage}</Text>
                <Text style={styles.statLabel}>Meals/Day</Text>
              </View>
            </View>
            {nutritionTrend.topFoods.length > 0 && (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Most logged: </Text>
                <Text style={styles.tagValues}>
                  {nutritionTrend.topFoods.map((f) => f.name).join(', ')}
                </Text>
              </View>
            )}
          </PremiumCard>
        )}

        {/* Compliance Trend */}
        {!loading && complianceTrend?.hasData && (
          <PremiumCard>
            <Text style={styles.cardTitle}>Compliance Trend</Text>
            <LineChart
              series={[{
                data: complianceTrend.dailyCompliance.map((d) => ({
                  label: formatDateLabel(d.date),
                  value: d.percentage,
                  date: d.date,
                })),
                color: Colors.accent,
                label: 'Compliance',
              }]}
              width={chartWidth}
              height={160}
              title="Compliance"
              unit="%"
            />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{complianceTrend.averageCompliance}%</Text>
                <Text style={styles.statLabel}>Average</Text>
              </View>
              {complianceTrend.bestDay && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{Math.round(complianceTrend.bestDay.percentage)}%</Text>
                  <Text style={styles.statLabel}>Best Day</Text>
                </View>
              )}
              {complianceTrend.worstDay && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{Math.round(complianceTrend.worstDay.percentage)}%</Text>
                  <Text style={styles.statLabel}>Worst Day</Text>
                </View>
              )}
            </View>
          </PremiumCard>
        )}

        {/* Weight Trend (category-gated) */}
        {!loading && showWeight && weightTrend?.hasData && (
          <PremiumCard>
            <Text style={styles.cardTitle}>Weight Trend</Text>
            {weightTrend.entries.length >= 2 ? (
              <>
                <LineChart
                  series={[{
                    data: weightTrend.entries.map((d) => ({
                      label: formatDateLabel(d.date),
                      value: d.weight,
                      date: d.date,
                    })),
                    color: Colors.accent,
                    label: 'Weight',
                  }]}
                  width={chartWidth}
                  height={160}
                  title="Weight"
                  unit="lbs"
                />
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {weightTrend.netChange > 0 ? '+' : ''}{weightTrend.netChange} lbs
                    </Text>
                    <Text style={styles.statLabel}>Net Change</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {weightTrend.trendDirection === 'up' ? '\u2191' : weightTrend.trendDirection === 'down' ? '\u2193' : '\u2192'}
                    </Text>
                    <Text style={styles.statLabel}>Direction</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.insufficientData}>
                Need at least 2 weight entries to show a trend.
              </Text>
            )}
          </PremiumCard>
        )}

        {/* Correlation Insights */}
        {!loading && correlations.length > 0 && (
          <PremiumCard>
            <Text style={styles.cardTitle}>Correlation Insights</Text>
            {correlations.map((insight, idx) => (
              <View key={idx} style={styles.insightRow}>
                <Ionicons name="bulb-outline" size={18} color={Colors.accentText} />
                <View style={styles.insightTextContainer}>
                  <Text style={styles.insightDescription}>{insight.description}</Text>
                  <Text style={styles.insightMeta}>
                    r={insight.correlation.toFixed(2)} | {insight.dataPoints} data points
                  </Text>
                </View>
              </View>
            ))}
            <Text style={styles.disclaimer}>
              These patterns are based on your data. Correlation does not mean causation.
            </Text>
          </PremiumCard>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
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
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  cardTitle: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  tagLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  tagValues: {
    color: Colors.text,
    fontSize: 12,
    flex: 1,
  },
  insufficientData: {
    color: Colors.secondaryText,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  insightTextContainer: {
    flex: 1,
  },
  insightDescription: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  insightMeta: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  disclaimer: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
});
