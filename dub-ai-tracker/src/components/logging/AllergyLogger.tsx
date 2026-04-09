// Allergy Logger — Sprint 17
// Daily allergy log: severity, symptoms, medication, symptom-free streak

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import { PremiumPill } from '../common/PremiumButton';
import {
  storageGet,
  storageSet,
  storageList,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { AllergyLogEntry, AllergySeverity, AllergySymptom } from '../../types';
import { ALLERGY_SEVERITY_OPTIONS, ALLERGY_SYMPTOM_OPTIONS } from '../../types';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import { getActiveDate } from '../../services/dateContextService';
import { todayDateString } from '../../utils/dayBoundary';

function generateId(): string {
  return `allergy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AllergyLogger() {
  const [entry, setEntry] = useState<AllergyLogEntry | null>(null);
  const [severity, setSeverity] = useState<AllergySeverity>('none');
  const [symptoms, setSymptoms] = useState<AllergySymptom[]>([]);
  const [medicationTaken, setMedicationTaken] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [notes, setNotes] = useState('');
  const [symptomFreeStreak, setSymptomFreeStreak] = useState(0);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_ALLERGIES, activeDate);
    const stored = await storageGet<AllergyLogEntry>(key);
    if (stored) {
      setEntry(stored);
      setSeverity(stored.severity);
      setSymptoms(stored.symptoms);
      setMedicationTaken(stored.medication_taken);
      setMedicationName(stored.medication_name ?? '');
      setNotes(stored.notes ?? '');
    } else {
      setEntry(null);
      setSeverity('none');
      setSymptoms([]);
      setMedicationTaken(false);
      setMedicationName('');
      setNotes('');
    }

    // Compute symptom-free streak
    let streak = 0;
    const today = todayDateString();
    for (let i = 1; i <= 365; i++) {
      const d = new Date(today + 'T12:00:00');
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayEntry = await storageGet<AllergyLogEntry>(dateKey(STORAGE_KEYS.LOG_ALLERGIES, dateStr));
      if (!dayEntry) break; // no entry = streak broken (not logged)
      if (dayEntry.severity === 'none') {
        streak++;
      } else {
        break;
      }
    }
    setSymptomFreeStreak(streak);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSymptom = useCallback((symptom: AllergySymptom) => {
    hapticSelection();
    setSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom],
    );
  }, []);

  const save = useCallback(async () => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_ALLERGIES, activeDate);
    const updated: AllergyLogEntry = {
      id: entry?.id ?? generateId(),
      timestamp: new Date().toISOString(),
      severity,
      symptoms: severity === 'none' ? [] : symptoms,
      medication_taken: medicationTaken,
      medication_name: medicationTaken && medicationName.trim() ? medicationName.trim() : null,
      notes: notes.trim() || null,
    };
    await storageSet(key, updated);
    setEntry(updated);
    hapticSuccess();
    showToast('Allergy log saved');
  }, [entry, severity, symptoms, medicationTaken, medicationName, notes, showToast]);

  const severityColor = ALLERGY_SEVERITY_OPTIONS.find((o) => o.value === severity)?.color ?? Colors.success;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Symptom-free streak */}
        {symptomFreeStreak > 0 && (
          <PremiumCard style={styles.streakCard}>
            <View style={styles.streakRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.success} />
              <Text style={styles.streakText}>
                {symptomFreeStreak} symptom-free day{symptomFreeStreak === 1 ? '' : 's'}
              </Text>
            </View>
          </PremiumCard>
        )}

        {/* Severity Picker */}
        <Text style={styles.sectionTitle}>SEVERITY</Text>
        <View style={styles.severityRow}>
          {ALLERGY_SEVERITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.severityChip,
                severity === opt.value && {
                  backgroundColor: opt.color + '22',
                  borderColor: opt.color,
                },
              ]}
              onPress={() => { hapticSelection(); setSeverity(opt.value); }}
              activeOpacity={0.7}
            >
              <View style={[styles.severityDot, { backgroundColor: opt.color }]} />
              <Text style={[
                styles.severityLabel,
                severity === opt.value && { color: opt.color },
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Symptoms multi-select (hidden if severity is none) */}
        {severity !== 'none' && (
          <>
            <Text style={styles.sectionTitle}>SYMPTOMS</Text>
            <View style={styles.symptomGrid}>
              {ALLERGY_SYMPTOM_OPTIONS.map((opt) => (
                <PremiumPill
                  key={opt.value}
                  label={opt.label}
                  selected={symptoms.includes(opt.value)}
                  onPress={() => toggleSymptom(opt.value)}
                />
              ))}
            </View>
          </>
        )}

        {/* Medication toggle */}
        <Text style={styles.sectionTitle}>MEDICATION</Text>
        <TouchableOpacity
          style={[styles.medToggle, medicationTaken && styles.medToggleActive]}
          onPress={() => { hapticSelection(); setMedicationTaken(!medicationTaken); }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={medicationTaken ? 'checkbox' : 'square-outline'}
            size={22}
            color={medicationTaken ? Colors.accent : Colors.secondaryText}
          />
          <Text style={styles.medToggleText}>Medication taken today</Text>
        </TouchableOpacity>

        {medicationTaken && (
          <TextInput
            style={styles.input}
            placeholder="e.g., Zyrtec, Flonase"
            placeholderTextColor={Colors.secondaryText}
            value={medicationName}
            onChangeText={setMedicationName}
            maxLength={200}
          />
        )}

        {/* Notes */}
        <Text style={styles.sectionTitle}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Any additional details..."
          placeholderTextColor={Colors.secondaryText}
          value={notes}
          onChangeText={setNotes}
          maxLength={300}
          multiline
          numberOfLines={3}
        />

        {/* Current status summary */}
        <PremiumCard style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: severityColor }]} />
            <Text style={[styles.statusText, { color: severityColor }]}>
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </Text>
            {symptoms.length > 0 && (
              <Text style={styles.statusSymptoms}>
                {symptoms.map((s) => ALLERGY_SYMPTOM_OPTIONS.find((o) => o.value === s)?.label).join(', ')}
              </Text>
            )}
          </View>
        </PremiumCard>

        {/* Save */}
        <View style={styles.saveSection}>
          <PremiumButton
            label={entry ? 'Update Allergy Log' : 'Save Allergy Log'}
            onPress={save}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingBottom: 48 },

  sectionTitle: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Streak
  streakCard: { marginBottom: 8 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakText: { color: Colors.success, fontSize: 15, fontWeight: '600' },

  // Severity
  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.cardBackground,
    gap: 4,
  },
  severityDot: { width: 10, height: 10, borderRadius: 5 },
  severityLabel: { color: Colors.secondaryText, fontSize: 12, fontWeight: '500' },

  // Symptoms
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Medication
  medToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  medToggleActive: { borderColor: Colors.accent + '55' },
  medToggleText: { color: Colors.text, fontSize: 15 },

  // Input
  input: {
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginTop: 8,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  // Status
  statusCard: { marginTop: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { fontSize: 16, fontWeight: '700' },
  statusSymptoms: { color: Colors.secondaryText, fontSize: 13 },

  // Save
  saveSection: { marginTop: 24 },
});
