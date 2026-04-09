// 7-Day Streak Badge — motivational streak display
// Sprint 15: Streak Badge

import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { calculateStreak } from '../../utils/streak';
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import { useToast } from '../../contexts/ToastContext';

const MILESTONES = [7, 14, 21, 30, 60, 90];

function getSubtext(days: number): string {
  if (days < 14) return 'Keep it going!';
  if (days < 30) return 'On a roll!';
  return 'Unstoppable!';
}

export function StreakBadge() {
  const [streakDays, setStreakDays] = useState(0);
  const { showToast } = useToast();

  const loadStreak = useCallback(async () => {
    const days = await calculateStreak();
    setStreakDays(days);

    // Check milestone toasts
    if (MILESTONES.includes(days)) {
      const lastMilestone = await storageGet<number>(STORAGE_KEYS.STREAKS + '.lastMilestone');
      if (lastMilestone !== days) {
        await storageSet(STORAGE_KEYS.STREAKS + '.lastMilestone', days);
        showToast(`\uD83D\uDD25 ${days}-Day Streak! You're on fire.`, 'success');
      }
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadStreak();
    }, [loadStreak]),
  );

  if (streakDays < 2) return null;

  const fireEmoji = streakDays >= 30 ? '\uD83D\uDD25\uD83D\uDD25' : '\uD83D\uDD25';
  const exclamation = streakDays >= 7 ? '!' : '';

  return (
    <View style={styles.container}>
      <Text style={styles.streakText}>
        {fireEmoji} {streakDays}-Day Streak{exclamation}
      </Text>
      <Text style={styles.subtext}>{getSubtext(streakDays)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.2)',
    backgroundColor: 'rgba(212, 168, 67, 0.07)',
  },
  streakText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  subtext: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginTop: 2,
  },
});
