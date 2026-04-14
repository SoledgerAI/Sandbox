// Sprint 23: Medication List Management settings screen
// Users define medications ONCE here; daily log pre-populates from this list

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
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { PremiumButton } from '../../src/components/common/PremiumButton';
import { hapticSuccess, hapticSelection } from '../../src/utils/haptics';
import { useToast } from '../../src/contexts/ToastContext';
import { getMedicationList, saveMedicationList } from '../../src/utils/medicationList';
import { onMedicationListChanged } from '../../src/services/notificationService';
import type { MedicationDefinition, MedicationFrequency } from '../../src/types';
import { MEDICATION_FREQUENCY_OPTIONS } from '../../src/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MedicationSettingsScreen() {
  const { showToast } = useToast();
  const [medications, setMedications] = useState<MedicationDefinition[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<MedicationFrequency>('daily');
  const [scheduledTime, setScheduledTime] = useState('08:00');

  useEffect(() => {
    (async () => {
      const list = await getMedicationList();
      setMedications(list);
    })();
  }, []);

  const resetForm = useCallback(() => {
    setName('');
    setDosage('');
    setFrequency('daily');
    setScheduledTime('08:00');
    setEditingId(null);
    setShowAddForm(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      showToast('Please enter a medication name', 'error');
      return;
    }
    if (!dosage.trim()) {
      showToast('Please enter a dosage', 'error');
      return;
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(scheduledTime)) {
      showToast('Please enter time as HH:MM (24-hour)', 'error');
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (editingId) {
      // Update existing
      const updated = medications.map((m) =>
        m.id === editingId
          ? { ...m, name: name.trim(), dosage: dosage.trim(), frequency, scheduled_time: scheduledTime }
          : m,
      );
      setMedications(updated);
      await saveMedicationList(updated);
      onMedicationListChanged().catch(() => {});
      showToast('Medication updated', 'success');
    } else {
      // Add new
      const newMed: MedicationDefinition = {
        id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        scheduled_time: scheduledTime,
      };
      const updated = [...medications, newMed];
      setMedications(updated);
      await saveMedicationList(updated);
      onMedicationListChanged().catch(() => {});
      showToast('Medication added', 'success');
    }

    hapticSuccess();
    resetForm();
  }, [name, dosage, frequency, scheduledTime, editingId, medications, showToast, resetForm]);

  const handleEdit = useCallback((med: MedicationDefinition) => {
    hapticSelection();
    setEditingId(med.id);
    setName(med.name);
    setDosage(med.dosage);
    setFrequency(med.frequency);
    setScheduledTime(med.scheduled_time);
    setShowAddForm(true);
  }, []);

  const handleDelete = useCallback((id: string, medName: string) => {
    Alert.alert(
      'Remove Medication',
      `Remove "${medName}" from your list? Historical daily entries will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const updated = medications.filter((m) => m.id !== id);
            setMedications(updated);
            await saveMedicationList(updated);
            onMedicationListChanged().catch(() => {});
            hapticSelection();
            showToast('Medication removed', 'info');
          },
        },
      ],
    );
  }, [medications, showToast]);

  return (
    <ScreenWrapper>
      <View style={styles.screenContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Medications</Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>
            Define your medications here. Your daily log will pre-populate from this list.
          </Text>

          {/* Medication List */}
          {medications.map((med) => (
            <PremiumCard key={med.id}>
              <View style={styles.medRow}>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{med.name}</Text>
                  <Text style={styles.medDetail}>{med.dosage} — {MEDICATION_FREQUENCY_OPTIONS.find((o) => o.value === med.frequency)?.label} at {med.scheduled_time}</Text>
                </View>
                <View style={styles.medActions}>
                  <TouchableOpacity
                    onPress={() => handleEdit(med)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${med.name}`}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(med.id, med.name)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${med.name}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </PremiumCard>
          ))}

          {medications.length === 0 && !showAddForm && (
            <PremiumCard>
              <View style={styles.emptyState}>
                <Ionicons name="medical-outline" size={40} color={Colors.secondaryText} />
                <Text style={styles.emptyText}>No medications added yet</Text>
              </View>
            </PremiumCard>
          )}

          {/* Add/Edit Form */}
          {showAddForm ? (
            <PremiumCard>
              <Text style={styles.formTitle}>{editingId ? 'Edit Medication' : 'Add Medication'}</Text>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Lisinopril"
                placeholderTextColor={Colors.secondaryText}
                maxLength={100}
                accessibilityLabel="Medication name"
              />
              <Text style={styles.fieldLabel}>Dosage</Text>
              <TextInput
                style={styles.input}
                value={dosage}
                onChangeText={setDosage}
                placeholder="e.g., 10mg, 2 tablets"
                placeholderTextColor={Colors.secondaryText}
                maxLength={50}
                accessibilityLabel="Medication dosage"
              />
              <Text style={styles.fieldLabel}>Frequency</Text>
              <View style={styles.freqRow}>
                {MEDICATION_FREQUENCY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.freqChip, frequency === opt.value && styles.freqChipActive]}
                    onPress={() => { hapticSelection(); setFrequency(opt.value); }}
                    accessibilityRole="radio"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected: frequency === opt.value }}
                  >
                    <Text style={[styles.freqChipText, frequency === opt.value && styles.freqChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Scheduled Time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={scheduledTime}
                onChangeText={setScheduledTime}
                placeholder="08:00"
                placeholderTextColor={Colors.secondaryText}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Scheduled time"
              />
              <View style={styles.formActions}>
                <TouchableOpacity onPress={resetForm}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <PremiumButton label={editingId ? 'Update' : 'Add'} onPress={handleSave} variant="primary" size="small" />
              </View>
            </PremiumCard>
          ) : (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { hapticSelection(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowAddForm(true); }}
              accessibilityRole="button"
              accessibilityLabel="Add a new medication"
            >
              <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
              <Text style={styles.addBtnText}>Add Medication</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: Colors.primaryBackground },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 32 },
  headerTitle: { color: Colors.text, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  subtitle: { color: Colors.secondaryText, fontSize: 14, marginBottom: 16 },

  // Medication list
  medRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  medInfo: { flex: 1, marginRight: 12 },
  medName: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  medDetail: { color: Colors.secondaryText, fontSize: 13, marginTop: 2 },
  medActions: { flexDirection: 'row', gap: 16 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { color: Colors.secondaryText, fontSize: 14 },

  // Form
  formTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  fieldLabel: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: Colors.inputBackground, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.divider,
  },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.divider,
  },
  freqChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  freqChipText: { color: Colors.text, fontSize: 13 },
  freqChipTextActive: { color: Colors.primaryBackground, fontWeight: '600' },
  formActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  cancelText: { color: Colors.secondaryText, fontSize: 14, fontWeight: '500' },

  // Add button
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  addBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '500' },
});
