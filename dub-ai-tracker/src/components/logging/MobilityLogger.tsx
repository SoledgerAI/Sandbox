// Stretching / Mobility logging — Sprint 19
// Type picker, duration, focus area multi-select, quick combos, weekly total

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
import type { MobilityEntry, MobilityType, MobilityFocusArea } from '../../types';
import { MOBILITY_TYPES, MOBILITY_FOCUS_AREAS } from '../../types';
import { TimestampPicker } from '../common/TimestampPicker';
import { getActiveDate } from '../../services/dateContextService';

interface QuickCombo {
  label: string;
  type: MobilityType;
  duration: number;
}

const QUICK_COMBOS: QuickCombo[] = [
  { label: '10 min stretch', type: 'stretching', duration: 10 },
  { label: 'Foam roll 15 min', type: 'foam_rolling', duration: 15 },
  { label: 'Yoga 30 min', type: 'yoga', duration: 30 },
];

function generateId(): string {
  return `mob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface MobilityLoggerProps {
  onEntryLogged?: () => void;
}

export function MobilityLogger({ onEntryLogged }: MobilityLoggerProps) {
  const [entries, setEntries] = useState<MobilityEntry[]>([]);
  const [selectedType, setSelectedType] = useState<MobilityType>('stretching');
  const [customType, setCustomType] = useState('');
  const [duration, setDuration] = useState('');
  const [focusAreas, setFocusAreas] = useState<MobilityFocusArea[]>([]);
  const [timestamp, setTimestamp] = useState(new Date());
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [weeklyDays, setWeeklyDays] = useState(0);

  const loadData = useCallback(async () => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_MOBILITY, activeDate);
    const stored = await storageGet<MobilityEntry[]>(key);
    setEntries(stored ?? []);

    // Weekly stats
    let totalMin = 0;
    let daysWithMobility = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayKey = dateKey(STORAGE_KEYS.LOG_MOBILITY, dateStr);
      const dayData = dateStr === activeDate ? stored : await storageGet<MobilityEntry[]>(dayKey);
      const dayEntries = dayData ?? [];
      if (dayEntries.length > 0) {
        daysWithMobility++;
        totalMin += dayEntries.reduce((s, e) => s + e.duration_minutes, 0);
      }
    }
    setWeeklyTotal(totalMin);
    setWeeklyDays(daysWithMobility);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleFocusArea = useCallback((area: MobilityFocusArea) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }, []);

  const logMobility = useCallback(async (combo?: QuickCombo) => {
    const type = combo?.type ?? selectedType;
    const dur = combo?.duration ?? parseInt(duration, 10);
    if (isNaN(dur) || dur < 1 || dur > 120) {
      Alert.alert('Invalid Duration', 'Please enter 1-120 minutes.');
      return;
    }

    const newEntry: MobilityEntry = {
      id: generateId(),
      timestamp: timestamp.toISOString(),
      type,
      custom_type: type === 'custom' ? (customType.trim() || null) : null,
      duration_minutes: dur,
      focus_areas: combo ? [] : focusAreas,
    };

    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_MOBILITY, activeDate);
    const updated = [...entries, newEntry];
    await storageSet(key, updated);
    setEntries(updated);
    setDuration('');
    setCustomType('');
    setFocusAreas([]);
    onEntryLogged?.();
  }, [duration, selectedType, customType, focusAreas, entries, onEntryLogged, timestamp]);

  const deleteEntry = useCallback(async (id: string) => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_MOBILITY, activeDate);
    const updated = entries.filter((e) => e.id !== id);
    await storageSet(key, updated);
    setEntries(updated);
  }, [entries]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Weekly summary */}
      {(weeklyTotal > 0 || weeklyDays > 0) && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{weeklyTotal}</Text>
            <Text style={styles.summaryUnit}>min this week</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{weeklyDays}/7</Text>
            <Text style={styles.summaryUnit}>recovery days</Text>
          </View>
        </View>
      )}

      {/* Quick combos */}
      <Text style={styles.sectionTitle}>Quick Log</Text>
      <View style={styles.quickRow}>
        {QUICK_COMBOS.map((c) => (
          <TouchableOpacity
            key={c.label}
            style={styles.quickPresetBtn}
            onPress={() => logMobility(c)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickPresetText}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Type selector */}
      <Text style={styles.sectionTitle}>Type</Text>
      <View style={styles.typeGrid}>
        {MOBILITY_TYPES.map((t) => (
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
          placeholder="Custom type name"
          placeholderTextColor={Colors.secondaryText}
          maxLength={50}
        />
      )}

      {/* Duration */}
      <Text style={styles.sectionTitle}>Duration (minutes)</Text>
      <View style={styles.durationRow}>
        {[5, 10, 15, 20, 30, 45].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.durationBtn, duration === String(d) && styles.durationBtnActive]}
            onPress={() => setDuration(String(d))}
          >
            <Text style={[styles.durationText, duration === String(d) && styles.durationTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={duration}
        onChangeText={setDuration}
        placeholder="Or enter custom (1-120)"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="number-pad"
      />

      {/* Focus areas (multi-select) */}
      <Text style={styles.sectionTitle}>Focus Area (optional)</Text>
      <View style={styles.focusGrid}>
        {MOBILITY_FOCUS_AREAS.map((area) => {
          const selected = focusAreas.includes(area.value);
          return (
            <TouchableOpacity
              key={area.value}
              style={[styles.focusBtn, selected && styles.focusBtnActive]}
              onPress={() => toggleFocusArea(area.value)}
            >
              <Text style={[styles.focusLabel, selected && styles.focusLabelActive]}>
                {area.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, !duration && styles.logBtnDisabled]}
        onPress={() => logMobility()}
        disabled={!duration}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Mobility</Text>
      </TouchableOpacity>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Today's Sessions</Text>
          {entries.map((e) => {
            const typeLabel = MOBILITY_TYPES.find((t) => t.value === e.type)?.label ?? e.custom_type ?? e.type;
            const areas = e.focus_areas.map((a) => MOBILITY_FOCUS_AREAS.find((f) => f.value === a)?.label ?? a).join(', ');
            return (
              <View key={e.id} style={styles.entryCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryType}>{typeLabel} — {e.duration_minutes} min</Text>
                  {areas ? <Text style={styles.entryDetail}>Focus: {areas}</Text> : null}
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
  summaryItem: { alignItems: 'center' },
  summaryNumber: { color: Colors.accent, fontSize: 24, fontWeight: '700' },
  summaryUnit: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickPresetBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
  },
  quickPresetText: { color: Colors.primaryBackground, fontSize: 13, fontWeight: '700' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: {
    width: '23%',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typeLabel: { color: Colors.secondaryText, fontSize: 10, fontWeight: '500', textAlign: 'center' },
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
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  durationBtn: {
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  durationBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  durationText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  durationTextActive: { color: Colors.primaryBackground },
  focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  focusBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  focusBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  focusLabel: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500' },
  focusLabelActive: { color: Colors.primaryBackground },
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
  entryDetail: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
});
