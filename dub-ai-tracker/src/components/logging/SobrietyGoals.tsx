// Sobriety/abstinence goal management UI
// Phase 8: Hydration, Caffeine, and Substance Logging
// Tone: Zero judgment. Factual. Supportive without patronizing.

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import type { SobrietyGoal, SobrietyGoalType } from '../../types/profile';
import { todayDateString } from '../../utils/dayBoundary';

type SubstanceKey = 'alcohol' | 'cannabis' | 'tobacco';

const SUBSTANCE_LABELS: Record<SubstanceKey, { name: string; icon: string }> = {
  alcohol: { name: 'Alcohol', icon: 'wine-outline' },
  cannabis: { name: 'Cannabis', icon: 'leaf-outline' },
  tobacco: { name: 'Tobacco', icon: 'cloud-outline' },
};

const GOAL_TYPES: { type: SobrietyGoalType; label: string; description: string }[] = [
  { type: 'reduce', label: 'Reduce', description: 'Set a target to reduce usage' },
  { type: 'quit', label: 'Quit', description: 'Commit to zero usage' },
  { type: 'monitor', label: 'Monitor', description: 'Track usage without a target' },
];


function daysBetween(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function SobrietyGoals() {
  const [goals, setGoals] = useState<Record<string, SobrietyGoal>>({});

  const loadGoals = useCallback(async () => {
    const stored = await storageGet<Record<string, SobrietyGoal>>(STORAGE_KEYS.SOBRIETY);
    setGoals(stored ?? {});
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const saveGoals = useCallback(
    async (updated: Record<string, SobrietyGoal>) => {
      await storageSet(STORAGE_KEYS.SOBRIETY, updated);
      setGoals(updated);
    },
    [],
  );

  const setGoalForSubstance = useCallback(
    (substance: SubstanceKey, goalType: SobrietyGoalType) => {
      const existing = goals[substance];
      const today = todayDateString();

      const updated: Record<string, SobrietyGoal> = {
        ...goals,
        [substance]: {
          substance,
          goal_type: goalType,
          sobriety_start_date: goalType === 'quit' ? today : (existing?.sobriety_start_date ?? null),
          current_streak_days: existing?.current_streak_days ?? 0,
          longest_streak_days: existing?.longest_streak_days ?? 0,
          target_amount: null,
          target_frequency: null,
        },
      };
      saveGoals(updated);
    },
    [goals, saveGoals],
  );

  const removeGoal = useCallback(
    (substance: SubstanceKey) => {
      Alert.alert(
        'Remove Goal',
        `Remove your ${SUBSTANCE_LABELS[substance].name.toLowerCase()} goal? Your streak data will be preserved.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              const updated = { ...goals };
              delete updated[substance];
              saveGoals(updated);
            },
          },
        ],
      );
    },
    [goals, saveGoals],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Goals</Text>
      <Text style={styles.pageSubtitle}>
        Set goals per substance. Your data, your terms.
      </Text>

      {(Object.keys(SUBSTANCE_LABELS) as SubstanceKey[]).map((substance) => {
        const goal = goals[substance];
        const info = SUBSTANCE_LABELS[substance];

        return (
          <View key={substance} style={styles.substanceCard}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <Ionicons name={info.icon as keyof typeof Ionicons.glyphMap} size={22} color={Colors.accent} />
              <Text style={styles.cardTitle}>{info.name}</Text>
              {goal && (
                <TouchableOpacity
                  onPress={() => removeGoal(substance)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={Colors.secondaryText} />
                </TouchableOpacity>
              )}
            </View>

            {/* Goal type selector or current goal display */}
            {!goal ? (
              <View style={styles.goalTypeRow}>
                {GOAL_TYPES.map((gt) => (
                  <TouchableOpacity
                    key={gt.type}
                    style={styles.goalTypeBtn}
                    onPress={() => setGoalForSubstance(substance, gt.type)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.goalTypeBtnLabel}>{gt.label}</Text>
                    <Text style={styles.goalTypeBtnDesc}>{gt.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.activeGoal}>
                {/* Goal type badge */}
                <View style={styles.goalBadgeRow}>
                  <View style={styles.goalBadge}>
                    <Text style={styles.goalBadgeText}>
                      {goal.goal_type.charAt(0).toUpperCase() + goal.goal_type.slice(1)}
                    </Text>
                  </View>
                  {/* Change goal type */}
                  <View style={styles.changeRow}>
                    {GOAL_TYPES.filter((gt) => gt.type !== goal.goal_type).map((gt) => (
                      <TouchableOpacity
                        key={gt.type}
                        style={styles.changeBtn}
                        onPress={() => setGoalForSubstance(substance, gt.type)}
                      >
                        <Text style={styles.changeBtnText}>{gt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Quit streak display */}
                {goal.goal_type === 'quit' && (
                  <View style={styles.streakSection}>
                    <View style={styles.streakRow}>
                      <View style={styles.streakItem}>
                        <Text style={styles.streakValue}>
                          {goal.sobriety_start_date
                            ? daysBetween(goal.sobriety_start_date)
                            : goal.current_streak_days}
                        </Text>
                        <Text style={styles.streakLabel}>current streak</Text>
                      </View>
                      <View style={styles.streakDivider} />
                      <View style={styles.streakItem}>
                        <Text style={styles.streakValue}>{goal.longest_streak_days}</Text>
                        <Text style={styles.streakLabel}>longest streak</Text>
                      </View>
                    </View>

                    {goal.sobriety_start_date && (
                      <Text style={styles.startDate}>
                        Started {new Date(goal.sobriety_start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={styles.resetBtn}
                      onPress={() => {
                        // Preserve longest streak, reset current
                        const currentDays = goal.sobriety_start_date
                          ? daysBetween(goal.sobriety_start_date)
                          : goal.current_streak_days;
                        const newLongest = Math.max(goal.longest_streak_days, currentDays);

                        const updated: Record<string, SobrietyGoal> = {
                          ...goals,
                          [substance]: {
                            ...goal,
                            current_streak_days: 0,
                            longest_streak_days: newLongest,
                            sobriety_start_date: todayDateString(),
                          },
                        };
                        saveGoals(updated);
                      }}
                    >
                      <Text style={styles.resetBtnText}>Reset Streak</Text>
                      <Text style={styles.resetBtnSubtext}>
                        Today is Day 1 of your next streak
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Monitor mode message */}
                {goal.goal_type === 'monitor' && (
                  <Text style={styles.monitorText}>
                    Tracking usage. No targets set.
                  </Text>
                )}

                {/* Reduce mode */}
                {goal.goal_type === 'reduce' && (
                  <Text style={styles.monitorText}>
                    Tracking usage toward reduction. Review your trends over time.
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pageSubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginBottom: 20,
  },
  substanceCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  goalTypeRow: {
    gap: 8,
  },
  goalTypeBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 48,
    justifyContent: 'center',
  },
  goalTypeBtnLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  goalTypeBtnDesc: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  activeGoal: {
    gap: 12,
  },
  goalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  goalBadgeText: {
    color: Colors.primaryBackground,
    fontSize: 13,
    fontWeight: '700',
  },
  changeRow: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  changeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  changeBtnText: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
  },
  streakSection: {
    gap: 10,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 16,
  },
  streakItem: {
    alignItems: 'center',
  },
  streakValue: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  streakLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  streakDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.divider,
  },
  startDate: {
    color: Colors.secondaryText,
    fontSize: 13,
    textAlign: 'center',
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  resetBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  resetBtnSubtext: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  monitorText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
