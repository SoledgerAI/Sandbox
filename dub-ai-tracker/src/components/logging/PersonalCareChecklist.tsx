// Personal care daily checklist -- AM/PM with tier-based defaults
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
import type { PersonalCareEntry } from '../../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const DEFAULT_ENTRY: PersonalCareEntry = {
  brush_teeth_am: false,
  brush_teeth_pm: false,
  floss: false,
  mouthwash: false,
  shower: false,
  skincare_am: false,
  skincare_am_detail: null,
  skincare_pm: false,
  skincare_pm_detail: null,
  sunscreen: false,
  grooming: false,
  grooming_notes: null,
  handwashing_count: 0,
};

interface CheckItem {
  key: keyof PersonalCareEntry;
  label: string;
  icon: string;
  type: 'boolean';
}

const CHECKLIST_ITEMS: CheckItem[] = [
  { key: 'brush_teeth_am', label: 'Brush Teeth AM', icon: 'sunny-outline', type: 'boolean' },
  { key: 'brush_teeth_pm', label: 'Brush Teeth PM', icon: 'moon-outline', type: 'boolean' },
  { key: 'floss', label: 'Floss', icon: 'git-merge-outline', type: 'boolean' },
  { key: 'mouthwash', label: 'Mouthwash', icon: 'water-outline', type: 'boolean' },
  { key: 'shower', label: 'Shower', icon: 'rainy-outline', type: 'boolean' },
  { key: 'skincare_am', label: 'Skincare AM', icon: 'sunny-outline', type: 'boolean' },
  { key: 'skincare_pm', label: 'Skincare PM', icon: 'moon-outline', type: 'boolean' },
  { key: 'sunscreen', label: 'Sunscreen', icon: 'shield-outline', type: 'boolean' },
  { key: 'grooming', label: 'Grooming', icon: 'cut-outline', type: 'boolean' },
];

export function PersonalCareChecklist() {
  const [entry, setEntry] = useState<PersonalCareEntry>(DEFAULT_ENTRY);
  const [skincareAmDetail, setSkincareAmDetail] = useState('');
  const [skincarePmDetail, setSkincarePmDetail] = useState('');
  const [groomingNotes, setGroomingNotes] = useState('');

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_PERSONALCARE, today);
    const stored = await storageGet<PersonalCareEntry>(key);
    if (stored) {
      setEntry(stored);
      setSkincareAmDetail(stored.skincare_am_detail ?? '');
      setSkincarePmDetail(stored.skincare_pm_detail ?? '');
      setGroomingNotes(stored.grooming_notes ?? '');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveEntry = useCallback(async (updated: PersonalCareEntry) => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_PERSONALCARE, today);
    await storageSet(key, updated);
    setEntry(updated);
  }, []);

  const toggleItem = (itemKey: keyof PersonalCareEntry) => {
    const updated = { ...entry, [itemKey]: !entry[itemKey] };
    saveEntry(updated);
  };

  const incrementHandwashing = () => {
    const updated = { ...entry, handwashing_count: entry.handwashing_count + 1 };
    saveEntry(updated);
  };

  const decrementHandwashing = () => {
    if (entry.handwashing_count <= 0) return;
    const updated = { ...entry, handwashing_count: entry.handwashing_count - 1 };
    saveEntry(updated);
  };

  const saveDetails = useCallback(() => {
    const updated = {
      ...entry,
      skincare_am_detail: skincareAmDetail.trim() || null,
      skincare_pm_detail: skincarePmDetail.trim() || null,
      grooming_notes: groomingNotes.trim() || null,
    };
    saveEntry(updated);
  }, [entry, skincareAmDetail, skincarePmDetail, groomingNotes, saveEntry]);

  const completedCount = CHECKLIST_ITEMS.filter(
    (item) => entry[item.key] === true,
  ).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>
          {completedCount}/{CHECKLIST_ITEMS.length}
        </Text>
        <Text style={styles.summaryLabel}>tasks completed</Text>
      </View>

      {/* Checklist */}
      <Text style={styles.sectionTitle}>Daily Checklist</Text>
      {CHECKLIST_ITEMS.map((item) => {
        const checked = entry[item.key] === true;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.checkRow}
            onPress={() => toggleItem(item.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={22}
              color={checked ? Colors.accent : Colors.secondaryText}
            />
            <Ionicons
              name={item.icon as any}
              size={18}
              color={checked ? Colors.accent : Colors.secondaryText}
            />
            <Text style={[styles.checkLabel, checked && styles.checkLabelDone]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Skincare AM detail */}
      {entry.skincare_am && (
        <TextInput
          style={styles.detailInput}
          value={skincareAmDetail}
          onChangeText={setSkincareAmDetail}
          onBlur={saveDetails}
          placeholder="AM skincare routine details (optional)"
          placeholderTextColor={Colors.secondaryText}
        />
      )}

      {/* Skincare PM detail */}
      {entry.skincare_pm && (
        <TextInput
          style={styles.detailInput}
          value={skincarePmDetail}
          onChangeText={setSkincarePmDetail}
          onBlur={saveDetails}
          placeholder="PM skincare routine details (optional)"
          placeholderTextColor={Colors.secondaryText}
        />
      )}

      {/* Grooming notes */}
      {entry.grooming && (
        <TextInput
          style={styles.detailInput}
          value={groomingNotes}
          onChangeText={setGroomingNotes}
          onBlur={saveDetails}
          placeholder="Grooming notes (optional)"
          placeholderTextColor={Colors.secondaryText}
        />
      )}

      {/* Handwashing counter */}
      <Text style={styles.sectionTitle}>Handwashing</Text>
      <View style={styles.counterRow}>
        <TouchableOpacity style={styles.counterBtn} onPress={decrementHandwashing}>
          <Ionicons name="remove" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.counterDisplay}>
          <Text style={styles.counterValue}>{entry.handwashing_count}</Text>
          <Text style={styles.counterLabel}>times</Text>
        </View>
        <TouchableOpacity style={styles.counterBtn} onPress={incrementHandwashing}>
          <Ionicons name="add" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryValue: {
    color: Colors.accent,
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: { color: Colors.secondaryText, fontSize: 13, marginTop: 4 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    gap: 10,
  },
  checkLabel: { flex: 1, color: Colors.text, fontSize: 14 },
  checkLabelDone: { color: Colors.accent, fontWeight: '600' },
  detailInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 8,
    marginTop: 4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  counterDisplay: { alignItems: 'center' },
  counterValue: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  counterLabel: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
});
