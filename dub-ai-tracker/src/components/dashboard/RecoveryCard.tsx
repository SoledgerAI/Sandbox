// Dashboard recovery gauge card
// Phase 12: Recovery Score v1.0

import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { DashboardCard } from './DashboardCard';
import { useRecovery } from '../../hooks/useRecovery';
import type { RecoveryScoreComponent } from '../../types';

function getTodayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return Colors.success;
  if (score >= 50) return Colors.warning;
  return Colors.danger;
}

function CircularGauge({ score, color }: { score: number; color: string }) {
  // Simple text-based gauge representation
  return (
    <View style={styles.gaugeContainer}>
      <View style={[styles.gaugeRing, { borderColor: color }]}>
        <Text style={[styles.gaugeScore, { color }]}>{score}</Text>
        <Text style={styles.gaugeLabel}>/ 100</Text>
      </View>
    </View>
  );
}

function ComponentRow({ component }: { component: RecoveryScoreComponent }) {
  const barWidth = component.has_data ? `${Math.max(component.raw_score, 2)}%` as const : '0%' as const;
  const barColor = component.has_data ? scoreColor(component.raw_score) : Colors.divider;

  return (
    <View style={styles.componentRow}>
      <View style={styles.componentLabelRow}>
        <Text style={styles.componentName}>{component.name}</Text>
        <Text style={styles.componentScore}>
          {component.has_data ? component.raw_score : '--'}
        </Text>
      </View>
      <View style={styles.componentBarBg}>
        <View
          style={[
            styles.componentBarFill,
            { width: barWidth, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

export function RecoveryCard() {
  const today = getTodayKey();
  const { recovery, loading } = useRecovery(today);
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <DashboardCard title="Recovery">
        <Text style={styles.loadingText}>Computing...</Text>
      </DashboardCard>
    );
  }

  if (recovery == null || !recovery.sufficient_data) {
    return (
      <DashboardCard title="Recovery">
        <Text style={styles.insufficientText}>
          Insufficient Data
        </Text>
        <Text style={styles.insufficientHint}>
          Log sleep, body metrics, and workouts to see your recovery score
        </Text>
      </DashboardCard>
    );
  }

  const color = scoreColor(recovery.total_score);

  return (
    <DashboardCard title="Recovery">
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.mainRow}>
          <CircularGauge score={recovery.total_score} color={color} />
          <View style={styles.summarySection}>
            <Text style={[styles.statusText, { color }]}>
              {recovery.total_score >= 80
                ? 'Recovered'
                : recovery.total_score >= 50
                  ? 'Moderate'
                  : 'Low Recovery'}
            </Text>
            <Text style={styles.tapHint}>
              {expanded ? 'Tap to collapse' : 'Tap for breakdown'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.breakdown}>
          <View style={styles.breakdownDivider} />
          {recovery.components.map((c) => (
            <ComponentRow key={c.name} component={c} />
          ))}
        </View>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  insufficientText: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  insufficientHint: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontSize: 24,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  gaugeLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: -2,
  },
  summarySection: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  tapHint: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 4,
  },
  breakdown: {
    marginTop: 8,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: 12,
  },
  componentRow: {
    marginBottom: 8,
  },
  componentLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  componentName: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  componentScore: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  componentBarBg: {
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    overflow: 'hidden',
  },
  componentBarFill: {
    height: 4,
    borderRadius: 2,
  },
});
