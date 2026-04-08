// Therapy logging component -- session logged, optional fields, MAXIMALLY PRIVATE notes
// Phase 10: Sleep and Mood Logging
// CRITICAL: Therapy notes are NEVER exported, NEVER sent to Coach

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
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
import type { TherapyEntry, TherapyType } from '../../types';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { TimestampPicker } from '../common/TimestampPicker';
import { todayDateString } from '../../utils/dayBoundary';
import { getActiveDate } from '../../services/dateContextService';


const THERAPY_TYPES: { value: TherapyType; label: string }[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'couples', label: 'Couples' },
  { value: 'group', label: 'Group' },
  { value: 'psychiatry', label: 'Psychiatry' },
];

interface TherapyLoggerProps {
  onEntryLogged?: () => void;
}

export function TherapyLogger({ onEntryLogged }: TherapyLoggerProps) {
  const [entry, setEntry] = useState<TherapyEntry | null>(null);
  const [therapistName, setTherapistName] = useState('');
  const [selectedType, setSelectedType] = useState<TherapyType>('individual');
  const [notes, setNotes] = useState('');
  const [timestamp, setTimestamp] = useState(new Date());
  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<TherapyEntry>('mental.wellness.therapy');

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    if (lastEntry.therapist_name) setTherapistName(lastEntry.therapist_name);
    if (lastEntry.type) setSelectedType(lastEntry.type);
    // DO NOT prefill notes -- they are MAXIMALLY PRIVATE
  }, [lastEntry]);

  const loadData = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_THERAPY, today);
    const stored = await storageGet<TherapyEntry>(key);
    if (stored) setEntry(stored);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logTherapy = useCallback(async () => {
    const newEntry: TherapyEntry = {
      session_logged: true,
      therapist_name: therapistName.trim() || null,
      type: selectedType,
      notes: notes.trim() || null, // MAXIMALLY PRIVATE -- never exported, never sent to Coach
      timestamp: timestamp.toISOString(),
    };

    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_THERAPY, today);
    await storageSet(key, newEntry);
    setEntry(newEntry);
    await saveAsLast(newEntry);
    onEntryLogged?.();
  }, [therapistName, selectedType, notes, onEntryLogged, saveAsLast, timestamp]);

  const clearEntry = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_THERAPY, today);
    await storageSet(key, null);
    setEntry(null);
    setTherapistName('');
    setNotes('');
  }, []);

  // Show summary if logged
  if (entry) {
    const typeLabel = THERAPY_TYPES.find((t) => t.value === entry.type)?.label ?? entry.type;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Ionicons name="chatbubbles" size={28} color={Colors.accent} />
          <Text style={styles.summaryTitle}>Therapy Session Logged</Text>
          {entry.type && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>{typeLabel}</Text>
            </View>
          )}
          {entry.therapist_name && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Therapist</Text>
              <Text style={styles.summaryValue}>{entry.therapist_name}</Text>
            </View>
          )}
          {entry.notes && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Notes</Text>
              <Text style={[styles.summaryValue, { flex: 1 }]} numberOfLines={3}>{entry.notes}</Text>
            </View>
          )}
          <Text style={styles.summaryTime}>
            {new Date(entry.timestamp).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Privacy notice */}
        <View style={styles.privacyCard}>
          <Ionicons name="lock-closed" size={16} color={Colors.accent} />
          <Text style={styles.privacyText}>
            Your therapy notes are maximally private. They are never exported, never included
            in health reports, and never sent to the AI Coach.
          </Text>
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={clearEntry}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteBtnText}>Clear Therapy Log</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Privacy notice */}
      <View style={styles.privacyCard}>
        <Ionicons name="lock-closed" size={16} color={Colors.accent} />
        <Text style={styles.privacyText}>
          Your therapy notes are maximally private. They are stored locally only and
          never exported or sent to the AI Coach.
        </Text>
      </View>

      <RepeatLastEntry
        tagLabel="therapy"
        subtitle={lastEntry ? (lastEntry.therapist_name ? `${lastEntry.type ?? 'therapy'} - ${lastEntry.therapist_name}` : (lastEntry.type ?? 'therapy')) : undefined}
        visible={!lastEntryLoading && lastEntry != null}
        onRepeat={handleRepeatLast}
      />

      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Session type */}
      <Text style={styles.sectionTitle}>Session Type</Text>
      <View style={styles.typeRow}>
        {THERAPY_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeBtn, selectedType === t.value && styles.typeBtnActive]}
            onPress={() => setSelectedType(t.value)}
          >
            <Text style={[styles.typeLabel, selectedType === t.value && styles.typeLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Therapist name */}
      <Text style={styles.sectionTitle}>Therapist (optional)</Text>
      <TextInput
        style={styles.input}
        value={therapistName}
        onChangeText={setTherapistName}
        placeholder="Therapist name"
        placeholderTextColor={Colors.secondaryText}
      />

      {/* Notes */}
      <Text style={styles.sectionTitle}>Session Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Private reflections from your session..."
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={5}
      />

      {/* Log button */}
      <TouchableOpacity style={styles.logBtn} onPress={logTherapy} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Session</Text>
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
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  privacyText: {
    color: Colors.secondaryText,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  typeBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  typeBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  typeLabel: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: Colors.primaryBackground,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 24,
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
    minHeight: 120,
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
    color: Colors.dangerText,
    fontSize: 14,
    fontWeight: '500',
  },
});
