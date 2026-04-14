// Sprint 25: Active Streaks Card
// Shows category streaks with milestone badges

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import type { CategoryStreak } from '../../utils/streakCalculator';

interface ActiveStreaksCardProps {
  streaks: CategoryStreak[];
}

function milestoneText(streak: CategoryStreak): string | null {
  if (streak.atMilestone) {
    return `\u{1F3C6} ${streak.currentStreak}-day milestone!`;
  }
  return null;
}

export function ActiveStreaksCard({ streaks }: ActiveStreaksCardProps) {
  if (streaks.length === 0) return null;

  return (
    <PremiumCard>
      <Text style={styles.title}>Active Streaks</Text>
      {streaks.map((s) => {
        const milestone = milestoneText(s);
        return (
          <View key={s.category} style={styles.row}>
            <Ionicons name={s.icon as any} size={18} color={Colors.accentText} />
            <View style={styles.textContainer}>
              <Text style={styles.label}>{s.label}</Text>
              {milestone && <Text style={styles.milestone}>{milestone}</Text>}
            </View>
            <View style={styles.countContainer}>
              <Text style={[styles.count, s.atMilestone && styles.countGold]}>
                {s.currentStreak}
              </Text>
              <Text style={styles.dayLabel}>days</Text>
            </View>
          </View>
        );
      })}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  milestone: {
    color: Colors.accentText,
    fontSize: 11,
    marginTop: 2,
  },
  countContainer: {
    alignItems: 'center',
    minWidth: 44,
  },
  count: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  countGold: {
    color: Colors.accentText,
  },
  dayLabel: {
    color: Colors.secondaryText,
    fontSize: 10,
  },
});
