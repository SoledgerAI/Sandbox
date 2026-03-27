// Water logging component -- quick-add buttons, daily total, goal progress
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
import type { WaterEntry } from '../../types';

const QUICK_ADD_OPTIONS = [
  { label: '8 oz', amount: 8 },
  { label: '16 oz', amount: 16 },
  { label: '24 oz', amount: 24 },
];

// Default goal: will be overridden by profile weight / 2 if available
const DEFAULT_WATER_GOAL_OZ = 64;

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface WaterLoggerProps {
  onEntryLogged?: () => void;
}

export function WaterLogger({ onEntryLogged }: WaterLoggerProps) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [waterGoal, setWaterGoal] = useState(DEFAULT_WATER_GOAL_OZ);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_WATER, today);
    const stored = await storageGet<WaterEntry[]>(key);
    setEntries(stored ?? []);

    // Load profile for water goal (bodyweight / 2)
    const profile = await storageGet<{ weight_lbs?: number }>(STORAGE_KEYS.PROFILE);
    if (profile?.weight_lbs) {
      setWaterGoal(Math.round(profile.weight_lbs / 2));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalOz = entries.reduce((sum, e) => sum + e.amount_oz, 0);
  const progressPct = Math.min(totalOz / waterGoal, 1);

  const logWater = useCallback(
    async (amount: number) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_WATER, today);

      const entry: WaterEntry = {
        id: `water_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        amount_oz: amount,
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
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid number of ounces.');
      return;
    }
    logWater(amount);
    setCustomAmount('');
  }, [customAmount, logWater]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_WATER, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Daily total and goal */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="water" size={28} color={Colors.accent} />
          <View style={styles.summaryText}>
            <Text style={styles.totalAmount}>{totalOz} oz</Text>
            <Text style={styles.goalText}>of {waterGoal} oz goal</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPct * 100}%`,
                backgroundColor:
                  progressPct >= 0.8
                    ? Colors.success
                    : progressPct >= 0.5
                      ? Colors.warning
                      : Colors.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {Math.round(progressPct * 100)}% of daily goal
        </Text>
      </View>

      {/* Quick-add buttons */}
      <Text style={styles.sectionTitle}>Quick Add</Text>
      <View style={styles.quickAddRow}>
        {QUICK_ADD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.amount}
            style={styles.quickAddBtn}
            onPress={() => logWater(opt.amount)}
            activeOpacity={0.7}
          >
            <Ionicons name="water-outline" size={20} color={Colors.primaryBackground} />
            <Text style={styles.quickAddText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom amount */}
      <Text style={styles.sectionTitle}>Custom Amount</Text>
      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          value={customAmount}
          onChangeText={setCustomAmount}
          placeholder="oz"
          placeholderTextColor={Colors.secondaryText}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={logCustom}
        />
        <TouchableOpacity
          style={[styles.customBtn, !customAmount && styles.customBtnDisabled]}
          onPress={logCustom}
          disabled={!customAmount}
          activeOpacity={0.7}
        >
          <Text style={styles.customBtnText}>Log</Text>
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
                  <Text style={styles.entryAmount}>{entry.amount_oz} oz</Text>
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
    textAlign: 'right',
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  quickAddText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '700',
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  customBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 24,
    justifyContent: 'center',
    minHeight: 48,
  },
  customBtnDisabled: {
    opacity: 0.4,
  },
  customBtnText: {
    color: Colors.primaryBackground,
    fontSize: 16,
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
  entryAmount: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  entryTime: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
});
