// Weight logging component -- entry in lbs or kg per unit preference
// Phase 9: Body Metrics and Weight Tracking
// TF-06: dual-wheel picker for 0.1 lb/kg precision. Left wheel holds the
// whole-number portion, right wheel holds tenths (0–9). Combined value is
// persisted as a float with 1-decimal precision in BodyEntry.weight_lbs.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { hapticSuccess } from '../../utils/haptics';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import { LBS_PER_KG } from '../../constants/formulas';
import type { BodyEntry } from '../../types';
import type { UserProfile } from '../../types/profile';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { TimestampPicker } from '../common/TimestampPicker';
import { todayDateString } from '../../utils/dayBoundary';
import { getActiveDate } from '../../services/dateContextService';


interface WeightLoggerProps {
  onEntryLogged?: () => void;
}

type UnitPref = 'imperial' | 'metric';

const RANGES: Record<UnitPref, { min: number; max: number }> = {
  imperial: { min: 50, max: 400 },
  metric: { min: 25, max: 200 },
};

function clampWhole(whole: number, unitPref: UnitPref): number {
  const { min, max } = RANGES[unitPref];
  return Math.max(min, Math.min(max, whole));
}

/** Snap a display value to 0.1 precision, then split into whole + tenths (0–9). */
function splitValue(v: number, unitPref: UnitPref): { whole: number; tenths: number } {
  const snapped = Math.round(v * 10) / 10;
  const clamped = Math.max(RANGES[unitPref].min, Math.min(RANGES[unitPref].max, snapped));
  const whole = Math.floor(clamped);
  const tenths = Math.round((clamped - whole) * 10);
  // Handle floating-point edge case where tenths rounds to 10
  if (tenths >= 10) return { whole: clampWhole(whole + 1, unitPref), tenths: 0 };
  return { whole, tenths };
}

export function WeightLogger({ onEntryLogged }: WeightLoggerProps) {
  const { lastEntry, loading: lastLoading, saveAsLast } = useLastEntry<BodyEntry>('body.measurements');
  const [entryTimestamp, setEntryTimestamp] = useState(new Date());
  const [wholeValue, setWholeValue] = useState<number>(150);
  const [decimalTenths, setDecimalTenths] = useState<number>(0);
  const [units, setUnits] = useState<UnitPref>('imperial');
  const [todayEntry, setTodayEntry] = useState<BodyEntry | null>(null);

  const selectedWeight = wholeValue + decimalTenths / 10;

  const loadData = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const stored = await storageGet<BodyEntry>(key);
    setTodayEntry(stored);

    const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
    const unitPref: UnitPref = profile?.units ?? 'imperial';
    setUnits(unitPref);

    // Default picker to last logged weight or profile weight
    const sourceLbs = stored?.weight_lbs ?? profile?.weight_lbs;
    if (sourceLbs != null) {
      const displayVal = unitPref === 'metric' ? sourceLbs / LBS_PER_KG : sourceLbs;
      const { whole, tenths } = splitValue(displayVal, unitPref);
      setWholeValue(whole);
      setDecimalTenths(tenths);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayWeight = todayEntry?.weight_lbs != null
    ? units === 'metric'
      ? (todayEntry.weight_lbs / LBS_PER_KG).toFixed(1)
      : todayEntry.weight_lbs.toFixed(1)
    : null;

  const unitLabel = units === 'metric' ? 'kg' : 'lbs';

  const logWeight = useCallback(async () => {
    const value = selectedWeight;
    if (value <= 0 || isNaN(value)) {
      Alert.alert('Invalid Weight', `Please select a valid weight in ${unitLabel}.`);
      return;
    }

    // Persist with 1-decimal precision. Metric → lbs conversion can introduce
    // floating-point artifacts (e.g. 88.1 kg → 194.224… lbs); round to 0.1.
    const rawLbs = units === 'metric' ? value * LBS_PER_KG : value;
    const weightLbs = Math.round(rawLbs * 10) / 10;

    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const existing = await storageGet<BodyEntry>(key);

    const entry: BodyEntry = {
      weight_lbs: weightLbs,
      body_fat_pct: existing?.body_fat_pct ?? null,
      measurements: existing?.measurements ?? null,
      bp_systolic: existing?.bp_systolic ?? null,
      bp_diastolic: existing?.bp_diastolic ?? null,
      resting_hr: existing?.resting_hr ?? null,
      hrv_ms: existing?.hrv_ms ?? null,
      spo2_pct: existing?.spo2_pct ?? null,
      timestamp: entryTimestamp.toISOString(),
      source: 'manual',
    };

    await storageSet(key, entry);
    await saveAsLast(entry);
    setTodayEntry(entry);
    hapticSuccess();
    onEntryLogged?.();
  }, [selectedWeight, units, unitLabel, onEntryLogged, saveAsLast, entryTimestamp]);

  const clearWeight = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const existing = await storageGet<BodyEntry>(key);
    if (!existing) return;

    const updated: BodyEntry = { ...existing, weight_lbs: null };
    await storageSet(key, updated);
    setTodayEntry(updated);
  }, []);

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry?.weight_lbs) return;
    const displayVal = units === 'metric'
      ? lastEntry.weight_lbs / LBS_PER_KG
      : lastEntry.weight_lbs;
    const { whole, tenths } = splitValue(displayVal, units);
    setWholeValue(whole);
    setDecimalTenths(tenths);
  }, [lastEntry, units]);

  const handleUnitChange = useCallback((next: UnitPref) => {
    if (next === units) return;
    // Convert the current picker value into the new unit, then snap.
    const currentInNewUnit = next === 'metric'
      ? selectedWeight / LBS_PER_KG
      : selectedWeight * LBS_PER_KG;
    const { whole, tenths } = splitValue(currentInNewUnit, next);
    setWholeValue(whole);
    setDecimalTenths(tenths);
    setUnits(next);
  }, [units, selectedWeight]);

  const wholeItems = useMemo(() => {
    const { min, max } = RANGES[units];
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [units]);

  const repeatSubtitle = lastEntry?.weight_lbs != null
    ? `${lastEntry.weight_lbs.toFixed(1)} lbs`
    : undefined;

  return (
    <View style={styles.container}>
      <RepeatLastEntry
        tagLabel="body entry"
        subtitle={repeatSubtitle}
        visible={!lastLoading && lastEntry != null}
        onRepeat={handleRepeatLast}
      />

      <TimestampPicker value={entryTimestamp} onChange={setEntryTimestamp} />

      {/* Current weight display */}
      {displayWeight != null && (
        <View style={styles.currentCard}>
          <Ionicons name="scale-outline" size={28} color={Colors.accent} />
          <View style={styles.currentInfo}>
            <Text style={styles.currentValue}>
              {displayWeight} {unitLabel}
            </Text>
            <Text style={styles.currentLabel}>Today's weight</Text>
          </View>
          <TouchableOpacity
            onPress={clearWeight}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* Weight picker */}
      <Text style={styles.sectionTitle}>
        {displayWeight != null ? 'Update Weight' : 'Log Weight'}
      </Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={wholeValue}
          onValueChange={(v) => {
            const safe = Number(v);
            if (!isNaN(safe)) setWholeValue(safe);
          }}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {wholeItems.map((val) => (
            <Picker.Item key={val} label={`${val}`} value={val} />
          ))}
        </Picker>
        <Picker
          selectedValue={decimalTenths}
          onValueChange={(v) => {
            const safe = Number(v);
            if (!isNaN(safe)) setDecimalTenths(safe);
          }}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
            <Picker.Item key={val} label={`.${val}`} value={val} />
          ))}
        </Picker>
        <View style={styles.pickerUnit}>
          <Text style={styles.pickerUnitText}>{unitLabel}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.logBtn}
        onPress={logWeight}
        activeOpacity={0.7}
      >
        <Text style={styles.logBtnText}>Log</Text>
      </TouchableOpacity>

      {/* Unit toggle */}
      <View style={styles.unitToggle}>
        <TouchableOpacity
          style={[styles.unitBtn, units === 'imperial' && styles.unitBtnActive]}
          onPress={() => handleUnitChange('imperial')}
        >
          <Text
            style={[styles.unitBtnText, units === 'imperial' && styles.unitBtnTextActive]}
          >
            lbs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitBtn, units === 'metric' && styles.unitBtnActive]}
          onPress={() => handleUnitChange('metric')}
        >
          <Text
            style={[styles.unitBtnText, units === 'metric' && styles.unitBtnTextActive]}
          >
            kg
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  currentInfo: {
    flex: 1,
  },
  currentValue: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  currentLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    flex: 1,
    color: Colors.text,
    height: 180,
  },
  pickerItem: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  pickerUnit: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  pickerUnitText: {
    color: Colors.secondaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  logBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 16,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '600',
  },
  unitToggle: {
    flexDirection: 'row',
    gap: 8,
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
});
