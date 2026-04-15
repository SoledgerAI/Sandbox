// Sprint 25: Upcoming Reminders Card
// Shows next medication due, doctor follow-up, predicted period

import { useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import { storageGet, STORAGE_KEYS, dateKey } from '../../utils/storage';
import { isCategoryEnabled } from '../../utils/categoryElection';
import { todayDateString } from '../../utils/dayBoundary';
import type { MedicationDefinition, MedicationEntry, DoctorVisitEntry, CycleEntryV2 } from '../../types';
import { getCyclePredictions } from '../../utils/cyclePredictions';

interface ReminderItem {
  icon: string;
  label: string;
  detail: string;
  color: string;
}

export function UpcomingRemindersCard() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReminders();
  }, []);

  async function loadReminders() {
    try {
      const items: ReminderItem[] = [];
      const today = todayDateString();

      // Next medication due (if medication_tracking enabled)
      const medEnabled = await isCategoryEnabled('medication_tracking');
      if (medEnabled) {
        const [medList, medEntry] = await Promise.all([
          storageGet<MedicationDefinition[]>(STORAGE_KEYS.SETTINGS_MEDICATION_LIST),
          storageGet<MedicationEntry>(dateKey(STORAGE_KEYS.LOG_MEDICATIONS, today)),
        ]);

        if (medList && medList.length > 0) {
          const takenIds = new Set(
            (medEntry?.medications ?? []).filter((m) => m.taken).map((m) => m.id),
          );
          const nextDue = medList.find((m) => !takenIds.has(m.id));
          if (nextDue) {
            items.push({
              icon: 'medical-outline',
              label: `${nextDue.name} due`,
              detail: nextDue.scheduled_time,
              color: Colors.accentText,
            });
          }
        }
      }

      // Doctor follow-up in next 7 days (visits stored at flat key, not per-date)
      const todayDate = new Date(today + 'T00:00:00');
      const weekFromNow = new Date(todayDate);
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      const allVisits = await storageGet<DoctorVisitEntry[]>(STORAGE_KEYS.LOG_DOCTOR_VISITS);
      if (allVisits) {
        for (const v of allVisits) {
          if (v.follow_up_date) {
            const followUp = new Date(v.follow_up_date + 'T00:00:00');
            if (followUp >= todayDate && followUp <= weekFromNow) {
              const daysUntil = Math.ceil((followUp.getTime() - todayDate.getTime()) / 86400000);
              items.push({
                icon: 'calendar-outline',
                label: `Follow-up: ${v.doctor_name ?? v.visit_type}`,
                detail: daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`,
                color: Colors.accentText,
              });
              break; // Only show the nearest one
            }
          }
        }
      }

      // Predicted period (if cycle_tracking enabled and within 3 days)
      const cycleEnabled = await isCategoryEnabled('cycle_tracking');
      if (cycleEnabled) {
        try {
          const predictions = await getCyclePredictions();
          if (predictions) {
            const nextPeriod = new Date(predictions.next_period_start + 'T00:00:00');
            const daysUntil = Math.ceil((nextPeriod.getTime() - todayDate.getTime()) / 86400000);
            if (daysUntil >= 0 && daysUntil <= 3) {
              items.push({
                icon: 'flower-outline',
                label: 'Period predicted',
                detail: daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`,
                color: '#E8A0A0',
              });
            }
          }
        } catch {
          // predictions may fail with insufficient data — that's fine
        }
      }

      setReminders(items);
    } finally {
      setLoading(false);
    }
  }

  if (loading || reminders.length === 0) return null;

  return (
    <PremiumCard>
      <Text style={styles.title}>Upcoming</Text>
      {reminders.map((item, idx) => (
        <View key={idx} style={styles.row}>
          <Ionicons name={item.icon as any} size={18} color={item.color} />
          <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.detail}>{item.detail}</Text>
        </View>
      ))}
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
    paddingVertical: 6,
    gap: 10,
  },
  label: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
  },
  detail: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
