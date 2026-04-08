// DateContextBanner — Prompt 14: Missed-Day Backfill Logging
// Persistent banner at top of log screens when backfilling a past date.
// Gold (#D4A843) at 15% opacity background, calendar icon, date display, close button.

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../constants/colors';
import { useDateContext } from '../hooks/useDateContext';
import { router } from 'expo-router';

function formatBannerDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

export function DateContextBanner() {
  const { activeDate, isBackfilling, setActiveDate, resetToToday } = useDateContext();
  const [showPicker, setShowPicker] = useState(false);

  if (!isBackfilling) return null;

  const handleClose = () => {
    resetToToday();
    router.replace('/(tabs)');
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setActiveDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  const pickerDate = new Date(activeDate + 'T12:00:00');

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Ionicons name="calendar-outline" size={18} color={Colors.accent} />

        <TouchableOpacity
          style={styles.dateTextWrap}
          onPress={() => setShowPicker(!showPicker)}
          activeOpacity={0.7}
          accessibilityLabel="Change backfill date"
          accessibilityRole="button"
        >
          <Text style={styles.dateText}>
            Logging for {formatBannerDate(activeDate)}
          </Text>
          <Ionicons
            name={showPicker ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.accentText}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleClose}
          hitSlop={12}
          style={styles.closeBtn}
          accessibilityLabel="Return to today"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {showPicker && (
        <View style={styles.pickerWrap}>
          <RNDateTimePicker
            value={pickerDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={handleDateChange}
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
    marginBottom: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  dateTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerWrap: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    marginTop: 4,
    paddingVertical: 8,
  },
});
