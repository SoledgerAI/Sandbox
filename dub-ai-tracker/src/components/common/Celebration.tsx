// Celebration component with gold shimmer animation
// Phase 21: Reporting, Health Report PDF, and Celebrations
//
// Gold shimmer animation on achievement card. Subtle. NOT confetti,
// NOT fireworks, NOT party emojis. Data-driven only.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { storageGet, storageSet, dateKey, STORAGE_KEYS } from '../../utils/storage';
import { ED_EXTREME_RESTRICTION_THRESHOLD, CALORIE_FLOOR_FEMALE, CALORIE_FLOOR_MALE } from '../../constants/formulas';
import type { StreakData } from '../../types/profile';
import type { UserProfile } from '../../types/profile';
import type { DailySummary, RecoveryScore } from '../../types';
import type { FoodEntry } from '../../types/food';

// ============================================================
// Celebration Types
// ============================================================

export type CelebrationTrigger =
  | 'new_pr'
  | 'weight_milestone'
  | 'consistency_7'
  | 'consistency_14'
  | 'consistency_30'
  | 'consistency_60'
  | 'consistency_90'
  | 'consistency_180'
  | 'consistency_365'
  | 'macro_streak_7'
  | 'recovery_streak_7';

export interface CelebrationEvent {
  trigger: CelebrationTrigger;
  title: string;
  detail: string; // Brief, data-specific coach acknowledgment
  timestamp: string;
}

interface CelebrationProps {
  event: CelebrationEvent;
  onDismiss: () => void;
}

// ============================================================
// Shimmer Animation Component
// ============================================================

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function Celebration({ event, onDismiss }: CelebrationProps) {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Gold shimmer sweep animation (repeating)
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(2000), // Pause between shimmers
      ]),
    );
    shimmerLoop.start();

    return () => shimmerLoop.stop();
  }, [fadeAnim, scaleAnim, shimmerAnim]);

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[
        styles.overlay,
        { opacity: fadeAnim },
      ]}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss} />
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Gold shimmer overlay */}
        <Animated.View
          style={[
            styles.shimmer,
            { transform: [{ translateX: shimmerTranslateX }] },
          ]}
        />

        {/* Gold accent bar */}
        <View style={styles.accentBar} />

        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.detail}>{event.detail}</Text>
        </View>

        <Pressable style={styles.dismissButton} onPress={handleDismiss}>
          <Text style={styles.dismissText}>OK</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================
// Celebration Detection
// ============================================================

const CONSISTENCY_MILESTONES = [7, 14, 30, 60, 90, 180, 365] as const;

/**
 * Check for celebration-worthy events. Returns events that haven't been shown yet.
 */
export async function checkCelebrations(todayStr: string): Promise<CelebrationEvent[]> {
  const events: CelebrationEvent[] = [];
  const shownKey = `dub.celebrations.shown.${todayStr}`;
  const alreadyShown = await storageGet<string[]>(shownKey) ?? [];

  // D6-004: Suppress ALL celebrations during extreme caloric restriction
  const userProfile = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
  const todayFoodEntries = await storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, todayStr)) ?? [];

  if (todayFoodEntries.length > 0) {
    const todayCalories = todayFoodEntries.reduce(
      (sum, entry) => sum + (entry.computed_nutrition?.calories ?? 0),
      0,
    );

    // Hard stop: today under extreme restriction threshold
    if (todayCalories < ED_EXTREME_RESTRICTION_THRESHOLD) {
      return events; // empty -- suppress all celebrations
    }

    // Soft stop: rolling 7-day average below sex-based calorie floor
    const calorieFloor = userProfile?.sex === 'female'
      ? CALORIE_FLOOR_FEMALE
      : CALORIE_FLOOR_MALE; // male and prefer_not_to_say both use male floor

    const today = new Date(todayStr + 'T00:00:00');
    let totalCals = todayCalories;
    let daysWithData = 1;

    for (let i = 1; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayEntries = await storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, dStr));
      if (dayEntries && dayEntries.length > 0) {
        totalCals += dayEntries.reduce(
          (sum, entry) => sum + (entry.computed_nutrition?.calories ?? 0),
          0,
        );
        daysWithData++;
      }
    }

    if (daysWithData >= 3) {
      const rollingAvg = totalCals / daysWithData;
      if (rollingAvg < calorieFloor) {
        return events; // empty -- suppress all celebrations
      }
    }
  }

  // Check consistency milestones
  const streaks = await storageGet<StreakData>(STORAGE_KEYS.STREAKS);
  if (streaks) {
    for (const milestone of CONSISTENCY_MILESTONES) {
      if (streaks.current_streak === milestone) {
        const trigger = `consistency_${milestone}` as CelebrationTrigger;
        if (!alreadyShown.includes(trigger)) {
          events.push({
            trigger,
            title: `${milestone}-Day Streak`,
            detail: `${milestone} consecutive days logged. Your consistency is building real data for better insights.`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Check weight milestone (every 5 lbs toward goal)
  const profile = await storageGet<{ goal?: { direction: string; target_weight: number | null }; weight_lbs: number | null }>(STORAGE_KEYS.PROFILE);
  if (profile?.goal?.target_weight && profile.weight_lbs) {
    const todayBody = await storageGet<{ weight_lbs: number | null }>(dateKey(STORAGE_KEYS.LOG_BODY, todayStr));
    if (todayBody?.weight_lbs) {
      const startWeight = profile.weight_lbs;
      const currentWeight = todayBody.weight_lbs;
      const targetWeight = profile.goal.target_weight;

      // Calculate progress in 5-lb increments
      const lost = Math.abs(startWeight - currentWeight);
      const milestonesReached = Math.floor(lost / 5);

      if (milestonesReached > 0 && !alreadyShown.includes('weight_milestone')) {
        const direction = profile.goal.direction === 'LOSE' ? 'lost' : 'gained';
        events.push({
          trigger: 'weight_milestone',
          title: 'Weight Milestone',
          detail: `You've ${direction} ${milestonesReached * 5} lbs. Current: ${currentWeight} lbs. Target: ${targetWeight} lbs.`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Check macro target streak (7 consecutive days)
  await checkMacroStreak(todayStr, alreadyShown, events);

  // Check recovery score streak (above 80 for 7 days)
  await checkRecoveryStreak(todayStr, alreadyShown, events);

  // Mark events as shown
  if (events.length > 0) {
    const newShown = [...alreadyShown, ...events.map((e) => e.trigger)];
    await storageSet(shownKey, newShown);
  }

  return events;
}

async function checkMacroStreak(
  todayStr: string,
  alreadyShown: string[],
  events: CelebrationEvent[],
): Promise<void> {
  if (alreadyShown.includes('macro_streak_7')) return;

  const today = new Date(todayStr + 'T00:00:00');
  let streak = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const summary = await storageGet<DailySummary>(dateKey(STORAGE_KEYS.DAILY_SUMMARY, dateStr));

    // Consider "hitting macros" as logging food that day
    if (summary && summary.calories_consumed > 0) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 7) {
    events.push({
      trigger: 'macro_streak_7',
      title: '7-Day Macro Streak',
      detail: 'You hit your macro targets 7 days in a row. Consistency at this level drives measurable results.',
      timestamp: new Date().toISOString(),
    });
  }
}

async function checkRecoveryStreak(
  todayStr: string,
  alreadyShown: string[],
  events: CelebrationEvent[],
): Promise<void> {
  if (alreadyShown.includes('recovery_streak_7')) return;

  const today = new Date(todayStr + 'T00:00:00');
  let streak = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const recovery = await storageGet<RecoveryScore>(dateKey(STORAGE_KEYS.RECOVERY, dateStr));

    if (recovery && recovery.total_score >= 80) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 7) {
    events.push({
      trigger: 'recovery_streak_7',
      title: '7-Day Recovery Streak',
      detail: 'Recovery score above 80 for 7 consecutive days. Your sleep, HRV, and training load are well-balanced.',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create a celebration event for a new personal record.
 * Called from strength logging when a PR is detected.
 */
export function createPRCelebration(
  exercise: string,
  weight: number,
  reps: number,
  previousBest: string,
): CelebrationEvent {
  return {
    trigger: 'new_pr',
    title: `New PR: ${exercise}`,
    detail: `${weight} lbs x ${reps}. ${previousBest}`,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'transparent',
    // Gold shimmer gradient approximation using shadow
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 0,
    opacity: 0.6,
  },
  accentBar: {
    height: 4,
    backgroundColor: Colors.accent,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.accentText,
    textAlign: 'center',
    marginBottom: 12,
  },
  detail: {
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  dismissButton: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accentText,
  },
});
