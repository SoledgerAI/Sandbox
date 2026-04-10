// Sprint 18: Daily Compliance Scorecard — Dashboard Card
// Shows compliance percentage with expandable goal breakdown

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
import { useFocusEffect } from 'expo-router';
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

export function ComplianceCard() {
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

  const pct = Math.round(result.percentage);
  const ringColor = pct >= 80 ? Colors.accent : pct >= 50 ? Colors.warning : Colors.danger;
  const textColor = pct >= 80 ? Colors.accentText : pct >= 50 ? Colors.warning : Colors.dangerText;

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
            <Text style={styles.cardTitle}>Daily Compliance</Text>
            <Text style={styles.subtitle}>
              {result.completed} of {result.total} daily goals
            </Text>
            {!expanded && result.items.some((i) => !i.completed) && (
              <Text style={styles.missedHint}>
                Tap to see details
              </Text>
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
                  name={item.completed ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={item.completed ? Colors.success : Colors.danger}
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
});
