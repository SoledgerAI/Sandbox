// Sprint 25: Daily Snapshot Card — top of dashboard
// Shows compliance ring, streak flame, quick stats row

import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import type { DailySummary } from '../../types';
import type { StreakData } from '../../types/profile';

interface QuickStat {
  label: string;
  value: string;
  emoji: string;
  route: string;
  visible: boolean;
}

interface DailySnapshotCardProps {
  greeting: string;
  dateDisplay: string;
  compliancePct: number;
  streak: StreakData;
  summary: DailySummary;
  waterGoalOz: number;
  enabledTags: string[];
}

function qualityEmoji(quality: number | null): string {
  if (quality == null) return '';
  if (quality >= 4) return '\u{1F60A}'; // smiling
  if (quality >= 3) return '\u{1F610}'; // neutral
  return '\u{1F634}'; // sleepy
}

function moodEmoji(mood: number | null): string {
  if (mood == null) return '';
  if (mood >= 8) return '\u{1F60A}';
  if (mood >= 6) return '\u{1F642}';
  if (mood >= 4) return '\u{1F610}';
  return '\u{1F614}';
}

function formatSleepDuration(hours: number | null): string {
  if (hours == null) return '--';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function DailySnapshotCard({
  greeting,
  dateDisplay,
  compliancePct,
  streak,
  summary,
  waterGoalOz,
  enabledTags,
}: DailySnapshotCardProps) {
  const complianceDays = streak.current_streak;
  // Count consecutive days with 70%+ compliance (we approximate using streak data)
  // For now, we use the logging streak as a proxy

  const quickStats: QuickStat[] = [
    {
      label: 'Sleep',
      value: `${formatSleepDuration(summary.sleep_hours)} ${qualityEmoji(summary.sleep_quality)}`,
      emoji: '\u{1F4A4}',
      route: '/log/sleep',
      visible: true,
    },
    {
      label: 'Mood',
      value: summary.mood_avg != null ? `${summary.mood_avg}/10 ${moodEmoji(summary.mood_avg)}` : '--',
      emoji: '\u{1F60A}',
      route: '/log/mood_mental',
      visible: true,
    },
    {
      label: 'Water',
      value: waterGoalOz > 0
        ? `${Math.round(summary.water_oz)}/${waterGoalOz} oz`
        : `${Math.round(summary.water_oz)} oz`,
      emoji: '\u{1F4A7}',
      route: '/log/water',
      visible: true,
    },
    {
      label: 'Exercise',
      value: summary.active_minutes > 0 ? `${summary.active_minutes} min` : '--',
      emoji: '\u{1F3CB}',
      route: '/log/workout',
      visible: true,
    },
    {
      label: 'Food',
      value: summary.calories_consumed > 0 ? `${Math.round(summary.calories_consumed)} cal` : '--',
      emoji: '\u{1F34E}',
      route: '/log/food',
      visible: true,
    },
    {
      label: 'Weight',
      value: summary.weight_lbs != null ? `${summary.weight_lbs} lbs` : '--',
      emoji: '\u{2696}',
      route: '/log/body',
      visible: enabledTags.includes('body.measurements'),
    },
  ];

  const visibleStats = quickStats.filter((s) => s.visible);

  return (
    <PremiumCard>
      {/* Compliance + Streak Row */}
      <View style={styles.topRow}>
        {/* Compliance Percentage */}
        <View style={styles.complianceContainer}>
          <Text style={styles.compliancePct}>{Math.round(compliancePct)}%</Text>
          <Text style={styles.complianceLabel}>Today</Text>
        </View>

        {/* Streak */}
        {complianceDays > 0 && (
          <View style={styles.streakContainer}>
            <Text style={styles.streakFlame}>{'\u{1F525}'}</Text>
            <Text style={styles.streakCount}>{complianceDays}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        )}
      </View>

      {/* Quick Stats Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
      >
        {visibleStats.map((stat) => (
          <TouchableOpacity
            key={stat.label}
            style={styles.statItem}
            onPress={() => router.push(stat.route as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.statEmoji}>{stat.emoji}</Text>
            <Text style={styles.statValue} numberOfLines={1}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  complianceContainer: {
    alignItems: 'center',
  },
  compliancePct: {
    color: Colors.accentText,
    fontSize: 36,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  complianceLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.elevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  streakFlame: {
    fontSize: 16,
  },
  streakCount: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  streakLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  statsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  statItem: {
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 80,
  },
  statEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  statValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  statLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
});
