// Weight logging component -- entry in lbs or kg per unit preference
// Phase 9: Body Metrics and Weight Tracking

import { useState, useEffect, useCallback } from 'react';
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

export function WeightLogger({ onEntryLogged }: WeightLoggerProps) {
  const { lastEntry, loading: lastLoading, saveAsLast } = useLastEntry<BodyEntry>('body.measurements');
  const [entryTimestamp, setEntryTimestamp] = useState(new Date());
  const [selectedWeight, setSelectedWeight] = useState<number>(150);
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const [todayEntry, setTodayEntry] = useState<BodyEntry | null>(null);

  const loadData = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const stored = await storageGet<BodyEntry>(key);
    setTodayEntry(stored);

    const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
    if (profile?.units) {
      setUnits(profile.units);
    }
    // Default picker to last logged weight or profile weight
    if (stored?.weight_lbs) {
      const displayVal = profile?.units === 'metric'
        ? Math.round(stored.weight_lbs / LBS_PER_KG * 2) / 2
        : Math.round(stored.weight_lbs);
      setSelectedWeight(displayVal);
    } else if (profile?.weight_lbs) {
      const displayVal = profile?.units === 'metric'
        ? Math.round(profile.weight_lbs / LBS_PER_KG * 2) / 2
        : Math.round(profile.weight_lbs);
      setSelectedWeight(displayVal);
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
    if (value <= 0) {
      Alert.alert('Invalid Weight', `Please select a valid weight in ${unitLabel}.`);
      return;
    }

    const weightLbs = units === 'metric' ? value * LBS_PER_KG : value;

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
      ? Math.round(lastEntry.weight_lbs / LBS_PER_KG * 2) / 2
      : Math.round(lastEntry.weight_lbs);
    setSelectedWeight(displayVal);
  }, [lastEntry, units]);

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
          selectedValue={selectedWeight}
          onValueChange={(v) => setSelectedWeight(v as number)}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {(units === 'metric'
            ? Array.from({ length: 401 }, (_, i) => 25 + i * 0.5)
            : Array.from({ length: 451 }, (_, i) => 50 + i)
          ).map((val) => (
            <Picker.Item key={val} label={`${val} ${unitLabel}`} value={val} />
          ))}
        </Picker>
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
          onPress={() => setUnits('imperial')}
        >
          <Text
            style={[styles.unitBtnText, units === 'imperial' && styles.unitBtnTextActive]}
          >
            lbs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitBtn, units === 'metric' && styles.unitBtnActive]}
          onPress={() => setUnits('metric')}
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
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    color: Colors.text,
    height: 180,
  },
  pickerItem: {
    color: Colors.text,
    fontSize: 20,
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
