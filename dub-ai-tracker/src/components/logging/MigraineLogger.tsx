// Sprint 22: Migraine Tracker Logger
// Daily entry: occurred (yes/no), severity, symptoms, triggers, location, medication, zip code

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../../utils/storage';
import { getActiveDate } from '../../services/dateContextService';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import type {
  MigraineEntry,
  MigraineSymptom,
  MigraineHeadLocation,
  MigraineTrigger,
} from '../../types';
import {
  MIGRAINE_SYMPTOM_OPTIONS,
  MIGRAINE_HEAD_LOCATION_OPTIONS,
  MIGRAINE_TRIGGER_OPTIONS,
} from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Calculate duration in minutes between two HH:MM time strings, handling midnight crossing */
function calculateDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) {
    endMin += 24 * 60; // crossed midnight
  }
  return endMin - startMin;
}

export function MigraineLogger() {
  const { showToast } = useToast();
  const today = getActiveDate();

  const [occurred, setOccurred] = useState<boolean | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [manualDuration, setManualDuration] = useState('');
  const [severity, setSeverity] = useState(5);
  const [symptoms, setSymptoms] = useState<MigraineSymptom[]>([]);
  const [symptomOtherText, setSymptomOtherText] = useState('');
  const [locations, setLocations] = useState<MigraineHeadLocation[]>([]);
  const [triggers, setTriggers] = useState<MigraineTrigger[]>([]);
  const [triggerOtherText, setTriggerOtherText] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [medicationTaken, setMedicationTaken] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [medicationTime, setMedicationTime] = useState('');
  const [reliefRating, setReliefRating] = useState(3);
  const [notes, setNotes] = useState('');
  const [existingEntry, setExistingEntry] = useState<MigraineEntry | null>(null);

  // Collapsible sections
  const [symptomsExpanded, setSymptomsExpanded] = useState(true);
  const [triggersExpanded, setTriggersExpanded] = useState(false);
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [medicationExpanded, setMedicationExpanded] = useState(false);

  // Load existing entry + last zip code
  useEffect(() => {
    (async () => {
      const [existing, lastZip] = await Promise.all([
        storageGet<MigraineEntry>(dateKey(STORAGE_KEYS.LOG_MIGRAINE, today)),
        storageGet<string>(STORAGE_KEYS.SETTINGS_LAST_ZIP_CODE),
      ]);
      if (lastZip) setZipCode(lastZip);
      if (existing) {
        setExistingEntry(existing);
        setOccurred(existing.occurred);
        if (existing.occurred) {
          setStartTime(existing.start_time ?? '');
          setEndTime(existing.end_time ?? '');
          setManualDuration(existing.total_duration_minutes?.toString() ?? '');
          setSeverity(existing.severity ?? 5);
          setSymptoms(existing.symptoms);
          setSymptomOtherText(existing.symptom_other_text ?? '');
          setLocations(existing.location_on_head);
          setTriggers(existing.triggers);
          setTriggerOtherText(existing.trigger_other_text ?? '');
          setZipCode(existing.zip_code ?? lastZip ?? '');
          setMedicationTaken(existing.medication_taken);
          setMedicationName(existing.medication_name ?? '');
          setMedicationTime(existing.medication_time ?? '');
          setReliefRating(existing.relief_rating ?? 3);
          setNotes(existing.notes ?? '');
        }
      }
    })();
  }, [today]);

  const toggleCollapsible = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    hapticSelection();
    setter((prev) => !prev);
  }, []);

  const toggleMultiSelect = useCallback(<T extends string>(
    value: T,
    setter: React.Dispatch<React.SetStateAction<T[]>>,
  ) => {
    hapticSelection();
    setter((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  }, []);

  const computedDuration = startTime && endTime
    ? calculateDurationMinutes(startTime, endTime)
    : null;

  const totalDuration = computedDuration ?? (manualDuration ? parseInt(manualDuration, 10) : null);

  const handleNoMigraine = useCallback(async () => {
    const key = dateKey(STORAGE_KEYS.LOG_MIGRAINE, today);
    const entry: MigraineEntry = {
      id: existingEntry?.id ?? `mig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      date: today,
      occurred: false,
      start_time: null,
      end_time: null,
      total_duration_minutes: null,
      severity: null,
      symptoms: [],
      symptom_other_text: null,
      location_on_head: [],
      triggers: [],
      trigger_other_text: null,
      zip_code: null,
      medication_taken: false,
      medication_name: null,
      medication_time: null,
      relief_rating: null,
      notes: null,
    };
    await storageSet(key, entry);
    hapticSuccess();
    showToast('No migraine today — logged', 'success');
  }, [today, existingEntry, showToast]);

  const handleSave = useCallback(async () => {
    const key = dateKey(STORAGE_KEYS.LOG_MIGRAINE, today);

    // Persist zip code for future pre-fill
    if (zipCode.length === 5) {
      await storageSet(STORAGE_KEYS.SETTINGS_LAST_ZIP_CODE, zipCode);
    }

    const entry: MigraineEntry = {
      id: existingEntry?.id ?? `mig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      date: today,
      occurred: true,
      start_time: startTime || null,
      end_time: endTime || null,
      total_duration_minutes: totalDuration ?? null,
      severity,
      symptoms,
      symptom_other_text: symptoms.includes('other') ? symptomOtherText.trim() || null : null,
      location_on_head: locations,
      triggers,
      trigger_other_text: triggers.includes('other') ? triggerOtherText.trim() || null : null,
      zip_code: zipCode.length === 5 ? zipCode : null,
      medication_taken: medicationTaken,
      medication_name: medicationTaken ? medicationName.trim() || null : null,
      medication_time: medicationTaken ? medicationTime || null : null,
      relief_rating: medicationTaken ? reliefRating : null,
      notes: notes.trim() || null,
    };
    await storageSet(key, entry);
    hapticSuccess();
    showToast('Migraine entry saved', 'success');
  }, [
    today, existingEntry, startTime, endTime, totalDuration, severity,
    symptoms, symptomOtherText, locations, triggers, triggerOtherText,
    zipCode, medicationTaken, medicationName, medicationTime, reliefRating,
    notes, showToast,
  ]);

  const renderCollapsibleHeader = (title: string, expanded: boolean, onToggle: () => void) => (
    <TouchableOpacity style={styles.collapsibleHeader} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={Colors.secondaryText}
      />
    </TouchableOpacity>
  );

  const renderPillGrid = <T extends string>(
    options: { value: T; label: string }[],
    selected: T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
  ) => (
    <View style={styles.pillGrid}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.pill, isSelected && styles.pillActive]}
            onPress={() => toggleMultiSelect(opt.value, setter)}
          >
            <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // If user hasn't chosen yet, show the occurred/not-occurred choice
  if (occurred === null) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PremiumCard>
          <Text style={styles.cardTitle}>Did a migraine occur today?</Text>
          <View style={styles.toggleRow}>
            <PremiumButton
              label="No Migraine Today"
              onPress={() => { setOccurred(false); handleNoMigraine(); }}
              variant="secondary"
              size="large"
              icon="checkmark-circle-outline"
            />
          </View>
          <View style={{ marginTop: 12 }}>
            <PremiumButton
              label="Yes, Log Migraine"
              onPress={() => { hapticSelection(); setOccurred(true); }}
              variant="primary"
              size="large"
              icon="flash-outline"
            />
          </View>
        </PremiumCard>
      </ScrollView>
    );
  }

  // If no migraine
  if (occurred === false) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PremiumCard>
          <View style={styles.noMigraineCard}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            <Text style={styles.noMigraineText}>No migraine today</Text>
            <TouchableOpacity onPress={() => { hapticSelection(); setOccurred(true); }}>
              <Text style={styles.changeText}>Tap to change</Text>
            </TouchableOpacity>
          </View>
        </PremiumCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Severity */}
      <PremiumCard>
        <Text style={styles.cardTitle}>Severity: <Text style={styles.severityValue}>{severity}/10</Text></Text>
        <View style={styles.severityRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            const isActive = n === severity;
            const color = n <= 3 ? '#4CAF50' : n <= 6 ? '#FF9800' : '#EF5350';
            return (
              <TouchableOpacity
                key={n}
                style={[styles.severityDot, isActive && { backgroundColor: color, borderColor: color }]}
                onPress={() => { hapticSelection(); setSeverity(n); }}
              >
                <Text style={[styles.severityDotText, isActive && { color: '#fff' }]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </PremiumCard>

      {/* Timing */}
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>Timing</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Start (HH:MM)</Text>
            <TextInput
              style={styles.textInput}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="e.g. 14:30"
              placeholderTextColor={Colors.divider}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>End (HH:MM)</Text>
            <TextInput
              style={styles.textInput}
              value={endTime}
              onChangeText={setEndTime}
              placeholder="ongoing"
              placeholderTextColor={Colors.divider}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>
        {computedDuration != null && (
          <Text style={styles.durationCalc}>Calculated: {computedDuration} minutes</Text>
        )}
        {!computedDuration && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.fieldLabel}>Or enter duration manually (minutes)</Text>
            <TextInput
              style={styles.textInput}
              value={manualDuration}
              onChangeText={(t) => setManualDuration(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 120"
              placeholderTextColor={Colors.divider}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        )}
      </PremiumCard>

      {/* Symptoms */}
      <PremiumCard style={styles.card}>
        {renderCollapsibleHeader('Symptoms', symptomsExpanded, () => toggleCollapsible(setSymptomsExpanded))}
        {symptomsExpanded && (
          <>
            {renderPillGrid(MIGRAINE_SYMPTOM_OPTIONS, symptoms, setSymptoms)}
            {symptoms.includes('other') && (
              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                value={symptomOtherText}
                onChangeText={(t) => setSymptomOtherText(t.slice(0, 100))}
                placeholder="Describe other symptom..."
                placeholderTextColor={Colors.divider}
              />
            )}
          </>
        )}
      </PremiumCard>

      {/* Location on Head */}
      <PremiumCard style={styles.card}>
        {renderCollapsibleHeader('Location on Head', locationExpanded, () => toggleCollapsible(setLocationExpanded))}
        {locationExpanded && renderPillGrid(MIGRAINE_HEAD_LOCATION_OPTIONS, locations, setLocations)}
      </PremiumCard>

      {/* Triggers */}
      <PremiumCard style={styles.card}>
        {renderCollapsibleHeader('Triggers', triggersExpanded, () => toggleCollapsible(setTriggersExpanded))}
        {triggersExpanded && (
          <>
            {renderPillGrid(MIGRAINE_TRIGGER_OPTIONS, triggers, setTriggers)}
            {triggers.includes('other') && (
              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                value={triggerOtherText}
                onChangeText={(t) => setTriggerOtherText(t.slice(0, 100))}
                placeholder="Describe other trigger..."
                placeholderTextColor={Colors.divider}
              />
            )}
          </>
        )}
      </PremiumCard>

      {/* Zip Code */}
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>Zip code (for weather pattern tracking)</Text>
        <TextInput
          style={styles.textInput}
          value={zipCode}
          onChangeText={(t) => setZipCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
          placeholder="e.g. 90210"
          placeholderTextColor={Colors.divider}
          keyboardType="number-pad"
          maxLength={5}
        />
      </PremiumCard>

      {/* Medication */}
      <PremiumCard style={styles.card}>
        {renderCollapsibleHeader('Medication', medicationExpanded, () => toggleCollapsible(setMedicationExpanded))}
        {medicationExpanded && (
          <>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !medicationTaken && styles.toggleBtnActive]}
                onPress={() => { hapticSelection(); setMedicationTaken(false); }}
              >
                <Text style={[styles.toggleText, !medicationTaken && styles.toggleTextActive]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, medicationTaken && styles.toggleBtnActive]}
                onPress={() => { hapticSelection(); setMedicationTaken(true); }}
              >
                <Text style={[styles.toggleText, medicationTaken && styles.toggleTextActive]}>Yes</Text>
              </TouchableOpacity>
            </View>
            {medicationTaken && (
              <>
                <TextInput
                  style={[styles.textInput, { marginTop: 8 }]}
                  value={medicationName}
                  onChangeText={(t) => setMedicationName(t.slice(0, 100))}
                  placeholder="Medication name"
                  placeholderTextColor={Colors.divider}
                />
                <TextInput
                  style={[styles.textInput, { marginTop: 8 }]}
                  value={medicationTime}
                  onChangeText={setMedicationTime}
                  placeholder="Time taken (HH:MM)"
                  placeholderTextColor={Colors.divider}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
                  Relief rating: <Text style={styles.severityValue}>{reliefRating}/5</Text>
                </Text>
                <View style={styles.reliefRow}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const isActive = n === reliefRating;
                    const color = n <= 2 ? '#EF5350' : n === 3 ? '#FF9800' : '#4CAF50';
                    return (
                      <TouchableOpacity
                        key={n}
                        style={[styles.reliefDot, isActive && { backgroundColor: color, borderColor: color }]}
                        onPress={() => { hapticSelection(); setReliefRating(n); }}
                      >
                        <Text style={[styles.severityDotText, isActive && { color: '#fff' }]}>{n}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </PremiumCard>

      {/* Notes */}
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>Notes</Text>
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          value={notes}
          onChangeText={(t) => setNotes(t.slice(0, 500))}
          placeholder="Optional notes..."
          placeholderTextColor={Colors.divider}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{notes.length}/500</Text>
      </PremiumCard>

      {/* Save */}
      <View style={styles.saveRow}>
        <PremiumButton
          label={existingEntry ? 'Update Entry' : 'Save Entry'}
          onPress={handleSave}
          variant="primary"
          size="large"
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  card: { marginTop: 12 },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  severityValue: {
    color: Colors.accentText,
    fontWeight: '600',
  },

  // Severity row (1-10)
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  severityDot: {
    width: 32,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityDotText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },

  // Timing
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  fieldLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 6,
  },
  durationCalc: {
    color: Colors.accentText,
    fontSize: 13,
    marginTop: 8,
    fontWeight: '500',
  },

  // Collapsible
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Pill grid (multi-select)
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  pillActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
  },
  pillText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  pillTextActive: {
    color: Colors.accentText,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  toggleBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
  },
  toggleText: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.accentText,
  },

  // Relief rating row
  reliefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  reliefDot: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // No migraine
  noMigraineCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  noMigraineText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  changeText: {
    color: Colors.accentText,
    fontSize: 14,
  },

  // Input
  textInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: Colors.secondaryText,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },

  // Save
  saveRow: {
    marginTop: 20,
  },
});
