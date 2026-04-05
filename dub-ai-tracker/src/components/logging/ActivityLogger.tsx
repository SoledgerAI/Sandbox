// Activity logger -- 25-item curated activity list, category groups, recent section
// Prompt 08: MET Library Trim

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  SectionList,
  Platform,
} from 'react-native';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import { calculateCalorieBurnImperial } from '../../utils/calories';
import { shareWorkoutSummary } from '../sharing/WorkoutSummaryCard';
import { ACTIVITIES, getActivitiesByCategory } from '../../data/activities';
import type { Activity } from '../../data/activities';
import type { WorkoutEntry, IntensityLevel } from '../../types/workout';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { todayDateString } from '../../utils/dayBoundary';

const RECENT_ACTIVITIES_KEY = STORAGE_KEYS.RECENT_ACTIVITIES;
const MAX_RECENT = 5;


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
  const [recentActivityIds, setRecentActivityIds] = useState<string[]>([]);

  // Form state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [intensity, setIntensity] = useState<IntensityLevel>('moderate');
  const [rpe, setRpe] = useState<number | null>(null);
  const [packWeightLbs, setPackWeightLbs] = useState<string>('');
  const [pushCount, setPushCount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [weightLbs, setWeightLbs] = useState<number>(170);

  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<WorkoutEntry>('fitness.workout');

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    const found = ACTIVITIES.find((a) => a.name === lastEntry.activity_name);
    if (found) setSelectedActivity(found);
    setDurationMinutes(lastEntry.duration_minutes);
    setIntensity(lastEntry.intensity);
    setRpe(lastEntry.rpe ?? null);
  }, [lastEntry]);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, today);
    const stored = await storageGet<WorkoutEntry[]>(key);
    setEntries(stored ?? []);

    // Load weight from profile for calorie calc
    const profile = await storageGet<{ weight_lbs: number | null }>(STORAGE_KEYS.PROFILE);
    if (profile?.weight_lbs) setWeightLbs(profile.weight_lbs);

    // Load recent activities
    const recent = await storageGet<string[]>(RECENT_ACTIVITIES_KEY);
    setRecentActivityIds(recent ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calorieEstimate = useMemo(() => {
    if (!selectedActivity || durationMinutes <= 0) return 0;
    let met = selectedActivity.met;
    // Load-adjusted MET approximation based on Pandolf et al., 1977
    // Simplified: MET * (1 + 0.01 * load_lbs) provides reasonable estimate
    const packLbs = parseFloat(packWeightLbs);
    if (selectedActivity.hasLoadFactor && !isNaN(packLbs) && packLbs > 0) {
      met = met * (1 + 0.01 * packLbs);
    }
    return Math.round(calculateCalorieBurnImperial(met, weightLbs, durationMinutes));
  }, [selectedActivity, durationMinutes, weightLbs, packWeightLbs]);

  // Build section list data for activity picker
  const sectionData = useMemo(() => {
    const sections: { title: string; data: Activity[] }[] = [];

    // Recent section (only if there are recent activities)
    if (recentActivityIds.length > 0) {
      const recentActivities = recentActivityIds
        .map((id) => ACTIVITIES.find((a) => a.id === id))
        .filter((a): a is Activity => a !== undefined);
      if (recentActivities.length > 0) {
        sections.push({ title: 'Recent', data: recentActivities });
      }
    }

    // Category sections
    const grouped = getActivitiesByCategory();
    for (const group of grouped) {
      if (group.activities.length > 0) {
        sections.push({ title: group.label, data: group.activities });
      }
    }

    return sections;
  }, [recentActivityIds]);

  const updateRecentActivities = useCallback(
    async (activityId: string) => {
      const filtered = recentActivityIds.filter((id) => id !== activityId);
      const updated = [activityId, ...filtered].slice(0, MAX_RECENT);
      setRecentActivityIds(updated);
      await storageSet(RECENT_ACTIVITIES_KEY, updated);
    },
    [recentActivityIds],
  );

  const logWorkout = useCallback(async () => {
    if (!selectedActivity) {
      Alert.alert('Missing Info', 'Please select an activity.');
      return;
    }
    if (durationMinutes <= 0) {
      Alert.alert('Invalid Duration', 'Please set a duration.');
      return;
    }

    const packLbs = parseFloat(packWeightLbs);
    const pushCt = parseInt(pushCount, 10);

    const entry: WorkoutEntry = {
      id: `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      activity_name: selectedActivity.name,
      compendium_code: selectedActivity.id,
      met_value: selectedActivity.met,
      duration_minutes: durationMinutes,
      intensity,
      calories_burned: calorieEstimate,
      distance: null,
      distance_unit: null,
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
      rpe,
      pack_weight_lbs: !isNaN(packLbs) && packLbs > 0 ? packLbs : null,
      push_count: !isNaN(pushCt) && pushCt > 0 ? pushCt : null,
      notes: notes.trim() || null,
      source: 'manual',
    };

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, today);
    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);

    // Update recent activities
    await updateRecentActivities(selectedActivity.id);

    // Save as last entry for repeat-last
    await saveAsLast(entry);

    // Reset form
    setSelectedActivity(null);
    setDurationMinutes(30);
    setIntensity('moderate');
    setRpe(null);
    setPackWeightLbs('');
    setPushCount('');
    setNotes('');
    onEntryLogged?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rpe is intentionally excluded; it resets on save
  }, [selectedActivity, durationMinutes, intensity, notes, calorieEstimate, entries, onEntryLogged, updateRecentActivities, saveAsLast]);

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

  // Duration picker helper: convert minutes to a Date for countdown timer
  const durationAsDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    d.setHours(hours, mins, 0, 0);
    return d;
  }, [durationMinutes]);

  const onDurationChange = useCallback((_event: unknown, date?: Date) => {
    if (date) {
      const totalMins = date.getHours() * 60 + date.getMinutes();
      setDurationMinutes(totalMins > 0 ? totalMins : 1);
    }
  }, []);

  // Activity picker view
  if (showActivityPicker) {
    return (
      <View style={styles.container}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Select Activity</Text>
          <TouchableOpacity onPress={() => setShowActivityPicker(false)}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <SectionList
          sections={sectionData}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
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
                <Text style={styles.activityName}>{item.name}</Text>
                <Text style={styles.activityMet}>MET: {item.met}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
        />
      </View>
    );
  }

  const totalCalories = entries.reduce((sum, e) => sum + e.calories_burned, 0);
  const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <RepeatLastEntry
        tagLabel="workout"
        subtitle={lastEntry ? `${lastEntry.activity_name} - ${lastEntry.duration_minutes}min` : undefined}
        visible={!lastEntryLoading && lastEntry !== null}
        onRepeat={handleRepeatLast}
      />

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
            <TouchableOpacity
              onPress={() => shareWorkoutSummary({ entry })}
              style={styles.shareEntryBtn}
            >
              <Ionicons name="share-outline" size={16} color={Colors.accentText} />
            </TouchableOpacity>
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
            {entry.rpe != null && (
              <>
                <Text style={styles.entryDot}>{'\u00B7'}</Text>
                <Text style={styles.entryDetail}>RPE {entry.rpe}</Text>
              </>
            )}
            {entry.pack_weight_lbs != null && entry.pack_weight_lbs > 0 && (
              <>
                <Text style={styles.entryDot}>{'\u00B7'}</Text>
                <Text style={styles.entryDetail}>{entry.pack_weight_lbs} lbs pack</Text>
              </>
            )}
            {entry.push_count != null && entry.push_count > 0 && (
              <>
                <Text style={styles.entryDot}>{'\u00B7'}</Text>
                <Text style={styles.entryDetail}>{entry.push_count.toLocaleString()} pushes</Text>
              </>
            )}
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
          {selectedActivity ? selectedActivity.name : 'Select activity...'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.secondaryText} />
      </TouchableOpacity>

      {selectedActivity && (
        <Text style={styles.metInfo}>
          MET: {selectedActivity.met}
        </Text>
      )}

      {/* Duration — scroll wheel picker */}
      <Text style={styles.fieldLabel}>Duration</Text>
      <View style={styles.durationPickerContainer}>
        <RNDateTimePicker
          value={durationAsDate}
          mode="countdown"
          onChange={onDurationChange}
          minuteInterval={5}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          textColor={Colors.text}
        />
      </View>
      <Text style={styles.durationHint}>
        {durationMinutes} min
      </Text>

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

      {/* P1-19: RPE selector (optional) */}
      <Text style={styles.fieldLabel}>RPE (optional)</Text>
      <View style={styles.rpeRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
          <TouchableOpacity
            key={val}
            style={[styles.rpeBtn, rpe === val && styles.rpeBtnActive]}
            onPress={() => setRpe(rpe === val ? null : val)}
            activeOpacity={0.7}
          >
            <Text style={[styles.rpeText, rpe === val && styles.rpeTextActive]}>
              {val}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pack Weight (for rucking and load-bearing activities) */}
      {selectedActivity?.hasLoadFactor && (
        <>
          <Text style={styles.fieldLabel}>Pack Weight (lbs)</Text>
          <TextInput
            style={styles.packWeightInput}
            value={packWeightLbs}
            onChangeText={setPackWeightLbs}
            placeholder="lbs"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="numeric"
          />
        </>
      )}

      {/* Push Count (for wheelchair activities) */}
      {selectedActivity?.supportsRepCount && (
        <>
          <Text style={styles.fieldLabel}>Push Count</Text>
          <TextInput
            style={styles.packWeightInput}
            value={pushCount}
            onChangeText={setPushCount}
            placeholder="total pushes"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="numeric"
          />
        </>
      )}

      {/* Calorie estimate */}
      {calorieEstimate > 0 && (
        <View style={styles.calorieCard}>
          <Ionicons name="flame" size={20} color={Colors.accent} />
          <Text style={styles.calorieText}>
            Estimated burn: {calorieEstimate} kcal
          </Text>
        </View>
      )}

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, !selectedActivity && styles.logBtnDisabled]}
        onPress={logWorkout}
        disabled={!selectedActivity}
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
  shareEntryBtn: {
    padding: 4,
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
  durationPickerContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  durationHint: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
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
  rpeRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  rpeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  rpeBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  rpeText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  rpeTextActive: {
    color: Colors.primaryBackground,
  },
  packWeightInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 12,
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
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
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
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionHeaderText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
