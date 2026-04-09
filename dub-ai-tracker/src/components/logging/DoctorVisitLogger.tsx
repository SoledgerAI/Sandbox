// Doctor Visit Logger — Sprint 17
// Log doctor visits with type, date, doctor name, location, notes, follow-up date

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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
} from '../../utils/storage';
import type { DoctorVisitEntry, DoctorVisitType } from '../../types';
import { DOCTOR_VISIT_TYPES } from '../../types';
import { hapticSuccess, hapticMedium } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import { todayDateString } from '../../utils/dayBoundary';

function generateId(): string {
  return `dv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const today = new Date(todayDateString() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function DoctorVisitLogger() {
  const [visits, setVisits] = useState<DoctorVisitEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { showToast } = useToast();

  // Form state
  const [visitType, setVisitType] = useState<DoctorVisitType>('general_physical');
  const [visitDate, setVisitDate] = useState(todayDateString());
  const [doctorName, setDoctorName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [specialistType, setSpecialistType] = useState('');

  const loadData = useCallback(async () => {
    const stored = await storageGet<DoctorVisitEntry[]>(STORAGE_KEYS.LOG_DOCTOR_VISITS);
    setVisits(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = useCallback(() => {
    setVisitType('general_physical');
    setVisitDate(todayDateString());
    setDoctorName('');
    setLocation('');
    setNotes('');
    setFollowUpDate('');
    setSpecialistType('');
    setEditingId(null);
  }, []);

  const openNew = useCallback(() => {
    resetForm();
    setShowForm(true);
    hapticMedium();
  }, [resetForm]);

  const openEdit = useCallback((visit: DoctorVisitEntry) => {
    setEditingId(visit.id);
    setVisitType(visit.visit_type);
    setVisitDate(visit.visit_date);
    setDoctorName(visit.doctor_name ?? '');
    setLocation(visit.location ?? '');
    setNotes(visit.notes ?? '');
    setFollowUpDate(visit.follow_up_date ?? '');
    setSpecialistType(visit.specialist_type ?? '');
    setShowForm(true);
  }, []);

  const saveVisit = useCallback(async () => {
    const entry: DoctorVisitEntry = {
      id: editingId ?? generateId(),
      timestamp: new Date().toISOString(),
      visit_type: visitType,
      visit_date: visitDate,
      doctor_name: doctorName.trim() || null,
      location: location.trim() || null,
      notes: notes.trim().slice(0, 500) || null,
      follow_up_date: followUpDate.trim() || null,
      specialist_type: visitType === 'specialist' ? (specialistType.trim() || null) : null,
    };

    let updated: DoctorVisitEntry[];
    if (editingId) {
      updated = visits.map((v) => (v.id === editingId ? entry : v));
    } else {
      updated = [...visits, entry];
    }

    await storageSet(STORAGE_KEYS.LOG_DOCTOR_VISITS, updated);
    setVisits(updated);
    setShowForm(false);
    resetForm();
    hapticSuccess();
    showToast(editingId ? 'Visit updated' : 'Visit logged');
  }, [editingId, visitType, visitDate, doctorName, location, notes, followUpDate, specialistType, visits, resetForm, showToast]);

  const deleteVisit = useCallback((id: string) => {
    Alert.alert('Delete Visit', 'Remove this doctor visit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = visits.filter((v) => v.id !== id);
          await storageSet(STORAGE_KEYS.LOG_DOCTOR_VISITS, updated);
          setVisits(updated);
          showToast('Visit deleted');
        },
      },
    ]);
  }, [visits, showToast]);

  const getVisitTypeDef = (type: DoctorVisitType) =>
    DOCTOR_VISIT_TYPES.find((t) => t.type === type) ?? DOCTOR_VISIT_TYPES[0];

  // Sort newest first
  const sortedVisits = [...visits].sort(
    (a, b) => b.visit_date.localeCompare(a.visit_date),
  );

  // Upcoming follow-ups
  const upcomingFollowUps = visits
    .filter((v) => v.follow_up_date && daysUntil(v.follow_up_date) >= 0)
    .sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!));

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
        {/* Quick-add button */}
        <PremiumButton
          label="Log Doctor Visit"
          onPress={openNew}
          icon={<Ionicons name="add-circle-outline" size={20} color={Colors.primaryBackground} />}
        />

        {/* Upcoming follow-ups */}
        {upcomingFollowUps.length > 0 && (
          <PremiumCard style={styles.followUpCard}>
            <Text style={styles.sectionTitle}>Upcoming Follow-ups</Text>
            {upcomingFollowUps.map((v) => {
              const days = daysUntil(v.follow_up_date!);
              const typeDef = getVisitTypeDef(v.visit_type);
              const label = v.visit_type === 'specialist' && v.specialist_type
                ? v.specialist_type
                : typeDef.label;
              return (
                <View key={v.id} style={styles.followUpRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
                  <Text style={styles.followUpText}>
                    {label} follow-up {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                    {' '}({formatDateDisplay(v.follow_up_date!)})
                  </Text>
                </View>
              );
            })}
          </PremiumCard>
        )}

        {/* Past visits list */}
        {sortedVisits.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Visit History</Text>
            {sortedVisits.map((visit) => {
              const typeDef = getVisitTypeDef(visit.visit_type);
              return (
                <PremiumCard key={visit.id} style={styles.visitCard}>
                  <TouchableOpacity
                    style={styles.visitRow}
                    onPress={() => openEdit(visit)}
                    onLongPress={() => deleteVisit(visit.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.visitBadge, { backgroundColor: typeDef.color + '22' }]}>
                      <Ionicons name={typeDef.icon as any} size={20} color={typeDef.color} />
                    </View>
                    <View style={styles.visitInfo}>
                      <Text style={styles.visitTypeLabel}>
                        {visit.visit_type === 'specialist' && visit.specialist_type
                          ? `Specialist: ${visit.specialist_type}`
                          : typeDef.label}
                      </Text>
                      <Text style={styles.visitDateText}>{formatDateDisplay(visit.visit_date)}</Text>
                      {visit.doctor_name && (
                        <Text style={styles.visitDetail}>Dr. {visit.doctor_name}</Text>
                      )}
                      {visit.location && (
                        <Text style={styles.visitDetail}>{visit.location}</Text>
                      )}
                      {visit.follow_up_date && (
                        <Text style={[styles.visitDetail, { color: Colors.accent }]}>
                          Follow-up: {formatDateDisplay(visit.follow_up_date)}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
                  </TouchableOpacity>
                </PremiumCard>
              );
            })}
          </View>
        )}

        {sortedVisits.length === 0 && !showForm && (
          <View style={styles.emptyState}>
            <Ionicons name="medkit-outline" size={48} color={Colors.secondaryText} />
            <Text style={styles.emptyText}>No doctor visits logged yet</Text>
            <Text style={styles.emptySubtext}>Tap the button above to log your first visit</Text>
          </View>
        )}

        {/* Add/Edit Form Modal */}
        <Modal visible={showForm} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingId ? 'Edit Visit' : 'Log Doctor Visit'}
                  </Text>
                  <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} hitSlop={12}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Visit Type Picker */}
                <Text style={styles.fieldLabel}>Visit Type</Text>
                <View style={styles.typePicker}>
                  {DOCTOR_VISIT_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.type}
                      style={[
                        styles.typeChip,
                        visitType === t.type && { backgroundColor: t.color + '33', borderColor: t.color },
                      ]}
                      onPress={() => setVisitType(t.type)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={t.icon as any} size={16} color={visitType === t.type ? t.color : Colors.secondaryText} />
                      <Text style={[styles.typeChipText, visitType === t.type && { color: t.color }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Specialist free-text */}
                {visitType === 'specialist' && (
                  <>
                    <Text style={styles.fieldLabel}>Specialist Type</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Cardiologist, Orthopedic"
                      placeholderTextColor={Colors.secondaryText}
                      value={specialistType}
                      onChangeText={setSpecialistType}
                      maxLength={100}
                    />
                  </>
                )}

                {/* Visit Date */}
                <Text style={styles.fieldLabel}>Visit Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.secondaryText}
                  value={visitDate}
                  onChangeText={setVisitDate}
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                />

                {/* Doctor Name */}
                <Text style={styles.fieldLabel}>Doctor Name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Smith"
                  placeholderTextColor={Colors.secondaryText}
                  value={doctorName}
                  onChangeText={setDoctorName}
                  maxLength={100}
                />

                {/* Location */}
                <Text style={styles.fieldLabel}>Location / Clinic (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., City Medical Center"
                  placeholderTextColor={Colors.secondaryText}
                  value={location}
                  onChangeText={setLocation}
                  maxLength={200}
                />

                {/* Notes */}
                <Text style={styles.fieldLabel}>Notes (optional, max 500 chars)</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="Any notes about this visit..."
                  placeholderTextColor={Colors.secondaryText}
                  value={notes}
                  onChangeText={setNotes}
                  maxLength={500}
                  multiline
                  numberOfLines={3}
                />

                {/* Follow-up Date */}
                <Text style={styles.fieldLabel}>Follow-up Date (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.secondaryText}
                  value={followUpDate}
                  onChangeText={setFollowUpDate}
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                />

                {/* Save Button */}
                <View style={styles.formActions}>
                  <PremiumButton
                    label={editingId ? 'Update Visit' : 'Save Visit'}
                    onPress={saveVisit}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingBottom: 48 },

  // Follow-up card
  followUpCard: { marginTop: 16 },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  followUpText: { color: Colors.text, fontSize: 14, flex: 1 },

  // List
  listSection: { marginTop: 20 },
  sectionTitle: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  visitCard: { marginBottom: 8 },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitInfo: { flex: 1, marginLeft: 12 },
  visitTypeLabel: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  visitDateText: { color: Colors.secondaryText, fontSize: 13, marginTop: 2 },
  visitDetail: { color: Colors.secondaryText, fontSize: 12, marginTop: 1 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: Colors.secondaryText, fontSize: 13 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.primaryBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },

  // Form fields
  fieldLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.cardBackground,
  },
  typeChipText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  formActions: { marginTop: 24, marginBottom: 32 },
});
