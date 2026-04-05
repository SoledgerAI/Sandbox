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
  storageList,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { SupplementEntry, SideEffectLabel, SideEffectEntry } from '../../types';
import { SIDE_EFFECT_OPTIONS } from '../../types';
import { DateTimePicker } from '../common/DateTimePicker';
import { DosageWarningBanner, checkDosageWarning } from './DosageValidator';
import { RepeatLastEntry } from './RepeatLastEntry';
import { useLastEntry } from '../../hooks/useLastEntry';
import { todayDateString } from '../../utils/dayBoundary';

// MASTER-52: Supplement stack preset type
interface SupplementStack {
  id: string;
  name: string;
  supplement_ids: string[];  // supplement names to check
  category: SupplementCategory;
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
  const [editingSideEffectsId, setEditingSideEffectsId] = useState<string | null>(null);
  const [sideEffectSelections, setSideEffectSelections] = useState<SideEffectLabel[]>([]);
  const [sideEffectOther, setSideEffectOther] = useState('');
  const [stacks, setStacks] = useState<SupplementStack[]>([]);
  const [morningStack, setMorningStack] = useState<SupplementEntry[] | null>(null);

  const { lastEntry: lastSupplements, saveAsLast: saveLastSupplements } =
    useLastEntry<SupplementEntry[]>('supplements.daily');

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today);
    const [stored, savedStacks] = await Promise.all([
      storageGet<SupplementEntry[]>(key),
      storageGet<SupplementStack[]>(STORAGE_KEYS.SUPPLEMENT_STACKS),
    ]);
    setEntries(stored ?? []);
    setStacks(savedStacks ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Detect morning stack: supplements logged 5am-10am on most recent day with data
  useEffect(() => {
    (async () => {
      const keys = await storageList(STORAGE_KEYS.LOG_SUPPLEMENTS);
      // Sort descending to find most recent day first
      const sortedKeys = keys
        .filter((k) => k !== dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, todayDateString()))
        .sort()
        .reverse();

      for (const key of sortedKeys.slice(0, 7)) {
        const dayEntries = await storageGet<SupplementEntry[]>(key);
        if (!dayEntries || dayEntries.length === 0) continue;

        const morningEntries = dayEntries.filter((e) => {
          if (!e.taken) return false;
          const hour = new Date(e.timestamp).getHours();
          return hour >= 5 && hour < 10;
        });

        if (morningEntries.length > 0) {
          setMorningStack(morningEntries);
          break;
        }
      }
    })();
  }, []);

  const saveEntries = useCallback(async (updated: SupplementEntry[]) => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today);
    await storageSet(key, updated);
    setEntries(updated);
    // Save as last for repeat-last
    const taken = updated.filter((e) => e.taken);
    if (taken.length > 0) {
      await saveLastSupplements(taken);
    }
  }, [saveLastSupplements]);

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
          side_effects: null,
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
          side_effects: null,
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
      side_effects: null,
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

  // MASTER-52: Save current checked supplements as a named stack
  const saveAsStack = useCallback(() => {
    const checked = entries.filter((e) => e.taken && e.category === category);
    if (checked.length === 0) {
      Alert.alert('No Supplements', 'Check some supplements first, then save as a stack.');
      return;
    }

    const supplementNames = [...new Set(checked.map((e) => e.name))];

    const doSave = (name: string) => {
      const stack: SupplementStack = {
        id: `stack_${Date.now()}`,
        name,
        supplement_ids: supplementNames,
        category,
      };
      const updated = [...stacks, stack];
      storageSet(STORAGE_KEYS.SUPPLEMENT_STACKS, updated);
      setStacks(updated);
    };

    if (Alert.prompt) {
      Alert.prompt('Save Stack', 'Name this supplement stack:', (name) => {
        if (name?.trim()) doSave(name.trim());
      });
    } else {
      Alert.alert('Save Stack', `Save ${supplementNames.length} supplements as a stack?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => doSave(`${category === 'vitamin' ? 'Vitamin' : 'Supplement'} Stack`),
        },
      ]);
    }
  }, [entries, category, stacks]);

  // MASTER-52: Apply a stack — check all supplements in it
  const applyStack = useCallback(
    async (stack: SupplementStack) => {
      const now = new Date();
      const newEntries: SupplementEntry[] = [];

      for (const name of stack.supplement_ids) {
        // Skip if already taken today
        const alreadyTaken = entries.some(
          (e) => e.name === name && e.category === stack.category && e.taken,
        );
        if (alreadyTaken) continue;

        newEntries.push({
          id: `supp_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: now.toISOString(),
          name,
          dosage: 0,
          unit: 'mg',
          taken: true,
          category: stack.category,
          notes: null,
          side_effects: null,
        });
      }

      if (newEntries.length === 0) {
        Alert.alert('Already Taken', 'All supplements in this stack are already logged today.');
        return;
      }

      await saveEntries([...entries, ...newEntries]);
    },
    [entries, saveEntries],
  );

  const deleteStack = useCallback(
    (stackId: string) => {
      Alert.alert('Delete Stack', 'Remove this supplement stack?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = stacks.filter((s) => s.id !== stackId);
            storageSet(STORAGE_KEYS.SUPPLEMENT_STACKS, updated);
            setStacks(updated);
          },
        },
      ]);
    },
    [stacks],
  );

  // Repeat last supplements: log all items from last entry
  const repeatLastSupps = useCallback(async () => {
    if (!lastSupplements || lastSupplements.length === 0) return;
    const now = new Date();
    const newEntries: SupplementEntry[] = [];

    for (const prev of lastSupplements) {
      const alreadyTaken = entries.some(
        (e) => e.name === prev.name && e.category === prev.category && e.taken,
      );
      if (alreadyTaken) continue;

      newEntries.push({
        id: `supp_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now.toISOString(),
        name: prev.name,
        dosage: prev.dosage,
        unit: prev.unit,
        taken: true,
        category: prev.category,
        notes: null,
        side_effects: null,
      });
    }

    if (newEntries.length === 0) {
      Alert.alert('Already Taken', 'All supplements from last time are already logged today.');
      return;
    }
    await saveEntries([...entries, ...newEntries]);
  }, [lastSupplements, entries, saveEntries]);

  // Repeat morning stack: log all supplements from 5am-10am on most recent day
  const applyMorningStack = useCallback(async () => {
    if (!morningStack || morningStack.length === 0) return;
    const now = new Date();
    const newEntries: SupplementEntry[] = [];

    for (const prev of morningStack) {
      const alreadyTaken = entries.some(
        (e) => e.name === prev.name && e.category === prev.category && e.taken,
      );
      if (alreadyTaken) continue;

      newEntries.push({
        id: `supp_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now.toISOString(),
        name: prev.name,
        dosage: prev.dosage,
        unit: prev.unit,
        taken: true,
        category: prev.category,
        notes: null,
        side_effects: null,
      });
    }

    if (newEntries.length === 0) {
      Alert.alert('Already Taken', 'All morning supplements are already logged today.');
      return;
    }
    await saveEntries([...entries, ...newEntries]);
  }, [morningStack, entries, saveEntries]);

  // P1-20: Side effects handlers
  const openSideEffectsEditor = useCallback((entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (entry?.side_effects) {
      setSideEffectSelections(entry.side_effects.labels);
      setSideEffectOther(entry.side_effects.other_text ?? '');
    } else {
      setSideEffectSelections([]);
      setSideEffectOther('');
    }
    setEditingSideEffectsId(entryId);
  }, [entries]);

  const toggleSideEffect = useCallback((label: SideEffectLabel) => {
    setSideEffectSelections((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  }, []);

  const saveSideEffects = useCallback(async () => {
    if (!editingSideEffectsId) return;
    const entry = entries.find((e) => e.id === editingSideEffectsId);
    if (!entry) return;

    const sideEffect: SideEffectEntry | null =
      sideEffectSelections.length > 0
        ? {
            labels: sideEffectSelections,
            other_text: sideEffectSelections.includes('Other') ? sideEffectOther.trim() || null : null,
            timestamp: new Date().toISOString(),
            medication_id: entry.id,
            medication_name: entry.name,
          }
        : null;

    const updated = entries.map((e) =>
      e.id === editingSideEffectsId ? { ...e, side_effects: sideEffect } : e,
    );
    await saveEntries(updated);
    setEditingSideEffectsId(null);
    setSideEffectSelections([]);
    setSideEffectOther('');
  }, [editingSideEffectsId, sideEffectSelections, sideEffectOther, entries, saveEntries]);

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

      {/* Repeat last supplements */}
      <RepeatLastEntry
        tagLabel="supplements"
        subtitle={lastSupplements ? `${lastSupplements.length} item${lastSupplements.length !== 1 ? 's' : ''}` : undefined}
        visible={lastSupplements != null && lastSupplements.length > 0 && entries.filter((e) => e.taken).length === 0}
        onRepeat={repeatLastSupps}
      />

      {/* Repeat morning stack */}
      <RepeatLastEntry
        tagLabel="morning stack"
        subtitle={morningStack ? `${[...new Set(morningStack.map((e) => e.name))].slice(0, 3).join(', ')}` : undefined}
        visible={morningStack != null && morningStack.length > 0 && entries.filter((e) => e.taken).length === 0}
        onRepeat={applyMorningStack}
      />

      {/* MASTER-52: Quick Stacks */}
      {stacks.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Quick Stacks</Text>
          {stacks.map((stack) => (
            <TouchableOpacity
              key={stack.id}
              style={styles.stackRow}
              onPress={() => applyStack(stack)}
              onLongPress={() => deleteStack(stack.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="layers-outline" size={20} color={Colors.accent} />
              <View style={styles.stackInfo}>
                <Text style={styles.stackName}>{stack.name}</Text>
                <Text style={styles.stackDetail}>
                  {stack.supplement_ids.length} item{stack.supplement_ids.length !== 1 ? 's' : ''} — tap to apply, hold to delete
                </Text>
              </View>
              <Ionicons name="add-circle" size={22} color={Colors.accent} />
            </TouchableOpacity>
          ))}
        </>
      )}

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

      {/* MASTER-52: Save as Stack button */}
      {entries.filter((e) => e.taken && e.category === category).length >= 2 && (
        <TouchableOpacity style={styles.saveStackBtn} onPress={saveAsStack} activeOpacity={0.7}>
          <Ionicons name="layers-outline" size={16} color={Colors.accent} />
          <Text style={styles.saveStackText}>Save as Stack</Text>
        </TouchableOpacity>
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
              <View key={entry.id}>
                <View style={styles.entryRow}>
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
                    {entry.side_effects && entry.side_effects.labels.length > 0 && (
                      <Text style={styles.sideEffectSummary}>
                        Side effects: {entry.side_effects.labels.join(', ')}
                        {entry.side_effects.other_text ? ` (${entry.side_effects.other_text})` : ''}
                      </Text>
                    )}
                  </View>
                  {entry.category === 'medication' && (
                    <TouchableOpacity
                      onPress={() => openSideEffectsEditor(entry.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginRight: 4 }}
                    >
                      <Ionicons
                        name={entry.side_effects ? 'warning' : 'warning-outline'}
                        size={18}
                        color={entry.side_effects ? Colors.accent : Colors.secondaryText}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => deleteEntry(entry.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>

                {/* P1-20: Side effects editor for this medication */}
                {editingSideEffectsId === entry.id && (
                  <View style={styles.sideEffectsCard}>
                    <Text style={styles.sideEffectsTitle}>Side Effects</Text>
                    <View style={styles.sideEffectsGrid}>
                      {SIDE_EFFECT_OPTIONS.map((label) => (
                        <TouchableOpacity
                          key={label}
                          style={[
                            styles.sideEffectChip,
                            sideEffectSelections.includes(label) && styles.sideEffectChipActive,
                          ]}
                          onPress={() => toggleSideEffect(label)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.sideEffectChipText,
                              sideEffectSelections.includes(label) && styles.sideEffectChipTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {sideEffectSelections.includes('Other') && (
                      <TextInput
                        style={styles.sideEffectOtherInput}
                        value={sideEffectOther}
                        onChangeText={setSideEffectOther}
                        placeholder="Describe other side effect..."
                        placeholderTextColor={Colors.secondaryText}
                      />
                    )}
                    <View style={styles.sideEffectsActions}>
                      <TouchableOpacity
                        onPress={() => setEditingSideEffectsId(null)}
                        style={styles.sideEffectsCancelBtn}
                      >
                        <Text style={styles.sideEffectsCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={saveSideEffects}
                        style={styles.sideEffectsSaveBtn}
                      >
                        <Text style={styles.sideEffectsSaveText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
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
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  stackInfo: { flex: 1 },
  stackName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  stackDetail: { color: Colors.secondaryText, fontSize: 11, marginTop: 2 },
  saveStackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  saveStackText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '500',
  },
  // P1-20: Side effects styles
  sideEffectSummary: {
    color: Colors.accentText,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  sideEffectsCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    marginTop: -2,
  },
  sideEffectsTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  sideEffectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  sideEffectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sideEffectChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  sideEffectChipText: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  sideEffectChipTextActive: {
    color: Colors.primaryBackground,
  },
  sideEffectOtherInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 10,
  },
  sideEffectsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  sideEffectsCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  sideEffectsCancelText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  sideEffectsSaveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  sideEffectsSaveText: {
    color: Colors.primaryBackground,
    fontSize: 13,
    fontWeight: '700',
  },
});
