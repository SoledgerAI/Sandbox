// Reusable DateTimePicker with spinner display (iOS scroll wheel)
// Task B: Prompt 07 v2

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface DateTimePickerProps {
  mode: 'date' | 'time' | 'datetime';
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  label: string;
  optional?: boolean;
}

function formatDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function DateTimePicker({
  mode,
  value,
  onChange,
  minimumDate,
  maximumDate,
  label,
  optional,
}: DateTimePickerProps) {
  const [expanded, setExpanded] = useState(false);

  const displayValue =
    mode === 'date'
      ? formatDate(value)
      : mode === 'time'
        ? formatTime(value)
        : formatDateTime(value);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}> (optional)</Text> : null}
        </Text>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{displayValue}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.secondaryText}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.pickerContainer}>
          <RNDateTimePicker
            value={value}
            mode={mode === 'datetime' ? 'datetime' : mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, selectedDate) => {
              if (Platform.OS === 'android') {
                setExpanded(false);
              }
              if (selectedDate) {
                onChange(selectedDate);
              }
            }}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            textColor={Colors.text}
            themeVariant="dark"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
  },
  label: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  optional: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '400',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    color: Colors.accentText,
    fontSize: 15,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: Colors.cardBackground,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginTop: -10,
    paddingTop: 10,
    paddingBottom: 8,
  },
});
