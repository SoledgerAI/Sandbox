// Sunlight / Outdoors logging — Sprint 19
// Duration, type, nature toggle, quick-log presets, daily total

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
import type { SunlightEntry, SunlightActivityType } from '../../types';
import { SUNLIGHT_ACTIVITY_TYPES } from '../../types';
import { TimestampPicker } from '../common/TimestampPicker';
import { getActiveDate } from '../../services/dateContextService';

const QUICK_PRESETS = [15, 30, 60];

function generateId(): string {
  return `sun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface SunlightLoggerProps {
  onEntryLogged?: () => void;
}

export function SunlightLogger({ onEntryLogged }: SunlightLoggerProps) {
  const [entries, setEntries] = useState<SunlightEntry[]>([]);
  const [selectedType, setSelectedType] = useState<SunlightActivityType>('walk');
  const [customType, setCustomType] = useState('');
  const [duration, setDuration] = useState('');
  const [nature, setNature] = useState(false);
  const [timestamp, setTimestamp] = useState(new Date());

  const loadData = useCallback(async () => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SUNLIGHT, activeDate);
    const stored = await storageGet<SunlightEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dailyTotal = entries.reduce((s, e) => s + e.duration_minutes, 0);
  const hasNatureToday = entries.some((e) => e.nature);

  const logSunlight = useCallback(async (presetMinutes?: number) => {
    const dur = presetMinutes ?? parseInt(duration, 10);
    if (isNaN(dur) || dur < 1 || dur > 480) {
      Alert.alert('Invalid Duration', 'Please enter 1-480 minutes.');
      return;
    }

    const newEntry: SunlightEntry = {
      id: generateId(),
      timestamp: timestamp.toISOString(),
      duration_minutes: dur,
      type: selectedType,
      custom_type: selectedType === 'custom' ? (customType.trim() || null) : null,
      nature,
    };

    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SUNLIGHT, activeDate);
    const updated = [...entries, newEntry];
    await storageSet(key, updated);
    setEntries(updated);
    setDuration('');
    setCustomType('');
    onEntryLogged?.();
  }, [duration, selectedType, customType, nature, entries, onEntryLogged, timestamp]);

  const deleteEntry = useCallback(async (id: string) => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SUNLIGHT, activeDate);
    const updated = entries.filter((e) => e.id !== id);
    await storageSet(key, updated);
    setEntries(updated);
  }, [entries]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Daily summary */}
      {entries.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{dailyTotal}</Text>
            <Text style={styles.summaryUnit}>min outdoors</Text>
          </View>
          {hasNatureToday && (
            <View style={styles.summaryItem}>
              <Ionicons name="leaf" size={20} color="#4CAF50" />
              <Text style={[styles.summaryUnit, { color: '#4CAF50' }]}>Nature day</Text>
            </View>
          )}
        </View>
      )}

      {/* Quick-log presets */}
      <Text style={styles.sectionTitle}>Quick Log</Text>
      <View style={styles.quickRow}>
        {QUICK_PRESETS.map((d) => (
          <TouchableOpacity
            key={d}
            style={styles.quickPresetBtn}
            onPress={() => logSunlight(d)}
            activeOpacity={0.7}
          >
            <Ionicons name="sunny-outline" size={16} color={Colors.primaryBackground} />
            <Text style={styles.quickPresetText}>{d} min</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Type selector */}
      <Text style={styles.sectionTitle}>Activity Type</Text>
      <View style={styles.typeGrid}>
        {SUNLIGHT_ACTIVITY_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeBtn, selectedType === t.value && styles.typeBtnActive]}
            onPress={() => setSelectedType(t.value)}
          >
            <Ionicons
              name={t.icon as any}
              size={20}
              color={selectedType === t.value ? Colors.primaryBackground : Colors.secondaryText}
            />
            <Text style={[styles.typeLabel, selectedType === t.value && styles.typeLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedType === 'custom' && (
        <TextInput
          style={styles.input}
          value={customType}
          onChangeText={setCustomType}
          placeholder="Custom activity name"
          placeholderTextColor={Colors.secondaryText}
          maxLength={50}
        />
      )}

      {/* Duration */}
      <Text style={styles.sectionTitle}>Duration (minutes)</Text>
      <TextInput
        style={styles.input}
        value={duration}
        onChangeText={setDuration}
        placeholder="Enter minutes (1-480)"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="number-pad"
      />

      {/* Nature toggle */}
      <View style={styles.natureRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.natureTitle}>Natural Setting?</Text>
          <Text style={styles.natureSubtitle}>Park, trail, beach vs. parking lot, sidewalk</Text>
        </View>
        <Switch
          value={nature}
          onValueChange={setNature}
          trackColor={{ false: Colors.elevated, true: '#4CAF50' }}
          thumbColor={nature ? '#FFFFFF' : Colors.secondaryText}
        />
      </View>

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, !duration && styles.logBtnDisabled]}
        onPress={() => logSunlight()}
        disabled={!duration}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Sunlight</Text>
      </TouchableOpacity>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Today's Outdoor Time</Text>
          {entries.map((e) => {
            const typeLabel = SUNLIGHT_ACTIVITY_TYPES.find((t) => t.value === e.type)?.label ?? e.custom_type ?? e.type;
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryType}>
                    {typeLabel} — {e.duration_minutes} min
                    {e.nature ? ' \uD83C\uDF3F' : ''}
                  </Text>
                  <Text style={styles.entryTime}>
                    {new Date(e.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteEntry(e.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    gap: 24,
    marginBottom: 16,
    justifyContent: 'center',
  },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryNumber: { color: Colors.accent, fontSize: 24, fontWeight: '700' },
  summaryUnit: { color: Colors.secondaryText, fontSize: 12 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickPresetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  quickPresetText: { color: Colors.primaryBackground, fontSize: 15, fontWeight: '700' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: {
    width: '31%',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typeLabel: { color: Colors.secondaryText, fontSize: 11, fontWeight: '500', textAlign: 'center' },
  typeLabelActive: { color: Colors.primaryBackground },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 20,
  },
  natureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  natureTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  natureSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText: { color: Colors.primaryBackground, fontSize: 17, fontWeight: '700' },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  entryType: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  entryTime: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
});
