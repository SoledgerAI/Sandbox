// Substance logging component -- alcohol, cannabis, tobacco tabs
// Phase 8: Hydration, Caffeine, and Substance Logging
// Tone: Zero judgment in UI copy. Data only.

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
import type {
  SubstanceEntry,
  AlcoholType,
  CannabisMethod,
} from '../../types';
import type { SobrietyGoal } from '../../types/profile';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';

type SubstanceTab = 'alcohol' | 'cannabis' | 'tobacco';

const ALCOHOL_TYPES: { label: string; type: AlcoholType; standardDrinks: number; calories: number; unit: string }[] = [
  { label: 'Beer (12 oz)', type: 'beer', standardDrinks: 1, calories: 153, unit: 'drinks' },
  { label: 'Wine (5 oz)', type: 'wine', standardDrinks: 1, calories: 125, unit: 'glasses' },
  { label: 'Liquor (1.5 oz)', type: 'liquor', standardDrinks: 1, calories: 97, unit: 'shots' },
  { label: 'Cocktail', type: 'cocktail', standardDrinks: 1.5, calories: 200, unit: 'drinks' },
];

const CANNABIS_METHODS: { label: string; method: CannabisMethod }[] = [
  { label: 'Smoked', method: 'smoked' },
  { label: 'Vaped', method: 'vaped' },
  { label: 'Edible', method: 'edible' },
  { label: 'Topical', method: 'topical' },
  { label: 'Beverage', method: 'beverage' },
];

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface SubstanceLoggerProps {
  initialTab?: SubstanceTab;
  onEntryLogged?: () => void;
}

export function SubstanceLogger({ initialTab = 'alcohol', onEntryLogged }: SubstanceLoggerProps) {
  const [activeTab, setActiveTab] = useState<SubstanceTab>(initialTab);
  const [entries, setEntries] = useState<SubstanceEntry[]>([]);

  // Alcohol state
  const [selectedAlcoholType, setSelectedAlcoholType] = useState<AlcoholType>('beer');
  const [alcoholCount, setAlcoholCount] = useState('1');

  // Cannabis state
  const [selectedMethod, setSelectedMethod] = useState<CannabisMethod>('smoked');
  const [thcMg, setThcMg] = useState('');
  const [cbdMg, setCbdMg] = useState('');

  // Tobacco state
  const [tobaccoCount, setTobaccoCount] = useState('1');
  const [tobaccoNotes, setTobaccoNotes] = useState('');

  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<SubstanceEntry>('substances.tracking');

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    setActiveTab(lastEntry.substance as SubstanceTab);
    if (lastEntry.substance === 'alcohol') {
      if (lastEntry.alcohol_type) setSelectedAlcoholType(lastEntry.alcohol_type);
      setAlcoholCount(String(lastEntry.amount));
    } else if (lastEntry.substance === 'cannabis') {
      if (lastEntry.cannabis_method) setSelectedMethod(lastEntry.cannabis_method);
    } else if (lastEntry.substance === 'tobacco') {
      setTobaccoCount(String(lastEntry.amount));
    }
  }, [lastEntry]);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SUBSTANCES, today);
    const stored = await storageGet<SubstanceEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tabEntries = entries.filter((e) => e.substance === activeTab);

  const logSubstance = useCallback(
    async (entry: Omit<SubstanceEntry, 'id' | 'timestamp'>) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_SUBSTANCES, today);

      const newEntry: SubstanceEntry = {
        ...entry,
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
      };

      const updated = [...entries, newEntry];
      await storageSet(key, updated);
      setEntries(updated);

      // Save as last entry for repeat-last
      await saveAsLast(newEntry);

      // D10-007: Auto-reset sobriety streak on substance log
      try {
        const sobrietyGoals = await storageGet<Record<string, SobrietyGoal>>(STORAGE_KEYS.SOBRIETY);
        if (sobrietyGoals) {
          const substanceKey = entry.substance;
          const goal = sobrietyGoals[substanceKey];
          if (goal && goal.goal_type === 'quit') {
            const resetGoals: Record<string, SobrietyGoal> = {
              ...sobrietyGoals,
              [substanceKey]: {
                ...goal,
                current_streak_days: 0,
                sobriety_start_date: todayDateString(),
              },
            };
            await storageSet(STORAGE_KEYS.SOBRIETY, resetGoals);
          }
        }
      } catch {
        // Streak reset is best-effort; do not block the log save
      }

      onEntryLogged?.();
    },
    [entries, onEntryLogged, saveAsLast],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_SUBSTANCES, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  const logAlcohol = useCallback(() => {
    const count = parseFloat(alcoholCount);
    if (isNaN(count) || count <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid number.');
      return;
    }
    const typeInfo = ALCOHOL_TYPES.find((t) => t.type === selectedAlcoholType);
    if (!typeInfo) return;

    logSubstance({
      substance: 'alcohol',
      amount: count,
      unit: typeInfo.unit,
      alcohol_type: selectedAlcoholType,
      cannabis_method: null,
      thc_mg: null,
      cbd_mg: null,
      calories: Math.round(typeInfo.calories * count),
      notes: null,
    });
    setAlcoholCount('1');
  }, [alcoholCount, selectedAlcoholType, logSubstance]);

  const logCannabis = useCallback(() => {
    const thc = thcMg ? parseFloat(thcMg) : null;
    const cbd = cbdMg ? parseFloat(cbdMg) : null;

    logSubstance({
      substance: 'cannabis',
      amount: 1,
      unit: 'session',
      alcohol_type: null,
      cannabis_method: selectedMethod,
      thc_mg: thc,
      cbd_mg: cbd,
      calories: null,
      notes: null,
    });
    setThcMg('');
    setCbdMg('');
  }, [selectedMethod, thcMg, cbdMg, logSubstance]);

  const logTobacco = useCallback(() => {
    const count = parseInt(tobaccoCount, 10);
    if (isNaN(count) || count <= 0) {
      Alert.alert('Invalid Count', 'Please enter a valid number.');
      return;
    }

    logSubstance({
      substance: 'tobacco',
      amount: count,
      unit: 'cigarettes',
      alcohol_type: null,
      cannabis_method: null,
      thc_mg: null,
      cbd_mg: null,
      calories: null,
      notes: tobaccoNotes.trim() || null,
    });
    setTobaccoCount('1');
    setTobaccoNotes('');
  }, [tobaccoCount, tobaccoNotes, logSubstance]);

  // Compute totals for alcohol
  const alcoholEntries = entries.filter((e) => e.substance === 'alcohol');
  const totalStandardDrinks = alcoholEntries.reduce((sum, e) => {
    const typeInfo = ALCOHOL_TYPES.find((t) => t.type === e.alcohol_type);
    return sum + e.amount * (typeInfo?.standardDrinks ?? 1);
  }, 0);
  const totalAlcoholCals = alcoholEntries.reduce((sum, e) => sum + (e.calories ?? 0), 0);

  const renderAlcoholTab = () => (
    <>
      {/* Daily summary */}
      {alcoholEntries.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalStandardDrinks.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>standard drinks</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalAlcoholCals}</Text>
              <Text style={styles.summaryLabel}>calories</Text>
            </View>
          </View>
        </View>
      )}

      {/* Drink type selector */}
      <Text style={styles.sectionTitle}>Type</Text>
      <View style={styles.typeGrid}>
        {ALCOHOL_TYPES.map((t) => (
          <TouchableOpacity
            key={t.type}
            style={[
              styles.typeBtn,
              selectedAlcoholType === t.type && styles.typeBtnSelected,
            ]}
            onPress={() => setSelectedAlcoholType(t.type)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.typeBtnText,
                selectedAlcoholType === t.type && styles.typeBtnTextSelected,
              ]}
            >
              {t.label}
            </Text>
            <Text style={styles.typeBtnDetail}>{t.calories} cal each</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount */}
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>How many</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const n = Math.max(0.5, parseFloat(alcoholCount) - 0.5);
              setAlcoholCount(String(n));
            }}
          >
            <Ionicons name="remove" size={20} color={Colors.text} />
          </TouchableOpacity>
          <TextInput
            style={styles.stepperInput}
            value={alcoholCount}
            onChangeText={setAlcoholCount}
            keyboardType="numeric"
            textAlign="center"
          />
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const n = parseFloat(alcoholCount) + 0.5;
              setAlcoholCount(String(n));
            }}
          >
            <Ionicons name="add" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.logBtn} onPress={logAlcohol} activeOpacity={0.7}>
        <Text style={styles.logBtnText}>Log Drink</Text>
      </TouchableOpacity>
    </>
  );

  const renderCannabisTab = () => (
    <>
      {/* Method selector */}
      <Text style={styles.sectionTitle}>Method</Text>
      <View style={styles.typeGrid}>
        {CANNABIS_METHODS.map((m) => (
          <TouchableOpacity
            key={m.method}
            style={[
              styles.typeBtn,
              selectedMethod === m.method && styles.typeBtnSelected,
            ]}
            onPress={() => setSelectedMethod(m.method)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.typeBtnText,
                selectedMethod === m.method && styles.typeBtnTextSelected,
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Optional dosage (for edibles especially) */}
      <Text style={styles.sectionTitle}>Dosage (optional)</Text>
      <View style={styles.dosageRow}>
        <View style={styles.dosageField}>
          <TextInput
            style={styles.dosageInput}
            value={thcMg}
            onChangeText={setThcMg}
            placeholder="THC mg"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.dosageField}>
          <TextInput
            style={styles.dosageInput}
            value={cbdMg}
            onChangeText={setCbdMg}
            placeholder="CBD mg"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="numeric"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logBtn} onPress={logCannabis} activeOpacity={0.7}>
        <Text style={styles.logBtnText}>Log Session</Text>
      </TouchableOpacity>
    </>
  );

  const renderTobaccoTab = () => (
    <>
      {/* Count */}
      <Text style={styles.sectionTitle}>Count</Text>
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Cigarettes</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const n = Math.max(1, parseInt(tobaccoCount, 10) - 1);
              setTobaccoCount(String(n));
            }}
          >
            <Ionicons name="remove" size={20} color={Colors.text} />
          </TouchableOpacity>
          <TextInput
            style={styles.stepperInput}
            value={tobaccoCount}
            onChangeText={setTobaccoCount}
            keyboardType="numeric"
            textAlign="center"
          />
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const n = parseInt(tobaccoCount, 10) + 1;
              setTobaccoCount(String(n));
            }}
          >
            <Ionicons name="add" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notes */}
      <TextInput
        style={styles.notesInput}
        value={tobaccoNotes}
        onChangeText={setTobaccoNotes}
        placeholder="Notes (optional)"
        placeholderTextColor={Colors.secondaryText}
        multiline
      />

      <TouchableOpacity style={styles.logBtn} onPress={logTobacco} activeOpacity={0.7}>
        <Text style={styles.logBtnText}>Log Usage</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <RepeatLastEntry
        tagLabel="substance"
        subtitle={lastEntry?.substance ?? undefined}
        visible={!lastEntryLoading && lastEntry !== null}
        onRepeat={handleRepeatLast}
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['alcohol', 'cannabis', 'tobacco'] as SubstanceTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === 'alcohol' && renderAlcoholTab()}
      {activeTab === 'cannabis' && renderCannabisTab()}
      {activeTab === 'tobacco' && renderTobaccoTab()}

      {/* Today's entries for active tab */}
      {tabEntries.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            Today&apos;s Entries
          </Text>
          {tabEntries
            .slice()
            .reverse()
            .map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryPrimary}>
                    {entry.substance === 'alcohol'
                      ? `${entry.amount} ${entry.alcohol_type ?? 'drink'}${entry.amount !== 1 ? 's' : ''}`
                      : entry.substance === 'cannabis'
                        ? `${entry.cannabis_method ?? 'session'}`
                        : `${entry.amount} cigarette${entry.amount !== 1 ? 's' : ''}`}
                  </Text>
                  {entry.calories != null && (
                    <Text style={styles.entryCals}>{entry.calories} cal</Text>
                  )}
                  {entry.thc_mg != null && (
                    <Text style={styles.entryDetail}>{entry.thc_mg} mg THC</Text>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: Colors.cardBackground,
  },
  tabText: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: Colors.accent,
    fontSize: 24,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.divider,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    minWidth: '45%',
    flexGrow: 1,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  typeBtnSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  typeBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  typeBtnTextSelected: {
    color: Colors.accent,
    fontWeight: '700',
  },
  typeBtnDetail: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  amountLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    width: 60,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  dosageRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  dosageField: {
    flex: 1,
  },
  dosageInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  notesInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  logBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  entryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  entryPrimary: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  entryCals: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  entryDetail: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  entryTime: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
});
