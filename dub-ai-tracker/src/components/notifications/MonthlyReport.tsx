// Monthly Report display component
// Phase 21: Reporting, Health Report PDF, and Celebrations

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import type { MonthlySummary } from '../../services/reporting';
import { storageGet, dateKey, STORAGE_KEYS } from '../../utils/storage';

interface MonthlyReportProps {
  monthStr: string; // YYYY-MM format
}

export default function MonthlyReport({ monthStr }: MonthlyReportProps) {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const key = dateKey(STORAGE_KEYS.MONTHLY_SUMMARY, monthStr);
      const data = await storageGet<MonthlySummary>(key);
      setSummary(data);

      // Load previous month for comparison
      const [yearStr, monStr] = monthStr.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monStr, 10);
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevKey = dateKey(
        STORAGE_KEYS.MONTHLY_SUMMARY,
        `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
      );
      const prevData = await storageGet<MonthlySummary>(prevKey);
      setPrevSummary(prevData);

      setLoading(false);
    }
    load();
  }, [monthStr]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.container}>
        <Text style={styles.noData}>No monthly report available for this period.</Text>
      </View>
    );
  }

  const monthName = new Date(`${monthStr}-01T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  const adherenceColor =
    summary.adherence_pct >= 80 ? Colors.success :
    summary.adherence_pct >= 50 ? Colors.warning :
    Colors.danger;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Report</Text>
        <Text style={styles.subtitle}>{monthName}</Text>
      </View>

      {/* Adherence */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Adherence</Text>
        <View style={styles.row}>
          <Text style={[styles.bigValue, { color: adherenceColor }]}>
            {summary.adherence_pct}%
          </Text>
          <Text style={styles.label}>
            {summary.days_logged} days logged
          </Text>
        </View>
        {prevSummary && (
          <ComparisonBadge
            current={summary.adherence_pct}
            previous={prevSummary.adherence_pct}
            unit="%"
            higherIsBetter
          />
        )}
      </View>

      {/* Nutrition */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nutrition (Daily Avg)</Text>
        <ComparisonRow
          label="Calories"
          current={summary.avg_calories_consumed}
          previous={prevSummary?.avg_calories_consumed ?? null}
          unit="kcal"
        />
        <ComparisonRow
          label="Protein"
          current={summary.avg_protein_g}
          previous={prevSummary?.avg_protein_g ?? null}
          unit="g"
        />
        <ComparisonRow
          label="Carbs"
          current={summary.avg_carbs_g}
          previous={prevSummary?.avg_carbs_g ?? null}
          unit="g"
        />
        <ComparisonRow
          label="Fat"
          current={summary.avg_fat_g}
          previous={prevSummary?.avg_fat_g ?? null}
          unit="g"
        />
        <ComparisonRow
          label="Water"
          current={summary.avg_water_oz}
          previous={prevSummary?.avg_water_oz ?? null}
          unit="oz"
        />
      </View>

      {/* Weight */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight</Text>
        {summary.start_weight !== null && (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Start</Text>
            <Text style={styles.metricValue}>{summary.start_weight} lbs</Text>
          </View>
        )}
        {summary.end_weight !== null && (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>End</Text>
            <Text style={styles.metricValue}>{summary.end_weight} lbs</Text>
          </View>
        )}
        {summary.weight_change !== null && (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Change</Text>
            <Text style={styles.metricValue}>
              {summary.weight_change > 0 ? '+' : ''}{summary.weight_change} lbs
            </Text>
          </View>
        )}
      </View>

      {/* Activity */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Activity</Text>
        <ComparisonRow
          label="Workouts"
          current={summary.workout_count}
          previous={prevSummary?.workout_count ?? null}
          unit="sessions"
        />
        <ComparisonRow
          label="Burned (avg/day)"
          current={summary.avg_calories_burned}
          previous={prevSummary?.avg_calories_burned ?? null}
          unit="kcal"
        />
      </View>

      {/* Sleep */}
      {summary.avg_sleep_hours !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sleep</Text>
          <ComparisonRow
            label="Avg Duration"
            current={summary.avg_sleep_hours}
            previous={prevSummary?.avg_sleep_hours ?? null}
            unit="hrs"
          />
        </View>
      )}

      {/* Recovery */}
      {summary.avg_recovery !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recovery</Text>
          <ComparisonRow
            label="Avg Score"
            current={summary.avg_recovery}
            previous={prevSummary?.avg_recovery ?? null}
            unit="/ 100"
          />
        </View>
      )}

      {/* Mood (summary stats only) */}
      {summary.avg_mood !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mood</Text>
          <ComparisonRow
            label="Average"
            current={summary.avg_mood}
            previous={prevSummary?.avg_mood ?? null}
            unit="/ 5"
          />
        </View>
      )}

      {/* PRs */}
      {summary.pr_count > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Records</Text>
          <Text style={styles.prValue}>{summary.pr_count} new PRs this month</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ============================================================
// Comparison Sub-components
// ============================================================

function ComparisonRow({
  label,
  current,
  previous,
  unit,
}: {
  label: string;
  current: number;
  previous: number | null;
  unit: string;
}) {
  const diff = previous !== null ? current - previous : null;

  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricRight}>
        <Text style={styles.metricValue}>
          {current} {unit}
        </Text>
        {diff !== null && diff !== 0 && (
          <Text style={[styles.diffText, { color: Colors.secondaryText }]}>
            {diff > 0 ? '+' : ''}{Math.round(diff * 10) / 10} vs prev
          </Text>
        )}
      </View>
    </View>
  );
}

function ComparisonBadge({
  current,
  previous,
  unit,
  higherIsBetter,
}: {
  current: number;
  previous: number;
  unit: string;
  higherIsBetter: boolean;
}) {
  const diff = current - previous;
  if (diff === 0) return null;

  const isPositive = higherIsBetter ? diff > 0 : diff < 0;
  const color = isPositive ? Colors.successText : Colors.danger;

  return (
    <Text style={[styles.comparisonBadge, { color }]}>
      {diff > 0 ? '+' : ''}{diff}{unit} vs last month
    </Text>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.secondaryText,
    marginTop: 4,
  },
  noData: {
    fontSize: 16,
    color: Colors.secondaryText,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accentText,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  bigValue: {
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 14,
    color: Colors.secondaryText,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  metricLabel: {
    fontSize: 14,
    color: Colors.secondaryText,
  },
  metricRight: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  diffText: {
    fontSize: 11,
    marginTop: 2,
  },
  comparisonBadge: {
    fontSize: 12,
    marginTop: 8,
  },
  prValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accentText,
  },
});
