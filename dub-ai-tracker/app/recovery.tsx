// S29-B: Recovery landing screen — minimal aggregate of yesterday's
// sleep + today's mood/stress with empty-state prompts that deep-link
// to each logger. The Recovery card on the dashboard now points here
// instead of an unrelated screen.

import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../src/components/common/ScreenWrapper';
import { Colors } from '../src/constants/colors';
import { Spacing } from '../src/constants/spacing';
import { storageGet, STORAGE_KEYS, dateKey } from '../src/utils/storage';
import { todayDateString, yesterdayDateString } from '../src/utils/dayBoundary';
import type { SleepEntry, MoodEntry, StressEntry } from '../src/types';

interface RecoverySnapshot {
  sleep: SleepEntry | null;
  mood: MoodEntry | null;
  stress: StressEntry | null;
}

function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function computeSleepHours(entry: SleepEntry | null): number | null {
  if (entry == null) return null;
  if (entry.total_duration_hours != null) return entry.total_duration_hours;
  if (entry.bedtime == null || entry.wake_time == null) return null;
  const bed = new Date(entry.bedtime).getTime();
  const wake = new Date(entry.wake_time).getTime();
  if (Number.isNaN(bed) || Number.isNaN(wake)) return null;
  let diff = wake - bed;
  if (diff < 0) diff += 24 * 60 * 60 * 1000;
  return diff / (60 * 60 * 1000);
}

export default function RecoveryScreen() {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot>({
    sleep: null,
    mood: null,
    stress: null,
  });

  const load = useCallback(async () => {
    const today = todayDateString();
    const yesterday = yesterdayDateString();
    const [sleep, moodList, stressList] = await Promise.all([
      storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, yesterday)),
      storageGet<MoodEntry[]>(dateKey(STORAGE_KEYS.LOG_MOOD, today)),
      storageGet<StressEntry[]>(dateKey(STORAGE_KEYS.LOG_STRESS, today)),
    ]);
    const lastMood = moodList && moodList.length > 0 ? moodList[moodList.length - 1] : null;
    const lastStress = stressList && stressList.length > 0 ? stressList[stressList.length - 1] : null;
    setSnapshot({ sleep, mood: lastMood, stress: lastStress });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sleepHours = computeSleepHours(snapshot.sleep);

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Recovery</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Row
          icon="moon-outline"
          label="Sleep (last night)"
          value={sleepHours != null ? formatHours(sleepHours) : null}
          empty="Log last night's sleep"
          onPress={() => router.push('/log/sleep')}
        />
        <Row
          icon="happy-outline"
          label="Mood (latest today)"
          value={snapshot.mood != null ? `${snapshot.mood.score} / 5` : null}
          empty="Log today's mood"
          onPress={() => router.push('/log/mood')}
        />
        <Row
          icon="pulse-outline"
          label="Stress (latest today)"
          value={snapshot.stress != null ? `${snapshot.stress.score} / 10` : null}
          empty="Log today's stress"
          onPress={() => router.push('/log/stress')}
        />

        <Text style={styles.helperText}>
          Recovery aggregates how rested and resilient you are right now. Log sleep, mood, and
          stress to see your full picture.
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

interface RowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | null;
  empty: string;
  onPress: () => void;
}

function Row({ icon, label, value, empty, onPress }: RowProps) {
  const hasData = value != null;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={hasData ? `${label}: ${value}` : empty}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={22} color={Colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hasData ? (
          <Text style={styles.rowValue}>{value}</Text>
        ) : (
          <Text style={styles.rowEmpty}>{empty}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowValue: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  rowEmpty: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
    fontStyle: 'italic',
  },
  helperText: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
