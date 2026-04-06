// Body measurements logging component
// Phase 9: Body Metrics and Weight Tracking
// Areas: Neck, chest, waist, hips, bicep L/R, thigh L/R, calf L/R

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
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
import { CM_PER_INCH } from '../../constants/formulas';
import type { BodyEntry, BodyMeasurements } from '../../types';
import type { UserProfile } from '../../types/profile';
import { TimestampPicker } from '../common/TimestampPicker';
import { todayDateString } from '../../utils/dayBoundary';


type MeasurementField = keyof BodyMeasurements;

const MEASUREMENT_FIELDS: { key: MeasurementField; label: string }[] = [
  { key: 'neck', label: 'Neck' },
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'bicep_left', label: 'Bicep (L)' },
  { key: 'bicep_right', label: 'Bicep (R)' },
  { key: 'thigh_left', label: 'Thigh (L)' },
  { key: 'thigh_right', label: 'Thigh (R)' },
  { key: 'calf_left', label: 'Calf (L)' },
  { key: 'calf_right', label: 'Calf (R)' },
];

const EMPTY_MEASUREMENTS: BodyMeasurements = {
  neck: null,
  chest: null,
  waist: null,
  hips: null,
  bicep_left: null,
  bicep_right: null,
  thigh_left: null,
  thigh_right: null,
  calf_left: null,
  calf_right: null,
};

interface MeasurementsLoggerProps {
  onEntryLogged?: () => void;
}

export function MeasurementsLogger({ onEntryLogged }: MeasurementsLoggerProps) {
  const [entryTimestamp, setEntryTimestamp] = useState(new Date());
  const [inputs, setInputs] = useState<Record<MeasurementField, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const f of MEASUREMENT_FIELDS) initial[f.key] = '';
      return initial as Record<MeasurementField, string>;
    },
  );
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const [todayMeasurements, setTodayMeasurements] = useState<BodyMeasurements | null>(null);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const stored = await storageGet<BodyEntry>(key);
    setTodayMeasurements(stored?.measurements ?? null);

    const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
    if (profile?.units) {
      setUnits(profile.units);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unitLabel = units === 'metric' ? 'cm' : 'in';

  const updateInput = useCallback((field: MeasurementField, value: string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  }, []);

  const logMeasurements = useCallback(async () => {
    const measurements: BodyMeasurements = { ...EMPTY_MEASUREMENTS };
    let hasAny = false;

    for (const f of MEASUREMENT_FIELDS) {
      const raw = inputs[f.key].trim();
      if (raw) {
        const value = parseFloat(raw);
        if (isNaN(value) || value <= 0) {
          Alert.alert('Invalid Value', `${f.label} must be a positive number.`);
          return;
        }
        // Store in inches internally
        measurements[f.key] = units === 'metric' ? value / CM_PER_INCH : value;
        hasAny = true;
      }
    }

    if (!hasAny) {
      Alert.alert('No Data', 'Please enter at least one measurement.');
      return;
    }

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const existing = await storageGet<BodyEntry>(key);

    // Merge with existing measurements if any
    const merged: BodyMeasurements = { ...(existing?.measurements ?? EMPTY_MEASUREMENTS) };
    for (const f of MEASUREMENT_FIELDS) {
      if (measurements[f.key] != null) {
        merged[f.key] = measurements[f.key];
      }
    }

    const entry: BodyEntry = {
      weight_lbs: existing?.weight_lbs ?? null,
      body_fat_pct: existing?.body_fat_pct ?? null,
      measurements: merged,
      bp_systolic: existing?.bp_systolic ?? null,
      bp_diastolic: existing?.bp_diastolic ?? null,
      resting_hr: existing?.resting_hr ?? null,
      hrv_ms: existing?.hrv_ms ?? null,
      spo2_pct: existing?.spo2_pct ?? null,
      timestamp: entryTimestamp.toISOString(),
      source: 'manual',
    };

    await storageSet(key, entry);
    setTodayMeasurements(merged);

    // Clear inputs
    const cleared: Record<string, string> = {};
    for (const f of MEASUREMENT_FIELDS) cleared[f.key] = '';
    setInputs(cleared as Record<MeasurementField, string>);

    onEntryLogged?.();
  }, [inputs, units, onEntryLogged]);

  const displayValue = (field: MeasurementField): string | null => {
    const val = todayMeasurements?.[field];
    if (val == null) return null;
    const displayed = units === 'metric' ? val * CM_PER_INCH : val;
    return displayed.toFixed(1);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TimestampPicker value={entryTimestamp} onChange={setEntryTimestamp} />

      {/* Current measurements */}
      {todayMeasurements != null && (
        <View style={styles.currentCard}>
          <Text style={styles.cardTitle}>Today's Measurements ({unitLabel})</Text>
          <View style={styles.measureGrid}>
            {MEASUREMENT_FIELDS.map((f) => {
              const val = displayValue(f.key);
              if (val == null) return null;
              return (
                <View key={f.key} style={styles.measureItem}>
                  <Text style={styles.measureLabel}>{f.label}</Text>
                  <Text style={styles.measureValue}>
                    {val} {unitLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Input fields */}
      <Text style={styles.sectionTitle}>Log Measurements ({unitLabel})</Text>
      {MEASUREMENT_FIELDS.map((f) => (
        <View key={f.key} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <TextInput
            style={styles.fieldInput}
            value={inputs[f.key]}
            onChangeText={(v) => updateInput(f.key, v)}
            placeholder={unitLabel}
            placeholderTextColor={Colors.secondaryText}
            keyboardType="decimal-pad"
          />
        </View>
      ))}

      {/* Unit toggle */}
      <View style={styles.unitToggle}>
        <TouchableOpacity
          style={[styles.unitBtn, units === 'imperial' && styles.unitBtnActive]}
          onPress={() => setUnits('imperial')}
        >
          <Text style={[styles.unitBtnText, units === 'imperial' && styles.unitBtnTextActive]}>
            inches
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitBtn, units === 'metric' && styles.unitBtnActive]}
          onPress={() => setUnits('metric')}
        >
          <Text style={[styles.unitBtnText, units === 'metric' && styles.unitBtnTextActive]}>
            cm
          </Text>
        </TouchableOpacity>
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.saveBtn} onPress={logMeasurements} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primaryBackground} />
        <Text style={styles.saveBtnText}>Save Measurements</Text>
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
    paddingBottom: 32,
  },
  currentCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  measureItem: {
    flexBasis: '48%',
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    padding: 10,
  },
  measureLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  measureValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  fieldLabel: {
    color: Colors.secondaryText,
    fontSize: 14,
    width: 80,
  },
  fieldInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  unitToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  unitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  unitBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  unitBtnText: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  unitBtnTextActive: {
    color: Colors.primaryBackground,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  saveBtnText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
});
