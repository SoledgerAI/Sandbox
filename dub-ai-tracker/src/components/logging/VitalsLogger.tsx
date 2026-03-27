// Vitals logging component -- BP, HR, HRV, SpO2
// Phase 9: Body Metrics and Weight Tracking
// BP categories per AHA: Normal <120/80, Elevated 120-129/<80,
// HBP Stage 1 130-139/80-89, HBP Stage 2 140+/90+, Crisis 180+/120+

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
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

interface BpCategory {
  label: string;
  color: string;
}

function getBpCategory(systolic: number, diastolic: number): BpCategory {
  if (systolic >= 180 || diastolic >= 120) {
    return { label: 'Hypertensive Crisis', color: '#D32F2F' };
  }
  if (systolic >= 140 || diastolic >= 90) {
    return { label: 'High BP Stage 2', color: Colors.danger };
  }
  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
    return { label: 'High BP Stage 1', color: '#FF9800' };
  }
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
    return { label: 'Elevated', color: Colors.warning };
  }
  if (systolic < 120 && diastolic < 80) {
    return { label: 'Normal', color: Colors.success };
  }
  return { label: 'Unknown', color: Colors.secondaryText };
}

interface VitalsLoggerProps {
  onEntryLogged?: () => void;
}

export function VitalsLogger({ onEntryLogged }: VitalsLoggerProps) {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [hr, setHr] = useState('');
  const [hrv, setHrv] = useState('');
  const [spo2, setSpo2] = useState('');
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

  const logVitals = useCallback(async () => {
    const sysVal = systolic.trim() ? parseInt(systolic, 10) : null;
    const diaVal = diastolic.trim() ? parseInt(diastolic, 10) : null;
    const hrVal = hr.trim() ? parseInt(hr, 10) : null;
    const hrvVal = hrv.trim() ? parseInt(hrv, 10) : null;
    const spo2Val = spo2.trim() ? parseFloat(spo2) : null;

    // Validate BP pair
    if ((sysVal != null && diaVal == null) || (sysVal == null && diaVal != null)) {
      Alert.alert('Incomplete BP', 'Please enter both systolic and diastolic values.');
      return;
    }

    if (sysVal != null && (isNaN(sysVal) || sysVal < 50 || sysVal > 250)) {
      Alert.alert('Invalid Systolic', 'Systolic should be between 50 and 250.');
      return;
    }
    if (diaVal != null && (isNaN(diaVal) || diaVal < 30 || diaVal > 200)) {
      Alert.alert('Invalid Diastolic', 'Diastolic should be between 30 and 200.');
      return;
    }
    if (hrVal != null && (isNaN(hrVal) || hrVal < 20 || hrVal > 250)) {
      Alert.alert('Invalid HR', 'Heart rate should be between 20 and 250 bpm.');
      return;
    }
    if (hrvVal != null && (isNaN(hrvVal) || hrvVal < 1 || hrvVal > 300)) {
      Alert.alert('Invalid HRV', 'HRV should be between 1 and 300 ms.');
      return;
    }
    if (spo2Val != null && (isNaN(spo2Val) || spo2Val < 70 || spo2Val > 100)) {
      Alert.alert('Invalid SpO2', 'SpO2 should be between 70 and 100%.');
      return;
    }

    if (sysVal == null && hrVal == null && hrvVal == null && spo2Val == null) {
      Alert.alert('No Data', 'Please enter at least one vital sign.');
      return;
    }

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
    const existing = await storageGet<BodyEntry>(key);

    const entry: BodyEntry = {
      weight_lbs: existing?.weight_lbs ?? null,
      body_fat_pct: existing?.body_fat_pct ?? null,
      measurements: existing?.measurements ?? null,
      bp_systolic: sysVal ?? existing?.bp_systolic ?? null,
      bp_diastolic: diaVal ?? existing?.bp_diastolic ?? null,
      resting_hr: hrVal ?? existing?.resting_hr ?? null,
      hrv_ms: hrvVal ?? existing?.hrv_ms ?? null,
      spo2_pct: spo2Val ?? existing?.spo2_pct ?? null,
      timestamp: new Date().toISOString(),
    };

    await storageSet(key, entry);
    setTodayEntry(entry);
    setSystolic('');
    setDiastolic('');
    setHr('');
    setHrv('');
    setSpo2('');
    onEntryLogged?.();
  }, [systolic, diastolic, hr, hrv, spo2, onEntryLogged]);

  const bpCategory =
    todayEntry?.bp_systolic != null && todayEntry?.bp_diastolic != null
      ? getBpCategory(todayEntry.bp_systolic, todayEntry.bp_diastolic)
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current vitals display */}
      {todayEntry != null &&
        (todayEntry.bp_systolic != null ||
          todayEntry.resting_hr != null ||
          todayEntry.hrv_ms != null ||
          todayEntry.spo2_pct != null) && (
          <View style={styles.currentCard}>
            <Text style={styles.cardTitle}>Today's Vitals</Text>

            {todayEntry.bp_systolic != null && todayEntry.bp_diastolic != null && (
              <View style={styles.vitalRow}>
                <View style={styles.vitalInfo}>
                  <Text style={styles.vitalLabel}>Blood Pressure</Text>
                  <Text style={styles.vitalValue}>
                    {todayEntry.bp_systolic}/{todayEntry.bp_diastolic} mmHg
                  </Text>
                </View>
                {bpCategory && (
                  <View style={[styles.bpBadge, { backgroundColor: bpCategory.color }]}>
                    <Text style={styles.bpBadgeText}>{bpCategory.label}</Text>
                  </View>
                )}
              </View>
            )}

            {todayEntry.resting_hr != null && (
              <View style={styles.vitalRow}>
                <View style={styles.vitalInfo}>
                  <Text style={styles.vitalLabel}>Resting Heart Rate</Text>
                  <Text style={styles.vitalValue}>{todayEntry.resting_hr} bpm</Text>
                </View>
              </View>
            )}

            {todayEntry.hrv_ms != null && (
              <View style={styles.vitalRow}>
                <View style={styles.vitalInfo}>
                  <Text style={styles.vitalLabel}>HRV</Text>
                  <Text style={styles.vitalValue}>{todayEntry.hrv_ms} ms</Text>
                </View>
              </View>
            )}

            {todayEntry.spo2_pct != null && (
              <View style={styles.vitalRow}>
                <View style={styles.vitalInfo}>
                  <Text style={styles.vitalLabel}>SpO2</Text>
                  <Text style={styles.vitalValue}>{todayEntry.spo2_pct}%</Text>
                </View>
              </View>
            )}
          </View>
        )}

      {/* Blood Pressure */}
      <Text style={styles.sectionTitle}>Blood Pressure</Text>
      <View style={styles.bpRow}>
        <View style={styles.bpField}>
          <Text style={styles.fieldLabel}>Systolic</Text>
          <TextInput
            style={styles.fieldInput}
            value={systolic}
            onChangeText={setSystolic}
            placeholder="mmHg"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="number-pad"
          />
        </View>
        <Text style={styles.bpSlash}>/</Text>
        <View style={styles.bpField}>
          <Text style={styles.fieldLabel}>Diastolic</Text>
          <TextInput
            style={styles.fieldInput}
            value={diastolic}
            onChangeText={setDiastolic}
            placeholder="mmHg"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Heart Rate */}
      <Text style={styles.sectionTitle}>Resting Heart Rate</Text>
      <View style={styles.singleRow}>
        <TextInput
          style={styles.fieldInput}
          value={hr}
          onChangeText={setHr}
          placeholder="bpm"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="number-pad"
        />
      </View>

      {/* HRV */}
      <Text style={styles.sectionTitle}>Heart Rate Variability (HRV)</Text>
      <View style={styles.singleRow}>
        <TextInput
          style={styles.fieldInput}
          value={hrv}
          onChangeText={setHrv}
          placeholder="ms"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="number-pad"
        />
      </View>

      {/* SpO2 */}
      <Text style={styles.sectionTitle}>Blood Oxygen (SpO2)</Text>
      <View style={styles.singleRow}>
        <TextInput
          style={styles.fieldInput}
          value={spo2}
          onChangeText={setSpo2}
          placeholder="%"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="decimal-pad"
        />
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.saveBtn} onPress={logVitals} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primaryBackground} />
        <Text style={styles.saveBtnText}>Save Vitals</Text>
      </TouchableOpacity>
    </ScrollView>
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
  vitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  vitalInfo: {
    flex: 1,
  },
  vitalLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  vitalValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  bpBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bpBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  bpRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 20,
  },
  bpField: {
    flex: 1,
  },
  bpSlash: {
    color: Colors.secondaryText,
    fontSize: 24,
    fontWeight: '300',
    paddingBottom: 10,
  },
  fieldLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  singleRow: {
    marginBottom: 20,
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
    marginTop: 8,
  },
  saveBtnText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
});
