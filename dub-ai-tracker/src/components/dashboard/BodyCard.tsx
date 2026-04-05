// Dashboard body card -- weight trend with 7-day average
// Phase 9: Body Metrics and Weight Tracking
// Redesign: P1 plain-language weight display

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { DashboardCard } from './DashboardCard';
import { SparkLine } from '../charts/SparkLine';
import { LBS_PER_KG } from '../../constants/formulas';
import {
  storageGet,
  storageList,
  STORAGE_KEYS,
} from '../../utils/storage';
import type { BodyEntry } from '../../types';
import type { UserProfile } from '../../types/profile';

/** Threshold (in display units) above which daily fluctuation triggers context note */
const FLUCTUATION_THRESHOLD = 1.5;

/** Minimum data points in the last 7 days to show a rolling average */
const MIN_POINTS_FOR_AVERAGE = 3;

export function BodyCard() {
  const [sevenDayAvg, setSevenDayAvg] = useState<number | null>(null);
  const [todayWeight, setTodayWeight] = useState<number | null>(null);
  const [dailyDelta, setDailyDelta] = useState<number | null>(null);
  const [sparkData, setSparkData] = useState<number[]>([]);
  const [pointsInWindow, setPointsInWindow] = useState(0);
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');

  const loadData = useCallback(async () => {
    const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
    const unitPref = profile?.units ?? 'imperial';
    setUnits(unitPref);

    const keys = await storageList(STORAGE_KEYS.LOG_BODY + '.');
    const allWeights: number[] = [];

    for (const key of keys.sort()) {
      const entry = await storageGet<BodyEntry>(key);
      if (entry?.weight_lbs != null) {
        const weight =
          unitPref === 'metric'
            ? entry.weight_lbs / LBS_PER_KG
            : entry.weight_lbs;
        allWeights.push(weight);
      }
    }

    if (allWeights.length === 0) {
      setTodayWeight(null);
      setSevenDayAvg(null);
      setDailyDelta(null);
      setSparkData([]);
      setPointsInWindow(0);
      return;
    }

    // Last 14 data points for sparkline
    const last14 = allWeights.slice(-14);
    setSparkData(last14);

    // Today's weight is most recent entry
    const current = allWeights[allWeights.length - 1];
    setTodayWeight(current);

    // 7-day window: last 7 data points
    const last7 = allWeights.slice(-7);
    setPointsInWindow(Math.min(last7.length, 7));

    // Compute 7-day rolling average (only if >= MIN_POINTS_FOR_AVERAGE)
    if (last7.length >= MIN_POINTS_FOR_AVERAGE) {
      const avg = last7.reduce((a, b) => a + b, 0) / last7.length;
      setSevenDayAvg(avg);
    } else {
      setSevenDayAvg(null);
    }

    // Daily delta: difference between last two entries
    if (allWeights.length >= 2) {
      const prev = allWeights[allWeights.length - 2];
      setDailyDelta(current - prev);
    } else {
      setDailyDelta(null);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unitLabel = units === 'metric' ? 'kg' : 'lbs';
  const fluctuationThreshold =
    units === 'metric' ? FLUCTUATION_THRESHOLD / LBS_PER_KG : FLUCTUATION_THRESHOLD;

  // Show context note when daily swing exceeds threshold
  const showFluctuationNote =
    dailyDelta != null && Math.abs(dailyDelta) > fluctuationThreshold;

  // No data at all
  if (todayWeight == null) {
    return (
      <DashboardCard title="Body">
        <Text style={styles.emptyText}>No weight data logged yet</Text>
      </DashboardCard>
    );
  }

  // Not enough data for average
  const needsMoreData = pointsInWindow < MIN_POINTS_FOR_AVERAGE;

  // Neutral arrow direction (never red/green)
  const deltaIcon: 'arrow-up' | 'arrow-down' | 'remove-outline' =
    dailyDelta != null && dailyDelta > 0.05
      ? 'arrow-up'
      : dailyDelta != null && dailyDelta < -0.05
        ? 'arrow-down'
        : 'remove-outline';

  return (
    <DashboardCard title="Body">
      {/* PRIMARY: 7-day rolling average or "needs more data" prompt */}
      {needsMoreData ? (
        <Text style={styles.needsDataText}>
          Log 3+ weights this week to see your trend
        </Text>
      ) : (
        <View style={styles.averageSection}>
          <Text style={styles.averageLabel}>7-Day Average</Text>
          <View style={styles.averageRow}>
            <Text style={styles.averageValue}>
              {sevenDayAvg!.toFixed(1)}
            </Text>
            <Text style={styles.averageUnit}>{unitLabel}</Text>
          </View>
        </View>
      )}

      {/* SECONDARY + TERTIARY: today's weight and sparkline */}
      <View style={styles.row}>
        <View style={styles.todaySection}>
          <Text style={styles.todayLabel}>Today</Text>
          <View style={styles.todayRow}>
            <Text style={styles.todayValue}>
              {todayWeight.toFixed(1)}
            </Text>
            <Text style={styles.todayUnit}>{unitLabel}</Text>
            {dailyDelta != null && (
              <View style={styles.deltaRow}>
                <Ionicons
                  name={deltaIcon}
                  size={12}
                  color={Colors.secondaryText}
                />
                <Text style={styles.deltaText}>
                  {Math.abs(dailyDelta).toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        </View>
        <SparkLine
          data={sparkData}
          width={100}
          height={36}
          color={Colors.accent}
        />
      </View>

      {/* CONTEXT NOTE: auto-show on large daily fluctuation */}
      {showFluctuationNote && (
        <Text style={styles.contextNote}>
          Daily weight varies 1–3 lbs from hydration and sodium.{'\n'}
          The 7-day average shows your real trend.
        </Text>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  averageSection: {
    marginBottom: 12,
  },
  averageLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  averageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  averageValue: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  averageUnit: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todaySection: {
    flex: 1,
  },
  todayLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '500',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  todayValue: {
    color: Colors.secondaryText,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  todayUnit: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
  },
  deltaText: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  needsDataText: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  contextNote: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    lineHeight: 16,
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
});
