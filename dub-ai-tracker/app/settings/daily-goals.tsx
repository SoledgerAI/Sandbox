// Daily Goals Settings — Sprint 18
// Toggle which activities count toward daily compliance score

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
} from 'react-native';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { hapticSelection } from '../../src/utils/haptics';
import { useToast } from '../../src/contexts/ToastContext';
import { getEnabledGoals, setEnabledGoals } from '../../src/services/complianceEngine';
import type { DailyGoalId } from '../../src/types';
import { ALL_DAILY_GOALS } from '../../src/types';

export default function DailyGoalsSettingsScreen() {
  const [enabledGoals, setEnabledGoalsState] = useState<DailyGoalId[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const goals = await getEnabledGoals();
    setEnabledGoalsState(goals);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleGoal = useCallback(async (goalId: DailyGoalId) => {
    hapticSelection();
    const isEnabled = enabledGoals.includes(goalId);
    const updated = isEnabled
      ? enabledGoals.filter((g) => g !== goalId)
      : [...enabledGoals, goalId];
    setEnabledGoalsState(updated);
    await setEnabledGoals(updated);
  }, [enabledGoals]);

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Daily Goals</Text>
        <Text style={styles.subtitle}>
          Choose which activities count toward your daily compliance score.
          Toggle on the goals that matter to you.
        </Text>

        <Text style={styles.countText}>
          {enabledGoals.length} goal{enabledGoals.length !== 1 ? 's' : ''} active
        </Text>

        <PremiumCard>
          {ALL_DAILY_GOALS.map((goal, index) => {
            const isEnabled = enabledGoals.includes(goal.id);
            return (
              <View key={goal.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.goalRow}>
                  <Ionicons
                    name={goal.icon as any}
                    size={22}
                    color={isEnabled ? Colors.accentText : Colors.secondaryText}
                    style={styles.goalIcon}
                  />
                  <Text
                    style={[
                      styles.goalLabel,
                      !isEnabled && styles.goalLabelDisabled,
                    ]}
                    numberOfLines={2}
                  >
                    {goal.label}
                  </Text>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleGoal(goal.id)}
                    trackColor={{ false: Colors.elevated, true: Colors.accent }}
                    thumbColor={isEnabled ? '#FFFFFF' : Colors.secondaryText}
                  />
                </View>
              </View>
            );
          })}
        </PremiumCard>

        <Text style={styles.footerText}>
          Your compliance percentage is calculated daily based on these goals.
          View your score on the Dashboard and track trends in Charts.
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  countText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 48,
  },
  goalIcon: {
    width: 28,
    textAlign: 'center',
    marginRight: 12,
  },
  goalLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  goalLabelDisabled: {
    color: Colors.secondaryText,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  footerText: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
});
