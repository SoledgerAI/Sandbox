// Sprint 23: Medication Tracker Logger
// Daily checklist format: pre-populated from saved medication list
// Taken/skipped toggle per medication, adherence summary, as-needed one-offs

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../../utils/storage';
import { getActiveDate } from '../../services/dateContextService';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import { getMedicationList } from '../../utils/medicationList';
import type {
  MedicationEntry,
  MedicationLogItem,
  MedicationDefinition,
  MedicationSkippedReason,
} from '../../types';
import { MEDICATION_SKIPPED_REASON_OPTIONS } from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function currentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function MedicationLogger() {
  const { showToast } = useToast();
  const today = getActiveDate();

  const [medications, setMedications] = useState<MedicationLogItem[]>([]);
  const [existingEntry, setExistingEntry] = useState<MedicationEntry | null>(null);
  const [medList, setMedList] = useState<MedicationDefinition[]>([]);
  const [showSkipReasonFor, setShowSkipReasonFor] = useState<string | null>(null);

  // As-needed add form
  const [addingAsNeeded, setAddingAsNeeded] = useState(false);
  const [asNeededName, setAsNeededName] = useState('');
  const [asNeededDosage, setAsNeededDosage] = useState('');

  // Load medication list and existing entry
  useEffect(() => {
    (async () => {
      const [list, existing] = await Promise.all([
        getMedicationList(),
        storageGet<MedicationEntry>(dateKey(STORAGE_KEYS.LOG_MEDICATIONS, today)),
      ]);

      setMedList(list);

      if (existing) {
        setExistingEntry(existing);
        // Merge: keep existing items, add any new medications from list
        const existingIds = new Set(existing.medications.map((m) => m.id));
        const merged = [...existing.medications];
        for (const def of list) {
          if (!existingIds.has(def.id)) {
            merged.push({
              id: def.id,
              name: def.name,
              dosage: def.dosage,
              time_scheduled: def.scheduled_time,
              time_taken: null,
              taken: false,
              skipped_reason: null,
              notes: null,
            });
          }
        }
        setMedications(merged);
      } else {
        // Pre-populate from saved list
        const items: MedicationLogItem[] = list.map((def) => ({
          id: def.id,
          name: def.name,
          dosage: def.dosage,
          time_scheduled: def.scheduled_time,
          time_taken: null,
          taken: false,
          skipped_reason: null,
          notes: null,
        }));
        setMedications(items);
      }
    })();
  }, [today]);

  const handleTaken = useCallback((id: string) => {
    hapticSuccess();
    setMedications((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, taken: true, time_taken: currentTimeHHMM(), skipped_reason: null }
          : m,
      ),
    );
  }, []);

  const handleSkip = useCallback((id: string) => {
    hapticSelection();
    setShowSkipReasonFor(id);
    // Mark as not taken
    setMedications((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, taken: false, time_taken: null }
          : m,
      ),
    );
  }, []);

  const handleSkipReason = useCallback((id: string, reason: MedicationSkippedReason) => {
    hapticSelection();
    setMedications((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, taken: false, time_taken: null, skipped_reason: reason }
          : m,
      ),
    );
    setShowSkipReasonFor(null);
  }, []);

  const handleUndoAction = useCallback((id: string) => {
    hapticSelection();
    setMedications((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, taken: false, time_taken: null, skipped_reason: null }
          : m,
      ),
    );
  }, []);

  const handleAddAsNeeded = useCallback(() => {
    if (!asNeededName.trim()) {
      showToast('Please enter a medication name', 'error');
      return;
    }
    hapticSelection();
    const newItem: MedicationLogItem = {
      id: `med_asneeded_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: asNeededName.trim(),
      dosage: asNeededDosage.trim() || 'as needed',
      time_scheduled: currentTimeHHMM(),
      time_taken: currentTimeHHMM(),
      taken: true,
      skipped_reason: null,
      notes: null,
    };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMedications((prev) => [...prev, newItem]);
    setAsNeededName('');
    setAsNeededDosage('');
    setAddingAsNeeded(false);
  }, [asNeededName, asNeededDosage, showToast]);

  const handleSave = useCallback(async () => {
    const entry: MedicationEntry = {
      id: existingEntry?.id ?? `medlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      date: today,
      medications,
    };

    const key = dateKey(STORAGE_KEYS.LOG_MEDICATIONS, today);
    await storageSet(key, entry);
    setExistingEntry(entry);
    hapticSuccess();
    showToast('Medications saved', 'success');
  }, [medications, existingEntry, today, showToast]);

  const takenCount = medications.filter((m) => m.taken).length;
  const totalCount = medications.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Adherence Summary */}
      {totalCount > 0 && (
        <PremiumCard>
          <View style={styles.summaryRow}>
            <Ionicons name="medical-outline" size={22} color={Colors.accent} />
            <Text style={styles.summaryText}>
              {takenCount} of {totalCount} medications taken today
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${totalCount > 0 ? (takenCount / totalCount) * 100 : 0}%` }]} />
          </View>
        </PremiumCard>
      )}

      {/* Empty state */}
      {medList.length === 0 && medications.length === 0 && (
        <PremiumCard>
          <View style={styles.emptyState}>
            <Ionicons name="medical-outline" size={40} color={Colors.secondaryText} />
            <Text style={styles.emptyTitle}>No medications set up</Text>
            <Text style={styles.emptyHint}>Add your medications in Settings to see your daily checklist here.</Text>
            <PremiumButton
              label="Set Up Medications"
              onPress={() => router.push('/settings/medications' as any)}
              variant="secondary"
              size="medium"
            />
          </View>
        </PremiumCard>
      )}

      {/* Medication Checklist */}
      {medications.map((med) => (
        <PremiumCard key={med.id}>
          <View style={styles.medRow}>
            <View style={styles.medInfo}>
              <Text style={styles.medName}>{med.name}</Text>
              <Text style={styles.medDosage}>{med.dosage} — scheduled {med.time_scheduled}</Text>
              {med.taken && med.time_taken && (
                <Text style={styles.medTakenTime}>Taken at {med.time_taken}</Text>
              )}
              {med.skipped_reason && (
                <Text style={styles.medSkippedReason}>
                  Skipped: {MEDICATION_SKIPPED_REASON_OPTIONS.find((o) => o.value === med.skipped_reason)?.label ?? med.skipped_reason}
                </Text>
              )}
            </View>
            <View style={styles.medActions}>
              {!med.taken && !med.skipped_reason ? (
                <>
                  <TouchableOpacity
                    style={styles.takenBtn}
                    onPress={() => handleTaken(med.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${med.name} as taken`}
                  >
                    <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => handleSkip(med.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${med.name} as skipped`}
                  >
                    <Ionicons name="close-circle" size={28} color={Colors.danger} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => handleUndoAction(med.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Undo ${med.name} action`}
                >
                  <Ionicons name="refresh-outline" size={20} color={Colors.secondaryText} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Skip reason picker */}
          {showSkipReasonFor === med.id && (
            <View style={styles.skipReasonContainer}>
              <Text style={styles.skipReasonTitle}>Why was it skipped?</Text>
              <View style={styles.skipReasonGrid}>
                {MEDICATION_SKIPPED_REASON_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={styles.skipReasonChip}
                    onPress={() => handleSkipReason(med.id, opt.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Skipped because: ${opt.label}`}
                  >
                    <Text style={styles.skipReasonChipText}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </PremiumCard>
      ))}

      {/* Add as-needed medication */}
      <PremiumCard>
        {!addingAsNeeded ? (
          <TouchableOpacity
            style={styles.addAsNeededBtn}
            onPress={() => { hapticSelection(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setAddingAsNeeded(true); }}
            accessibilityRole="button"
            accessibilityLabel="Add as-needed medication"
          >
            <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
            <Text style={styles.addAsNeededText}>Add as-needed medication</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>As-Needed Medication</Text>
            <TextInput
              style={styles.input}
              value={asNeededName}
              onChangeText={setAsNeededName}
              placeholder="Medication name (e.g., Ibuprofen)"
              placeholderTextColor={Colors.secondaryText}
              maxLength={100}
              accessibilityLabel="As-needed medication name"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={asNeededDosage}
              onChangeText={setAsNeededDosage}
              placeholder="Dosage (e.g., 200mg)"
              placeholderTextColor={Colors.secondaryText}
              maxLength={50}
              accessibilityLabel="As-needed medication dosage"
            />
            <View style={styles.addAsNeededActions}>
              <TouchableOpacity onPress={() => { setAddingAsNeeded(false); setAsNeededName(''); setAsNeededDosage(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <PremiumButton label="Add & Mark Taken" onPress={handleAddAsNeeded} variant="primary" size="small" />
            </View>
          </View>
        )}
      </PremiumCard>

      {/* Manage medications link */}
      <TouchableOpacity
        style={styles.manageLink}
        onPress={() => router.push('/settings/medications' as any)}
        accessibilityRole="link"
        accessibilityLabel="Manage medication list"
      >
        <Ionicons name="settings-outline" size={16} color={Colors.accent} />
        <Text style={styles.manageLinkText}>Manage Medication List</Text>
      </TouchableOpacity>

      {/* Save */}
      {medications.length > 0 && (
        <PremiumButton
          label={existingEntry ? 'Update Medications' : 'Save Medications'}
          onPress={handleSave}
          variant="primary"
          size="large"
        />
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },

  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },

  // Summary
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  summaryText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: Colors.inputBackground, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.accent, borderRadius: 3 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: Colors.secondaryText, fontSize: 13, textAlign: 'center', maxWidth: 280 },

  // Medication row
  medRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  medInfo: { flex: 1, marginRight: 12 },
  medName: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  medDosage: { color: Colors.secondaryText, fontSize: 13, marginTop: 2 },
  medTakenTime: { color: Colors.success, fontSize: 12, marginTop: 4 },
  medSkippedReason: { color: Colors.danger, fontSize: 12, marginTop: 4 },
  medActions: { flexDirection: 'row', gap: 8 },
  takenBtn: { padding: 4 },
  skipBtn: { padding: 4 },
  undoBtn: { padding: 8, backgroundColor: Colors.inputBackground, borderRadius: 20 },

  // Skip reason
  skipReasonContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.divider },
  skipReasonTitle: { color: Colors.secondaryText, fontSize: 13, marginBottom: 8 },
  skipReasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skipReasonChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.divider,
  },
  skipReasonChipText: { color: Colors.text, fontSize: 13 },

  // Add as-needed
  addAsNeededBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  addAsNeededText: { color: Colors.accent, fontSize: 15, fontWeight: '500' },
  input: {
    backgroundColor: Colors.inputBackground, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.divider,
  },
  addAsNeededActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  cancelText: { color: Colors.secondaryText, fontSize: 14, fontWeight: '500' },

  // Manage link
  manageLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginBottom: 8 },
  manageLinkText: { color: Colors.accent, fontSize: 14, fontWeight: '500' },
});
