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
  KeyboardAvoidingView,
  Platform,
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
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { DateTimePicker } from '../common/DateTimePicker';
import { todayDateString } from '../../utils/dayBoundary';
import { getActiveDate } from '../../services/dateContextService';
import { calculateSleepAdherence } from '../../utils/sleepAdherence';


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
  const { lastEntry, loading: lastLoading, saveAsLast } = useLastEntry<SleepEntry>('sleep.tracking');
  const [entry, setEntry] = useState<SleepEntry | null>(null);
  const [adherence, setAdherence] = useState<{
    overallScore: number;
    bedtimeAdherence: { score: number; diffMinutes: number; label: string } | null;
    wakeAdherence: { score: number; diffMinutes: number; label: string } | null;
  } | null>(null);

  // Form state — DateTimePicker replaces manual HH:MM inputs
  const defaultBedtime = (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(22, 0, 0, 0); return d; })();
  const defaultWake = (() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; })();
  const [bedtime, setBedtime] = useState<Date>(defaultBedtime);
  const [wakeTime, setWakeTime] = useState<Date>(defaultWake);
  const [bedtimeTouched, setBedtimeTouched] = useState(false);
  const [wakeTouched, setWakeTouched] = useState(false);
  const [quality, setQuality] = useState<number>(3);
  const [bathroomTrips, setBathroomTrips] = useState('');
  const [alarmUsed, setAlarmUsed] = useState(false);
  const [timeToFallAsleep, setTimeToFallAsleep] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    const stored = await storageGet<SleepEntry>(key);
    if (stored) {
      setEntry(stored);
      // Calculate adherence if schedule is set
      if (stored.bedtime || stored.wake_time) {
        const adh = await calculateSleepAdherence(stored.bedtime, stored.wake_time);
        setAdherence(adh);
      }
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
    if (!bedtimeTouched || !wakeTouched) {
      Alert.alert('Select Times', 'Please select both bedtime and wake time.');
      return;
    }

    const newEntry: SleepEntry = {
      bedtime: bedtime.toISOString(),
      wake_time: wakeTime.toISOString(),
      quality,
      bathroom_trips: bathroomTrips ? parseInt(bathroomTrips, 10) : null,
      alarm_used: alarmUsed,
      time_to_fall_asleep_min: timeToFallAsleep ? parseInt(timeToFallAsleep, 10) : null,
      notes: notes.trim() || null,
      device_data: null,
      source: 'manual',
    };

    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    await storageSet(key, newEntry);
    await saveAsLast(newEntry);
    setEntry(newEntry);
    onEntryLogged?.();
  }, [bedtime, wakeTime, bedtimeTouched, wakeTouched, quality, bathroomTrips, alarmUsed, timeToFallAsleep, notes, onEntryLogged, saveAsLast]);

  const clearEntry = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    await storageSet(key, null);
    setEntry(null);
    setBedtimeTouched(false);
    setWakeTouched(false);
    setQuality(3);
    setBathroomTrips('');
    setAlarmUsed(false);
    setTimeToFallAsleep('');
    setNotes('');
  }, []);

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    if (lastEntry.bedtime) {
      const bed = new Date(lastEntry.bedtime);
      // Shift to last night (same time, yesterday)
      const newBed = new Date();
      newBed.setDate(newBed.getDate() - 1);
      newBed.setHours(bed.getHours(), bed.getMinutes(), 0, 0);
      setBedtime(newBed);
      setBedtimeTouched(true);
    }
    if (lastEntry.wake_time) {
      const wake = new Date(lastEntry.wake_time);
      const newWake = new Date();
      newWake.setHours(wake.getHours(), wake.getMinutes(), 0, 0);
      setWakeTime(newWake);
      setWakeTouched(true);
    }
    if (lastEntry.quality) setQuality(lastEntry.quality);
  }, [lastEntry]);

  const repeatSubtitle = lastEntry
    ? lastEntry.quality
      ? `Quality ${lastEntry.quality}/5 - ${QUALITY_LABELS[lastEntry.quality]}`
      : undefined
    : undefined;

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
          {adherence && (
            <>
              <View style={{ height: 1, backgroundColor: Colors.divider, width: '100%', marginVertical: 10 }} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Schedule Adherence</Text>
                <Text style={[styles.summaryValue, { color: adherence.overallScore >= 75 ? Colors.success : adherence.overallScore >= 50 ? Colors.warning : Colors.danger }]}>
                  {adherence.overallScore}%
                </Text>
              </View>
              {adherence.bedtimeAdherence && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bedtime</Text>
                  <Text style={styles.summaryValue}>
                    {adherence.bedtimeAdherence.diffMinutes > 0 ? '+' : ''}{adherence.bedtimeAdherence.diffMinutes}min ({adherence.bedtimeAdherence.label})
                  </Text>
                </View>
              )}
              {adherence.wakeAdherence && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Wake</Text>
                  <Text style={styles.summaryValue}>
                    {adherence.wakeAdherence.diffMinutes > 0 ? '+' : ''}{adherence.wakeAdherence.diffMinutes}min ({adherence.wakeAdherence.label})
                  </Text>
                </View>
              )}
            </>
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <RepeatLastEntry
        tagLabel="sleep"
        subtitle={repeatSubtitle}
        visible={!lastLoading && lastEntry != null}
        onRepeat={handleRepeatLast}
      />
      {/* Bedtime — DateTimePicker in time mode */}
      <DateTimePicker
        mode="time"
        label="Bedtime (last night)"
        value={bedtime}
        onChange={(d) => { setBedtime(d); setBedtimeTouched(true); }}
      />

      {/* Wake time — DateTimePicker in time mode */}
      <DateTimePicker
        mode="time"
        label="Wake Time (this morning)"
        value={wakeTime}
        onChange={(d) => { setWakeTime(d); setWakeTouched(true); }}
      />

      {/* Duration preview */}
      {bedtimeTouched && wakeTouched && (
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: Colors.accentText, fontSize: 16, fontWeight: '600' }}>
            {computeDurationHours(bedtime.toISOString(), wakeTime.toISOString())}h sleep
          </Text>
        </View>
      )}

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
        style={[styles.logBtn, (!bedtimeTouched || !wakeTouched) && styles.logBtnDisabled]}
        onPress={logSleep}
        disabled={!bedtimeTouched || !wakeTouched}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Sleep</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
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
    fontSize: 11,
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
