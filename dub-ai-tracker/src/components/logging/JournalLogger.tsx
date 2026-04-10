// Journal logging — Sprint 19
// Free-form daily writing, mood tag, private flag (therapy firewall pattern)
// Private entries excluded from Coach DUB context and data export

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
import type { JournalEntry } from '../../types';
import { TimestampPicker } from '../common/TimestampPicker';
import { getActiveDate } from '../../services/dateContextService';
import { todayDateString } from '../../utils/dayBoundary';

const MOOD_OPTIONS = [
  { value: 1, label: 'Bad', icon: 'sad-outline' },
  { value: 2, label: 'Poor', icon: 'sad-outline' },
  { value: 3, label: 'OK', icon: 'remove-circle-outline' },
  { value: 4, label: 'Good', icon: 'happy-outline' },
  { value: 5, label: 'Great', icon: 'happy-outline' },
];

function generateId(): string {
  return `jrn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface JournalLoggerProps {
  onEntryLogged?: () => void;
}

export function JournalLogger({ onEntryLogged }: JournalLoggerProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [text, setText] = useState('');
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [isPrivate, setIsPrivate] = useState(true);
  const [timestamp, setTimestamp] = useState(new Date());
  const [streak, setStreak] = useState(0);

  const loadData = useCallback(async () => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_JOURNAL, activeDate);
    const stored = await storageGet<JournalEntry[]>(key);
    setEntries(stored ?? []);

    // Calculate streak
    let streakCount = 0;
    const today = todayDateString();
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayKey = dateKey(STORAGE_KEYS.LOG_JOURNAL, dateStr);
      const dayData = dateStr === activeDate ? stored : await storageGet<JournalEntry[]>(dayKey);
      const hasEntry = dayData != null && dayData.length > 0;
      if (hasEntry) {
        streakCount++;
      } else {
        if (i === 0 && dateStr === today) continue;
        break;
      }
    }
    setStreak(streakCount);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logJournal = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Empty Entry', 'Please write something before saving.');
      return;
    }

    const newEntry: JournalEntry = {
      id: generateId(),
      timestamp: timestamp.toISOString(),
      text: trimmed.slice(0, 2000),
      mood_score: moodScore,
      private: isPrivate,
    };

    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_JOURNAL, activeDate);
    const updated = [...entries, newEntry];
    await storageSet(key, updated);
    setEntries(updated);
    setText('');
    setMoodScore(null);
    setIsPrivate(true);
    onEntryLogged?.();
  }, [text, moodScore, isPrivate, entries, onEntryLogged, timestamp]);

  const deleteEntry = useCallback(async (id: string) => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_JOURNAL, activeDate);
    const updated = entries.filter((e) => e.id !== id);
    await storageSet(key, updated);
    setEntries(updated);
  }, [entries]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Streak */}
      {streak > 0 && (
        <View style={styles.streakBar}>
          <Ionicons name="flame-outline" size={18} color={Colors.accent} />
          <Text style={styles.streakText}>{streak} day journaling streak</Text>
        </View>
      )}

      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Text entry */}
      <Text style={styles.sectionTitle}>Write</Text>
      <TextInput
        style={styles.textArea}
        value={text}
        onChangeText={(t) => setText(t.slice(0, 2000))}
        placeholder="What's on your mind today?"
        placeholderTextColor={Colors.secondaryText}
        multiline
        textAlignVertical="top"
        maxLength={2000}
      />
      <Text style={styles.charCount}>{text.length}/2000</Text>

      {/* Mood tag (optional) */}
      <Text style={styles.sectionTitle}>Mood (optional)</Text>
      <View style={styles.moodRow}>
        {MOOD_OPTIONS.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.moodBtn, moodScore === m.value && styles.moodBtnActive]}
            onPress={() => setMoodScore(moodScore === m.value ? null : m.value)}
          >
            <Ionicons
              name={m.icon as any}
              size={20}
              color={moodScore === m.value ? Colors.primaryBackground : Colors.secondaryText}
            />
            <Text style={[styles.moodLabel, moodScore === m.value && styles.moodLabelActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Private toggle */}
      <View style={styles.privateRow}>
        <View style={styles.privateInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={isPrivate ? 'lock-closed' : 'lock-open-outline'} size={18} color={isPrivate ? Colors.accent : Colors.secondaryText} />
            <Text style={styles.privateTitle}>Private</Text>
          </View>
          <Text style={styles.privateSubtitle}>
            {isPrivate
              ? 'This entry will NOT be visible to Coach DUB or included in data exports'
              : 'This entry may be referenced by Coach DUB (content not shared, only the fact you journaled)'}
          </Text>
        </View>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ false: Colors.elevated, true: Colors.accent }}
          thumbColor={isPrivate ? '#FFFFFF' : Colors.secondaryText}
        />
      </View>

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, !text.trim() && styles.logBtnDisabled]}
        onPress={logJournal}
        disabled={!text.trim()}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Save Journal Entry</Text>
      </TouchableOpacity>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Today's Entries</Text>
          {entries.map((e) => (
            <View key={e.id} style={styles.entryCard}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {e.private && <Ionicons name="lock-closed" size={14} color={Colors.accent} />}
                  <Text style={styles.entryTime}>
                    {new Date(e.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  {e.mood_score != null && (
                    <Text style={styles.entryMood}>
                      Mood: {MOOD_OPTIONS.find((m) => m.value === e.mood_score)?.label ?? e.mood_score}
                    </Text>
                  )}
                </View>
                <Text style={styles.entryText} numberOfLines={3}>{e.text}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteEntry(e.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
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
  streakBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  streakText: { color: Colors.accentText, fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  textArea: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  charCount: { color: Colors.secondaryText, fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 20 },
  moodRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  moodLabel: { color: Colors.secondaryText, fontSize: 10, fontWeight: '500' },
  moodLabelActive: { color: Colors.primaryBackground },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  privateInfo: { flex: 1 },
  privateTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  privateSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 4, lineHeight: 17 },
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
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  entryTime: { color: Colors.secondaryText, fontSize: 12 },
  entryMood: { color: Colors.accentText, fontSize: 12, fontWeight: '500' },
  entryText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
});
