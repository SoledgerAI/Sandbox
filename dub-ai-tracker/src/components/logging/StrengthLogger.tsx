// Strength training logger -- quick-log (4 fields) and detailed (12 fields) per exercise
// Wave 2 P1: Workout Quick-Log + Same As Last Time

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import type {
  StrengthEntry,
  StrengthExercise,
  StrengthSet,
  StrengthLogMode,
} from '../../types/strength';
import { todayDateString } from '../../utils/dayBoundary';

// -- Common exercises for quick selection --

const COMMON_EXERCISES = [
  'Bench Press', 'Squat', 'Deadlift', 'Overhead Press',
  'Barbell Row', 'Pull-ups', 'Lat Pulldown', 'Leg Press',
  'Romanian Deadlift', 'Incline Bench', 'Dumbbell Curl',
  'Tricep Pushdown', 'Lateral Raise', 'Cable Fly',
  'Leg Curl', 'Leg Extension', 'Calf Raise', 'Face Pull',
];

const MODE_PREF_KEY = STORAGE_KEYS.STRENGTH_MODE_PREF;
const TAG_ID = 'strength.training';


function generateId(): string {
  return `str_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Quick-log maps rep range string (e.g. "8-12") to midpoint
function repRangeMidpoint(range: string): number {
  const parts = range.split('-').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return Math.round((parts[0] + parts[1]) / 2);
  }
  const single = parseInt(range, 10);
  return isNaN(single) ? 10 : single;
}

// Build detailed sets from quick-log fields
function quickToDetailedSets(
  setCount: number,
  weightLbs: number,
  repRange: string,
): StrengthSet[] {
  const reps = repRangeMidpoint(repRange);
  return Array.from({ length: setCount }, (_, i) => ({
    set_number: i + 1,
    weight_lbs: weightLbs,
    reps,
    rpe: null,
  }));
}

// -- Quick-log exercise form state --

interface QuickExerciseForm {
  name: string;
  sets: string;       // count as string for input
  weight: string;     // lbs as string
  repRange: string;   // e.g. "8-12"
}

const emptyQuickForm: QuickExerciseForm = {
  name: '',
  sets: '4',
  weight: '',
  repRange: '8-12',
};

// -- Detailed exercise form state --

interface DetailedSetForm {
  weight: string;
  reps: string;
  rpe: string;
}

interface DetailedExerciseForm {
  name: string;
  sets: DetailedSetForm[];
}

function emptyDetailedForm(numSets: number = 4): DetailedExerciseForm {
  return {
    name: '',
    sets: Array.from({ length: numSets }, () => ({
      weight: '',
      reps: '',
      rpe: '',
    })),
  };
}

export function StrengthLogger() {
  const [mode, setMode] = useState<StrengthLogMode>('quick');
  const [entries, setEntries] = useState<StrengthEntry[]>([]);
  const [exercises, setExercises] = useState<StrengthExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  // Quick-log form
  const [quickForm, setQuickForm] = useState<QuickExerciseForm>(emptyQuickForm);

  // Detailed form
  const [detailedForm, setDetailedForm] = useState<DetailedExerciseForm>(emptyDetailedForm());

  // Last entry for repeat and same-as-last-time
  const { lastEntry, saveAsLast } = useLastEntry<StrengthEntry>(TAG_ID);

  // Load mode preference and today's data
  useEffect(() => {
    (async () => {
      const [pref, today] = await Promise.all([
        storageGet<StrengthLogMode>(MODE_PREF_KEY),
        storageGet<StrengthEntry[]>(dateKey(STORAGE_KEYS.LOG_STRENGTH, todayDateString())),
      ]);
      if (pref) setMode(pref);
      setEntries(today ?? []);
    })();
  }, []);

  // Persist mode preference
  const toggleMode = useCallback(async (newMode: StrengthLogMode) => {
    setMode(newMode);
    await storageSet(MODE_PREF_KEY, newMode);
  }, []);

  // -- "Same as last time" for a specific exercise --

  const prefillFromLast = useCallback(
    (exerciseName: string) => {
      if (!lastEntry) return;
      const match = lastEntry.exercises.find(
        (e) => e.name.toLowerCase() === exerciseName.toLowerCase(),
      );
      if (!match || match.sets.length === 0) {
        Alert.alert('No History', `No previous data found for ${exerciseName}.`);
        return;
      }

      if (mode === 'quick') {
        const firstSet = match.sets[0];
        const allSameWeight = match.sets.every((s) => s.weight_lbs === firstSet.weight_lbs);
        const minReps = Math.min(...match.sets.map((s) => s.reps));
        const maxReps = Math.max(...match.sets.map((s) => s.reps));
        setQuickForm({
          name: match.name,
          sets: String(match.sets.length),
          weight: String(allSameWeight ? firstSet.weight_lbs : firstSet.weight_lbs),
          repRange: minReps === maxReps ? String(minReps) : `${minReps}-${maxReps}`,
        });
      } else {
        setDetailedForm({
          name: match.name,
          sets: match.sets.map((s) => ({
            weight: String(s.weight_lbs),
            reps: String(s.reps),
            rpe: s.rpe != null ? String(s.rpe) : '',
          })),
        });
      }
    },
    [lastEntry, mode],
  );

  // -- Add exercise to session --

  const addExerciseFromQuick = useCallback(() => {
    const name = quickForm.name.trim();
    if (!name) {
      Alert.alert('Missing Info', 'Please enter an exercise name.');
      return;
    }
    const setCount = parseInt(quickForm.sets, 10) || 4;
    const weight = parseFloat(quickForm.weight) || 0;

    const exercise: StrengthExercise = {
      id: generateId(),
      name,
      sets: quickToDetailedSets(setCount, weight, quickForm.repRange),
    };

    setExercises((prev) => [...prev, exercise]);
    setQuickForm(emptyQuickForm);
  }, [quickForm]);

  const addExerciseFromDetailed = useCallback(() => {
    const name = detailedForm.name.trim();
    if (!name) {
      Alert.alert('Missing Info', 'Please enter an exercise name.');
      return;
    }

    const sets: StrengthSet[] = detailedForm.sets
      .map((s, i) => ({
        set_number: i + 1,
        weight_lbs: parseFloat(s.weight) || 0,
        reps: parseInt(s.reps, 10) || 0,
        rpe: s.rpe ? parseFloat(s.rpe) : null,
      }))
      .filter((s) => s.reps > 0);

    if (sets.length === 0) {
      Alert.alert('Missing Info', 'Enter at least one set with reps.');
      return;
    }

    const exercise: StrengthExercise = {
      id: generateId(),
      name,
      sets,
    };

    setExercises((prev) => [...prev, exercise]);
    setDetailedForm(emptyDetailedForm());
  }, [detailedForm]);

  const removeExercise = useCallback((exerciseId: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  }, []);

  // -- Save full session --

  const saveSession = useCallback(async () => {
    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise before saving.');
      return;
    }

    const entry: StrengthEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      exercises,
      mode,
      duration_minutes: null,
      notes: null,
    };

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_STRENGTH, today);
    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setExercises([]);

    // Save as last entry for repeat-last
    await saveAsLast(entry);

    Alert.alert('Saved', `${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} logged.`);
  }, [exercises, entries, mode, saveAsLast]);

  // -- Repeat last full session --

  const repeatLastSession = useCallback(() => {
    if (!lastEntry) return;
    if (mode === 'quick') {
      // Load all exercises into the pending list
      setExercises(
        lastEntry.exercises.map((e) => ({
          ...e,
          id: generateId(),
        })),
      );
    } else {
      setExercises(
        lastEntry.exercises.map((e) => ({
          ...e,
          id: generateId(),
        })),
      );
    }
  }, [lastEntry, mode]);

  // -- Select exercise name --

  const selectExerciseName = useCallback(
    (name: string) => {
      if (mode === 'quick') {
        setQuickForm((prev) => ({ ...prev, name }));
      } else {
        setDetailedForm((prev) => ({ ...prev, name }));
      }
      setShowExercisePicker(false);

      // Auto-prefill from last entry if available
      if (lastEntry) {
        const match = lastEntry.exercises.find(
          (e) => e.name.toLowerCase() === name.toLowerCase(),
        );
        if (match) {
          Alert.alert(
            'Same as Last Time?',
            `Pre-fill ${name} from your last session?`,
            [
              { text: 'No', style: 'cancel' },
              { text: 'Yes', onPress: () => prefillFromLast(name) },
            ],
          );
        }
      }
    },
    [mode, lastEntry, prefillFromLast],
  );

  // Add/remove set in detailed mode
  const addDetailedSet = useCallback(() => {
    setDetailedForm((prev) => ({
      ...prev,
      sets: [...prev.sets, { weight: '', reps: '', rpe: '' }],
    }));
  }, []);

  const removeDetailedSet = useCallback((index: number) => {
    setDetailedForm((prev) => ({
      ...prev,
      sets: prev.sets.filter((_, i) => i !== index),
    }));
  }, []);

  const updateDetailedSet = useCallback(
    (index: number, field: keyof DetailedSetForm, value: string) => {
      setDetailedForm((prev) => ({
        ...prev,
        sets: prev.sets.map((s, i) =>
          i === index ? { ...s, [field]: value } : s,
        ),
      }));
    },
    [],
  );

  // Summary stats for current session
  const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const totalVolume = exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + set.weight_lbs * set.reps, 0),
    0,
  );

  // Logged sessions today
  const todayTotalExercises = entries.reduce((sum, e) => sum + e.exercises.length, 0);

  // Last entry summary for repeat banner
  const lastEntrySummary = useMemo(() => {
    if (!lastEntry) return undefined;
    const names = lastEntry.exercises.map((e) => e.name).slice(0, 3);
    const suffix = lastEntry.exercises.length > 3
      ? ` +${lastEntry.exercises.length - 3} more`
      : '';
    return names.join(', ') + suffix;
  }, [lastEntry]);

  const currentName = mode === 'quick' ? quickForm.name : detailedForm.name;

  // Exercise picker view
  if (showExercisePicker) {
    // Group exercises: from last session first, then common
    const lastSessionNames = lastEntry?.exercises.map((e) => e.name) ?? [];
    const commonFiltered = COMMON_EXERCISES.filter(
      (n) => !lastSessionNames.includes(n),
    );

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Select Exercise</Text>
          <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {lastSessionNames.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>From Last Session</Text>
            {lastSessionNames.map((name) => (
              <TouchableOpacity
                key={`last_${name}`}
                style={styles.exerciseRow}
                onPress={() => selectExerciseName(name)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={18} color={Colors.accent} />
                <Text style={styles.exerciseName}>{name}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.sectionLabel}>Common Exercises</Text>
        {commonFiltered.map((name) => (
          <TouchableOpacity
            key={name}
            style={styles.exerciseRow}
            onPress={() => selectExerciseName(name)}
            activeOpacity={0.7}
          >
            <Ionicons name="barbell-outline" size={18} color={Colors.secondaryText} />
            <Text style={styles.exerciseName}>{name}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Repeat last session banner */}
        <RepeatLastEntry
          tagLabel="strength session"
          subtitle={lastEntrySummary}
          visible={lastEntry != null && exercises.length === 0}
          onRepeat={repeatLastSession}
        />

        {/* Today's summary */}
        {entries.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{entries.length}</Text>
              <Text style={styles.summaryLabel}>session{entries.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{todayTotalExercises}</Text>
              <Text style={styles.summaryLabel}>exercises</Text>
            </View>
          </View>
        )}

        {/* Mode toggle: [Detailed] [Quick Log] */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'detailed' && styles.modeBtnActive]}
            onPress={() => toggleMode('detailed')}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={mode === 'detailed' ? Colors.primaryBackground : Colors.secondaryText}
            />
            <Text style={[styles.modeText, mode === 'detailed' && styles.modeTextActive]}>
              Detailed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'quick' && styles.modeBtnActive]}
            onPress={() => toggleMode('quick')}
          >
            <Ionicons
              name="flash-outline"
              size={16}
              color={mode === 'quick' ? Colors.primaryBackground : Colors.secondaryText}
            />
            <Text style={[styles.modeText, mode === 'quick' && styles.modeTextActive]}>
              Quick Log
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pending exercises in this session */}
        {exercises.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Current Session</Text>
            <View style={styles.sessionStatsRow}>
              <Text style={styles.sessionStat}>{exercises.length} exercises</Text>
              <Text style={styles.sessionStatDot}>{'\u00B7'}</Text>
              <Text style={styles.sessionStat}>{totalSets} sets</Text>
              <Text style={styles.sessionStatDot}>{'\u00B7'}</Text>
              <Text style={styles.sessionStat}>{Math.round(totalVolume).toLocaleString()} lbs volume</Text>
            </View>
            {exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseCardHeader}>
                  <Ionicons name="barbell-outline" size={18} color={Colors.accent} />
                  <Text style={styles.exerciseCardName}>{exercise.name}</Text>
                  <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.setsPreview}>
                  {exercise.sets.map((set) => (
                    <Text key={set.set_number} style={styles.setPreviewText}>
                      Set {set.set_number}: {set.weight_lbs} lbs x {set.reps}
                      {set.rpe != null ? ` @RPE ${set.rpe}` : ''}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Add Exercise Form */}
        <Text style={styles.sectionTitle}>Add Exercise</Text>

        {/* Exercise name selector */}
        <TouchableOpacity
          style={styles.exerciseSelector}
          onPress={() => setShowExercisePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="barbell-outline" size={20} color={Colors.accent} />
          <Text style={styles.exerciseSelectorText}>
            {currentName || 'Select exercise...'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.secondaryText} />
        </TouchableOpacity>

        {/* "Same as last time" per-exercise button */}
        {currentName.length > 0 && lastEntry?.exercises.some(
          (e) => e.name.toLowerCase() === currentName.toLowerCase(),
        ) && (
          <TouchableOpacity
            style={styles.sameAsLastBtn}
            onPress={() => prefillFromLast(currentName)}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={16} color={Colors.accent} />
            <Text style={styles.sameAsLastText}>Same as last time</Text>
          </TouchableOpacity>
        )}

        {mode === 'quick' ? (
          /* -- QUICK LOG MODE: 4 fields -- */
          <View style={styles.quickForm}>
            <View style={styles.quickRow}>
              <View style={styles.quickField}>
                <Text style={styles.fieldLabel}>Sets</Text>
                <TextInput
                  style={styles.input}
                  value={quickForm.sets}
                  onChangeText={(v) => setQuickForm((p) => ({ ...p, sets: v }))}
                  keyboardType="number-pad"
                  placeholder="4"
                  placeholderTextColor={Colors.secondaryText}
                />
              </View>
              <View style={styles.quickField}>
                <Text style={styles.fieldLabel}>Weight (lbs)</Text>
                <TextInput
                  style={styles.input}
                  value={quickForm.weight}
                  onChangeText={(v) => setQuickForm((p) => ({ ...p, weight: v }))}
                  keyboardType="numeric"
                  placeholder="135"
                  placeholderTextColor={Colors.secondaryText}
                />
              </View>
              <View style={styles.quickField}>
                <Text style={styles.fieldLabel}>Rep Range</Text>
                <TextInput
                  style={styles.input}
                  value={quickForm.repRange}
                  onChangeText={(v) => setQuickForm((p) => ({ ...p, repRange: v }))}
                  placeholder="8-12"
                  placeholderTextColor={Colors.secondaryText}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addExerciseBtn, !quickForm.name && styles.addExerciseBtnDisabled]}
              onPress={addExerciseFromQuick}
              disabled={!quickForm.name}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={20} color={Colors.primaryBackground} />
              <Text style={styles.addExerciseBtnText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* -- DETAILED MODE: per-set weight/reps/RPE -- */
          <View style={styles.detailedForm}>
            {detailedForm.sets.map((set, index) => (
              <View key={index} style={styles.detailedSetRow}>
                <Text style={styles.setLabel}>Set {index + 1}</Text>
                <View style={styles.detailedSetFields}>
                  <View style={styles.detailedField}>
                    <Text style={styles.fieldLabelSmall}>Weight</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={set.weight}
                      onChangeText={(v) => updateDetailedSet(index, 'weight', v)}
                      keyboardType="numeric"
                      placeholder="lbs"
                      placeholderTextColor={Colors.secondaryText}
                    />
                  </View>
                  <View style={styles.detailedField}>
                    <Text style={styles.fieldLabelSmall}>Reps</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={set.reps}
                      onChangeText={(v) => updateDetailedSet(index, 'reps', v)}
                      keyboardType="number-pad"
                      placeholder="#"
                      placeholderTextColor={Colors.secondaryText}
                    />
                  </View>
                  <View style={styles.detailedField}>
                    <Text style={styles.fieldLabelSmall}>RPE</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={set.rpe}
                      onChangeText={(v) => updateDetailedSet(index, 'rpe', v)}
                      keyboardType="numeric"
                      placeholder="1-10"
                      placeholderTextColor={Colors.secondaryText}
                    />
                  </View>
                  {detailedForm.sets.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeDetailedSet(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.removeSetBtn}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addSetBtn} onPress={addDetailedSet} activeOpacity={0.7}>
              <Ionicons name="add" size={16} color={Colors.accent} />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addExerciseBtn, !detailedForm.name && styles.addExerciseBtnDisabled]}
              onPress={addExerciseFromDetailed}
              disabled={!detailedForm.name}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={20} color={Colors.primaryBackground} />
              <Text style={styles.addExerciseBtnText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save Session */}
        {exercises.length > 0 && (
          <TouchableOpacity style={styles.saveBtn} onPress={saveSession} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.primaryBackground} />
            <Text style={styles.saveBtnText}>Save Session</Text>
          </TouchableOpacity>
        )}

        {/* Previously logged sessions today */}
        {entries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Logged Today</Text>
            {entries
              .slice()
              .reverse()
              .map((entry) => (
                <View key={entry.id} style={styles.loggedCard}>
                  <Text style={styles.loggedTime}>
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {' \u00B7 '}
                    {entry.mode === 'quick' ? 'Quick Log' : 'Detailed'}
                  </Text>
                  {entry.exercises.map((ex) => (
                    <Text key={ex.id} style={styles.loggedExercise}>
                      {ex.name}: {ex.sets.length} sets
                      {ex.sets.length > 0 && ` \u00B7 ${ex.sets[0].weight_lbs} lbs`}
                    </Text>
                  ))}
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

  // Summary
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryValue: {
    color: Colors.accent,
    fontSize: 22,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: { color: Colors.secondaryText, fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.divider },

  // Mode toggle
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  modeBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  modeText: { color: Colors.secondaryText, fontSize: 14, fontWeight: '600' },
  modeTextActive: { color: Colors.primaryBackground },

  // Section
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionLabel: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },

  // Session stats
  sessionStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sessionStat: { color: Colors.secondaryText, fontSize: 12 },
  sessionStatDot: { color: Colors.secondaryText, fontSize: 12 },

  // Exercise cards (pending)
  exerciseCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  exerciseCardName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  setsPreview: { paddingLeft: 26 },
  setPreviewText: { color: Colors.secondaryText, fontSize: 12, marginBottom: 2 },

  // Exercise selector
  exerciseSelector: {
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
  exerciseSelectorText: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },

  // Same as last time
  sameAsLastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  sameAsLastText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '500',
  },

  // Quick form
  quickForm: { marginTop: 4 },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickField: { flex: 1 },
  fieldLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
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

  // Detailed form
  detailedForm: { marginTop: 4 },
  detailedSetRow: {
    marginBottom: 10,
  },
  setLabel: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailedSetFields: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  detailedField: { flex: 1 },
  fieldLabelSmall: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginBottom: 2,
  },
  inputSmall: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  removeSetBtn: {
    paddingBottom: 6,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginBottom: 8,
  },
  addSetText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '500',
  },

  // Add exercise button
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  addExerciseBtnDisabled: { opacity: 0.4 },
  addExerciseBtnText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },

  // Save session
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 20,
  },
  saveBtnText: {
    color: Colors.primaryBackground,
    fontSize: 17,
    fontWeight: '700',
  },

  // Logged today
  loggedCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  loggedTime: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 4,
  },
  loggedExercise: {
    color: Colors.text,
    fontSize: 13,
    marginBottom: 2,
  },

  // Exercise picker
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
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  exerciseName: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
