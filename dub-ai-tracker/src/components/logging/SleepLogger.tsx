// Sprint 23: Enhanced Sleep Logger
// Daily entry: bedtime, wake time, quality, disturbances, sleep aids, naps, quick log mode
// Gold styling, PremiumCards, haptic feedback, collapsible sections

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { KeyboardAwareScreen } from '../KeyboardAwareScreen';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../../utils/storage';
import { getActiveDate } from '../../services/dateContextService';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import { DateTimePicker } from '../common/DateTimePicker';
import type {
  SleepEntry,
  SleepDisturbance,
  SleepAid,
} from '../../types';
import {
  SLEEP_DISTURBANCE_OPTIONS,
  SLEEP_AID_OPTIONS,
} from '../../types';

const QUALITY_LABELS: Record<number, string> = {
  1: 'Terrible',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
};

/** Compute sleep duration in hours from two ISO datetime strings, handling overnight */
function computeDurationHours(bedtime: string, wakeTime: string): number {
  const bed = new Date(bedtime).getTime();
  let wake = new Date(wakeTime).getTime();
  if (wake <= bed) {
    // Crossed midnight or same-day nap scenario: assume next day
    wake += 24 * 60 * 60 * 1000;
  }
  return Math.round(((wake - bed) / (1000 * 60 * 60)) * 10) / 10;
}

export function SleepLogger() {
  // Enable LayoutAnimation on Android (must be inside component to avoid test breakage)
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const { showToast } = useToast();
  const today = getActiveDate();

  // Quick log mode
  const [quickLogMode, setQuickLogMode] = useState(false);

  // Core fields
  const defaultBedtime = (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(22, 0, 0, 0); return d; })();
  const defaultWake = (() => { const d = new Date(); d.setHours(6, 30, 0, 0); return d; })();
  const [bedtime, setBedtime] = useState<Date>(defaultBedtime);
  const [wakeTime, setWakeTime] = useState<Date>(defaultWake);
  const [bedtimeTouched, setBedtimeTouched] = useState(false);
  const [wakeTouched, setWakeTouched] = useState(false);
  const [quality, setQuality] = useState<number>(3);

  // Extended fields
  const [timeToFallAsleep, setTimeToFallAsleep] = useState(0);
  const [wakeUps, setWakeUps] = useState(0);
  const [disturbances, setDisturbances] = useState<SleepDisturbance[]>([]);
  const [disturbanceOtherText, setDisturbanceOtherText] = useState('');
  const [sleepAids, setSleepAids] = useState<SleepAid[]>([]);
  const [sleepAidOtherText, setSleepAidOtherText] = useState('');
  const [nap, setNap] = useState(false);
  const [napDuration, setNapDuration] = useState(30);
  const [notes, setNotes] = useState('');

  // Existing entry
  const [existingEntry, setExistingEntry] = useState<SleepEntry | null>(null);

  // Collapsible sections
  const [disturbancesExpanded, setDisturbancesExpanded] = useState(false);
  const [aidsExpanded, setAidsExpanded] = useState(false);
  const [napExpanded, setNapExpanded] = useState(false);

  // Load existing entry
  useEffect(() => {
    (async () => {
      const existing = await storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, today));
      if (existing) {
        setExistingEntry(existing);
        if (existing.bedtime) {
          setBedtime(new Date(existing.bedtime));
          setBedtimeTouched(true);
        }
        if (existing.wake_time) {
          setWakeTime(new Date(existing.wake_time));
          setWakeTouched(true);
        }
        if (existing.quality) setQuality(existing.quality);
        if (existing.time_to_fall_asleep_min != null) setTimeToFallAsleep(existing.time_to_fall_asleep_min);
        if (existing.wake_ups != null) setWakeUps(existing.wake_ups);
        if (existing.disturbances) setDisturbances(existing.disturbances);
        if (existing.disturbance_other_text) setDisturbanceOtherText(existing.disturbance_other_text);
        if (existing.sleep_aids_used) setSleepAids(existing.sleep_aids_used);
        if (existing.sleep_aid_other_text) setSleepAidOtherText(existing.sleep_aid_other_text);
        if (existing.nap != null) setNap(existing.nap);
        if (existing.nap_duration_minutes != null) setNapDuration(existing.nap_duration_minutes);
        if (existing.notes) setNotes(existing.notes);
      }
    })();
  }, [today]);

  const toggleSection = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    hapticSelection();
    setter((prev) => !prev);
  }, []);

  const toggleDisturbance = useCallback((value: SleepDisturbance) => {
    hapticSelection();
    setDisturbances((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }, []);

  const toggleSleepAid = useCallback((value: SleepAid) => {
    hapticSelection();
    if (value === 'none') {
      setSleepAids(['none']);
      return;
    }
    setSleepAids((prev) => {
      const without = prev.filter((a) => a !== 'none');
      return without.includes(value) ? without.filter((a) => a !== value) : [...without, value];
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!bedtimeTouched || !wakeTouched) {
      Alert.alert('Select Times', 'Please select both bedtime and wake time.');
      return;
    }

    const bedISO = bedtime.toISOString();
    const wakeISO = wakeTime.toISOString();
    const duration = computeDurationHours(bedISO, wakeISO);

    // Edge case: unreasonably short or long sleep
    if (duration < 0.5) {
      Alert.alert('Check Times', 'Sleep duration is less than 30 minutes. Please verify your bedtime and wake time.');
      return;
    }
    if (duration > 18) {
      Alert.alert('Check Times', 'Sleep duration exceeds 18 hours. Please verify your bedtime and wake time.');
      return;
    }

    const entry: SleepEntry = {
      bedtime: bedISO,
      wake_time: wakeISO,
      quality,
      bathroom_trips: null,
      alarm_used: null,
      time_to_fall_asleep_min: quickLogMode ? null : (timeToFallAsleep > 0 ? timeToFallAsleep : null),
      notes: notes.trim().slice(0, 500) || null,
      device_data: null,
      source: 'manual',
      // Sprint 23 fields
      total_duration_hours: duration,
      wake_ups: quickLogMode ? null : wakeUps,
      disturbances: quickLogMode ? [] : disturbances,
      disturbance_other_text: (!quickLogMode && disturbances.includes('other') && disturbanceOtherText.trim()) ? disturbanceOtherText.trim() : null,
      sleep_aids_used: quickLogMode ? [] : sleepAids,
      sleep_aid_other_text: (!quickLogMode && sleepAids.includes('other') && sleepAidOtherText.trim()) ? sleepAidOtherText.trim() : null,
      nap: quickLogMode ? null : nap,
      nap_duration_minutes: (!quickLogMode && nap) ? napDuration : null,
    };

    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    await storageSet(key, entry);
    setExistingEntry(entry);
    hapticSuccess();
    showToast('Sleep logged', 'success');
  }, [bedtime, wakeTime, bedtimeTouched, wakeTouched, quality, timeToFallAsleep, wakeUps, disturbances, disturbanceOtherText, sleepAids, sleepAidOtherText, nap, napDuration, notes, quickLogMode, today, showToast]);

  const handleClear = useCallback(async () => {
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, today);
    await storageSet(key, null);
    setExistingEntry(null);
    setBedtimeTouched(false);
    setWakeTouched(false);
    setQuality(3);
    setTimeToFallAsleep(0);
    setWakeUps(0);
    setDisturbances([]);
    setDisturbanceOtherText('');
    setSleepAids([]);
    setSleepAidOtherText('');
    setNap(false);
    setNapDuration(30);
    setNotes('');
    hapticSelection();
    showToast('Sleep entry cleared', 'info');
  }, [today, showToast]);

  // Show summary if already logged
  if (existingEntry && existingEntry.bedtime && existingEntry.wake_time) {
    const duration = existingEntry.total_duration_hours ?? computeDurationHours(existingEntry.bedtime, existingEntry.wake_time);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PremiumCard>
          <View style={styles.summaryHeader}>
            <Ionicons name="moon" size={28} color={Colors.accent} />
            <Text style={styles.summaryTitle}>Sleep Logged</Text>
          </View>
          <View style={styles.durationHighlight}>
            <Text style={styles.durationValue}>{duration}h</Text>
            <Text style={styles.durationLabel}>total sleep</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Bedtime</Text>
            <Text style={styles.summaryValue}>
              {new Date(existingEntry.bedtime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Wake</Text>
            <Text style={styles.summaryValue}>
              {new Date(existingEntry.wake_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Quality</Text>
            <Text style={styles.summaryValue}>
              {existingEntry.quality ? `${existingEntry.quality}/5 — ${QUALITY_LABELS[existingEntry.quality]}` : 'N/A'}
            </Text>
          </View>
          {existingEntry.wake_ups != null && existingEntry.wake_ups > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Wake-ups</Text>
              <Text style={styles.summaryValue}>{existingEntry.wake_ups} time(s)</Text>
            </View>
          )}
          {existingEntry.disturbances && existingEntry.disturbances.length > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Disturbances</Text>
              <Text style={[styles.summaryValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                {existingEntry.disturbances.map((d) => SLEEP_DISTURBANCE_OPTIONS.find((o) => o.value === d)?.label ?? d).join(', ')}
              </Text>
            </View>
          )}
          {existingEntry.sleep_aids_used && existingEntry.sleep_aids_used.length > 0 && existingEntry.sleep_aids_used[0] !== 'none' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sleep aids</Text>
              <Text style={[styles.summaryValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                {existingEntry.sleep_aids_used.map((a) => SLEEP_AID_OPTIONS.find((o) => o.value === a)?.label ?? a).join(', ')}
              </Text>
            </View>
          )}
          {existingEntry.nap && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Nap</Text>
              <Text style={styles.summaryValue}>{existingEntry.nap_duration_minutes ?? 0} min</Text>
            </View>
          )}
          {existingEntry.notes && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Notes</Text>
              <Text style={[styles.summaryValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{existingEntry.notes}</Text>
            </View>
          )}
        </PremiumCard>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Clear sleep log entry"
        >
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.clearBtnText}>Clear & Re-enter</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.content}>
      {/* Quick Log Toggle */}
      <PremiumCard>
        <View style={styles.quickLogRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickLogLabel}>Quick Log</Text>
            <Text style={styles.quickLogHint}>Just bedtime, wake time & quality</Text>
          </View>
          <Switch
            value={quickLogMode}
            onValueChange={(v) => { hapticSelection(); setQuickLogMode(v); }}
            trackColor={{ false: Colors.divider, true: Colors.accent }}
            thumbColor={Colors.text}
            accessibilityLabel="Toggle quick log mode"
          />
        </View>
      </PremiumCard>

      {/* Bedtime & Wake Time */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Sleep Times</Text>
        <DateTimePicker
          mode="time"
          label="Bedtime (last night)"
          value={bedtime}
          onChange={(d) => { setBedtime(d); setBedtimeTouched(true); hapticSelection(); }}
        />
        <DateTimePicker
          mode="time"
          label="Wake Time (this morning)"
          value={wakeTime}
          onChange={(d) => { setWakeTime(d); setWakeTouched(true); hapticSelection(); }}
        />
        {bedtimeTouched && wakeTouched && (
          <View style={styles.durationHighlight}>
            <Text style={styles.durationValue}>
              {computeDurationHours(bedtime.toISOString(), wakeTime.toISOString())}h
            </Text>
            <Text style={styles.durationLabel}>sleep duration</Text>
          </View>
        )}
      </PremiumCard>

      {/* Quality */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Sleep Quality</Text>
        <View style={styles.qualityRow}>
          {[1, 2, 3, 4, 5].map((q) => (
            <TouchableOpacity
              key={q}
              style={[styles.qualityBtn, quality === q && styles.qualityBtnActive]}
              onPress={() => { setQuality(q); hapticSelection(); }}
              accessibilityRole="button"
              accessibilityLabel={`Quality ${q}: ${QUALITY_LABELS[q]}`}
              accessibilityState={{ selected: quality === q }}
            >
              <Text style={[styles.qualityNum, quality === q && styles.qualityNumActive]}>{q}</Text>
              <Text style={[styles.qualityLabel, quality === q && styles.qualityLabelActive]}>
                {QUALITY_LABELS[q]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </PremiumCard>

      {!quickLogMode && (
        <>
          {/* Time to Fall Asleep & Wake-ups */}
          <PremiumCard>
            <Text style={styles.sectionTitle}>Sleep Details</Text>
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Time to fall asleep (min)</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => { setTimeToFallAsleep((v) => Math.max(0, v - 5)); hapticSelection(); }}
                  accessibilityLabel="Decrease time to fall asleep"
                >
                  <Ionicons name="remove" size={18} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{timeToFallAsleep}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => { setTimeToFallAsleep((v) => Math.min(120, v + 5)); hapticSelection(); }}
                  accessibilityLabel="Increase time to fall asleep"
                >
                  <Ionicons name="add" size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Wake-ups during night</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => { setWakeUps((v) => Math.max(0, v - 1)); hapticSelection(); }}
                  accessibilityLabel="Decrease wake-ups"
                >
                  <Ionicons name="remove" size={18} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{wakeUps}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => { setWakeUps((v) => Math.min(10, v + 1)); hapticSelection(); }}
                  accessibilityLabel="Increase wake-ups"
                >
                  <Ionicons name="add" size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </PremiumCard>

          {/* Disturbances (collapsible) */}
          <PremiumCard>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection(setDisturbancesExpanded)}
              accessibilityRole="button"
              accessibilityLabel={`Disturbances section, ${disturbancesExpanded ? 'expanded' : 'collapsed'}`}
            >
              <Text style={styles.sectionTitle}>
                Disturbances {disturbances.length > 0 ? `(${disturbances.length})` : ''}
              </Text>
              <Ionicons name={disturbancesExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.accent} />
            </TouchableOpacity>
            {disturbancesExpanded && (
              <View style={styles.multiSelectGrid}>
                {SLEEP_DISTURBANCE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.multiSelectChip, disturbances.includes(opt.value) && styles.multiSelectChipActive]}
                    onPress={() => toggleDisturbance(opt.value)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ checked: disturbances.includes(opt.value) }}
                  >
                    <Text style={[styles.multiSelectText, disturbances.includes(opt.value) && styles.multiSelectTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {disturbances.includes('other') && (
                  <TextInput
                    style={styles.otherInput}
                    value={disturbanceOtherText}
                    onChangeText={setDisturbanceOtherText}
                    placeholder="Describe other disturbance..."
                    placeholderTextColor={Colors.secondaryText}
                    maxLength={200}
                    accessibilityLabel="Other disturbance description"
                  />
                )}
              </View>
            )}
          </PremiumCard>

          {/* Sleep Aids (collapsible) */}
          <PremiumCard>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection(setAidsExpanded)}
              accessibilityRole="button"
              accessibilityLabel={`Sleep aids section, ${aidsExpanded ? 'expanded' : 'collapsed'}`}
            >
              <Text style={styles.sectionTitle}>
                Sleep Aids {sleepAids.length > 0 && sleepAids[0] !== 'none' ? `(${sleepAids.length})` : ''}
              </Text>
              <Ionicons name={aidsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.accent} />
            </TouchableOpacity>
            {aidsExpanded && (
              <View style={styles.multiSelectGrid}>
                {SLEEP_AID_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.multiSelectChip, sleepAids.includes(opt.value) && styles.multiSelectChipActive]}
                    onPress={() => toggleSleepAid(opt.value)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ checked: sleepAids.includes(opt.value) }}
                  >
                    <Text style={[styles.multiSelectText, sleepAids.includes(opt.value) && styles.multiSelectTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {sleepAids.includes('other') && (
                  <TextInput
                    style={styles.otherInput}
                    value={sleepAidOtherText}
                    onChangeText={setSleepAidOtherText}
                    placeholder="Describe other sleep aid..."
                    placeholderTextColor={Colors.secondaryText}
                    maxLength={200}
                    accessibilityLabel="Other sleep aid description"
                  />
                )}
              </View>
            )}
          </PremiumCard>

          {/* Naps (collapsible) */}
          <PremiumCard>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => toggleSection(setNapExpanded)}
              accessibilityRole="button"
              accessibilityLabel={`Naps section, ${napExpanded ? 'expanded' : 'collapsed'}`}
            >
              <Text style={styles.sectionTitle}>Naps</Text>
              <Ionicons name={napExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.accent} />
            </TouchableOpacity>
            {napExpanded && (
              <View>
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>Did you nap today?</Text>
                  <Switch
                    value={nap}
                    onValueChange={(v) => { hapticSelection(); setNap(v); }}
                    trackColor={{ false: Colors.divider, true: Colors.accent }}
                    thumbColor={Colors.text}
                    accessibilityLabel="Toggle nap"
                  />
                </View>
                {nap && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.stepperRow}>
                      <Text style={styles.stepperLabel}>Nap duration (min)</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => { setNapDuration((v) => Math.max(5, v - 5)); hapticSelection(); }}
                          accessibilityLabel="Decrease nap duration"
                        >
                          <Ionicons name="remove" size={18} color={Colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{napDuration}</Text>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => { setNapDuration((v) => Math.min(180, v + 5)); hapticSelection(); }}
                          accessibilityLabel="Increase nap duration"
                        >
                          <Ionicons name="add" size={18} color={Colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}
          </PremiumCard>

          {/* Notes */}
          <PremiumCard>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, 500))}
              placeholder="Anything else about your sleep..."
              placeholderTextColor={Colors.secondaryText}
              multiline
              numberOfLines={3}
              maxLength={500}
              accessibilityLabel="Sleep notes"
            />
            <Text style={styles.charCount}>{notes.length}/500</Text>
          </PremiumCard>
        </>
      )}

      {/* Save Button */}
      <PremiumButton
        label={existingEntry ? 'Update Sleep Entry' : 'Log Sleep'}
        onPress={handleSave}
        variant="primary"
        size="large"
        disabled={!bedtimeTouched || !wakeTouched}
      />

      <View style={{ height: 32 }} />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },

  // Quick Log
  quickLogRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickLogLabel: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  quickLogHint: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },

  // Section titles
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },

  // Duration
  durationHighlight: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  durationValue: { color: Colors.accent, fontSize: 32, fontWeight: '700' },
  durationLabel: { color: Colors.secondaryText, fontSize: 13, marginTop: 2 },

  // Quality
  qualityRow: { flexDirection: 'row', gap: 6 },
  qualityBtn: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.inputBackground,
    borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.divider,
  },
  qualityBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  qualityNum: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  qualityNumActive: { color: Colors.primaryBackground },
  qualityLabel: { color: Colors.secondaryText, fontSize: 11, marginTop: 2 },
  qualityLabelActive: { color: Colors.primaryBackground },

  // Steppers
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  stepperLabel: { color: Colors.text, fontSize: 14, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.inputBackground,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.divider,
  },
  stepperValue: { color: Colors.text, fontSize: 18, fontWeight: '600', minWidth: 30, textAlign: 'center' },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },

  // Collapsible
  collapsibleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Multi-select
  multiSelectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  multiSelectChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.divider,
  },
  multiSelectChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  multiSelectText: { color: Colors.text, fontSize: 13 },
  multiSelectTextActive: { color: Colors.primaryBackground, fontWeight: '600' },
  otherInput: {
    width: '100%', backgroundColor: Colors.inputBackground, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontSize: 14,
    borderWidth: 1, borderColor: Colors.divider, marginTop: 4,
  },

  // Notes
  notesInput: {
    backgroundColor: Colors.inputBackground, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, color: Colors.text, fontSize: 14, borderWidth: 1,
    borderColor: Colors.divider, minHeight: 80, textAlignVertical: 'top',
  },
  charCount: { color: Colors.secondaryText, fontSize: 11, textAlign: 'right', marginTop: 4 },

  // Summary
  summaryHeader: { alignItems: 'center', marginBottom: 12 },
  summaryTitle: { color: Colors.accent, fontSize: 20, fontWeight: '700', marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { color: Colors.secondaryText, fontSize: 14 },
  summaryValue: { color: Colors.text, fontSize: 14, fontWeight: '600' },

  // Clear
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  clearBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '500' },
});
