import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, STORAGE_KEYS } from '../constants/theme';
import { ProgressRing } from '../components/ProgressRing';
import { getTodayKey } from '../utils/date';
import type { DailyLog } from '../types';

const WATER_GOAL = 100;

export function DashboardScreen() {
  const router = useRouter();
  const [waterTotal, setWaterTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadWaterData();
    }, [])
  );

  const loadWaterData = async () => {
    try {
      const key = `${STORAGE_KEYS.logs}/${getTodayKey()}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const log: DailyLog = JSON.parse(raw);
        const total = (log.water || []).reduce(
          (sum, e) => sum + e.amount,
          0
        );
        setWaterTotal(total);
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const waterProgress = Math.min(waterTotal / WATER_GOAL, 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Date Header */}
      <Text style={styles.dateText}>{todayFormatted}</Text>

      {/* Overall Score */}
      <View style={styles.scoreSection}>
        <ProgressRing
          progress={0}
          size={160}
          strokeWidth={12}
          label="Overall Score"
          sublabel="Start tracking to score"
        />
      </View>

      {/* Water Card */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/water')}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>💧</Text>
          <Text style={styles.cardTitle}>Water</Text>
          <Text style={styles.cardValue}>
            {waterTotal} / {WATER_GOAL} oz
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${waterProgress * 100}%`,
                backgroundColor:
                  waterProgress >= 0.8
                    ? COLORS.success
                    : waterProgress >= 0.5
                      ? COLORS.warning
                      : COLORS.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.cardHint}>Tap to log water →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBackground,
  },
  content: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  dateText: {
    color: COLORS.secondaryText,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  scoreSection: {
    marginVertical: 20,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  cardValue: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  cardHint: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
});
