// Sexual activity logging screen -- duration, intensity, MET-based calorie burn
// Phase 13: Supplements, Personal Care, and Remaining Tags

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../src/utils/storage';
import type { SexualEntry } from '../../src/types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// MET values from 2024 Compendium, Heading 14
const INTENSITY_OPTIONS: {
  value: SexualEntry['intensity'];
  label: string;
  code: string;
  met: number;
  description: string;
}[] = [
  { value: 'light', label: 'Light', code: '14030', met: 1.8, description: 'Passive, light effort' },
  { value: 'moderate', label: 'Moderate', code: '14020', met: 3.0, description: 'General, moderate effort' },
  { value: 'vigorous', label: 'Vigorous', code: '14010', met: 5.8, description: 'Active, vigorous effort' },
];

export default function SexualScreen() {
  const [entries, setEntries] = useState<SexualEntry[]>([]);
  const [duration, setDuration] = useState('15');
  const [intensity, setIntensity] = useState<SexualEntry['intensity']>('moderate');

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SEXUAL, today);
    const stored = await storageGet<SexualEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedOption = INTENSITY_OPTIONS.find((o) => o.value === intensity)!;
  const durationMin = parseFloat(duration) || 0;

  // Calories = MET x weight_kg x duration_hours
  // Using approximate 70kg default; actual weight would come from profile
  const weightKg = 70;
  const caloriesBurned = Math.round(selectedOption.met * weightKg * (durationMin / 60));

  const logEntry = useCallback(async () => {
    if (durationMin <= 0) return;

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_SEXUAL, today);

    const entry: SexualEntry = {
      id: `sexual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      duration_minutes: durationMin,
      intensity,
      compendium_code: selectedOption.code,
      met_value: selectedOption.met,
      calories_burned: caloriesBurned,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setDuration('15');
  }, [entries, durationMin, intensity, selectedOption, caloriesBurned]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_SEXUAL, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Sexual Activity</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Calorie estimate card */}
        <View style={styles.calorieCard}>
          <Text style={styles.calorieValue}>{caloriesBurned}</Text>
          <Text style={styles.calorieLabel}>estimated calories</Text>
          <Text style={styles.metLabel}>MET {selectedOption.met}</Text>
        </View>

        {/* Duration */}
        <Text style={styles.sectionTitle}>Duration (minutes)</Text>
        <TextInput
          style={styles.durationInput}
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric"
          placeholder="15"
          placeholderTextColor={Colors.secondaryText}
        />

        {/* Intensity selector */}
        <Text style={styles.sectionTitle}>Intensity</Text>
        {INTENSITY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.intensityRow,
              intensity === opt.value && styles.intensityRowActive,
            ]}
            onPress={() => setIntensity(opt.value)}
            activeOpacity={0.7}
          >
            <View style={styles.intensityInfo}>
              <Text
                style={[
                  styles.intensityLabel,
                  intensity === opt.value && styles.intensityLabelActive,
                ]}
              >
                {opt.label}
              </Text>
              <Text style={styles.intensityDesc}>{opt.description}</Text>
            </View>
            <Text style={styles.intensityMet}>MET {opt.met}</Text>
            {intensity === opt.value && (
              <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
            )}
          </TouchableOpacity>
        ))}

        {/* Log button */}
        <TouchableOpacity style={styles.logBtn} onPress={logEntry} activeOpacity={0.7}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
          <Text style={styles.logBtnText}>Log Activity</Text>
        </TouchableOpacity>

        {/* Today's entries */}
        {entries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Today's Entries</Text>
            {entries
              .slice()
              .reverse()
              .map((entry) => (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryDuration}>
                      {entry.duration_minutes} min -- {entry.intensity}
                    </Text>
                    <Text style={styles.entryCal}>{entry.calories_burned} kcal</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 32 },
  calorieCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  calorieValue: {
    color: Colors.accent,
    fontSize: 36,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  calorieLabel: { color: Colors.secondaryText, fontSize: 13, marginTop: 4 },
  metLabel: { color: Colors.secondaryText, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10, marginTop: 8 },
  durationInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 18,
    borderWidth: 1,
    borderColor: Colors.divider,
    textAlign: 'center',
    marginBottom: 16,
  },
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  intensityRowActive: { borderColor: Colors.accent },
  intensityInfo: { flex: 1 },
  intensityLabel: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  intensityLabelActive: { color: Colors.accent },
  intensityDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  intensityMet: { color: Colors.secondaryText, fontSize: 13, marginRight: 8 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 12,
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
  entryInfo: { flex: 1 },
  entryDuration: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  entryCal: { color: Colors.accent, fontSize: 13, marginTop: 2 },
  entryTime: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
});
