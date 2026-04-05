// 3-axis mood picker -- mood, energy, anxiety (1-5 each)
// Phase 10: Sleep and Mood Logging
// Redesign: P1 3-axis quick-tap (Expert 3 clinical psych recommendation)

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
import type { MoodEntry } from '../../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// -- Axis definitions --

interface AxisConfig {
  key: 'mood' | 'energy' | 'anxiety';
  title: string;
  lowAnchor: string;
  highAnchor: string;
  labels: Record<number, string>;
}

const AXES: AxisConfig[] = [
  {
    key: 'mood',
    title: 'Mood',
    lowAnchor: 'Very low',
    highAnchor: 'Great',
    labels: {
      1: 'Very low',
      2: 'Low',
      3: 'Neutral',
      4: 'Good',
      5: 'Great',
    },
  },
  {
    key: 'energy',
    title: 'Energy',
    lowAnchor: 'Exhausted',
    highAnchor: 'Energized',
    labels: {
      1: 'Exhausted',
      2: 'Low',
      3: 'Moderate',
      4: 'High',
      5: 'Energized',
    },
  },
  {
    key: 'anxiety',
    title: 'Anxiety',
    lowAnchor: 'Calm',
    highAnchor: 'Very anxious',
    labels: {
      1: 'Calm',
      2: 'Mild',
      3: 'Moderate',
      4: 'High',
      5: 'Very anxious',
    },
  },
];

interface AxisRowProps {
  axis: AxisConfig;
  value: number;
  onSelect: (value: number) => void;
}

function AxisRow({ axis, value, onSelect }: AxisRowProps) {
  return (
    <View style={styles.axisSection}>
      <Text style={styles.axisTitle}>{axis.title}</Text>
      <View style={styles.anchorRow}>
        <Text style={styles.anchorText}>{axis.lowAnchor}</Text>
        <Text style={styles.anchorText}>{axis.highAnchor}</Text>
      </View>
      <View style={styles.buttonRow}>
        {[1, 2, 3, 4, 5].map((score) => (
          <TouchableOpacity
            key={score}
            style={[styles.tapTarget, value === score && styles.tapTargetActive]}
            onPress={() => onSelect(score)}
            accessibilityLabel={`${axis.title}: ${axis.labels[score]}, ${score} out of 5`}
            accessibilityRole="radio"
          >
            <Text style={[styles.tapNumber, value === score && styles.tapNumberActive]}>
              {score}
            </Text>
            <Text
              style={[styles.tapLabel, value === score && styles.tapLabelActive]}
              numberOfLines={1}
            >
              {axis.labels[score]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// -- Summary label helpers --

function moodLabel(score: number): string {
  return AXES[0].labels[Math.round(Math.min(5, Math.max(1, score)))] ?? '';
}

function entryLabel(entry: MoodEntry): string {
  const parts = [`M:${entry.score}`];
  if (entry.energy != null) parts.push(`E:${entry.energy}`);
  if (entry.anxiety != null) parts.push(`A:${entry.anxiety}`);
  return parts.join(' ');
}

interface MoodPickerProps {
  onEntryLogged?: () => void;
}

export function MoodPicker({ onEntryLogged }: MoodPickerProps) {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [selectedMood, setSelectedMood] = useState(3);
  const [selectedEnergy, setSelectedEnergy] = useState(3);
  const [selectedAnxiety, setSelectedAnxiety] = useState(1);
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
      score: selectedMood,
      energy: selectedEnergy,
      anxiety: selectedAnxiety,
      note: note.trim() || null,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setNote('');
    onEntryLogged?.();
  }, [entries, selectedMood, selectedEnergy, selectedAnxiety, note, onEntryLogged]);

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

  // Averages for today's summary card
  const avgMood = entries.length > 0
    ? Math.round((entries.reduce((s, e) => s + e.score, 0) / entries.length) * 10) / 10
    : null;
  const avgEnergy = entries.length > 0
    ? Math.round((entries.filter((e) => e.energy != null).reduce((s, e) => s + e.energy!, 0) / Math.max(entries.filter((e) => e.energy != null).length, 1)) * 10) / 10
    : null;
  const avgAnxiety = entries.length > 0
    ? Math.round((entries.filter((e) => e.anxiety != null).reduce((s, e) => s + e.anxiety!, 0) / Math.max(entries.filter((e) => e.anxiety != null).length, 1)) * 10) / 10
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Average card */}
      {entries.length > 0 && (
        <View style={styles.avgCard}>
          <Text style={styles.avgLabel}>Today's Averages</Text>
          <View style={styles.avgGrid}>
            <View style={styles.avgItem}>
              <Text style={styles.avgDimLabel}>Mood</Text>
              <Text style={styles.avgValue}>{avgMood}/5</Text>
            </View>
            {avgEnergy != null && (
              <View style={styles.avgItem}>
                <Text style={styles.avgDimLabel}>Energy</Text>
                <Text style={styles.avgValue}>{avgEnergy}/5</Text>
              </View>
            )}
            {avgAnxiety != null && (
              <View style={styles.avgItem}>
                <Text style={styles.avgDimLabel}>Anxiety</Text>
                <Text style={styles.avgValue}>{avgAnxiety}/5</Text>
              </View>
            )}
          </View>
          <Text style={styles.avgSub}>{entries.length} check-in{entries.length !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {/* 3-axis selector */}
      <Text style={styles.sectionTitle}>How are you feeling?</Text>

      <AxisRow axis={AXES[0]} value={selectedMood} onSelect={setSelectedMood} />
      <AxisRow axis={AXES[1]} value={selectedEnergy} onSelect={setSelectedEnergy} />
      <AxisRow axis={AXES[2]} value={selectedAnxiety} onSelect={setSelectedAnxiety} />

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
        <Text style={styles.logBtnText}>Log Check-in</Text>
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
                <View style={styles.entryInfo}>
                  <Text style={styles.entryScore}>
                    {entryLabel(entry)} — {moodLabel(entry.score)}
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
  avgGrid: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  avgItem: {
    alignItems: 'center',
  },
  avgDimLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avgValue: {
    color: Colors.accentText,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 2,
  },
  avgSub: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },

  // -- Axis row styles --
  axisSection: {
    marginBottom: 20,
  },
  axisTitle: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  anchorText: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tapTarget: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    minHeight: 48,
    minWidth: 48,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tapTargetActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  tapNumber: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  tapNumberActive: {
    color: Colors.accentText,
  },
  tapLabel: {
    color: Colors.secondaryText,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  tapLabelActive: {
    color: Colors.accentText,
    fontWeight: '600',
  },

  // -- Note and log button --
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

  // -- Entry list --
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
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
