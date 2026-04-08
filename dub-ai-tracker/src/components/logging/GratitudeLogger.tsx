// Gratitude logging component -- free text, 1-3 items per entry
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
import type { GratitudeEntry } from '../../types';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { TimestampPicker } from '../common/TimestampPicker';
import { todayDateString } from '../../utils/dayBoundary';
import { getActiveDate } from '../../services/dateContextService';


interface GratitudeLoggerProps {
  onEntryLogged?: () => void;
}

export function GratitudeLogger({ onEntryLogged }: GratitudeLoggerProps) {
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [item1, setItem1] = useState('');
  const [item2, setItem2] = useState('');
  const [item3, setItem3] = useState('');
  const [timestamp, setTimestamp] = useState(new Date());
  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<GratitudeEntry>('mental.wellness.gratitude');

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    setItem1(lastEntry.items[0] ?? '');
    setItem2(lastEntry.items[1] ?? '');
    setItem3(lastEntry.items[2] ?? '');
  }, [lastEntry]);

  const loadData = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_GRATITUDE, today);
    const stored = await storageGet<GratitudeEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logGratitude = useCallback(async () => {
    const items = [item1, item2, item3].map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) {
      Alert.alert('Empty Entry', 'Please write at least one thing you are grateful for.');
      return;
    }

    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_GRATITUDE, today);

    const entry: GratitudeEntry = {
      id: `gratitude_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: timestamp.toISOString(),
      items,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setItem1('');
    setItem2('');
    setItem3('');
    await saveAsLast(entry);
    onEntryLogged?.();
  }, [entries, item1, item2, item3, onEntryLogged, saveAsLast, timestamp]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = getActiveDate();
      const key = dateKey(STORAGE_KEYS.LOG_GRATITUDE, today);
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
        tagLabel="gratitude"
        subtitle={lastEntry?.items[0] ? (lastEntry.items[0].length > 40 ? lastEntry.items[0].slice(0, 40) + '...' : lastEntry.items[0]) : undefined}
        visible={!lastEntryLoading && lastEntry != null}
        onRepeat={handleRepeatLast}
      />

      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Prompt */}
      <View style={styles.promptCard}>
        <Ionicons name="heart" size={28} color={Colors.accent} />
        <Text style={styles.promptText}>What are you grateful for today?</Text>
        <Text style={styles.promptSub}>Write 1-3 things</Text>
      </View>

      {/* Inputs */}
      <View style={styles.inputGroup}>
        <View style={styles.inputRow}>
          <Text style={styles.inputNum}>1.</Text>
          <TextInput
            style={styles.input}
            value={item1}
            onChangeText={setItem1}
            placeholder="I'm grateful for..."
            placeholderTextColor={Colors.secondaryText}
          />
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputNum}>2.</Text>
          <TextInput
            style={styles.input}
            value={item2}
            onChangeText={setItem2}
            placeholder="I'm grateful for..."
            placeholderTextColor={Colors.secondaryText}
          />
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputNum}>3.</Text>
          <TextInput
            style={styles.input}
            value={item3}
            onChangeText={setItem3}
            placeholder="I'm grateful for..."
            placeholderTextColor={Colors.secondaryText}
          />
        </View>
      </View>

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, !item1.trim() && styles.logBtnDisabled]}
        onPress={logGratitude}
        disabled={!item1.trim()}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Gratitude</Text>
      </TouchableOpacity>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Today's Entries</Text>
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTime}>
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => deleteEntry(entry.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                {entry.items.map((item, i) => (
                  <View key={i} style={styles.entryItem}>
                    <Ionicons name="heart-outline" size={14} color={Colors.accent} />
                    <Text style={styles.entryItemText}>{item}</Text>
                  </View>
                ))}
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
  promptCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  promptText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  promptSub: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  inputGroup: {
    gap: 10,
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputNum: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: '700',
    width: 24,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
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
  logBtnDisabled: {
    opacity: 0.4,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  entryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTime: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  entryItemText: {
    color: Colors.text,
    fontSize: 14,
    flex: 1,
  },
});
