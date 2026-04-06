// Shared timestamp picker for all log entry forms (F-01 remediation)
// Displays a tappable row showing the selected date/time.
// Tapping opens a scroll-wheel picker. Defaults to "now."
// Future timestamps are blocked.

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface TimestampPickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

function formatReadable(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${month} ${day}, ${year} at ${time}`;
}

export function TimestampPicker({ value, onChange }: TimestampPickerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        accessibilityLabel="Change date and time"
        accessibilityRole="button"
      >
        <View style={styles.left}>
          <Ionicons name="time-outline" size={18} color={Colors.accent} />
          <Text style={styles.label}>{formatReadable(value)}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.secondaryText}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.pickerContainer}>
          <RNDateTimePicker
            value={value}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_event, selectedDate) => {
              if (Platform.OS === 'android') {
                setExpanded(false);
              }
              if (selectedDate) {
                onChange(selectedDate);
              }
            }}
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
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '500',
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
