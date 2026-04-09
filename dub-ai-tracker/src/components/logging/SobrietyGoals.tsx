// Sobriety/abstinence goal management UI
// Phase 8 → Sprint 13: Goal workflows, descriptions, day-of-week targets
// Tone: Zero judgment. Factual. Supportive without patronizing.

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import type { SobrietyGoal, SobrietyGoalType, DailyTargets } from '../../types/profile';
import { todayDateString } from '../../utils/dayBoundary';
import { getActiveDate } from '../../services/dateContextService';

type SubstanceKey = 'alcohol' | 'cannabis' | 'tobacco' | 'hemp';

const SUBSTANCE_LABELS: Record<SubstanceKey, { name: string; icon: string }> = {
  alcohol: { name: 'Alcohol', icon: 'wine-outline' },
  cannabis: { name: 'Cannabis', icon: 'leaf-outline' },
  tobacco: { name: 'Tobacco', icon: 'cloud-outline' },
  hemp: { name: 'Hemp', icon: 'flower-outline' },
};

const GOAL_DESCRIPTIONS: Record<SobrietyGoalType, { label: string; tagline: string; description: string }> = {
  monitor: {
    label: 'Monitor',
    tagline: 'Just data, no judgment',
    description:
      'Track usage without targets. See your patterns over time. No judgment, just data.',
  },
  reduce: {
    label: 'Reduce',
    tagline: 'Set weekly targets',
    description:
      'Set weekly targets and track your progress. Gradually decrease usage at your own pace.',
  },
  quit: {
    label: 'Quit',
    tagline: 'Track your streak',
    description:
      'Commit to stopping. Track your streak and get support when it\'s tough.',
  },
};

const DAY_KEYS: (keyof DailyTargets)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<keyof DailyTargets, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const DEFAULT_DAILY_TARGETS: DailyTargets = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

function daysBetween(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTodayDayKey(): keyof DailyTargets {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ...
  const map: (keyof DailyTargets)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[day];
}

export function SobrietyGoals() {
  const [goals, setGoals] = useState<Record<string, SobrietyGoal>>({});
  const [explanationModal, setExplanationModal] = useState<{
    substance: SubstanceKey;
    goalType: SobrietyGoalType;
  } | null>(null);

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

  const confirmGoal = useCallback(
    (substance: SubstanceKey, goalType: SobrietyGoalType) => {
      const existing = goals[substance];
      const today = getActiveDate();
      const now = new Date().toISOString();

      const updated: Record<string, SobrietyGoal> = {
        ...goals,
        [substance]: {
          substance,
          goal_type: goalType,
          sobriety_start_date:
            goalType === 'quit' ? today : (existing?.sobriety_start_date ?? null),
          current_streak_days: existing?.current_streak_days ?? 0,
          longest_streak_days: existing?.longest_streak_days ?? 0,
          target_amount: existing?.target_amount ?? null,
          target_frequency: existing?.target_frequency ?? null,
          daily_targets:
            goalType === 'reduce'
              ? existing?.daily_targets ?? { ...DEFAULT_DAILY_TARGETS }
              : null,
          quit_date: goalType === 'quit' ? today : null,
          created_at: existing?.created_at ?? now,
          updated_at: now,
        },
      };
      saveGoals(updated);
      setExplanationModal(null);
    },
    [goals, saveGoals],
  );

  const handleGoalSelect = useCallback(
    (substance: SubstanceKey, goalType: SobrietyGoalType) => {
      const existing = goals[substance];
      // First time selecting a goal for this substance → show explanation
      if (!existing) {
        setExplanationModal({ substance, goalType });
      } else {
        confirmGoal(substance, goalType);
      }
    },
    [goals, confirmGoal],
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

  const updateDailyTarget = useCallback(
    (substance: SubstanceKey, day: keyof DailyTargets, value: number) => {
      const goal = goals[substance];
      if (!goal) return;

      const targets = goal.daily_targets ?? { ...DEFAULT_DAILY_TARGETS };
      const updatedTargets = { ...targets, [day]: Math.max(0, value) };
      const weeklyTotal = DAY_KEYS.reduce((sum, k) => sum + updatedTargets[k], 0);

      const updated: Record<string, SobrietyGoal> = {
        ...goals,
        [substance]: {
          ...goal,
          daily_targets: updatedTargets,
          target_amount: weeklyTotal,
          updated_at: new Date().toISOString(),
        },
      };
      saveGoals(updated);
    },
    [goals, saveGoals],
  );

  const renderReduceGoal = (substance: SubstanceKey, goal: SobrietyGoal) => {
    const targets = goal.daily_targets ?? { ...DEFAULT_DAILY_TARGETS };
    const weeklyTotal = DAY_KEYS.reduce((sum, k) => sum + targets[k], 0);
    const todayKey = getTodayDayKey();

    return (
      <View style={styles.reduceSection}>
        {/* Weekly total */}
        <View style={styles.weeklyTotalCard}>
          <Text style={styles.weeklyTotalLabel}>Weekly Target</Text>
          <Text style={styles.weeklyTotalValue}>{weeklyTotal}</Text>
        </View>

        {/* Day-of-week grid */}
        <View style={styles.dailyGrid}>
          {DAY_KEYS.map((day) => {
            const isToday = day === todayKey;
            return (
              <View key={day} style={[styles.dailyCol, isToday && styles.dailyColToday]}>
                <Text style={[styles.dailyLabel, isToday && styles.dailyLabelToday]}>
                  {DAY_LABELS[day]}
                </Text>
                <View style={styles.dailyStepper}>
                  <TouchableOpacity
                    style={styles.dailyStepBtn}
                    onPress={() => updateDailyTarget(substance, day, targets[day] - 1)}
                  >
                    <Ionicons name="remove" size={14} color={Colors.secondaryText} />
                  </TouchableOpacity>
                  <Text style={styles.dailyValue}>{targets[day]}</Text>
                  <TouchableOpacity
                    style={styles.dailyStepBtn}
                    onPress={() => updateDailyTarget(substance, day, targets[day] + 1)}
                  >
                    <Ionicons name="add" size={14} color={Colors.secondaryText} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.reduceTip}>
          Tap + / - to set your target per day. The weekly total updates automatically.
        </Text>
      </View>
    );
  };

  const renderQuitGoal = (substance: SubstanceKey, goal: SobrietyGoal) => {
    const currentDays = goal.sobriety_start_date
      ? daysBetween(goal.sobriety_start_date)
      : goal.current_streak_days;

    return (
      <View style={styles.streakSection}>
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text style={styles.streakValue}>{currentDays}</Text>
            <Text style={styles.streakLabel}>current streak</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={styles.streakValue}>{goal.longest_streak_days}</Text>
            <Text style={styles.streakLabel}>longest streak</Text>
          </View>
        </View>

        {goal.longest_streak_days > 0 && currentDays === 0 && (
          <Text style={styles.relapseMessage}>
            Day 1 starts now. Every restart is progress.
          </Text>
        )}

        {goal.longest_streak_days > 0 && currentDays === 0 && (
          <Text style={styles.previousBest}>
            Previous best: {goal.longest_streak_days} days
          </Text>
        )}

        {goal.sobriety_start_date && currentDays > 0 && (
          <Text style={styles.startDate}>
            Started{' '}
            {new Date(goal.sobriety_start_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        )}

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => {
            const newLongest = Math.max(goal.longest_streak_days, currentDays);
            const updated: Record<string, SobrietyGoal> = {
              ...goals,
              [substance]: {
                ...goal,
                current_streak_days: 0,
                longest_streak_days: newLongest,
                sobriety_start_date: todayDateString(),
                updated_at: new Date().toISOString(),
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
    );
  };

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
                {(Object.keys(GOAL_DESCRIPTIONS) as SobrietyGoalType[]).map((gt) => {
                  const desc = GOAL_DESCRIPTIONS[gt];
                  return (
                    <TouchableOpacity
                      key={gt}
                      style={styles.goalTypeBtn}
                      onPress={() => handleGoalSelect(substance, gt)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.goalTypeBtnLabel}>{desc.label}</Text>
                      <Text style={styles.goalTypeBtnDesc}>{desc.tagline}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.activeGoal}>
                {/* Goal type badge */}
                <View style={styles.goalBadgeRow}>
                  <View style={styles.goalBadge}>
                    <Text style={styles.goalBadgeText}>
                      {GOAL_DESCRIPTIONS[goal.goal_type].label}
                    </Text>
                  </View>
                  {/* Change goal type */}
                  <View style={styles.changeRow}>
                    {(Object.keys(GOAL_DESCRIPTIONS) as SobrietyGoalType[])
                      .filter((gt) => gt !== goal.goal_type)
                      .map((gt) => (
                        <TouchableOpacity
                          key={gt}
                          style={styles.changeBtn}
                          onPress={() => confirmGoal(substance, gt)}
                        >
                          <Text style={styles.changeBtnText}>
                            {GOAL_DESCRIPTIONS[gt].label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>

                {/* Goal description */}
                <Text style={styles.goalDescription}>
                  {GOAL_DESCRIPTIONS[goal.goal_type].description}
                </Text>

                {/* Goal-specific content */}
                {goal.goal_type === 'quit' && renderQuitGoal(substance, goal)}

                {goal.goal_type === 'monitor' && (
                  <Text style={styles.monitorText}>
                    Tracking usage. No targets set. Check your trends over time.
                  </Text>
                )}

                {goal.goal_type === 'reduce' && renderReduceGoal(substance, goal)}
              </View>
            )}
          </View>
        );
      })}

      {/* Explanation modal */}
      <Modal
        visible={explanationModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExplanationModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {explanationModal && (
              <>
                <Text style={styles.modalTitle}>
                  {GOAL_DESCRIPTIONS[explanationModal.goalType].label}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {SUBSTANCE_LABELS[explanationModal.substance].name}
                </Text>
                <Text style={styles.modalDescription}>
                  {GOAL_DESCRIPTIONS[explanationModal.goalType].description}
                </Text>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={() =>
                    confirmGoal(explanationModal.substance, explanationModal.goalType)
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalConfirmText}>
                    Set {GOAL_DESCRIPTIONS[explanationModal.goalType].label} Goal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setExplanationModal(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  goalDescription: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  // Quit goal
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
  relapseMessage: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  previousBest: {
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
  // Reduce goal — day-of-week targets
  reduceSection: {
    gap: 12,
  },
  weeklyTotalCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weeklyTotalLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  weeklyTotalValue: {
    color: Colors.accent,
    fontSize: 22,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  dailyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dailyCol: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  dailyColToday: {
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  dailyLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  dailyLabelToday: {
    color: Colors.accent,
  },
  dailyStepper: {
    alignItems: 'center',
    gap: 2,
  },
  dailyStepBtn: {
    width: 28,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
  },
  reduceTip: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Explanation modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    color: Colors.accent,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginBottom: 16,
  },
  modalDescription: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalConfirmBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalConfirmText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCancelText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
});
