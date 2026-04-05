// Dashboard recovery gauge card
// Phase 12: Recovery Score v1.0

import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [showMethodology, setShowMethodology] = useState(false);

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

          <Pressable
            style={styles.methodologyToggle}
            onPress={() => setShowMethodology(!showMethodology)}
            accessibilityRole="button"
            accessibilityLabel={showMethodology ? 'Hide methodology' : 'How recovery score works'}
          >
            <Ionicons name="information-circle-outline" size={14} color={Colors.accentText} />
            <Text style={styles.methodologyToggleText}>
              {showMethodology ? 'Hide' : 'How is this calculated?'}
            </Text>
          </Pressable>

          {showMethodology && (
            <View style={styles.methodologyBox}>
              <Text style={styles.methodologyTitle}>How Recovery Score Works</Text>
              <Text style={styles.methodologyText}>
                Your Recovery Score (0–100) estimates readiness based on six factors:
              </Text>
              <Text style={styles.methodologyText}>{'\u2022'} HRV trend — compared to your personal 7-day average</Text>
              <Text style={styles.methodologyText}>{'\u2022'} Resting heart rate — compared to your personal 7-day average</Text>
              <Text style={styles.methodologyText}>{'\u2022'} Sleep duration — based on 7–9 hours as optimal</Text>
              <Text style={styles.methodologyText}>{'\u2022'} Sleep quality — your self-reported rating</Text>
              <Text style={styles.methodologyText}>{'\u2022'} Training load — recent workout intensity</Text>
              <Text style={styles.methodologyText}>{'\u2022'} Alcohol impact — based on reported consumption</Text>
              <Text style={[styles.methodologyText, { marginTop: 8 }]}>
                Higher scores suggest greater readiness for intense training. This score uses your personal baselines, not population averages.
              </Text>
              <Text style={[styles.methodologyText, { marginTop: 4, fontStyle: 'italic' }]}>
                Methodology: DUB_AI Recovery Model v1.0
              </Text>
            </View>
          )}
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
  methodologyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  methodologyToggleText: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '500',
  },
  methodologyBox: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  methodologyTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  methodologyText: {
    color: Colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
  },
});
