// Sprint 31 Commit 2: Wearable scan route.
// Mirrors app/log/sleep.tsx structure: ScreenWrapper > header +
// DateContextBanner + logger component. Banner is the visible
// date label and edit affordance; route presets it to yesterday
// on mount so the user lands on "logging for last night" by
// default. NO KeyboardAwareScreen — wearable has no text input.

import { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { Colors } from '../../src/constants/colors';
import { DateContextBanner } from '../../src/components/DateContextBanner';
import { WearableLogger } from '../../src/components/logging/WearableLogger';
import { useStorageWatcher } from '../../src/hooks/useStorageWatcher';
import { setActiveDate, getActiveDate } from '../../src/services/dateContextService';
import { todayDateString } from '../../src/utils/dayBoundary';
import { computeYesterdayTimestamp } from '../../src/utils/recoveryDate';
import { STORAGE_KEYS } from '../../src/utils/storage';

function yesterdayDateString(): string {
  const d = computeYesterdayTimestamp();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WearableScreen() {
  // Default the banner to yesterday on mount unless the user
  // arrived already on a non-today date (e.g. via gap-day flow).
  useEffect(() => {
    if (getActiveDate() === todayDateString()) {
      setActiveDate(yesterdayDateString());
    }
  }, []);

  // Scaffolding subscription so any future Recovery dashboard tile
  // refreshes when entries land. No-op refetch in this commit.
  useStorageWatcher([STORAGE_KEYS.LOG_RECOVERY_METRICS], () => {}, { prefix: true });

  return (
    <ScreenWrapper>
      <View style={styles.container}>
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

        <DateContextBanner />
        <WearableLogger />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
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
});
