// Weight logging component -- entry in lbs or kg per unit preference
// Phase 9: Body Metrics and Weight Tracking

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
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
import { LBS_PER_KG } from '../../constants/formulas';
import type { BodyEntry } from '../../types';
import type { UserProfile } from '../../types/profile';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { todayDateString } from '../../utils/dayBoundary';


interface WeightLoggerProps {
  onEntryLogged?: () => void;
}

export function WeightLogger({ onEntryLogged }: WeightLoggerProps) {
  const { lastEntry, loading: lastLoading, saveAsLast } = useLastEntry<BodyEntry>('body.measurements');
  const [weightInput, setWeightInput] = useState('');
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const [todayEntry, setTodayEntry] = useState<BodyEntry | null>(null);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const stored = await storageGet<BodyEntry>(key);
    setTodayEntry(stored);

    const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
    if (profile?.units) {
      setUnits(profile.units);
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
    const value = parseFloat(weightInput);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Weight', `Please enter a valid weight in ${unitLabel}.`);
      return;
    }

    const weightLbs = units === 'metric' ? value * LBS_PER_KG : value;

    const today = todayDateString();
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
      timestamp: new Date().toISOString(),
    };

    await storageSet(key, entry);
    await saveAsLast(entry);
    setTodayEntry(entry);
    setWeightInput('');
    onEntryLogged?.();
  }, [weightInput, units, unitLabel, onEntryLogged, saveAsLast]);

  const clearWeight = useCallback(async () => {
    const today = todayDateString();
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
      ? (lastEntry.weight_lbs / LBS_PER_KG).toFixed(1)
      : lastEntry.weight_lbs.toFixed(1);
    setWeightInput(displayVal);
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

      {/* Weight input */}
      <Text style={styles.sectionTitle}>
        {displayWeight != null ? 'Update Weight' : 'Log Weight'}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={weightInput}
          onChangeText={setWeightInput}
          placeholder={unitLabel}
          placeholderTextColor={Colors.secondaryText}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={logWeight}
        />
        <TouchableOpacity
          style={[styles.logBtn, !weightInput && styles.logBtnDisabled]}
          onPress={logWeight}
          disabled={!weightInput}
          activeOpacity={0.7}
        >
          <Text style={styles.logBtnText}>Log</Text>
        </TouchableOpacity>
      </View>

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
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  logBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 24,
    justifyContent: 'center',
    minHeight: 48,
  },
  logBtnDisabled: {
    opacity: 0.4,
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
