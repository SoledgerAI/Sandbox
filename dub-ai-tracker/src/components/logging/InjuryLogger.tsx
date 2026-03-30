// Injury/pain logger -- body location, severity, type, aggravators, onset date
// Phase 13: Supplements, Personal Care, and Remaining Tags

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
import type { InjuryEntry } from '../../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const BODY_LOCATIONS = [
  'Head', 'Neck', 'Left Shoulder', 'Right Shoulder', 'Upper Back', 'Lower Back',
  'Left Elbow', 'Right Elbow', 'Left Wrist', 'Right Wrist', 'Left Hand', 'Right Hand',
  'Chest', 'Abdomen', 'Left Hip', 'Right Hip', 'Left Knee', 'Right Knee',
  'Left Ankle', 'Right Ankle', 'Left Foot', 'Right Foot',
  'Left Thigh', 'Right Thigh', 'Left Calf', 'Right Calf',
  'Left Shin', 'Right Shin', 'Left Bicep', 'Right Bicep',
  'Left Forearm', 'Right Forearm',
];

const INJURY_TYPES: ('acute' | 'chronic' | 'recurring')[] = ['acute', 'chronic', 'recurring'];

const COMMON_AGGRAVATORS = [
  'Running', 'Walking', 'Lifting', 'Sitting', 'Standing', 'Overhead Press',
  'Squatting', 'Bending', 'Twisting', 'Sleeping', 'Typing', 'Driving',
];

function severityColor(sev: number): string {
  if (sev <= 3) return Colors.success;
  if (sev <= 6) return Colors.warning;
  return Colors.danger;
}

export function InjuryLogger() {
  const [entries, setEntries] = useState<InjuryEntry[]>([]);
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState(5);
  const [injuryType, setInjuryType] = useState<'acute' | 'chronic' | 'recurring'>('acute');
  const [description, setDescription] = useState('');
  const [aggravators, setAggravators] = useState<string[]>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_INJURY, today);
    const stored = await storageGet<InjuryEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logInjury = useCallback(async () => {
    if (!location.trim()) {
      Alert.alert('Required', 'Please select a body location.');
      return;
    }

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_INJURY, today);

    const entry: InjuryEntry = {
      id: `injury_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      body_location: location,
      severity,
      type: injuryType,
      description: description.trim(),
      aggravators,
      onset_date: today,
      resolved_date: null,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setLocation('');
    setDescription('');
    setAggravators([]);
    setSeverity(5);
  }, [entries, location, severity, injuryType, description, aggravators]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_INJURY, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  const resolveEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_INJURY, today);
      const updated = entries.map((e) =>
        e.id === id ? { ...e, resolved_date: today } : e,
      );
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  const toggleAggravator = (agg: string) => {
    setAggravators((prev) =>
      prev.includes(agg) ? prev.filter((a) => a !== agg) : [...prev, agg],
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Body location */}
      <Text style={styles.sectionTitle}>Body Location</Text>
      <TouchableOpacity
        style={styles.locationPicker}
        onPress={() => setShowLocationPicker(!showLocationPicker)}
      >
        <Text style={location ? styles.locationText : styles.locationPlaceholder}>
          {location || 'Select location...'}
        </Text>
        <Ionicons
          name={showLocationPicker ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.secondaryText}
        />
      </TouchableOpacity>

      {showLocationPicker && (
        <View style={styles.locationGrid}>
          {BODY_LOCATIONS.map((loc) => (
            <TouchableOpacity
              key={loc}
              style={[styles.locationBtn, location === loc && styles.locationBtnActive]}
              onPress={() => {
                setLocation(loc);
                setShowLocationPicker(false);
              }}
            >
              <Text style={[styles.locationBtnText, location === loc && styles.locationBtnTextActive]}>
                {loc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Severity */}
      <Text style={styles.sectionTitle}>Severity</Text>
      <View style={styles.severityCard}>
        <Text style={[styles.severityValue, { color: severityColor(severity) }]}>{severity}</Text>
        <Text style={styles.severityLabel}>/ 10</Text>
      </View>
      <View style={styles.scaleRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <TouchableOpacity
            key={n}
            style={[
              styles.scaleBtn,
              severity === n && { backgroundColor: severityColor(n), borderColor: severityColor(n) },
            ]}
            onPress={() => setSeverity(n)}
          >
            <Text style={[styles.scaleNum, severity === n && styles.scaleNumActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabelText}>Mild</Text>
        <Text style={styles.scaleLabelText}>Severe</Text>
      </View>

      {/* Type */}
      <Text style={styles.sectionTitle}>Type</Text>
      <View style={styles.typeRow}>
        {INJURY_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, injuryType === t && styles.typeBtnActive]}
            onPress={() => setInjuryType(t)}
          >
            <Text style={[styles.typeText, injuryType === t && styles.typeTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Description */}
      <Text style={styles.sectionTitle}>Description</Text>
      <TextInput
        style={styles.descInput}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the injury or pain..."
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={3}
      />

      {/* Aggravators */}
      <Text style={styles.sectionTitle}>Aggravators</Text>
      <View style={styles.aggGrid}>
        {COMMON_AGGRAVATORS.map((agg) => {
          const selected = aggravators.includes(agg);
          return (
            <TouchableOpacity
              key={agg}
              style={[styles.aggBtn, selected && styles.aggBtnActive]}
              onPress={() => toggleAggravator(agg)}
            >
              <Text style={[styles.aggText, selected && styles.aggTextActive]}>{agg}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Log button */}
      <TouchableOpacity style={styles.logBtn} onPress={logInjury} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Injury</Text>
      </TouchableOpacity>

      {/* Active injuries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active Injuries</Text>
          {entries
            .filter((e) => !e.resolved_date)
            .map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={[styles.sevBadge, { backgroundColor: severityColor(entry.severity) }]}>
                  <Text style={styles.sevBadgeText}>{entry.severity}</Text>
                </View>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryLocation}>{entry.body_location}</Text>
                  <Text style={styles.entryType}>{entry.type}</Text>
                  {entry.description ? (
                    <Text style={styles.entryDesc} numberOfLines={2}>{entry.description}</Text>
                  ) : null}
                  {entry.aggravators.length > 0 && (
                    <Text style={styles.entryAgg}>
                      Aggravated by: {entry.aggravators.join(', ')}
                    </Text>
                  )}
                </View>
                <View style={styles.entryActions}>
                  <TouchableOpacity
                    onPress={() => resolveEntry(entry.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteEntry(entry.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
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
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  locationPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 8,
  },
  locationText: { color: Colors.text, fontSize: 15 },
  locationPlaceholder: { color: Colors.secondaryText, fontSize: 15 },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  locationBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  locationBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  locationBtnText: { color: Colors.secondaryText, fontSize: 12 },
  locationBtnTextActive: { color: Colors.primaryBackground, fontWeight: '600' },
  severityCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  severityValue: { fontSize: 40, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  severityLabel: { color: Colors.secondaryText, fontSize: 20, marginLeft: 4 },
  scaleRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  scaleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  scaleNum: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  scaleNumActive: { color: Colors.primaryBackground },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  scaleLabelText: { color: Colors.secondaryText, fontSize: 11 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  typeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typeText: { color: Colors.secondaryText, fontSize: 13, fontWeight: '600' },
  typeTextActive: { color: Colors.primaryBackground },
  descInput: {
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
  aggGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  aggBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  aggBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  aggText: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500' },
  aggTextActive: { color: Colors.primaryBackground },
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
    alignItems: 'flex-start',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  sevBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sevBadgeText: { color: Colors.primaryBackground, fontSize: 16, fontWeight: '700' },
  entryInfo: { flex: 1 },
  entryLocation: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  entryType: { color: Colors.secondaryText, fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  entryDesc: { color: Colors.secondaryText, fontSize: 13, marginTop: 2 },
  entryAgg: { color: Colors.secondaryText, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  entryActions: { gap: 8 },
});
