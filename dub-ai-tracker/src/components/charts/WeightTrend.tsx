// Weight trend line chart with 7-day moving average
// Phase 9: Body Metrics and Weight Tracking

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Polyline,
  Circle as SvgCircle,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { LBS_PER_KG } from '../../constants/formulas';
import {
  storageGet,
  storageList,
  STORAGE_KEYS,
} from '../../utils/storage';
import type { BodyEntry } from '../../types';
import type { UserProfile } from '../../types/profile';

interface WeightDataPoint {
  date: string;
  weight: number; // in display units
}

function computeMovingAverage(data: number[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      sum += data[j];
    }
    return sum / window;
  });
}

interface WeightTrendProps {
  width?: number;
  height?: number;
}

export function WeightTrend({ width = 340, height = 200 }: WeightTrendProps) {
  const [dataPoints, setDataPoints] = useState<WeightDataPoint[]>([]);
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');

  const loadData = useCallback(async () => {
    const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
    const unitPref = profile?.units ?? 'imperial';
    setUnits(unitPref);

    const keys = await storageList(STORAGE_KEYS.LOG_BODY + '.');
    const points: WeightDataPoint[] = [];

    for (const key of keys.sort()) {
      const entry = await storageGet<BodyEntry>(key);
      if (entry?.weight_lbs != null) {
        const date = key.replace(STORAGE_KEYS.LOG_BODY + '.', '');
        const weight =
          unitPref === 'metric'
            ? entry.weight_lbs / LBS_PER_KG
            : entry.weight_lbs;
        points.push({ date, weight });
      }
    }

    // Keep last 30 data points max
    setDataPoints(points.slice(-30));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unitLabel = units === 'metric' ? 'kg' : 'lbs';

  if (dataPoints.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.emptyText}>No weight data yet</Text>
      </View>
    );
  }

  const weights = dataPoints.map((d) => d.weight);
  const movingAvg = computeMovingAverage(weights, 7);

  const allValues = [
    ...weights,
    ...movingAvg.filter((v): v is number => v != null),
  ];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const padding = { top: 24, bottom: 28, left: 44, right: 12 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const toX = (i: number) =>
    padding.left + (i / Math.max(dataPoints.length - 1, 1)) * chartW;
  const toY = (val: number) =>
    padding.top + chartH - ((val - minVal) / range) * chartH;

  // Raw weight points
  const rawPoints = weights.map((w, i) => `${toX(i)},${toY(w)}`).join(' ');

  // Moving average line (skip nulls)
  const avgPoints = movingAvg
    .map((v, i) => (v != null ? `${toX(i)},${toY(v)}` : null))
    .filter(Boolean)
    .join(' ');

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minVal + (range * i) / 4;
    return { val, y: toY(val) };
  });

  // X-axis labels (first, middle, last)
  const xLabels: { label: string; x: number }[] = [];
  if (dataPoints.length >= 1) {
    xLabels.push({ label: shortDate(dataPoints[0].date), x: toX(0) });
  }
  if (dataPoints.length >= 3) {
    const mid = Math.floor(dataPoints.length / 2);
    xLabels.push({ label: shortDate(dataPoints[mid].date), x: toX(mid) });
  }
  if (dataPoints.length >= 2) {
    xLabels.push({
      label: shortDate(dataPoints[dataPoints.length - 1].date),
      x: toX(dataPoints.length - 1),
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.secondaryText }]} />
          <Text style={styles.legendText}>Weight</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
          <Text style={styles.legendText}>7-Day Avg</Text>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Weight trend chart. Current: ${weights[weights.length - 1].toFixed(1)} ${unitLabel}. ${movingAvg[movingAvg.length - 1] != null ? `7-day average: ${movingAvg[movingAvg.length - 1]!.toFixed(1)} ${unitLabel}.` : ''} ${dataPoints.length} data points.`}
      >
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <Line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke={Colors.divider}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`y-${i}`}
            x={padding.left - 6}
            y={tick.y + 4}
            fill={Colors.secondaryText}
            fontSize={10}
            textAnchor="end"
          >
            {tick.val.toFixed(0)}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {xLabels.map((xl, i) => (
          <SvgText
            key={`x-${i}`}
            x={xl.x}
            y={height - 6}
            fill={Colors.secondaryText}
            fontSize={10}
            textAnchor="middle"
          >
            {xl.label}
          </SvgText>
        ))}

        {/* Raw weight line */}
        <Polyline
          points={rawPoints}
          fill="none"
          stroke={Colors.secondaryText}
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.5}
        />

        {/* Raw weight dots */}
        {weights.map((w, i) => (
          <SvgCircle
            key={`dot-${i}`}
            cx={toX(i)}
            cy={toY(w)}
            r={2.5}
            fill={Colors.secondaryText}
            opacity={0.6}
          />
        ))}

        {/* 7-day moving average line */}
        {avgPoints.length > 0 && (
          <Polyline
            points={avgPoints}
            fill="none"
            stroke={Colors.accent}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </Svg>
      </View>

      {/* Current stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {weights[weights.length - 1].toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>Current ({unitLabel})</Text>
        </View>
        {movingAvg[movingAvg.length - 1] != null && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {movingAvg[movingAvg.length - 1]!.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>7-Day Avg ({unitLabel})</Text>
          </View>
        )}
        {dataPoints.length >= 2 && (
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    weights[weights.length - 1] < weights[0]
                      ? Colors.successText
                      : weights[weights.length - 1] > weights[0]
                        ? Colors.danger
                        : Colors.text,
                },
              ]}
            >
              {(weights[weights.length - 1] - weights[0] > 0 ? '+' : '')}
              {(weights[weights.length - 1] - weights[0]).toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>Change ({unitLabel})</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function shortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 40,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
});
