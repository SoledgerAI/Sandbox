// Sleep logging component -- bedtime, wake time, quality, duration computation
// Phase 10: Sleep and Mood Logging

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { SleepEntry } from '../../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const QUALITY_LABELS: Record<number, string> = {
  1: 'Terrible',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
};

interface SleepLoggerProps {
  onEntryLogged?: () => void;
}

export function SleepLogger({ onEntryLogged }: SleepLoggerProps) {
  const [entry, setEntry] = useState<SleepEntry | null>(null);

  // Form state
  const [bedHour, setBedHour] = useState('');
  const [bedMinute, setBedMinute] = useState('');
  const [bedAmPm, setBedAmPm] = useState<'AM' | 'PM'>('PM');
  const [wakeHour, setWakeHour] = useState('');
  const [wakeMinute, setWakeMinute] = useState('');
  const [wakeAmPm, setWakeAmPm] = useState<'AM' | 'PM'>('AM');
  const [quality, setQuality] = useState<number>(3);
  const [bathroomTrips, setBathroomTrips] = useState('');
  const [alarmUsed, setAlarmUsed] = useState(false);
  const [timeToFallAsleep, setTimeToFallAsleep] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    const stored = await storageGet<SleepEntry>(key);
    if (stored) {
      setEntry(stored);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function computeDurationHours(bedtime: string, wakeTime: string): number {
    const bed = new Date(bedtime).getTime();
    const wake = new Date(wakeTime).getTime();
    if (wake <= bed) return 0;
    return Math.round(((wake - bed) / (1000 * 60 * 60)) * 10) / 10;
  }

  function buildISOTime(hour: string, minute: string, amPm: 'AM' | 'PM', dayOffset: number): string | null {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (isNaN(h) || isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) return null;

    let hour24 = h;
    if (amPm === 'AM' && h === 12) hour24 = 0;
    else if (amPm === 'PM' && h !== 12) hour24 = h + 12;

    const today = new Date();
    today.setDate(today.getDate() + dayOffset);
    today.setHours(hour24, m, 0, 0);
    return today.toISOString();
  }

  const logSleep = useCallback(async () => {
    // Bedtime is previous night (day offset -1 for PM times, 0 for AM times)
    const bedDayOffset = bedAmPm === 'PM' ? -1 : 0;
    const bedtime = buildISOTime(bedHour, bedMinute, bedAmPm, bedDayOffset);
    const wakeTime = buildISOTime(wakeHour, wakeMinute, wakeAmPm, 0);

    if (!bedtime || !wakeTime) {
      Alert.alert('Invalid Time', 'Please enter valid bedtime and wake time.');
      return;
    }

    const newEntry: SleepEntry = {
      bedtime,
      wake_time: wakeTime,
      quality,
      bathroom_trips: bathroomTrips ? parseInt(bathroomTrips, 10) : null,
      alarm_used: alarmUsed,
      time_to_fall_asleep_min: timeToFallAsleep ? parseInt(timeToFallAsleep, 10) : null,
      notes: notes.trim() || null,
      device_data: null,
    };

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    await storageSet(key, newEntry);
    setEntry(newEntry);
    onEntryLogged?.();
  }, [bedHour, bedMinute, bedAmPm, wakeHour, wakeMinute, wakeAmPm, quality, bathroomTrips, alarmUsed, timeToFallAsleep, notes, onEntryLogged]);

  const clearEntry = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    await storageSet(key, null);
    setEntry(null);
    setBedHour('');
    setBedMinute('');
    setWakeHour('');
    setWakeMinute('');
    setQuality(3);
    setBathroomTrips('');
    setAlarmUsed(false);
    setTimeToFallAsleep('');
    setNotes('');
  }, []);

  // Show summary if already logged
  if (entry && entry.bedtime && entry.wake_time) {
    const duration = computeDurationHours(entry.bedtime, entry.wake_time);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Ionicons name="moon" size={28} color={Colors.accent} />
          <Text style={styles.summaryTitle}>Sleep Logged</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{duration}h</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Bedtime</Text>
            <Text style={styles.summaryValue}>
              {new Date(entry.bedtime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Wake</Text>
            <Text style={styles.summaryValue}>
              {new Date(entry.wake_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Quality</Text>
            <Text style={styles.summaryValue}>
              {entry.quality ? `${entry.quality}/5 - ${QUALITY_LABELS[entry.quality]}` : 'N/A'}
            </Text>
          </View>
          {entry.bathroom_trips !== null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bathroom</Text>
              <Text style={styles.summaryValue}>{entry.bathroom_trips} trip(s)</Text>
            </View>
          )}
          {entry.alarm_used && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Alarm</Text>
              <Text style={styles.summaryValue}>Used</Text>
            </View>
          )}
          {entry.time_to_fall_asleep_min !== null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fell Asleep</Text>
              <Text style={styles.summaryValue}>{entry.time_to_fall_asleep_min} min</Text>
            </View>
          )}
          {entry.notes && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Notes</Text>
              <Text style={[styles.summaryValue, { flex: 1 }]} numberOfLines={2}>{entry.notes}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={clearEntry}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteBtnText}>Clear Sleep Log</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Bedtime */}
      <Text style={styles.sectionTitle}>Bedtime (last night)</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={styles.timeInput}
          value={bedHour}
          onChangeText={setBedHour}
          placeholder="HH"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={styles.timeSeparator}>:</Text>
        <TextInput
          style={styles.timeInput}
          value={bedMinute}
          onChangeText={setBedMinute}
          placeholder="MM"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="number-pad"
          maxLength={2}
        />
        <View style={styles.amPmToggle}>
          <TouchableOpacity
            style={[styles.amPmBtn, bedAmPm === 'AM' && styles.amPmBtnActive]}
            onPress={() => setBedAmPm('AM')}
          >
            <Text style={[styles.amPmText, bedAmPm === 'AM' && styles.amPmTextActive]}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.amPmBtn, bedAmPm === 'PM' && styles.amPmBtnActive]}
            onPress={() => setBedAmPm('PM')}
          >
            <Text style={[styles.amPmText, bedAmPm === 'PM' && styles.amPmTextActive]}>PM</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Wake time */}
      <Text style={styles.sectionTitle}>Wake Time (this morning)</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={styles.timeInput}
          value={wakeHour}
          onChangeText={setWakeHour}
          placeholder="HH"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={styles.timeSeparator}>:</Text>
        <TextInput
          style={styles.timeInput}
          value={wakeMinute}
          onChangeText={setWakeMinute}
          placeholder="MM"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="number-pad"
          maxLength={2}
        />
        <View style={styles.amPmToggle}>
          <TouchableOpacity
            style={[styles.amPmBtn, wakeAmPm === 'AM' && styles.amPmBtnActive]}
            onPress={() => setWakeAmPm('AM')}
          >
            <Text style={[styles.amPmText, wakeAmPm === 'AM' && styles.amPmTextActive]}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.amPmBtn, wakeAmPm === 'PM' && styles.amPmBtnActive]}
            onPress={() => setWakeAmPm('PM')}
          >
            <Text style={[styles.amPmText, wakeAmPm === 'PM' && styles.amPmTextActive]}>PM</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quality */}
      <Text style={styles.sectionTitle}>Sleep Quality</Text>
      <View style={styles.qualityRow}>
        {[1, 2, 3, 4, 5].map((q) => (
          <TouchableOpacity
            key={q}
            style={[styles.qualityBtn, quality === q && styles.qualityBtnActive]}
            onPress={() => setQuality(q)}
          >
            <Text style={[styles.qualityNum, quality === q && styles.qualityNumActive]}>{q}</Text>
            <Text style={[styles.qualityLabel, quality === q && styles.qualityLabelActive]}>
              {QUALITY_LABELS[q]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Optional fields */}
      <Text style={styles.sectionTitle}>Optional Details</Text>
      <View style={styles.optionalCard}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Bathroom Trips</Text>
          <TextInput
            style={styles.smallInput}
            value={bathroomTrips}
            onChangeText={setBathroomTrips}
            placeholder="0"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>

        <View style={styles.fieldDivider} />

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Alarm Used</Text>
          <Switch
            value={alarmUsed}
            onValueChange={setAlarmUsed}
            trackColor={{ false: Colors.divider, true: Colors.accent }}
            thumbColor={Colors.text}
          />
        </View>

        <View style={styles.fieldDivider} />

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Time to Fall Asleep (min)</Text>
          <TextInput
            style={styles.smallInput}
            value={timeToFallAsleep}
            onChangeText={setTimeToFallAsleep}
            placeholder="min"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="How was your sleep?"
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={3}
      />

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, (!bedHour || !wakeHour) && styles.logBtnDisabled]}
        onPress={logSleep}
        disabled={!bedHour || !wakeHour}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Sleep</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timeInput: {
    width: 56,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  timeSeparator: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  amPmToggle: {
    flexDirection: 'row',
    marginLeft: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  amPmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.inputBackground,
  },
  amPmBtnActive: {
    backgroundColor: Colors.accent,
  },
  amPmText: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  amPmTextActive: {
    color: Colors.primaryBackground,
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  qualityBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  qualityBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  qualityNum: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  qualityNumActive: {
    color: Colors.primaryBackground,
  },
  qualityLabel: {
    color: Colors.secondaryText,
    fontSize: 9,
    marginTop: 2,
  },
  qualityLabelActive: {
    color: Colors.primaryBackground,
  },
  optionalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: Colors.text,
    fontSize: 14,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 12,
  },
  smallInput: {
    width: 60,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: 15,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  notesInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  logBtnDisabled: {
    opacity: 0.4,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 17,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6,
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
});
