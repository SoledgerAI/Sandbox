// Activity logger -- cardio activity type, duration, intensity, MET-based calorie burn
// Phase 11: Fitness and Workout Logging

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import { calculateCalorieBurnImperial, searchMetActivities } from '../../utils/calories';
import type { MetActivity } from '../../utils/calories';
import type { WorkoutEntry, IntensityLevel } from '../../types/workout';
import metCompendium from '../../data/met_compendium.json';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const INTENSITY_OPTIONS: { value: IntensityLevel; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'vigorous', label: 'Vigorous' },
];

interface ActivityLoggerProps {
  onEntryLogged?: () => void;
}

export function ActivityLogger({ onEntryLogged }: ActivityLoggerProps) {
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');

  // Form state
  const [selectedActivity, setSelectedActivity] = useState<MetActivity | null>(null);
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState<IntensityLevel>('moderate');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [weightLbs, setWeightLbs] = useState<number>(170);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, today);
    const stored = await storageGet<WorkoutEntry[]>(key);
    setEntries(stored ?? []);

    // Load weight from profile for calorie calc
    const profile = await storageGet<{ weight_lbs: number | null }>(STORAGE_KEYS.PROFILE);
    if (profile?.weight_lbs) setWeightLbs(profile.weight_lbs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allActivities = useMemo(
    () => metCompendium.activities as MetActivity[],
    [],
  );

  const filteredActivities = useMemo(() => {
    if (!activitySearch.trim()) return allActivities;
    return searchMetActivities(activitySearch);
  }, [activitySearch, allActivities]);

  const calorieEstimate = useMemo(() => {
    if (!selectedActivity || !duration) return 0;
    const mins = parseFloat(duration);
    if (isNaN(mins) || mins <= 0) return 0;
    return Math.round(calculateCalorieBurnImperial(selectedActivity.met, weightLbs, mins));
  }, [selectedActivity, duration, weightLbs]);

  const logWorkout = useCallback(async () => {
    if (!selectedActivity || !duration) {
      Alert.alert('Missing Info', 'Please select an activity and enter duration.');
      return;
    }

    const mins = parseFloat(duration);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid duration in minutes.');
      return;
    }

    const entry: WorkoutEntry = {
      id: `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      activity_name: selectedActivity.description,
      compendium_code: selectedActivity.code,
      met_value: selectedActivity.met,
      duration_minutes: mins,
      intensity,
      calories_burned: calorieEstimate,
      distance: distance ? parseFloat(distance) : null,
      distance_unit: distance ? 'miles' : null,
      environmental: {
        elevation_gain_ft: null,
        elevation_loss_ft: null,
        altitude_ft: null,
        temperature_f: null,
      },
      biometric: {
        avg_heart_rate_bpm: null,
        max_heart_rate_bpm: null,
        heart_rate_zones: null,
      },
      notes: notes.trim() || null,
      source: 'manual',
    };

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, today);
    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);

    // Reset form
    setSelectedActivity(null);
    setDuration('');
    setIntensity('moderate');
    setDistance('');
    setNotes('');
    onEntryLogged?.();
  }, [selectedActivity, duration, intensity, distance, notes, calorieEstimate, entries, onEntryLogged]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  // Activity picker modal
  if (showActivityPicker) {
    return (
      <View style={styles.container}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Select Activity</Text>
          <TouchableOpacity onPress={() => setShowActivityPicker(false)}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={Colors.secondaryText} />
          <TextInput
            style={styles.searchInput}
            value={activitySearch}
            onChangeText={setActivitySearch}
            placeholder="Search activities..."
            placeholderTextColor={Colors.secondaryText}
            autoFocus
          />
        </View>
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.activityRow}
              onPress={() => {
                setSelectedActivity(item);
                setShowActivityPicker(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.activityInfo}>
                <Text style={styles.activityName}>{item.description}</Text>
                <Text style={styles.activityMet}>MET: {item.met}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    );
  }

  const totalCalories = entries.reduce((sum, e) => sum + e.calories_burned, 0);
  const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Today's summary */}
      {entries.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{entries.length}</Text>
            <Text style={styles.summaryLabel}>
              workout{entries.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{Math.round(totalMinutes)}</Text>
            <Text style={styles.summaryLabel}>minutes</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{Math.round(totalCalories)}</Text>
            <Text style={styles.summaryLabel}>kcal</Text>
          </View>
        </View>
      )}

      {/* Logged entries */}
      {entries.map((entry) => (
        <View key={entry.id} style={styles.entryCard}>
          <View style={styles.entryHeader}>
            <Ionicons name="flame" size={18} color={Colors.accent} />
            <Text style={styles.entryName} numberOfLines={1}>
              {entry.activity_name}
            </Text>
            <TouchableOpacity onPress={() => deleteEntry(entry.id)}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            </TouchableOpacity>
          </View>
          <View style={styles.entryDetails}>
            <Text style={styles.entryDetail}>{entry.duration_minutes} min</Text>
            <Text style={styles.entryDot}>{'\u00B7'}</Text>
            <Text style={styles.entryDetail}>{Math.round(entry.calories_burned)} kcal</Text>
            <Text style={styles.entryDot}>{'\u00B7'}</Text>
            <Text style={styles.entryDetail}>{entry.intensity}</Text>
          </View>
        </View>
      ))}

      {/* New entry form */}
      <Text style={styles.sectionTitle}>Log Activity</Text>

      {/* Activity selector */}
      <TouchableOpacity
        style={styles.activitySelector}
        onPress={() => setShowActivityPicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="fitness-outline" size={20} color={Colors.accent} />
        <Text style={styles.activitySelectorText}>
          {selectedActivity ? selectedActivity.description : 'Select activity...'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.secondaryText} />
      </TouchableOpacity>

      {selectedActivity && (
        <Text style={styles.metInfo}>
          MET: {selectedActivity.met} {'\u00B7'} Code: {selectedActivity.code}
        </Text>
      )}

      {/* Duration */}
      <Text style={styles.fieldLabel}>Duration (minutes)</Text>
      <TextInput
        style={styles.input}
        value={duration}
        onChangeText={setDuration}
        placeholder="0"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="decimal-pad"
      />

      {/* Intensity */}
      <Text style={styles.fieldLabel}>Intensity</Text>
      <View style={styles.intensityRow}>
        {INTENSITY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.intensityBtn,
              intensity === opt.value && styles.intensityBtnActive,
            ]}
            onPress={() => setIntensity(opt.value)}
          >
            <Text
              style={[
                styles.intensityText,
                intensity === opt.value && styles.intensityTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Distance (optional) */}
      <Text style={styles.fieldLabel}>Distance (optional)</Text>
      <TextInput
        style={styles.input}
        value={distance}
        onChangeText={setDistance}
        placeholder="miles"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="decimal-pad"
      />

      {/* Calorie estimate */}
      {calorieEstimate > 0 && (
        <View style={styles.calorieCard}>
          <Ionicons name="flame" size={20} color={Colors.accent} />
          <Text style={styles.calorieText}>
            Estimated burn: {calorieEstimate} kcal
          </Text>
        </View>
      )}

      {/* Notes */}
      <Text style={styles.fieldLabel}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="How was the workout?"
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={2}
      />

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, (!selectedActivity || !duration) && styles.logBtnDisabled]}
        onPress={logWorkout}
        disabled={!selectedActivity || !duration}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Activity</Text>
      </TouchableOpacity>
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
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: Colors.accent,
    fontSize: 22,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.divider,
  },
  entryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  entryName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  entryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26,
    gap: 6,
  },
  entryDetail: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  entryDot: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  activitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 8,
  },
  activitySelectorText: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  metInfo: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 12,
    paddingLeft: 4,
  },
  fieldLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 8,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  intensityBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  intensityBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  intensityText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  intensityTextActive: {
    color: Colors.primaryBackground,
  },
  calorieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginVertical: 8,
  },
  calorieText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '600',
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
  },
  logBtnDisabled: {
    opacity: 0.4,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 17,
    fontWeight: '700',
  },
  // Activity picker styles
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pickerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  activityMet: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
});
