// Bodyweight Reps Logger — Sprint 16
// Quick-log buttons for 5 bodyweight exercises with rep/set picker

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { BodyweightRepEntry, BodyweightExerciseType } from '../../types';
import { BODYWEIGHT_EXERCISES } from '../../types';
import { hapticSuccess, hapticMedium } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import { getActiveDate } from '../../services/dateContextService';

function generateId(): string {
  return `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Rep count options for the picker (1-200)
const REP_OPTIONS = Array.from({ length: 200 }, (_, i) => i + 1);
const SET_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export function BodyweightRepsLogger() {
  const [entries, setEntries] = useState<BodyweightRepEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<BodyweightExerciseType | null>(null);
  const [selectedReps, setSelectedReps] = useState(10);
  const [selectedSets, setSelectedSets] = useState(1);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_REPS, today);
    const stored = await storageGet<BodyweightRepEntry[]>(key);
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveEntries = useCallback(async (updated: BodyweightRepEntry[]) => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_REPS, today);
    await storageSet(key, updated);
    setEntries(updated);
  }, []);

  const openLogger = useCallback((exerciseType: BodyweightExerciseType) => {
    setSelectedExercise(exerciseType);
    setSelectedReps(10);
    setSelectedSets(1);
    setShowModal(true);
    hapticMedium();
  }, []);

  const saveEntry = useCallback(() => {
    if (!selectedExercise) return;
    const exercise = BODYWEIGHT_EXERCISES.find((e) => e.type === selectedExercise);
    if (!exercise) return;

    const newEntry: BodyweightRepEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      exercise_type: selectedExercise,
      reps: selectedReps,
      sets: selectedSets,
      notes: null,
    };

    const updated = [...entries, newEntry];
    saveEntries(updated);
    setShowModal(false);
    hapticSuccess();
    showToast(`${exercise.label}: ${selectedReps} reps x ${selectedSets} set${selectedSets > 1 ? 's' : ''}`, 'success');
  }, [selectedExercise, selectedReps, selectedSets, entries, saveEntries, showToast]);

  const deleteEntry = useCallback((id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    saveEntries(updated);
    showToast('Entry removed', 'info');
  }, [entries, saveEntries, showToast]);

  // Compute daily totals per exercise type
  const dailyTotals = BODYWEIGHT_EXERCISES.map((ex) => {
    const typeEntries = entries.filter((e) => e.exercise_type === ex.type);
    const totalReps = typeEntries.reduce((s, e) => s + e.reps * e.sets, 0);
    const totalSets = typeEntries.reduce((s, e) => s + e.sets, 0);
    return { ...ex, totalReps, totalSets, count: typeEntries.length };
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Quick-log buttons */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Quick Log</Text>
        <View style={styles.quickLogGrid}>
          {BODYWEIGHT_EXERCISES.map((ex) => (
            <TouchableOpacity
              key={ex.type}
              style={styles.quickLogBtn}
              onPress={() => openLogger(ex.type)}
              activeOpacity={0.7}
            >
              <Ionicons name={ex.icon as any} size={28} color={Colors.accent} />
              <Text style={styles.quickLogLabel}>{ex.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </PremiumCard>

      {/* Daily Totals */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Today's Totals</Text>
        {dailyTotals.map((ex) => (
          <View key={ex.type} style={styles.totalRow}>
            <Ionicons name={ex.icon as any} size={20} color={ex.totalReps > 0 ? Colors.accent : Colors.secondaryText} />
            <Text style={[styles.totalLabel, ex.totalReps > 0 && styles.totalLabelActive]}>
              {ex.label}
            </Text>
            <Text style={[styles.totalValue, ex.totalReps > 0 && styles.totalValueActive]}>
              {ex.totalReps > 0
                ? `${ex.totalReps} reps (${ex.totalSets} set${ex.totalSets > 1 ? 's' : ''})`
                : '—'}
            </Text>
          </View>
        ))}
      </PremiumCard>

      {/* Recent entries */}
      {entries.length > 0 && (
        <PremiumCard>
          <Text style={styles.sectionTitle}>Log Entries</Text>
          {[...entries].reverse().map((entry) => {
            const ex = BODYWEIGHT_EXERCISES.find((e) => e.type === entry.exercise_type);
            return (
              <View key={entry.id} style={styles.entryRow}>
                <Ionicons name={(ex?.icon ?? 'body-outline') as any} size={18} color={Colors.accent} />
                <View style={styles.entryInfo}>
                  <Text style={styles.entryLabel}>{ex?.label ?? entry.exercise_type}</Text>
                  <Text style={styles.entryDetail}>
                    {entry.reps} reps x {entry.sets} set{entry.sets > 1 ? 's' : ''} = {entry.reps * entry.sets} total
                  </Text>
                </View>
                <Text style={styles.entryTime}>
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={18} color={Colors.secondaryText} />
                </TouchableOpacity>
              </View>
            );
          })}
        </PremiumCard>
      )}

      {/* Rep/Set Picker Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {BODYWEIGHT_EXERCISES.find((e) => e.type === selectedExercise)?.label ?? ''}
            </Text>

            {/* Reps selector */}
            <Text style={styles.pickerLabel}>Reps</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
            >
              {REP_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.pickerItem, selectedReps === n && styles.pickerItemSelected]}
                  onPress={() => { setSelectedReps(n); hapticMedium(); }}
                >
                  <Text style={[styles.pickerItemText, selectedReps === n && styles.pickerItemTextSelected]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Sets selector */}
            <Text style={styles.pickerLabel}>Sets (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
            >
              {SET_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.pickerItem, selectedSets === n && styles.pickerItemSelected]}
                  onPress={() => { setSelectedSets(n); hapticMedium(); }}
                >
                  <Text style={[styles.pickerItemText, selectedSets === n && styles.pickerItemTextSelected]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Summary */}
            <Text style={styles.modalSummary}>
              Total: {selectedReps * selectedSets} reps
            </Text>

            {/* Actions */}
            <View style={styles.modalActions}>
              <PremiumButton
                label="Cancel"
                variant="outline"
                onPress={() => setShowModal(false)}
                size="medium"
              />
              <PremiumButton
                label="Save"
                onPress={saveEntry}
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickLogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickLogBtn: {
    width: '30%' as any,
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quickLogLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  totalLabel: {
    flex: 1,
    color: Colors.secondaryText,
    fontSize: 14,
  },
  totalLabelActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  totalValue: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  totalValueActive: {
    color: Colors.accentText,
    fontWeight: '600',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  entryInfo: {
    flex: 1,
  },
  entryLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  entryDetail: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  entryTime: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  pickerScroll: {
    marginBottom: 12,
  },
  pickerScrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  pickerItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  pickerItemSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  pickerItemText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pickerItemTextSelected: {
    color: Colors.primaryBackground,
  },
  modalSummary: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 16,
    fontVariant: ['tabular-nums'],
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
});
