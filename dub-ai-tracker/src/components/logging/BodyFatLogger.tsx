// Body fat percentage logging component
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
import type { BodyEntry } from '../../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface BodyFatLoggerProps {
  onEntryLogged?: () => void;
}

export function BodyFatLogger({ onEntryLogged }: BodyFatLoggerProps) {
  const [bfInput, setBfInput] = useState('');
  const [todayEntry, setTodayEntry] = useState<BodyEntry | null>(null);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const stored = await storageGet<BodyEntry>(key);
    setTodayEntry(stored);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logBodyFat = useCallback(async () => {
    const value = parseFloat(bfInput);
    if (isNaN(value) || value < 1 || value > 70) {
      Alert.alert('Invalid Value', 'Please enter a body fat percentage between 1 and 70.');
      return;
    }

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const existing = await storageGet<BodyEntry>(key);

    const entry: BodyEntry = {
      weight_lbs: existing?.weight_lbs ?? null,
      body_fat_pct: value,
      measurements: existing?.measurements ?? null,
      bp_systolic: existing?.bp_systolic ?? null,
      bp_diastolic: existing?.bp_diastolic ?? null,
      resting_hr: existing?.resting_hr ?? null,
      hrv_ms: existing?.hrv_ms ?? null,
      spo2_pct: existing?.spo2_pct ?? null,
      timestamp: new Date().toISOString(),
    };

    await storageSet(key, entry);
    setTodayEntry(entry);
    setBfInput('');
    onEntryLogged?.();
  }, [bfInput, onEntryLogged]);

  const clearBodyFat = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const existing = await storageGet<BodyEntry>(key);
    if (!existing) return;

    const updated: BodyEntry = { ...existing, body_fat_pct: null };
    await storageSet(key, updated);
    setTodayEntry(updated);
  }, []);

  return (
    <View style={styles.container}>
      {/* Current body fat display */}
      {todayEntry?.body_fat_pct != null && (
        <View style={styles.currentCard}>
          <Ionicons name="body-outline" size={28} color={Colors.accent} />
          <View style={styles.currentInfo}>
            <Text style={styles.currentValue}>{todayEntry.body_fat_pct}%</Text>
            <Text style={styles.currentLabel}>Today's body fat</Text>
          </View>
          <TouchableOpacity
            onPress={clearBodyFat}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <Text style={styles.sectionTitle}>
        {todayEntry?.body_fat_pct != null ? 'Update Body Fat %' : 'Log Body Fat %'}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={bfInput}
          onChangeText={setBfInput}
          placeholder="%"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={logBodyFat}
        />
        <TouchableOpacity
          style={[styles.logBtn, !bfInput && styles.logBtnDisabled]}
          onPress={logBodyFat}
          disabled={!bfInput}
          activeOpacity={0.7}
        >
          <Text style={styles.logBtnText}>Log</Text>
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
});
