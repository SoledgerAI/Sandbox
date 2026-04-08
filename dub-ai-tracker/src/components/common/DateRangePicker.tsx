// Reusable date range picker with presets and custom date selection
// Task 22: Report Enhancements — custom date range picker

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/colors';

interface DateRangePreset {
  label: string;
  days: number;
}

const DEFAULT_PRESETS: DateRangePreset[] = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '6M', days: 182 },
  { label: '1Y', days: 365 },
];

export interface DateRangePickerProps {
  currentRange: { start: Date; end: Date };
  onRangeChange: (range: { start: Date; end: Date }) => void;
  presets?: DateRangePreset[];
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DateRangePicker({
  currentRange,
  onRangeChange,
  presets = DEFAULT_PRESETS,
}: DateRangePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(currentRange.start);
  const [customEnd, setCustomEnd] = useState(currentRange.end);
  const [editingField, setEditingField] = useState<'start' | 'end'>('start');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handlePresetSelect = useCallback(
    (days: number) => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      onRangeChange({ start, end });
      setShowCustom(false);
      setModalVisible(false);
    },
    [onRangeChange],
  );

  const handleApplyCustom = useCallback(() => {
    if (customStart >= customEnd) {
      setValidationError('Start date must be before end date.');
      return;
    }
    setValidationError(null);
    onRangeChange({ start: customStart, end: customEnd });
    setModalVisible(false);
    setShowCustom(false);
  }, [customStart, customEnd, onRangeChange]);

  const handleDateChange = useCallback(
    (_event: unknown, date?: Date) => {
      if (!date) return;
      if (editingField === 'start') {
        setCustomStart(date);
      } else {
        setCustomEnd(date);
      }
      setValidationError(null);
    },
    [editingField],
  );

  const displayLabel = `${formatDateShort(currentRange.start)} — ${formatDateShort(currentRange.end)}`;

  return (
    <>
      <Pressable
        style={styles.displayButton}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Date range: ${displayLabel}. Tap to change.`}
      >
        <Text style={styles.displayText}>{displayLabel}</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select Date Range</Text>

            {/* Preset buttons */}
            <View style={styles.presetRow}>
              {presets.map((preset) => (
                <Pressable
                  key={preset.label}
                  style={styles.presetButton}
                  onPress={() => handlePresetSelect(preset.days)}
                >
                  <Text style={styles.presetText}>{preset.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Custom toggle */}
            <Pressable
              style={[styles.presetButton, showCustom && styles.presetButtonActive]}
              onPress={() => setShowCustom(!showCustom)}
            >
              <Text style={[styles.presetText, showCustom && styles.presetTextActive]}>
                Custom
              </Text>
            </Pressable>

            {/* Custom date pickers */}
            {showCustom && (
              <View style={styles.customSection}>
                <View style={styles.dateFieldRow}>
                  <Pressable
                    style={[
                      styles.dateFieldButton,
                      editingField === 'start' && styles.dateFieldButtonActive,
                    ]}
                    onPress={() => setEditingField('start')}
                  >
                    <Text style={styles.dateFieldLabel}>Start</Text>
                    <Text style={styles.dateFieldValue}>
                      {formatDateShort(customStart)}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.dateFieldButton,
                      editingField === 'end' && styles.dateFieldButtonActive,
                    ]}
                    onPress={() => setEditingField('end')}
                  >
                    <Text style={styles.dateFieldLabel}>End</Text>
                    <Text style={styles.dateFieldValue}>
                      {formatDateShort(customEnd)}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.pickerContainer}>
                  <RNDateTimePicker
                    value={editingField === 'start' ? customStart : customEnd}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    textColor={Colors.text}
                  />
                </View>

                {validationError && (
                  <Text style={styles.errorText}>{validationError}</Text>
                )}

                <Pressable style={styles.applyButton} onPress={handleApplyCustom}>
                  <Text style={styles.applyButtonText}>Apply</Text>
                </Pressable>
              </View>
            )}

            {/* Close button */}
            <Pressable
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  displayButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  displayText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.primaryBackground,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  presetButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  presetText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  presetTextActive: {
    color: Colors.primaryBackground,
  },
  customSection: {
    marginTop: 12,
  },
  dateFieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateFieldButton: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 48,
  },
  dateFieldButtonActive: {
    borderColor: Colors.accent,
  },
  dateFieldLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginBottom: 4,
  },
  dateFieldValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  errorText: {
    color: Colors.dangerText,
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  applyButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  applyButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  closeButtonText: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
});
