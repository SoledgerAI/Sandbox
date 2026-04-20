// Sprint 23: Body Measurement Logger
// Weight, body fat, tape measurements with unit toggle, last-entry reference
// "Log when you measure" — not daily, typically weekly/biweekly

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
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import { TimestampPicker } from '../common/TimestampPicker';
import { storageGet, storageSet, storageList, STORAGE_KEYS, dateKey } from '../../utils/storage';
import { getActiveDate } from '../../services/dateContextService';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import type {
  BodyMeasurementEntry,
  BodyMeasurementMeasurements,
  WeightUnit,
  MeasurementUnit,
} from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MEASUREMENT_FIELDS: { key: keyof BodyMeasurementMeasurements; label: string }[] = [
  { key: 'neck', label: 'Neck' },
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'bicep_left', label: 'Bicep (L)' },
  { key: 'bicep_right', label: 'Bicep (R)' },
  { key: 'thigh_left', label: 'Thigh (L)' },
  { key: 'thigh_right', label: 'Thigh (R)' },
];

const EMPTY_MEASUREMENTS: BodyMeasurementMeasurements = {
  waist: null, hips: null, chest: null,
  bicep_left: null, bicep_right: null,
  thigh_left: null, thigh_right: null, neck: null,
};

export function BodyMeasurementLogger() {
  const { showToast } = useToast();
  const today = getActiveDate();

  // Form state
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');
  const [bodyFat, setBodyFat] = useState('');
  const [measurements, setMeasurements] = useState<Record<keyof BodyMeasurementMeasurements, string>>({
    waist: '', hips: '', chest: '',
    bicep_left: '', bicep_right: '',
    thigh_left: '', thigh_right: '', neck: '',
  });
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('in');
  const [photoTaken, setPhotoTaken] = useState(false);
  const [notes, setNotes] = useState('');
  const [timestamp, setTimestamp] = useState(new Date());

  // UI
  const [measurementsExpanded, setMeasurementsExpanded] = useState(false);
  const [existingEntry, setExistingEntry] = useState<BodyMeasurementEntry | null>(null);
  const [lastEntry, setLastEntry] = useState<BodyMeasurementEntry | null>(null);

  // Load existing entry, preferences, and last entry
  useEffect(() => {
    (async () => {
      const [existing, savedWeightUnit, savedMeasUnit] = await Promise.all([
        storageGet<BodyMeasurementEntry>(dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today)),
        storageGet<WeightUnit>(STORAGE_KEYS.SETTINGS_BODY_MEAS_WEIGHT_UNIT),
        storageGet<MeasurementUnit>(STORAGE_KEYS.SETTINGS_BODY_MEAS_UNIT),
      ]);

      if (savedWeightUnit) setWeightUnit(savedWeightUnit);
      if (savedMeasUnit) setMeasurementUnit(savedMeasUnit);

      if (existing) {
        setExistingEntry(existing);
        if (existing.weight != null) setWeight(String(existing.weight));
        if (existing.body_fat_percentage != null) setBodyFat(String(existing.body_fat_percentage));
        setWeightUnit(existing.weight_unit);
        setMeasurementUnit(existing.measurement_unit);
        setPhotoTaken(existing.photo_taken);
        if (existing.notes) setNotes(existing.notes);
        const m = existing.measurements;
        setMeasurements({
          waist: m.waist != null ? String(m.waist) : '',
          hips: m.hips != null ? String(m.hips) : '',
          chest: m.chest != null ? String(m.chest) : '',
          bicep_left: m.bicep_left != null ? String(m.bicep_left) : '',
          bicep_right: m.bicep_right != null ? String(m.bicep_right) : '',
          thigh_left: m.thigh_left != null ? String(m.thigh_left) : '',
          thigh_right: m.thigh_right != null ? String(m.thigh_right) : '',
          neck: m.neck != null ? String(m.neck) : '',
        });
      }

      // Find the last entry for reference
      const allKeys = await storageList(STORAGE_KEYS.LOG_BODY_MEASUREMENTS);
      const sortedKeys = allKeys.filter((k) => k !== dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today)).sort().reverse();
      if (sortedKeys.length > 0) {
        const last = await storageGet<BodyMeasurementEntry>(sortedKeys[0]);
        if (last) setLastEntry(last);
      }
    })();
  }, [today]);

  const handleToggleWeightUnit = useCallback(async () => {
    hapticSelection();
    const newUnit: WeightUnit = weightUnit === 'lbs' ? 'kg' : 'lbs';
    setWeightUnit(newUnit);
    await storageSet(STORAGE_KEYS.SETTINGS_BODY_MEAS_WEIGHT_UNIT, newUnit);
  }, [weightUnit]);

  const handleToggleMeasurementUnit = useCallback(async () => {
    hapticSelection();
    const newUnit: MeasurementUnit = measurementUnit === 'in' ? 'cm' : 'in';
    setMeasurementUnit(newUnit);
    await storageSet(STORAGE_KEYS.SETTINGS_BODY_MEAS_UNIT, newUnit);
  }, [measurementUnit]);

  const handleSave = useCallback(async () => {
    const weightNum = weight.trim() ? parseFloat(weight) : null;

    // Validate weight
    if (weightNum != null && (weightNum <= 0 || isNaN(weightNum))) {
      showToast('Please enter a valid weight', 'error');
      return;
    }
    if (weightNum != null && weightUnit === 'lbs' && weightNum > 1000) {
      showToast('Weight seems too high. Please check.', 'error');
      return;
    }
    if (weightNum != null && weightUnit === 'kg' && weightNum > 450) {
      showToast('Weight seems too high. Please check.', 'error');
      return;
    }

    // Validate body fat
    const bfNum = bodyFat.trim() ? parseFloat(bodyFat) : null;
    if (bfNum != null && (bfNum < 1 || bfNum > 60 || isNaN(bfNum))) {
      showToast('Body fat must be between 1-60%', 'error');
      return;
    }

    // Parse measurements
    const parsedMeasurements: BodyMeasurementMeasurements = { ...EMPTY_MEASUREMENTS };
    for (const field of MEASUREMENT_FIELDS) {
      const val = measurements[field.key].trim();
      if (val) {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
          parsedMeasurements[field.key] = num;
        }
      }
    }

    if (weightNum == null && bfNum == null && Object.values(parsedMeasurements).every((v) => v == null)) {
      showToast('Please enter at least one measurement', 'error');
      return;
    }

    const entry: BodyMeasurementEntry = {
      id: existingEntry?.id ?? `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: timestamp.toISOString(),
      date: today,
      weight: weightNum,
      weight_unit: weightUnit,
      body_fat_percentage: bfNum,
      measurements: parsedMeasurements,
      measurement_unit: measurementUnit,
      photo_taken: photoTaken,
      notes: notes.trim().slice(0, 500) || null,
    };

    const key = dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today);
    await storageSet(key, entry);
    setExistingEntry(entry);
    hapticSuccess();
    showToast('Body measurements saved', 'success');
  }, [weight, weightUnit, bodyFat, measurements, measurementUnit, photoTaken, notes, existingEntry, today, showToast, timestamp]);

  const handleClear = useCallback(async () => {
    const key = dateKey(STORAGE_KEYS.LOG_BODY_MEASUREMENTS, today);
    await storageSet(key, null);
    setExistingEntry(null);
    setWeight('');
    setBodyFat('');
    setMeasurements({ waist: '', hips: '', chest: '', bicep_left: '', bicep_right: '', thigh_left: '', thigh_right: '', neck: '' });
    setPhotoTaken(false);
    setNotes('');
    hapticSelection();
    showToast('Entry cleared', 'info');
  }, [today, showToast]);

  const formatComparison = (current: string, lastValue: number | null, unit: string): string | null => {
    if (!current.trim() || lastValue == null) return null;
    const curr = parseFloat(current);
    if (isNaN(curr)) return null;
    const diff = curr - lastValue;
    if (diff === 0) return 'no change';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)} ${unit}`;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Last entry reference */}
      {lastEntry && (
        <PremiumCard>
          <View style={styles.lastEntryHeader}>
            <Ionicons name="time-outline" size={16} color={Colors.secondaryText} />
            <Text style={styles.lastEntryTitle}>Last entry: {lastEntry.date}</Text>
          </View>
          {lastEntry.weight != null && (
            <Text style={styles.lastEntryDetail}>Weight: {lastEntry.weight} {lastEntry.weight_unit}</Text>
          )}
          {lastEntry.body_fat_percentage != null && (
            <Text style={styles.lastEntryDetail}>Body fat: {lastEntry.body_fat_percentage}%</Text>
          )}
        </PremiumCard>
      )}

      {/* Weight */}
      <PremiumCard>
        <View style={styles.fieldHeader}>
          <Text style={styles.sectionTitle}>Weight</Text>
          <TouchableOpacity
            style={styles.unitToggle}
            onPress={handleToggleWeightUnit}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${weightUnit === 'lbs' ? 'kilograms' : 'pounds'}`}
          >
            <Text style={[styles.unitOption, weightUnit === 'lbs' && styles.unitOptionActive]}>lbs</Text>
            <Text style={styles.unitDivider}>/</Text>
            <Text style={[styles.unitOption, weightUnit === 'kg' && styles.unitOptionActive]}>kg</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.weightInput}
          value={weight}
          onChangeText={setWeight}
          placeholder={`Enter weight (${weightUnit})`}
          placeholderTextColor={Colors.secondaryText}
          keyboardType="decimal-pad"
          maxLength={6}
          accessibilityLabel={`Weight in ${weightUnit}`}
        />
        {lastEntry?.weight != null && weight.trim() && (() => {
          const comp = formatComparison(weight, lastEntry.weight, weightUnit);
          return comp ? <Text style={styles.comparisonText}>{comp} from last entry</Text> : null;
        })()}
      </PremiumCard>

      {/* Body Fat */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Body Fat %</Text>
        <TextInput
          style={styles.weightInput}
          value={bodyFat}
          onChangeText={setBodyFat}
          placeholder="Enter body fat percentage (1-60)"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="decimal-pad"
          maxLength={5}
          accessibilityLabel="Body fat percentage"
        />
      </PremiumCard>

      {/* Tape Measurements (collapsible) */}
      <PremiumCard>
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            hapticSelection();
            setMeasurementsExpanded((prev) => !prev);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Tape measurements section, ${measurementsExpanded ? 'expanded' : 'collapsed'}`}
        >
          <Text style={styles.sectionTitle}>Tape Measurements</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.unitToggle}
              onPress={handleToggleMeasurementUnit}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${measurementUnit === 'in' ? 'centimeters' : 'inches'}`}
            >
              <Text style={[styles.unitOption, measurementUnit === 'in' && styles.unitOptionActive]}>in</Text>
              <Text style={styles.unitDivider}>/</Text>
              <Text style={[styles.unitOption, measurementUnit === 'cm' && styles.unitOptionActive]}>cm</Text>
            </TouchableOpacity>
            <Ionicons name={measurementsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.accent} />
          </View>
        </TouchableOpacity>
        {measurementsExpanded && (
          <View style={styles.measurementGrid}>
            {MEASUREMENT_FIELDS.map((field) => (
              <View key={field.key} style={styles.measurementRow}>
                <Text style={styles.measurementLabel}>{field.label}</Text>
                <View style={styles.measurementInputWrap}>
                  <TextInput
                    style={styles.measurementInput}
                    value={measurements[field.key]}
                    onChangeText={(v) => setMeasurements((prev) => ({ ...prev, [field.key]: v }))}
                    placeholder={measurementUnit}
                    placeholderTextColor={Colors.secondaryText}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    accessibilityLabel={`${field.label} measurement in ${measurementUnit}`}
                  />
                  {lastEntry?.measurements[field.key] != null && (
                    <Text style={styles.lastMeasValue}>
                      was {lastEntry.measurements[field.key]}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </PremiumCard>

      {/* Photo Flag */}
      <PremiumCard>
        <View style={styles.photoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepperLabel}>Progress photo taken?</Text>
            <Text style={styles.photoHint}>Flag only (photos stored in your camera roll)</Text>
          </View>
          <TouchableOpacity
            style={[styles.photoToggle, photoTaken && styles.photoToggleActive]}
            onPress={() => { hapticSelection(); setPhotoTaken(!photoTaken); }}
            accessibilityRole="checkbox"
            accessibilityLabel="Progress photo taken"
            accessibilityState={{ checked: photoTaken }}
          >
            <Ionicons name={photoTaken ? 'camera' : 'camera-outline'} size={20} color={photoTaken ? Colors.primaryBackground : Colors.text} />
          </TouchableOpacity>
        </View>
      </PremiumCard>

      {/* Notes */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={(t) => setNotes(t.slice(0, 500))}
          placeholder="Measurement conditions, time of day, etc."
          placeholderTextColor={Colors.secondaryText}
          multiline
          numberOfLines={3}
          maxLength={500}
          accessibilityLabel="Measurement notes"
        />
        <Text style={styles.charCount}>{notes.length}/500</Text>
      </PremiumCard>

      {/* Save */}
      <PremiumButton
        label={existingEntry ? 'Update Measurements' : 'Save Measurements'}
        onPress={handleSave}
        variant="primary"
        size="large"
      />

      {existingEntry && (
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear} accessibilityRole="button" accessibilityLabel="Clear measurement entry">
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.clearBtnText}>Clear Entry</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },

  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },

  // Last entry reference
  lastEntryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  lastEntryTitle: { color: Colors.secondaryText, fontSize: 13 },
  lastEntryDetail: { color: Colors.text, fontSize: 13, marginLeft: 22 },

  // Field header with unit toggle
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  unitToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.inputBackground, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  unitOption: { color: Colors.secondaryText, fontSize: 13, fontWeight: '600' },
  unitOptionActive: { color: Colors.accent },
  unitDivider: { color: Colors.divider, fontSize: 13, marginHorizontal: 4 },

  // Weight input
  weightInput: {
    backgroundColor: Colors.inputBackground, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, color: Colors.text, fontSize: 18, fontWeight: '600',
    textAlign: 'center', borderWidth: 1, borderColor: Colors.divider,
  },
  comparisonText: { color: Colors.accent, fontSize: 12, textAlign: 'center', marginTop: 6 },

  // Collapsible
  collapsibleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Measurements
  measurementGrid: { marginTop: 8, gap: 10 },
  measurementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  measurementLabel: { color: Colors.text, fontSize: 14, width: 90 },
  measurementInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  measurementInput: {
    width: 80, backgroundColor: Colors.inputBackground, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, color: Colors.text, fontSize: 15,
    textAlign: 'center', borderWidth: 1, borderColor: Colors.divider,
  },
  lastMeasValue: { color: Colors.secondaryText, fontSize: 11 },

  // Photo
  photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoHint: { color: Colors.secondaryText, fontSize: 11, marginTop: 2 },
  stepperLabel: { color: Colors.text, fontSize: 14 },
  photoToggle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.inputBackground,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.divider,
  },
  photoToggleActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },

  // Notes
  notesInput: {
    backgroundColor: Colors.inputBackground, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, color: Colors.text, fontSize: 14, borderWidth: 1,
    borderColor: Colors.divider, minHeight: 80, textAlignVertical: 'top',
  },
  charCount: { color: Colors.secondaryText, fontSize: 11, textAlign: 'right', marginTop: 4 },

  // Clear
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  clearBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '500' },
});
