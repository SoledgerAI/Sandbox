// Mood picker component -- 1-5 scale with emoji faces, optional note
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
import type { MoodEntry } from '../../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const MOOD_EMOJIS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😢', label: 'Struggling' },
  2: { emoji: '😔', label: 'Low' },
  3: { emoji: '😐', label: 'Neutral' },
  4: { emoji: '🙂', label: 'Good' },
  5: { emoji: '😄', label: 'Great' },
};

interface MoodPickerProps {
  onEntryLogged?: () => void;
}

export function MoodPicker({ onEntryLogged }: MoodPickerProps) {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [selectedScore, setSelectedScore] = useState<number>(3);
  const [note, setNote] = useState('');

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_MOOD, today);
    const stored = await storageGet<MoodEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logMood = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_MOOD, today);

    const entry: MoodEntry = {
      id: `mood_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      score: selectedScore,
      note: note.trim() || null,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setNote('');
    onEntryLogged?.();
  }, [entries, selectedScore, note, onEntryLogged]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_MOOD, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  const avgMood = entries.length > 0
    ? Math.round((entries.reduce((s, e) => s + e.score, 0) / entries.length) * 10) / 10
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Average mood card */}
      {entries.length > 0 && (
        <View style={styles.avgCard}>
          <Text style={styles.avgLabel}>Today's Average</Text>
          <Text style={styles.avgValue}>
            {MOOD_EMOJIS[Math.round(avgMood!)].emoji} {avgMood}/5
          </Text>
          <Text style={styles.avgSub}>{entries.length} check-in{entries.length !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {/* Mood selector */}
      <Text style={styles.sectionTitle}>How are you feeling?</Text>
      <View style={styles.moodRow}>
        {[1, 2, 3, 4, 5].map((score) => (
          <TouchableOpacity
            key={score}
            style={[styles.moodBtn, selectedScore === score && styles.moodBtnActive]}
            onPress={() => setSelectedScore(score)}
            accessibilityLabel={`${MOOD_EMOJIS[score].label}, ${score} out of 5`}
            accessibilityRole="radio"
          >
            <Text style={styles.moodEmoji}>{MOOD_EMOJIS[score].emoji}</Text>
            <Text style={[styles.moodLabel, selectedScore === score && styles.moodLabelActive]}>
              {MOOD_EMOJIS[score].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Optional note */}
      <Text style={styles.sectionTitle}>Note (optional)</Text>
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder="What's on your mind?"
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={3}
      />

      {/* Log button */}
      <TouchableOpacity style={styles.logBtn} onPress={logMood} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Mood</Text>
      </TouchableOpacity>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Today's Check-ins</Text>
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <Text style={styles.entryEmoji}>{MOOD_EMOJIS[entry.score].emoji}</Text>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryScore}>
                    {entry.score}/5 - {MOOD_EMOJIS[entry.score].label}
                  </Text>
                  {entry.note && (
                    <Text style={styles.entryNote} numberOfLines={2}>{entry.note}</Text>
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
  avgCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  avgLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  avgValue: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  avgSub: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodLabel: {
    color: Colors.secondaryText,
    fontSize: 10,
    marginTop: 4,
  },
  moodLabelActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  noteInput: {
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
  entryEmoji: {
    fontSize: 24,
  },
  entryInfo: {
    flex: 1,
  },
  entryScore: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
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
