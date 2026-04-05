// Meditation logging component -- duration, type selector, optional note
// Phase 10: Sleep and Mood Logging

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
import type { MeditationEntry } from '../../types';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { todayDateString } from '../../utils/dayBoundary';


type MeditationType = MeditationEntry['type'];

const MEDITATION_TYPES: { value: MeditationType; label: string; icon: string }[] = [
  { value: 'guided', label: 'Guided', icon: 'headset-outline' },
  { value: 'unguided', label: 'Unguided', icon: 'leaf-outline' },
  { value: 'breathing', label: 'Breathing', icon: 'cloudy-outline' },
  { value: 'body_scan', label: 'Body Scan', icon: 'body-outline' },
];

const QUICK_DURATIONS = [5, 10, 15, 20, 30];

interface MeditationLoggerProps {
  onEntryLogged?: () => void;
}

export function MeditationLogger({ onEntryLogged }: MeditationLoggerProps) {
  const [entry, setEntry] = useState<MeditationEntry | null>(null);
  const [duration, setDuration] = useState('');
  const [selectedType, setSelectedType] = useState<MeditationType>('guided');
  const [notes, setNotes] = useState('');
  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<MeditationEntry>('mental.wellness.meditation');

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    setDuration(String(lastEntry.duration_minutes));
    setSelectedType(lastEntry.type);
  }, [lastEntry]);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_MEDITATION, today);
    const stored = await storageGet<MeditationEntry>(key);
    if (stored) setEntry(stored);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logMeditation = useCallback(async () => {
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid duration in minutes.');
      return;
    }

    const newEntry: MeditationEntry = {
      duration_minutes: dur,
      type: selectedType,
      timestamp: new Date().toISOString(),
      notes: notes.trim() || null,
    };

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_MEDITATION, today);
    await storageSet(key, newEntry);
    setEntry(newEntry);
    await saveAsLast(newEntry);
    onEntryLogged?.();
  }, [duration, selectedType, notes, onEntryLogged, saveAsLast]);

  const clearEntry = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_MEDITATION, today);
    await storageSet(key, null);
    setEntry(null);
    setDuration('');
    setNotes('');
  }, []);

  // Show summary if logged
  if (entry) {
    const typeLabel = MEDITATION_TYPES.find((t) => t.value === entry.type)?.label ?? entry.type;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Ionicons name="leaf" size={28} color={Colors.accent} />
          <Text style={styles.summaryTitle}>Meditation Logged</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{entry.duration_minutes} min</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Type</Text>
            <Text style={styles.summaryValue}>{typeLabel}</Text>
          </View>
          {entry.notes && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Notes</Text>
              <Text style={[styles.summaryValue, { flex: 1 }]} numberOfLines={2}>{entry.notes}</Text>
            </View>
          )}
          <Text style={styles.summaryTime}>
            {new Date(entry.timestamp).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={clearEntry}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteBtnText}>Clear Meditation Log</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <RepeatLastEntry
        tagLabel="meditation"
        subtitle={lastEntry ? `${lastEntry.duration_minutes} min ${lastEntry.type}` : undefined}
        visible={!lastEntryLoading && lastEntry != null}
        onRepeat={handleRepeatLast}
      />

      {/* Type selector */}
      <Text style={styles.sectionTitle}>Type</Text>
      <View style={styles.typeGrid}>
        {MEDITATION_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeBtn, selectedType === t.value && styles.typeBtnActive]}
            onPress={() => setSelectedType(t.value)}
          >
            <Ionicons
              name={t.icon as any}
              size={22}
              color={selectedType === t.value ? Colors.primaryBackground : Colors.secondaryText}
            />
            <Text style={[styles.typeLabel, selectedType === t.value && styles.typeLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Duration quick-select */}
      <Text style={styles.sectionTitle}>Duration (minutes)</Text>
      <View style={styles.quickRow}>
        {QUICK_DURATIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.quickBtn, duration === String(d) && styles.quickBtnActive]}
            onPress={() => setDuration(String(d))}
          >
            <Text style={[styles.quickText, duration === String(d) && styles.quickTextActive]}>
              {d}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom duration */}
      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          value={duration}
          onChangeText={setDuration}
          placeholder="Or enter custom minutes"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="number-pad"
        />
      </View>

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="How was your session?"
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={3}
      />

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, !duration && styles.logBtnDisabled]}
        onPress={logMeditation}
        disabled={!duration}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Meditation</Text>
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
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  typeLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: Colors.primaryBackground,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  quickBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  quickText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  quickTextActive: {
    color: Colors.primaryBackground,
  },
  customRow: {
    marginBottom: 24,
  },
  customInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  notesInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  logBtnDisabled: {
    opacity: 0.4,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 17,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6,
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryTime: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 10,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
});
