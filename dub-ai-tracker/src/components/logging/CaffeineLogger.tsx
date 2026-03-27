// Caffeine logging component -- presets and custom mg entry
// Phase 8: Hydration, Caffeine, and Substance Logging

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { CaffeineEntry } from '../../types';

const CAFFEINE_PRESETS = [
  { label: 'Coffee', source: 'coffee', mg: 95, icon: 'cafe-outline' as const },
  { label: 'Espresso', source: 'espresso', mg: 63, icon: 'cafe' as const },
  { label: 'Tea', source: 'tea', mg: 47, icon: 'leaf-outline' as const },
  { label: 'Soda', source: 'soda', mg: 34, icon: 'beer-outline' as const },
  { label: 'Energy Drink', source: 'energy drink', mg: 160, icon: 'flash-outline' as const },
];

// FDA general guidance threshold
const CAFFEINE_AWARENESS_MG = 400;

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface CaffeineLoggerProps {
  onEntryLogged?: () => void;
}

export function CaffeineLogger({ onEntryLogged }: CaffeineLoggerProps) {
  const [entries, setEntries] = useState<CaffeineEntry[]>([]);
  const [customMg, setCustomMg] = useState('');
  const [customSource, setCustomSource] = useState('');

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_CAFFEINE, today);
    const stored = await storageGet<CaffeineEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalMg = entries.reduce((sum, e) => sum + e.amount_mg, 0);

  const logCaffeine = useCallback(
    async (amount_mg: number, source: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_CAFFEINE, today);

      const entry: CaffeineEntry = {
        id: `caff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        amount_mg,
        source,
        notes: null,
      };

      const updated = [...entries, entry];
      await storageSet(key, updated);
      setEntries(updated);
      onEntryLogged?.();
    },
    [entries, onEntryLogged],
  );

  const logCustom = useCallback(() => {
    const mg = parseFloat(customMg);
    if (isNaN(mg) || mg <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid mg amount.');
      return;
    }
    logCaffeine(mg, customSource.trim() || 'custom');
    setCustomMg('');
    setCustomSource('');
  }, [customMg, customSource, logCaffeine]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_CAFFEINE, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Daily total */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="cafe" size={28} color={Colors.accent} />
          <View style={styles.summaryText}>
            <Text style={styles.totalAmount}>{totalMg} mg</Text>
            <Text style={styles.goalText}>caffeine today</Text>
          </View>
        </View>

        {/* Awareness bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min((totalMg / CAFFEINE_AWARENESS_MG) * 100, 100)}%`,
                backgroundColor:
                  totalMg >= CAFFEINE_AWARENESS_MG ? Colors.danger : Colors.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {totalMg >= CAFFEINE_AWARENESS_MG
            ? `${totalMg} mg — above 400 mg FDA general guidance`
            : `${CAFFEINE_AWARENESS_MG - totalMg} mg until 400 mg awareness threshold`}
        </Text>
      </View>

      {/* Presets */}
      <Text style={styles.sectionTitle}>Quick Add</Text>
      <View style={styles.presetsGrid}>
        {CAFFEINE_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.source}
            style={styles.presetBtn}
            onPress={() => logCaffeine(preset.mg, preset.source)}
            activeOpacity={0.7}
          >
            <Ionicons name={preset.icon} size={22} color={Colors.accent} />
            <Text style={styles.presetLabel}>{preset.label}</Text>
            <Text style={styles.presetMg}>{preset.mg} mg</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom amount */}
      <Text style={styles.sectionTitle}>Custom</Text>
      <View style={styles.customRow}>
        <TextInput
          style={[styles.customInput, { flex: 1 }]}
          value={customSource}
          onChangeText={setCustomSource}
          placeholder="Source (optional)"
          placeholderTextColor={Colors.secondaryText}
        />
        <TextInput
          style={[styles.customInput, { width: 80 }]}
          value={customMg}
          onChangeText={setCustomMg}
          placeholder="mg"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={logCustom}
        />
        <TouchableOpacity
          style={[styles.logBtn, !customMg && styles.logBtnDisabled]}
          onPress={logCustom}
          disabled={!customMg}
          activeOpacity={0.7}
        >
          <Text style={styles.logBtnText}>Log</Text>
        </TouchableOpacity>
      </View>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Today&apos;s Entries</Text>
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={styles.entryInfo}>
                  <Text style={styles.entrySource}>
                    {entry.source.charAt(0).toUpperCase() + entry.source.slice(1)}
                  </Text>
                  <Text style={styles.entryMg}>{entry.amount_mg} mg</Text>
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
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  summaryText: {
    flex: 1,
  },
  totalAmount: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  goalText: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 6,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  presetBtn: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    width: '30%',
    flexGrow: 1,
    minHeight: 80,
    justifyContent: 'center',
  },
  presetLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  presetMg: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  customInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  logBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    minHeight: 48,
  },
  logBtnDisabled: {
    opacity: 0.4,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '600',
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
  },
  entrySource: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  entryMg: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  entryTime: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
});
