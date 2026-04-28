// S33-A: Pain logger — chip-based, ongoing-state.
// Distinct from InjuryLogger (acute event-shaped). Reuses the
// JointPainArea taxonomy from src/types/index.ts.

import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useToast } from '../../contexts/ToastContext';
import { TimestampPicker } from '../common/TimestampPicker';
import { savePainEntry } from '../../services/painLogService';
import {
  PAIN_CHIP_DISPLAY,
  PAIN_CHIPS_ORDERED,
  PAIN_SEVERITY_LABELS,
} from '../../constants/painChips';
import type { JointPainArea, PainSeverity } from '../../types';

const NOTES_MAX = 500;

const SEVERITY_VALUES: PainSeverity[] = [1, 2, 3, 4, 5];
const DURATION_VALUES: number[] = Array.from({ length: 365 }, (_, i) => i + 1);

export function PainLogger() {
  const { showToast } = useToast();
  const [areas, setAreas] = useState<JointPainArea[]>([]);
  const [severity, setSeverity] = useState<PainSeverity>(2);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [durationKnown, setDurationKnown] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [entryTimestamp, setEntryTimestamp] = useState<Date>(new Date());
  const [saving, setSaving] = useState<boolean>(false);

  const toggleArea = useCallback((area: JointPainArea) => {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (areas.length === 0) {
      Alert.alert('Pick at least one area', 'Tap a chip to mark where it hurts.');
      return;
    }
    setSaving(true);
    try {
      await savePainEntry({
        areas,
        severity,
        ...(durationKnown ? { duration_days: durationDays } : {}),
        ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
        timestamp: entryTimestamp.getTime(),
      });
      showToast('Pain logged', 'success');
      // Reset for next entry
      setAreas([]);
      setSeverity(2);
      setDurationDays(7);
      setDurationKnown(true);
      setNotes('');
      setEntryTimestamp(new Date());
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }, [areas, severity, durationDays, durationKnown, notes, entryTimestamp, showToast]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Where? */}
        <Text style={styles.sectionTitle}>Where?</Text>
        <View style={styles.chipRow}>
          {PAIN_CHIPS_ORDERED.map((area) => {
            const selected = areas.includes(area);
            return (
              <TouchableOpacity
                key={area}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleArea(area)}
                activeOpacity={0.7}
                testID={`pain-chip-${area}`}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                  {PAIN_CHIP_DISPLAY[area].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* How bad? */}
        <Text style={styles.sectionTitle}>How bad?</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={severity}
            onValueChange={(v) => setSeverity(Number(v) as PainSeverity)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            testID="pain-severity-picker"
          >
            {SEVERITY_VALUES.map((v) => (
              <Picker.Item
                key={v}
                label={`${v} — ${PAIN_SEVERITY_LABELS[v]}`}
                value={v}
              />
            ))}
          </Picker>
        </View>

        {/* How long? */}
        <Text style={styles.sectionTitle}>How long?</Text>
        <View style={styles.durationRow}>
          <TouchableOpacity
            style={[styles.durationToggle, !durationKnown && styles.durationToggleSelected]}
            onPress={() => setDurationKnown(false)}
            activeOpacity={0.7}
          >
            <Text style={[styles.durationToggleLabel, !durationKnown && styles.durationToggleLabelSelected]}>
              Just today / Not sure
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.durationToggle, durationKnown && styles.durationToggleSelected]}
            onPress={() => setDurationKnown(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.durationToggleLabel, durationKnown && styles.durationToggleLabelSelected]}>
              Days ongoing
            </Text>
          </TouchableOpacity>
        </View>
        {durationKnown && (
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={durationDays}
              onValueChange={(v) => setDurationDays(Number(v))}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              testID="pain-duration-picker"
            >
              {DURATION_VALUES.map((v) => (
                <Picker.Item key={v} label={`${v} day${v === 1 ? '' : 's'}`} value={v} />
              ))}
            </Picker>
          </View>
        )}

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={(t) => setNotes(t.slice(0, NOTES_MAX))}
          placeholder="Anything else worth noting?"
          placeholderTextColor={Colors.secondaryText}
          multiline
          numberOfLines={3}
          maxLength={NOTES_MAX}
        />
        <Text style={styles.notesCount}>{notes.length} / {NOTES_MAX}</Text>

        {/* Manual timestamp override (standing rule §1.8) */}
        <TimestampPicker value={entryTimestamp} onChange={setEntryTimestamp} />

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, (areas.length === 0 || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={areas.length === 0 || saving}
          activeOpacity={0.7}
          testID="pain-save-btn"
        >
          <Ionicons name="checkmark-circle" size={22} color={Colors.primaryBackground} />
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
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
    marginTop: 16,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  chipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  pickerWrapper: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  picker: {
    color: Colors.text,
  },
  pickerItem: {
    color: Colors.text,
    fontSize: 16,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  durationToggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  durationToggleSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  durationToggleLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  durationToggleLabelSelected: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    color: Colors.text,
    fontSize: 14,
    padding: 12,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  notesCount: {
    color: Colors.secondaryText,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    color: Colors.primaryBackground,
    fontSize: 17,
    fontWeight: '700',
  },
});
