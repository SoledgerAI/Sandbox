// Streak counter display
// Phase 5: Dashboard Layout

import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { DashboardCard } from './DashboardCard';
import type { StreakData } from '../../types/profile';

interface StreakCounterProps {
  streak: StreakData;
}

export function StreakCounter({ streak }: StreakCounterProps) {
  return (
    <DashboardCard>
      <View style={styles.container}>
        <View style={styles.mainStreak}>
          <Text style={styles.streakNumber}>{streak.current_streak}</Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streak.longest_streak}</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streak.total_days_logged}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mainStreak: {
    alignItems: 'center',
  },
  streakNumber: {
    color: Colors.accent,
    fontSize: 42,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    lineHeight: 46,
  },
  streakLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.divider,
  },
});
