// Doctor Follow-up Reminder Card — Sprint 17
// Shows upcoming doctor follow-up dates on the Dashboard

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import { storageGet, STORAGE_KEYS } from '../../utils/storage';
import type { DoctorVisitEntry } from '../../types';
import { DOCTOR_VISIT_TYPES } from '../../types';
import { todayDateString } from '../../utils/dayBoundary';

function daysUntil(dateStr: string): number {
  const today = new Date(todayDateString() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function DoctorFollowUpCard() {
  const [followUps, setFollowUps] = useState<
    { label: string; days: number; date: string }[]
  >([]);

  const load = useCallback(async () => {
    const visits = await storageGet<DoctorVisitEntry[]>(STORAGE_KEYS.LOG_DOCTOR_VISITS);
    if (!visits) return;

    const upcoming = visits
      .filter((v) => v.follow_up_date && daysUntil(v.follow_up_date) >= 0 && daysUntil(v.follow_up_date) <= 30)
      .map((v) => {
        const typeDef = DOCTOR_VISIT_TYPES.find((t) => t.type === v.visit_type);
        const label =
          v.visit_type === 'specialist' && v.specialist_type
            ? v.specialist_type
            : typeDef?.label ?? v.visit_type;
        return {
          label,
          days: daysUntil(v.follow_up_date!),
          date: v.follow_up_date!,
        };
      })
      .sort((a, b) => a.days - b.days);

    setFollowUps(upcoming);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (followUps.length === 0) return null;

  return (
    <PremiumCard style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="medkit-outline" size={18} color={Colors.accent} />
        <Text style={styles.headerText}>Doctor Follow-ups</Text>
      </View>
      {followUps.map((f, i) => (
        <Text key={i} style={styles.followUpText}>
          {f.label} follow-up{' '}
          {f.days === 0 ? 'today' : f.days === 1 ? 'tomorrow' : `in ${f.days} days`}
        </Text>
      ))}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  headerText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  followUpText: {
    color: Colors.text,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
});
