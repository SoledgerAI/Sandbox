// Supplement checklist -- vitamins, medications, supplements with time logging, quantity, and UL validation
// Phase 13 + Task F: Prompt 07 v2

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
import type { SupplementEntry } from '../../types';
import { DateTimePicker } from '../common/DateTimePicker';
import { DosageWarningBanner, checkDosageWarning } from './DosageValidator';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

type SupplementCategory = 'vitamin' | 'medication' | 'supplement';

const CATEGORY_TABS: { value: SupplementCategory; label: string; icon: string }[] = [
  { value: 'vitamin', label: 'Vitamins', icon: 'sunny-outline' },
  { value: 'medication', label: 'Medications', icon: 'medkit-outline' },
  { value: 'supplement', label: 'Supplements', icon: 'flask-outline' },
];

const DEFAULT_VITAMINS = [
  'Vitamin A', 'Vitamin B1', 'Vitamin B2', 'Vitamin B3', 'Vitamin B5',
  'Vitamin B6', 'Vitamin B7', 'Vitamin B9', 'Vitamin B12', 'Vitamin C',
  'Vitamin D', 'Vitamin E', 'Vitamin K',
];

const COMMON_SUPPLEMENTS = [
  'Creatine Monohydrate', 'Beta-Alanine', 'Citrulline Malate', 'BCAAs', 'HMB',
  'Ashwagandha', 'Rhodiola Rosea', 'Tongkat Ali', 'Maca Root', 'Turmeric/Curcumin',
  'Berberine', "Lion's Mane", 'Reishi', 'Omega-3 Fish Oil', 'Probiotics',
  'Collagen Peptides', 'CoQ10', 'Melatonin', 'L-Theanine',
  'Glucosamine/Chondroitin', 'Fiber supplement', 'Electrolytes',
];

export function SupplementChecklist() {
  const [entries, setEntries] = useState<SupplementEntry[]>([]);
  const [category, setCategory] = useState<SupplementCategory>('vitamin');
  const [customName, setCustomName] = useState('');
  const [dosage, setDosage] = useState('');
  const [unit, setUnit] = useState('mg');
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today);
    const stored = await storageGet<SupplementEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveEntries = useCallback(async (updated: SupplementEntry[]) => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today);
    await storageSet(key, updated);
    setEntries(updated);
  }, []);

  // F2: Tap checked supplement = add another dose. Long-press = remove all.
  const toggleItem = useCallback(
    async (name: string, cat: SupplementCategory) => {
      const matchingEntries = entries.filter(
        (e) => e.name === name && e.category === cat && e.taken,
      );
      if (matchingEntries.length > 0) {
        // Already taken — add another dose (increment)
        if (matchingEntries.length >= 10) {
          Alert.alert('Maximum Reached', 'You can log up to 10 doses per supplement per day.');
          return;
        }
        const entry: SupplementEntry = {
          id: `supp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          name,
          dosage: 0,
          unit: 'mg',
          taken: true,
          category: cat,
          notes: null,
        };
        await saveEntries([...entries, entry]);
      } else {
        // Not taken — log first dose
        const entry: SupplementEntry = {
          id: `supp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          name,
          dosage: 0,
          unit: 'mg',
          taken: true,
          category: cat,
          notes: null,
        };
        await saveEntries([...entries, entry]);
      }
    },
    [entries, saveEntries],
  );

  const removeAllForItem = useCallback(
    (name: string, cat: SupplementCategory) => {
      Alert.alert(
        'Remove Supplement',
        `Remove all ${name} entries for today?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              saveEntries(entries.filter(
                (e) => !(e.name === name && e.category === cat && e.taken),
              ));
            },
          },
        ],
      );
    },
    [entries, saveEntries],
  );

  // F1: Update timestamp for a specific entry
  const updateTimestamp = useCallback(
    async (entryId: string, newDate: Date) => {
      const updated = entries.map((e) =>
        e.id === entryId ? { ...e, timestamp: newDate.toISOString() } : e,
      );
      await saveEntries(updated);
    },
    [entries, saveEntries],
  );

  const addCustom = useCallback(async () => {
    const name = customName.trim();
    if (!name) return;

    const dosageVal = parseFloat(dosage) || 0;

    const entry: SupplementEntry = {
      id: `supp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      name,
      dosage: dosageVal,
      unit,
      taken: true,
      category,
      notes: null,
    };

    const dailyTotal = entries
      .filter((e) => e.name.toLowerCase() === name.toLowerCase() && e.taken)
      .reduce((sum, e) => sum + e.dosage, 0) + dosageVal;

    const warning = checkDosageWarning(name, dailyTotal, unit);
    if (warning?.exceeded) {
      Alert.alert(
        'Dosage Warning',
        `Your daily ${warning.supplementDisplayName} intake of ${dailyTotal} ${unit} exceeds the Tolerable Upper Intake Level of ${warning.ulValue} ${warning.ulUnit}.\n\nConsult your healthcare provider.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Anyway',
            onPress: async () => {
              await saveEntries([...entries, entry]);
              setCustomName('');
              setDosage('');
            },
          },
        ],
      );
      return;
    }

    await saveEntries([...entries, entry]);
    setCustomName('');
    setDosage('');
  }, [customName, dosage, unit, category, entries, saveEntries]);

  const deleteEntry = useCallback(
    async (id: string) => {
      await saveEntries(entries.filter((e) => e.id !== id));
    },
    [entries, saveEntries],
  );

  const takenCount = entries.filter((e) => e.taken).length;
  const categoryEntries = entries.filter((e) => e.category === category && e.taken);

  const dailyTotals = entries
    .filter((e) => e.taken && e.dosage > 0)
    .reduce<Record<string, { total: number; unit: string }>>((acc, e) => {
      const k = e.name.toLowerCase();
      if (!acc[k]) acc[k] = { total: 0, unit: e.unit };
      acc[k].total += e.dosage;
      return acc;
    }, {});

  const checklist = category === 'vitamin' ? DEFAULT_VITAMINS : COMMON_SUPPLEMENTS;

  // F3: Get count + latest timestamp for each supplement in checklist
  function getItemInfo(name: string, cat: SupplementCategory) {
    const matching = entries.filter(
      (e) => e.name === name && e.category === cat && e.taken,
    );
    const count = matching.length;
    const latest = matching.length > 0
      ? matching.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
      : null;
    const hasOverriddenTime = matching.some((e) => e.notes === 'time_overridden');
    return { count, latest, hasOverriddenTime };
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{takenCount}</Text>
        <Text style={styles.summaryLabel}>supplements taken today</Text>
      </View>

      {/* UL warnings */}
      {Object.entries(dailyTotals).map(([name, { total, unit: u }]) => (
        <DosageWarningBanner key={name} supplementName={name} dailyTotal={total} unit={u} />
      ))}

      {/* Category tabs */}
      <View style={styles.tabRow}>
        {CATEGORY_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.tab, category === tab.value && styles.tabActive]}
            onPress={() => setCategory(tab.value)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={category === tab.value ? Colors.primaryBackground : Colors.secondaryText}
            />
            <Text style={[styles.tabText, category === tab.value && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Checklist for vitamins/supplements */}
      {category !== 'medication' && (
        <>
          <Text style={styles.sectionTitle}>
            {category === 'vitamin' ? 'Vitamins' : 'Common Supplements'}
          </Text>
          <Text style={styles.sectionHint}>Tap to log. Tap again to add another dose. Long-press to remove.</Text>
          {checklist.map((name) => {
            const { count, latest, hasOverriddenTime } = getItemInfo(name, category);
            const taken = count > 0;
            return (
              <TouchableOpacity
                key={name}
                style={styles.checkRow}
                onPress={() => toggleItem(name, category)}
                onLongPress={() => taken && removeAllForItem(name, category)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={taken ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={taken ? Colors.accent : Colors.secondaryText}
                />
                <Text style={[styles.checkLabel, taken && styles.checkLabelTaken]}>{name}</Text>
                {count > 1 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>x{count}</Text>
                  </View>
                )}
                {taken && latest && (
                  <TouchableOpacity
                    onPress={() => setEditingTimeId(editingTimeId === latest.id ? null : latest.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.checkTime, hasOverriddenTime && styles.checkTimeOverridden]}>
                      {new Date(latest.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* F1: Time override picker */}
      {editingTimeId && (
        <View style={styles.timeOverrideCard}>
          <DateTimePicker
            label="Edit Time"
            mode="datetime"
            value={new Date(entries.find((e) => e.id === editingTimeId)?.timestamp ?? Date.now())}
            onChange={(d) => {
              updateTimestamp(editingTimeId, d);
              // Mark as overridden by setting notes
              const updated = entries.map((e) =>
                e.id === editingTimeId ? { ...e, timestamp: d.toISOString(), notes: 'time_overridden' } : e,
              );
              saveEntries(updated);
            }}
            minimumDate={new Date(Date.now() - 48 * 60 * 60 * 1000)}
            maximumDate={new Date()}
          />
          <TouchableOpacity
            style={styles.timeOverrideDone}
            onPress={() => setEditingTimeId(null)}
          >
            <Text style={styles.timeOverrideDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Custom entry for all categories */}
      <Text style={styles.sectionTitle}>
        {category === 'medication' ? 'Log Medication' : 'Add Custom'}
      </Text>
      <View style={styles.customRow}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          value={customName}
          onChangeText={setCustomName}
          placeholder="Name"
          placeholderTextColor={Colors.secondaryText}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={dosage}
          onChangeText={setDosage}
          placeholder="Dose"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={styles.unitBtn}
          onPress={() => {
            const units = ['mg', 'mcg', 'g', 'IU', 'ml'];
            const idx = units.indexOf(unit);
            setUnit(units[(idx + 1) % units.length]);
          }}
        >
          <Text style={styles.unitText}>{unit}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={addCustom} activeOpacity={0.7}>
        <Ionicons name="add-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.addBtnText}>Add {category === 'medication' ? 'Medication' : 'Supplement'}</Text>
      </TouchableOpacity>

      {/* Today's logged entries */}
      {categoryEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Logged Today</Text>
          {categoryEntries
            .slice()
            .reverse()
            .map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>{entry.name}</Text>
                  {entry.dosage > 0 && (
                    <Text style={styles.entryDosage}>
                      {entry.dosage} {entry.unit}
                    </Text>
                  )}
                  <Text style={[styles.entryTime, entry.notes === 'time_overridden' && styles.entryTimeOverridden]}>
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
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabText: { color: Colors.secondaryText, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: Colors.primaryBackground },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionHint: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginBottom: 8,
    marginTop: -4,
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
  checkLabelTaken: { color: Colors.accent, fontWeight: '600' },
  checkTime: { color: Colors.secondaryText, fontSize: 12 },
  checkTimeOverridden: { color: Colors.accent },
  countBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: Colors.primaryBackground,
    fontSize: 11,
    fontWeight: '700',
  },
  timeOverrideCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  timeOverrideDone: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  timeOverrideDoneText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  unitBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    minWidth: 50,
  },
  unitText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 20,
  },
  addBtnText: { color: Colors.primaryBackground, fontSize: 16, fontWeight: '700' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  entryInfo: { flex: 1 },
  entryName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  entryDosage: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  entryTime: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  entryTimeOverridden: { color: Colors.accent },
});
