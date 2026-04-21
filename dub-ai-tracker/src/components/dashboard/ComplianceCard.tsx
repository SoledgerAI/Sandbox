// Sprint 18: Daily Compliance Scorecard — Dashboard Card
// Shows compliance percentage with expandable goal breakdown.
// TF-08: Three presentation states to avoid negative feedback on day one:
//   - empty  (nothing logged today)         → encouraging CTA, no ring/%
//   - building (<3 total days of logging)   → muted indicators, warm copy
//   - full   (3+ total days)                → color-coded current behavior

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import { hapticLight } from '../../utils/haptics';
import { refreshCompliance } from '../../services/complianceEngine';
import { todayDateString } from '../../utils/dayBoundary';
import type { ComplianceResult } from '../../types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 80;
const RING_STROKE = 7;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// TF-08: days of logging history below which we show the "building" state.
const BUILDING_ROUTINE_THRESHOLD = 3;

interface ComplianceCardProps {
  /** Total unique days the user has logged anything, used to gate colored
   *  indicators off during the first few days of use. */
  totalDaysLogged?: number;
}

export function ComplianceCard({ totalDaysLogged = 0 }: ComplianceCardProps) {
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  const progress = useSharedValue(0);

  const loadCompliance = useCallback(async () => {
    const today = todayDateString();
    const compliance = await refreshCompliance(today);
    setResult(compliance);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCompliance();
    }, [loadCompliance]),
  );

  useEffect(() => {
    if (result) {
      progress.value = withTiming(result.percentage / 100, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [result, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - progress.value),
  }));

  if (!result || result.total === 0) return null;

  const hasActivityToday = result.completed > 0;
  const isBuildingRoutine = totalDaysLogged < BUILDING_ROUTINE_THRESHOLD;

  // TF-08 (A): Empty today — show a compassionate CTA instead of 0%.
  if (!hasActivityToday) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          hapticLight();
          router.push('/(tabs)/log');
        }}
        accessibilityRole="button"
        accessibilityLabel="Start your day — log your first entry"
      >
        <PremiumCard>
          <View style={styles.emptyTopRow}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="sunny-outline" size={22} color={Colors.accentText} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>Start Your Day</Text>
              <Text style={styles.subtitle}>
                Log your first entry to start tracking daily goals.
              </Text>
            </View>
          </View>
          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>Log Something</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.accentText} />
          </View>
        </PremiumCard>
      </TouchableOpacity>
    );
  }

  const pct = Math.round(result.percentage);

  // TF-08 (B+C): Color choice — muted during first 3 days, graded afterwards.
  const ringColor = isBuildingRoutine
    ? Colors.accent
    : pct >= 80 ? Colors.accent : pct >= 50 ? Colors.warning : Colors.danger;
  const textColor = isBuildingRoutine
    ? Colors.accentText
    : pct >= 80 ? Colors.accentText : pct >= 50 ? Colors.warning : Colors.dangerText;
  const missedIconColor = isBuildingRoutine ? Colors.secondaryText : Colors.danger;
  const missedIconName: 'ellipse-outline' | 'close-circle' = isBuildingRoutine
    ? 'ellipse-outline'
    : 'close-circle';

  const title = isBuildingRoutine ? 'Building Your Routine' : 'Daily Compliance';
  const subtitle = isBuildingRoutine
    ? `You've completed ${result.completed} of ${result.total} goals today. Keep going!`
    : `${result.completed} of ${result.total} daily goals`;

  const handlePress = () => {
    hapticLight();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
      <PremiumCard>
        <View style={styles.topRow}>
          {/* Progress Ring */}
          <View style={styles.ringContainer}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={Colors.divider}
                strokeWidth={RING_STROKE}
                fill="transparent"
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={ringColor}
                strokeWidth={RING_STROKE}
                fill="transparent"
                strokeDasharray={RING_CIRCUMFERENCE}
                animatedProps={animatedProps}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringLabel}>
              <Text style={[styles.pctText, { color: textColor }]}>{pct}%</Text>
            </View>
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {!expanded && result.items.some((i) => !i.completed) && (
              <Text style={styles.missedHint}>Tap to see details</Text>
            )}
          </View>

          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.secondaryText}
          />
        </View>

        {/* Expanded: goal breakdown */}
        {expanded && (
          <View style={styles.breakdown}>
            <View style={styles.divider} />
            {result.items.map((item) => (
              <View key={item.id} style={styles.goalRow}>
                <Ionicons
                  name={item.completed ? 'checkmark-circle' : missedIconName}
                  size={18}
                  color={item.completed ? Colors.success : missedIconColor}
                />
                <Text
                  style={[
                    styles.goalLabel,
                    !item.completed && styles.goalLabelMissed,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.detail && (
                  <Text style={styles.goalDetail}>{item.detail}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </PremiumCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: RING_SIZE,
    height: RING_SIZE,
  },
  pctText: {
    fontSize: 20,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  missedHint: {
    color: Colors.accentText,
    fontSize: 11,
    marginTop: 4,
  },
  breakdown: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: 8,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 8,
  },
  goalLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
  },
  goalLabelMissed: {
    color: Colors.secondaryText,
  },
  goalDetail: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  // TF-08 empty state
  emptyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 6,
  },
  ctaText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
});
