// Sleep Schedule Settings — Sprint 19
// Set target bedtime and wake time for adherence tracking

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import type { SleepScheduleSettings } from '../../src/types';

const BEDTIME_OPTIONS = [
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30',
  '23:00', '23:30', '00:00', '00:30', '01:00',
];

const WAKE_OPTIONS = [
  '04:00', '04:30', '05:00', '05:30', '06:00', '06:30',
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
];

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function SleepScheduleScreen() {
  const [settings, setSettings] = useState<SleepScheduleSettings>({
    target_bedtime: null,
    target_wake_time: null,
  });

  const loadData = useCallback(async () => {
    const stored = await storageGet<SleepScheduleSettings>(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE);
    if (stored) setSettings(stored);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const save = useCallback(async (updated: SleepScheduleSettings) => {
    setSettings(updated);
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, updated);
  }, []);

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Sleep Schedule</Text>
          <View style={styles.backBtn} />
        </View>

        <Text style={styles.subtitle}>
          Set your target bedtime and wake time. Your adherence score shows how closely you hit these targets.
        </Text>

        <PremiumCard>
          <Text style={styles.cardTitle}>Target Bedtime</Text>
          <View style={styles.timeGrid}>
            {BEDTIME_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.timeBtn, settings.target_bedtime === t && styles.timeBtnActive]}
                onPress={() => save({ ...settings, target_bedtime: t })}
              >
                <Text style={[styles.timeText, settings.target_bedtime === t && styles.timeTextActive]}>
                  {formatTime(t)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </PremiumCard>

        <PremiumCard>
          <Text style={styles.cardTitle}>Target Wake Time</Text>
          <View style={styles.timeGrid}>
            {WAKE_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.timeBtn, settings.target_wake_time === t && styles.timeBtnActive]}
                onPress={() => save({ ...settings, target_wake_time: t })}
              >
                <Text style={[styles.timeText, settings.target_wake_time === t && styles.timeTextActive]}>
                  {formatTime(t)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </PremiumCard>

        {settings.target_bedtime && settings.target_wake_time && (
          <View style={styles.summaryCard}>
            <Ionicons name="alarm-outline" size={24} color={Colors.accent} />
            <Text style={styles.summaryText}>
              Target: {formatTime(settings.target_bedtime)} - {formatTime(settings.target_wake_time)}
            </Text>
            <Text style={styles.summaryHint}>
              Adherence will show on your sleep log and in Coach DUB context.
            </Text>
          </View>
        )}

        {(settings.target_bedtime || settings.target_wake_time) && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => save({ target_bedtime: null, target_wake_time: null })}
          >
            <Text style={styles.clearBtnText}>Clear Schedule</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: Colors.secondaryText, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  timeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  timeText: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  timeTextActive: { color: Colors.primaryBackground, fontWeight: '700' },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    gap: 8,
  },
  summaryText: { color: Colors.accentText, fontSize: 16, fontWeight: '600' },
  summaryHint: { color: Colors.secondaryText, fontSize: 12, textAlign: 'center' },
  clearBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 12 },
  clearBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '500' },
});
