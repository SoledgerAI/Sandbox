// Strength training logger -- exercise search, set-by-set logging, volume, PRs
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
  Modal,
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
  StrengthSession,
  StrengthExercise,
  ExerciseSet,
  PersonalRecord,
} from '../../types/workout';
import { SetEntry } from './SetEntry';
import { RestTimer } from './RestTimer';
import { ExerciseSearch, type ExerciseItem } from './ExerciseSearch';
import {
  calculateVolume,
  calculateSessionVolume,
  estimate1RM,
  detectPR,
  loadPersonalRecords,
  savePersonalRecord,
} from '../../utils/strength';
import muscleGroupData from '../../data/muscle_groups.json';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface StrengthLoggerProps {
  onEntryLogged?: () => void;
}

export function StrengthLogger({ onEntryLogged }: StrengthLoggerProps) {
  const [session, setSession] = useState<StrengthSession | null>(null);
  const [exercises, setExercises] = useState<StrengthExercise[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [newPrs, setNewPrs] = useState<Map<string, PersonalRecord['type']>>(new Map());

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_STRENGTH, today);
    const stored = await storageGet<StrengthSession>(key);
    if (stored) {
      setSession(stored);
      setExercises(stored.exercises);
      setSessionName(stored.name ?? '');
    }
    const storedPrs = await loadPersonalRecords();
    setPrs(storedPrs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveSession = useCallback(
    async (updatedExercises: StrengthExercise[]) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_STRENGTH, today);
      const updated: StrengthSession = {
        id: session?.id ?? `strength_${Date.now()}`,
        timestamp: session?.timestamp ?? new Date().toISOString(),
        name: sessionName.trim() || null,
        exercises: updatedExercises,
        duration_minutes: null,
        calories_burned: null,
        notes: null,
        template_id: null,
      };
      await storageSet(key, updated);
      setSession(updated);
      setExercises(updatedExercises);
    },
    [session, sessionName],
  );

  const addExercise = useCallback(
    (exerciseItem: ExerciseItem) => {
      const newExercise: StrengthExercise = {
        exercise_id: exerciseItem.id,
        exercise_name: exerciseItem.name,
        muscle_groups: [...exerciseItem.primary, ...exerciseItem.secondary],
        equipment: exerciseItem.equipment,
        sets: [
          {
            set_number: 1,
            weight: 0,
            weight_unit: 'lbs',
            reps: 0,
            rpe: null,
            rest_seconds: null,
            notes: null,
            is_warmup: false,
            is_pr: false,
          },
        ],
        total_volume: 0,
      };
      const updated = [...exercises, newExercise];
      setShowExerciseSearch(false);
      saveSession(updated);
    },
    [exercises, saveSession],
  );

  const removeExercise = useCallback(
    (idx: number) => {
      Alert.alert('Remove Exercise', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = exercises.filter((_, i) => i !== idx);
            saveSession(updated);
          },
        },
      ]);
    },
    [exercises, saveSession],
  );

  const addSet = useCallback(
    (exerciseIdx: number) => {
      const ex = exercises[exerciseIdx];
      const workingSets = ex.sets.filter((s) => !s.is_warmup);
      const lastSet = workingSets[workingSets.length - 1] ?? ex.sets[ex.sets.length - 1];
      const newSet: ExerciseSet = {
        set_number: workingSets.length + 1,
        weight: lastSet?.weight ?? 0,
        weight_unit: lastSet?.weight_unit ?? 'lbs',
        reps: lastSet?.reps ?? 0,
        rpe: null,
        rest_seconds: null,
        notes: null,
        is_warmup: false,
        is_pr: false,
      };
      const updatedSets = [...ex.sets, newSet];
      const updatedExercises = exercises.map((e, i) =>
        i === exerciseIdx
          ? { ...e, sets: updatedSets, total_volume: calculateVolume(updatedSets) }
          : e,
      );
      saveSession(updatedExercises);
    },
    [exercises, saveSession],
  );

  const updateSet = useCallback(
    async (exerciseIdx: number, setIdx: number, updated: ExerciseSet) => {
      const ex = exercises[exerciseIdx];
      const updatedSets = ex.sets.map((s, i) => (i === setIdx ? updated : s));

      // PR detection
      if (!updated.is_warmup && updated.weight > 0 && updated.reps > 0) {
        const prResult = detectPR(updated, prs, ex.exercise_id);
        if (prResult) {
          const pr: PersonalRecord = {
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            type: prResult.type,
            value: prResult.value,
            weight: updated.weight,
            reps: updated.reps,
            date: todayDateString(),
          };
          const updatedPrs = await savePersonalRecord(pr, prs);
          setPrs(updatedPrs);
          updated.is_pr = true;
          updatedSets[setIdx] = updated;
          setNewPrs((prev) => new Map(prev).set(`${ex.exercise_id}_${setIdx}`, prResult.type));
        }
      }

      // Renumber working sets
      let workingNum = 1;
      for (const s of updatedSets) {
        if (!s.is_warmup) {
          s.set_number = workingNum++;
        }
      }

      const updatedExercises = exercises.map((e, i) =>
        i === exerciseIdx
          ? { ...e, sets: updatedSets, total_volume: calculateVolume(updatedSets) }
          : e,
      );
      saveSession(updatedExercises);
    },
    [exercises, prs, saveSession],
  );

  const deleteSet = useCallback(
    (exerciseIdx: number, setIdx: number) => {
      const ex = exercises[exerciseIdx];
      if (ex.sets.length <= 1) return;
      const updatedSets = ex.sets.filter((_, i) => i !== setIdx);

      // Renumber working sets
      let workingNum = 1;
      for (const s of updatedSets) {
        if (!s.is_warmup) {
          s.set_number = workingNum++;
        }
      }

      const updatedExercises = exercises.map((e, i) =>
        i === exerciseIdx
          ? { ...e, sets: updatedSets, total_volume: calculateVolume(updatedSets) }
          : e,
      );
      saveSession(updatedExercises);
    },
    [exercises, saveSession],
  );

  const clearSession = useCallback(async () => {
    Alert.alert('Clear Session', 'Delete all exercises for today?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const today = todayDateString();
          const key = dateKey(STORAGE_KEYS.LOG_STRENGTH, today);
          await storageSet(key, null);
          setSession(null);
          setExercises([]);
          setSessionName('');
          setNewPrs(new Map());
        },
      },
    ]);
  }, []);

  const getMuscleLabel = (id: string) =>
    muscleGroupData.muscle_groups.find((m) => m.id === id)?.name ?? id;

  const totalVolume = calculateSessionVolume(exercises);
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => !s.is_warmup).length, 0);

  // Exercise search modal
  if (showExerciseSearch) {
    return (
      <ExerciseSearch
        onSelect={addExercise}
        onClose={() => setShowExerciseSearch(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Session name */}
      <TextInput
        style={styles.sessionNameInput}
        value={sessionName}
        onChangeText={setSessionName}
        placeholder="Session name (e.g. Push Day)"
        placeholderTextColor={Colors.secondaryText}
        onBlur={() => {
          if (exercises.length > 0) saveSession(exercises);
        }}
      />

      {/* Session summary */}
      {exercises.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{exercises.length}</Text>
            <Text style={styles.summaryLabel}>exercises</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalSets}</Text>
            <Text style={styles.summaryLabel}>sets</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {totalVolume >= 1000
                ? `${(totalVolume / 1000).toFixed(1)}k`
                : totalVolume}
            </Text>
            <Text style={styles.summaryLabel}>volume (lbs)</Text>
          </View>
        </View>
      )}

      {/* Rest timer toggle */}
      <TouchableOpacity
        style={styles.timerToggle}
        onPress={() => setShowRestTimer(!showRestTimer)}
      >
        <Ionicons name="timer-outline" size={18} color={Colors.accent} />
        <Text style={styles.timerToggleText}>
          {showRestTimer ? 'Hide Rest Timer' : 'Show Rest Timer'}
        </Text>
      </TouchableOpacity>

      {showRestTimer && <RestTimer />}

      {/* Exercises */}
      {exercises.map((ex, exIdx) => {
        const est1rm =
          ex.sets
            .filter((s) => !s.is_warmup && s.weight > 0 && s.reps > 0 && s.reps <= 10)
            .map((s) => estimate1RM(s.weight, s.reps) ?? 0)
            .reduce((max, v) => Math.max(max, v), 0);

        return (
          <View key={`${ex.exercise_id}_${exIdx}`} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseTitle}>
                <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
                <Text style={styles.exerciseMeta}>
                  {ex.muscle_groups
                    .slice(0, 3)
                    .map(getMuscleLabel)
                    .join(', ')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeExercise(exIdx)}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            {/* Volume & 1RM */}
            <View style={styles.exerciseStats}>
              <Text style={styles.statText}>
                Vol: {ex.total_volume.toLocaleString()} lbs
              </Text>
              {est1rm > 0 && (
                <Text style={styles.statText}>
                  Est 1RM: {Math.round(est1rm)} lbs
                </Text>
              )}
            </View>

            {/* Sets */}
            {ex.sets.map((set, setIdx) => (
              <SetEntry
                key={`set_${exIdx}_${setIdx}`}
                set={set}
                onUpdate={(updated) => updateSet(exIdx, setIdx, updated)}
                onDelete={() => deleteSet(exIdx, setIdx)}
                isPR={
                  newPrs.has(`${ex.exercise_id}_${setIdx}`) || set.is_pr
                }
              />
            ))}

            {/* Add set button */}
            <TouchableOpacity
              style={styles.addSetBtn}
              onPress={() => addSet(exIdx)}
            >
              <Ionicons name="add" size={16} color={Colors.accent} />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Add exercise button */}
      <TouchableOpacity
        style={styles.addExerciseBtn}
        onPress={() => setShowExerciseSearch(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.addExerciseText}>Add Exercise</Text>
      </TouchableOpacity>

      {/* Clear session */}
      {exercises.length > 0 && (
        <TouchableOpacity style={styles.clearBtn} onPress={clearSession}>
          <Ionicons name="trash-outline" size={14} color={Colors.danger} />
          <Text style={styles.clearBtnText}>Clear Session</Text>
        </TouchableOpacity>
      )}

      {/* Empty state */}
      {exercises.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="barbell-outline" size={48} color={Colors.divider} />
          <Text style={styles.emptyTitle}>No exercises logged</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Add Exercise" to search and add exercises
          </Text>
        </View>
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
  sessionNameInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 12,
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
    fontSize: 20,
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
  timerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 4,
  },
  timerToggleText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  exerciseCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  exerciseTitle: {
    flex: 1,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
  exerciseStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  statText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  addSetText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 12,
  },
  addExerciseText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  clearBtnText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});
