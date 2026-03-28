// Weekly Report display component
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
import type { WeeklySummary } from '../../types';
import { storageGet, dateKey, STORAGE_KEYS } from '../../utils/storage';

interface WeeklyReportProps {
  weekStr: string; // YYYY-WW format
}

export default function WeeklyReport({ weekStr }: WeeklyReportProps) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const key = dateKey(STORAGE_KEYS.WEEKLY_SUMMARY, weekStr);
      const data = await storageGet<WeeklySummary>(key);
      setSummary(data);
      setLoading(false);
    }
    load();
  }, [weekStr]);

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
        <Text style={styles.noData}>No weekly report available for this period.</Text>
      </View>
    );
  }

  const adherenceColor =
    summary.adherence_pct >= 80 ? Colors.success :
    summary.adherence_pct >= 50 ? Colors.warning :
    Colors.danger;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Report</Text>
        <Text style={styles.subtitle}>
          {summary.start_date} to {summary.end_date}
        </Text>
      </View>

      {/* Adherence */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Adherence</Text>
        <View style={styles.adherenceRow}>
          <Text style={[styles.adherenceValue, { color: adherenceColor }]}>
            {summary.adherence_pct}%
          </Text>
          <Text style={styles.adherenceLabel}>
            {summary.days_logged} of 7 days logged
          </Text>
        </View>
      </View>

      {/* Nutrition Averages */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nutrition (Daily Avg)</Text>
        <View style={styles.metricsGrid}>
          <MetricItem label="Calories" value={`${summary.avg_calories_consumed}`} unit="kcal" />
          <MetricItem label="Protein" value={`${summary.avg_protein_g}`} unit="g" />
          <MetricItem label="Carbs" value={`${summary.avg_carbs_g}`} unit="g" />
          <MetricItem label="Fat" value={`${summary.avg_fat_g}`} unit="g" />
          <MetricItem label="Water" value={`${summary.avg_water_oz}`} unit="oz" />
        </View>
      </View>

      {/* Weight */}
      {(summary.avg_weight !== null || summary.weight_change !== null) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weight</Text>
          <View style={styles.metricsGrid}>
            {summary.avg_weight !== null && (
              <MetricItem label="Average" value={`${summary.avg_weight}`} unit="lbs" />
            )}
            {summary.weight_change !== null && (
              <MetricItem
                label="Change"
                value={`${summary.weight_change > 0 ? '+' : ''}${summary.weight_change}`}
                unit="lbs"
                valueColor={summary.weight_change === 0 ? Colors.text : undefined}
              />
            )}
          </View>
        </View>
      )}

      {/* Activity */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Activity</Text>
        <View style={styles.metricsGrid}>
          <MetricItem label="Workouts" value={`${summary.workout_count}`} unit="sessions" />
          <MetricItem
            label="Burned"
            value={`${summary.avg_calories_burned}`}
            unit="kcal/day"
          />
        </View>
      </View>

      {/* Sleep */}
      {summary.avg_sleep_hours !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sleep</Text>
          <MetricItem label="Average" value={`${summary.avg_sleep_hours}`} unit="hrs/night" />
        </View>
      )}

      {/* Mood (summary only, not raw entries) */}
      {summary.avg_mood !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mood</Text>
          <MetricItem label="Average" value={`${summary.avg_mood}`} unit="/ 5" />
        </View>
      )}
    </ScrollView>
  );
}

// ============================================================
// Metric Item Sub-component
// ============================================================

function MetricItem({
  label,
  value,
  unit,
  valueColor,
}: {
  label: string;
  value: string;
  unit: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueColor ? { color: valueColor } : null]}>
        {value}
        <Text style={styles.metricUnit}> {unit}</Text>
      </Text>
    </View>
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
    fontSize: 14,
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
    color: Colors.accent,
    marginBottom: 12,
  },
  adherenceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  adherenceValue: {
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  adherenceLabel: {
    fontSize: 14,
    color: Colors.secondaryText,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricItem: {
    minWidth: 80,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.secondaryText,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.secondaryText,
  },
});
