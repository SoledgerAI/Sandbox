// Bristol Stool Scale logger -- visual Type 1-7 with descriptions
// Phase 13: Supplements, Personal Care, and Remaining Tags

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { DigestiveEntry, BristolStoolType } from '../../types';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { TimestampPicker } from '../common/TimestampPicker';
import { todayDateString } from '../../utils/dayBoundary';


interface BristolTypeInfo {
  type: BristolStoolType;
  description: string;
  indicator: string;
  color: string;
  visual: string;
}

const BRISTOL_TYPES: BristolTypeInfo[] = [
  { type: 1, description: 'Separate hard lumps', indicator: 'Constipation', color: '#8D6E63', visual: '...' },
  { type: 2, description: 'Lumpy, sausage-shaped', indicator: 'Constipation', color: '#A1887F', visual: '~.~' },
  { type: 3, description: 'Sausage with cracks', indicator: 'Normal', color: '#4CAF50', visual: '~~~' },
  { type: 4, description: 'Smooth, soft sausage', indicator: 'Ideal', color: '#2E7D32', visual: '===' },
  { type: 5, description: 'Soft blobs, clear edges', indicator: 'Normal', color: '#4CAF50', visual: 'ooo' },
  { type: 6, description: 'Mushy, fluffy pieces', indicator: 'Diarrhea', color: '#FF9800', visual: '~~~' },
  { type: 7, description: 'Watery, no solid pieces', indicator: 'Diarrhea', color: '#F44336', visual: '---' },
];

export function BristolScale() {
  const [entries, setEntries] = useState<DigestiveEntry[]>([]);
  const [entryTimestamp, setEntryTimestamp] = useState(new Date());
  const [selectedType, setSelectedType] = useState<BristolStoolType>(4);
  const [notes, setNotes] = useState('');

  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<DigestiveEntry>('digestive.health');

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    setSelectedType(lastEntry.bristol_type);
  }, [lastEntry]);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_DIGESTIVE, today);
    const stored = await storageGet<DigestiveEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logEntry = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_DIGESTIVE, today);

    const entry: DigestiveEntry = {
      id: `digest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: entryTimestamp.toISOString(),
      bristol_type: selectedType,
      notes: notes.trim() || null,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setNotes('');
    await saveAsLast(entry);
  }, [entries, selectedType, notes, saveAsLast]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_DIGESTIVE, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  const selectedInfo = BRISTOL_TYPES.find((b) => b.type === selectedType)!;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <RepeatLastEntry
        tagLabel="digestive"
        subtitle={lastEntry ? `Type ${lastEntry.bristol_type}` : undefined}
        visible={!lastEntryLoading && lastEntry !== null}
        onRepeat={handleRepeatLast}
      />

      <TimestampPicker value={entryTimestamp} onChange={setEntryTimestamp} />

      {/* Current selection */}
      <View style={[styles.selectedCard, { borderColor: selectedInfo.color }]}>
        <Text style={[styles.selectedType, { color: selectedInfo.color }]}>
          Type {selectedType}
        </Text>
        <Text style={styles.selectedDesc}>{selectedInfo.description}</Text>
        <View style={[styles.indicatorBadge, { backgroundColor: selectedInfo.color }]}>
          <Text style={styles.indicatorText}>{selectedInfo.indicator}</Text>
        </View>
      </View>

      {/* Type selector */}
      <Text style={styles.sectionTitle}>Bristol Stool Scale</Text>
      <View accessibilityLabel="Bristol Stool Scale selector. Choose type 1 through 7." accessibilityRole="radiogroup">
      {BRISTOL_TYPES.map((bt) => (
        <TouchableOpacity
          key={bt.type}
          style={[
            styles.typeRow,
            selectedType === bt.type && { borderColor: bt.color, borderWidth: 2 },
          ]}
          onPress={() => setSelectedType(bt.type)}
          activeOpacity={0.7}
          accessibilityLabel={`Type ${bt.type}: ${bt.description}. ${bt.indicator} indicator.`}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedType === bt.type }}
        >
          <View style={[styles.typeNum, { backgroundColor: bt.color }]}>
            <Text style={styles.typeNumText}>{bt.type}</Text>
          </View>
          <View style={styles.typeInfo}>
            <Text style={styles.typeDesc}>{bt.description}</Text>
            <Text style={[styles.typeIndicator, { color: bt.color }]}>{bt.indicator}</Text>
          </View>
        </TouchableOpacity>
      ))}
      </View>

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional notes..."
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={3}
      />

      {/* Log button */}
      <TouchableOpacity style={styles.logBtn} onPress={logEntry} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Entry</Text>
      </TouchableOpacity>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Today's Entries</Text>
          {entries
            .slice()
            .reverse()
            .map((entry) => {
              const info = BRISTOL_TYPES.find((b) => b.type === entry.bristol_type)!;
              return (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={[styles.entryBadge, { backgroundColor: info.color }]}>
                    <Text style={styles.entryBadgeText}>{entry.bristol_type}</Text>
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryDesc}>{info.description}</Text>
                    {entry.notes && (
                      <Text style={styles.entryNote} numberOfLines={2}>
                        {entry.notes}
                      </Text>
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
              );
            })}
        </>
      )}

      {/* Source citation */}
      <Text style={styles.citation}>
        Source: Lewis SJ, Heaton KW. Scand J Gastroenterol. 1997;32(9):920-924.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  selectedCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  selectedType: { fontSize: 24, fontWeight: 'bold' },
  selectedDesc: { color: Colors.text, fontSize: 15, marginTop: 4 },
  indicatorBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  indicatorText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeNumText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  typeInfo: { flex: 1 },
  typeDesc: { color: Colors.text, fontSize: 14 },
  typeIndicator: { fontSize: 11, fontWeight: '600', marginTop: 2 },
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
    marginBottom: 16,
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
  logBtnText: { color: Colors.primaryBackground, fontSize: 17, fontWeight: '700' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  entryBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBadgeText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  entryInfo: { flex: 1 },
  entryDesc: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  entryNote: { color: Colors.secondaryText, fontSize: 13, marginTop: 2 },
  entryTime: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  citation: {
    color: Colors.secondaryText,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
});
