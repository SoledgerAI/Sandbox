// MissedDayCard — Prompt 14: Dashboard nudge for gap days
// Shows when getGapDays(7) returns one or more days with no log entries.
// Single card regardless of gap count. Dismissable per date.

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { storageGet, storageSet } from '../../utils/storage';
import { getGapDays, setActiveDate } from '../../services/dateContextService';

const DISMISSED_KEY = '@dubaitracker/dismissed-gaps';

function formatDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export function MissedDayCard() {
  const [gapDays, setGapDays] = useState<string[]>([]);
  const [dismissedDates, setDismissedDates] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const loadGaps = useCallback(async () => {
    const [gaps, dismissed] = await Promise.all([
      getGapDays(7),
      storageGet<string[]>(DISMISSED_KEY),
    ]);
    const dismissedSet = new Set(dismissed ?? []);
    setDismissedDates(dismissed ?? []);
    setGapDays(gaps.filter((d) => !dismissedSet.has(d)));
  }, []);

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  const handleDismiss = useCallback(async () => {
    // Dismiss all currently visible gap dates
    const updated = [...dismissedDates, ...gapDays];
    await storageSet(DISMISSED_KEY, updated);
    setDismissedDates(updated);
    setGapDays([]);
  }, [dismissedDates, gapDays]);

  const handleLogPastDay = useCallback((dateStr: string) => {
    setActiveDate(dateStr);
    router.push('/(tabs)/log');
  }, []);

  const handlePickerChange = useCallback((_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      handleLogPastDay(`${yyyy}-${mm}-${dd}`);
    }
  }, [handleLogPastDay]);

  if (gapDays.length === 0) return null;

  const isSingle = gapDays.length === 1;
  const dayName = isSingle ? formatDayName(gapDays[0]) : '';

  return (
    <View style={styles.card}>
      {/* Dismiss X */}
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={handleDismiss}
        hitSlop={12}
        accessibilityLabel="Dismiss missed day reminder"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={18} color={Colors.secondaryText} />
      </TouchableOpacity>

      {/* Icon + Copy */}
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="calendar-outline" size={24} color={Colors.accent} />
          <View style={styles.alertDot} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>
            {isSingle
              ? `You didn't log anything on ${dayName}. Want to add entries?`
              : `You have ${gapDays.length} days with no entries this week.`
            }
          </Text>
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={() => {
          if (isSingle) {
            handleLogPastDay(gapDays[0]);
          } else {
            setShowPicker(!showPicker);
          }
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>Log Past Day</Text>
      </TouchableOpacity>

      {/* Multi-day picker */}
      {showPicker && !isSingle && (
        <View style={styles.gapList}>
          {gapDays.map((dateStr) => (
            <TouchableOpacity
              key={dateStr}
              style={styles.gapDayBtn}
              onPress={() => {
                setShowPicker(false);
                handleLogPastDay(dateStr);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
              <Text style={styles.gapDayText}>
                {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Reload function for external callers (e.g., after tab focus)
MissedDayCard.reloadKey = DISMISSED_KEY;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dismissBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 4,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 24,
  },
  iconWrap: {
    position: 'relative',
    marginTop: 2,
  },
  alertDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  ctaBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  ctaText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '700',
  },
  gapList: {
    marginTop: 8,
    gap: 4,
  },
  gapDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  gapDayText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
