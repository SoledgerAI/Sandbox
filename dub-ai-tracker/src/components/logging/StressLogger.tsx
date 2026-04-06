// Stress logging component -- 1-10 scale + trigger tag multi-select
// Phase 10: Sleep and Mood Logging

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
import type { StressEntry, StressTrigger } from '../../types';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { TimestampPicker } from '../common/TimestampPicker';
import { todayDateString } from '../../utils/dayBoundary';


const TRIGGER_OPTIONS: { value: StressTrigger; label: string; icon: string }[] = [
  { value: 'work', label: 'Work', icon: 'briefcase-outline' },
  { value: 'relationships', label: 'Relationships', icon: 'people-outline' },
  { value: 'health', label: 'Health', icon: 'medkit-outline' },
  { value: 'finance', label: 'Finance', icon: 'cash-outline' },
  { value: 'family', label: 'Family', icon: 'home-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

function stressColor(score: number): string {
  if (score <= 3) return Colors.success;
  if (score <= 6) return Colors.warning;
  return Colors.danger;
}

interface StressLoggerProps {
  onEntryLogged?: () => void;
}

export function StressLogger({ onEntryLogged }: StressLoggerProps) {
  const [entries, setEntries] = useState<StressEntry[]>([]);
  const [score, setScore] = useState<number>(5);
  const [selectedTriggers, setSelectedTriggers] = useState<StressTrigger[]>([]);
  const [notes, setNotes] = useState('');
  const [timestamp, setTimestamp] = useState(new Date());
  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<StressEntry>('mental.wellness.stress');

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    setScore(lastEntry.score);
    if (lastEntry.trigger) setSelectedTriggers([lastEntry.trigger]);
  }, [lastEntry]);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_STRESS, today);
    const stored = await storageGet<StressEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleTrigger = (trigger: StressTrigger) => {
    setSelectedTriggers((prev) =>
      prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger],
    );
  };

  const logStress = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_STRESS, today);

    // Store one entry per trigger (or one with null if no triggers)
    const trigger = selectedTriggers.length > 0 ? selectedTriggers[0] : null;
    const entry: StressEntry = {
      id: `stress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: timestamp.toISOString(),
      score,
      trigger,
      notes: notes.trim() || null,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setNotes('');
    setSelectedTriggers([]);
    await saveAsLast(entry);
    onEntryLogged?.();
  }, [entries, score, selectedTriggers, notes, onEntryLogged, saveAsLast, timestamp]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_STRESS, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <RepeatLastEntry
        tagLabel="stress"
        subtitle={lastEntry ? `Level ${lastEntry.score}` : undefined}
        visible={!lastEntryLoading && lastEntry != null}
        onRepeat={handleRepeatLast}
      />

      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Score display */}
      <View style={styles.scoreCard}>
        <Text style={[styles.scoreValue, { color: stressColor(score) }]}>{score}</Text>
        <Text style={styles.scoreLabel}>/ 10</Text>
      </View>

      {/* 1-10 scale (split into two rows of 5 for larger touch targets) */}
      <Text style={styles.sectionTitle}>Stress Level</Text>
      <View style={styles.scaleRow}>
        {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
          <TouchableOpacity
            key={n}
            style={[
              styles.scaleBtn,
              score === n && { backgroundColor: stressColor(n), borderColor: stressColor(n) },
            ]}
            onPress={() => setScore(n)}
            accessibilityLabel={`Stress level ${n} out of 10`}
            accessibilityRole="radio"
          >
            <Text style={[styles.scaleNum, score === n && styles.scaleNumActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scaleRow}>
        {Array.from({ length: 5 }, (_, i) => i + 6).map((n) => (
          <TouchableOpacity
            key={n}
            style={[
              styles.scaleBtn,
              score === n && { backgroundColor: stressColor(n), borderColor: stressColor(n) },
            ]}
            onPress={() => setScore(n)}
            accessibilityLabel={`Stress level ${n} out of 10`}
            accessibilityRole="radio"
          >
            <Text style={[styles.scaleNum, score === n && styles.scaleNumActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabelText}>Low</Text>
        <Text style={styles.scaleLabelText}>High</Text>
      </View>

      {/* Trigger tags */}
      <Text style={styles.sectionTitle}>Triggers (optional)</Text>
      <View style={styles.triggerGrid}>
        {TRIGGER_OPTIONS.map((opt) => {
          const selected = selectedTriggers.includes(opt.value);
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.triggerBtn, selected && styles.triggerBtnActive]}
              onPress={() => toggleTrigger(opt.value)}
            >
              <Ionicons
                name={opt.icon as any}
                size={18}
                color={selected ? Colors.primaryBackground : Colors.secondaryText}
              />
              <Text style={[styles.triggerLabel, selected && styles.triggerLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="What's causing stress?"
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={3}
      />

      {/* Log button */}
      <TouchableOpacity style={styles.logBtn} onPress={logStress} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Stress</Text>
      </TouchableOpacity>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Today's Entries</Text>
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={[styles.entryScoreBadge, { backgroundColor: stressColor(entry.score) }]}>
                  <Text style={styles.entryScoreText}>{entry.score}</Text>
                </View>
                <View style={styles.entryInfo}>
                  {entry.trigger && (
                    <Text style={styles.entryTrigger}>{entry.trigger}</Text>
                  )}
                  {entry.notes && (
                    <Text style={styles.entryNote} numberOfLines={2}>{entry.notes}</Text>
                  )}
                  <Text style={styles.entryTime}>
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteEntry(entry.id)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
        </>
      )}
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
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  scoreLabel: {
    color: Colors.secondaryText,
    fontSize: 20,
    marginLeft: 4,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  scaleRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  scaleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingVertical: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  scaleNum: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  scaleNumActive: {
    color: Colors.primaryBackground,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  scaleLabelText: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  triggerBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  triggerLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  triggerLabelActive: {
    color: Colors.primaryBackground,
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
    marginBottom: 20,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 24,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 17,
    fontWeight: '700',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  entryScoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryScoreText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  entryInfo: {
    flex: 1,
  },
  entryTrigger: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  entryNote: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  entryTime: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
});
