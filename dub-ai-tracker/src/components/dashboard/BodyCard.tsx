// Dashboard body card -- current weight and trend direction
// Phase 9: Body Metrics and Weight Tracking

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { DashboardCard } from './DashboardCard';
import { SparkLine } from '../charts/SparkLine';
import { LBS_PER_KG } from '../../constants/formulas';
import { WEIGHT_PROJECTION_DISCLAIMER } from '../../utils/calories';
import {
  storageGet,
  storageList,
  STORAGE_KEYS,
} from '../../utils/storage';
import type { BodyEntry } from '../../types';
import type { UserProfile } from '../../types/profile';

interface WeightPoint {
  weight: number;
}

export function BodyCard() {
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [trendDirection, setTrendDirection] = useState<'up' | 'down' | 'stable'>('stable');
  const [sparkData, setSparkData] = useState<number[]>([]);
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');

  const loadData = useCallback(async () => {
    const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
    const unitPref = profile?.units ?? 'imperial';
    setUnits(unitPref);

    const keys = await storageList(STORAGE_KEYS.LOG_BODY + '.');
    const points: WeightPoint[] = [];

    for (const key of keys.sort()) {
      const entry = await storageGet<BodyEntry>(key);
      if (entry?.weight_lbs != null) {
        const weight =
          unitPref === 'metric'
            ? entry.weight_lbs / LBS_PER_KG
            : entry.weight_lbs;
        points.push({ weight });
      }
    }

    if (points.length === 0) {
      setCurrentWeight(null);
      setSparkData([]);
      return;
    }

    const last7 = points.slice(-7).map((p) => p.weight);
    setSparkData(last7);
    setCurrentWeight(points[points.length - 1].weight);

    // Determine trend from last 3+ days
    if (points.length >= 3) {
      const recent = points.slice(-3).map((p) => p.weight);
      const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
      const first = recent[0];
      const diff = avgRecent - first;
      if (diff > 0.5) setTrendDirection('up');
      else if (diff < -0.5) setTrendDirection('down');
      else setTrendDirection('stable');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unitLabel = units === 'metric' ? 'kg' : 'lbs';

  const trendIcon =
    trendDirection === 'up'
      ? 'trending-up'
      : trendDirection === 'down'
        ? 'trending-down'
        : 'remove-outline';

  const trendColor =
    trendDirection === 'up'
      ? Colors.danger
      : trendDirection === 'down'
        ? Colors.success
        : Colors.secondaryText;

  if (currentWeight == null) {
    return (
      <DashboardCard title="Body">
        <Text style={styles.emptyText}>No weight data logged yet</Text>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Body">
      <View style={styles.row}>
        <View style={styles.weightSection}>
          <View style={styles.weightRow}>
            <Text style={styles.weightValue}>
              {currentWeight.toFixed(1)}
            </Text>
            <Text style={styles.weightUnit}>{unitLabel}</Text>
          </View>
          <View style={styles.trendRow}>
            <Ionicons name={trendIcon as any} size={16} color={trendColor} />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {trendDirection === 'up'
                ? 'Trending up'
                : trendDirection === 'down'
                  ? 'Trending down'
                  : 'Stable'}
            </Text>
          </View>
        </View>
        <SparkLine
          data={sparkData}
          width={90}
          height={36}
          color={trendColor}
        />
      </View>
      <Text style={styles.disclaimer}>{WEIGHT_PROJECTION_DISCLAIMER}</Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightSection: {
    flex: 1,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  weightValue: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  weightUnit: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  disclaimer: {
    color: Colors.secondaryText,
    fontSize: 10,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 14,
  },
});
