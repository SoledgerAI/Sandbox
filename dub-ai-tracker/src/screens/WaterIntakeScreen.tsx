import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { ProgressRing } from '../components/ProgressRing';
import { useWaterLog } from '../hooks/useWaterLog';
import { formatTime } from '../utils/date';

const QUICK_ADD = [
  { label: '+4 oz', amount: 4 },
  { label: '+8 oz', amount: 8 },
  { label: '+16 oz', amount: 16 },
];

export function WaterIntakeScreen() {
  const { entries, totalOz, goal, progress, loading, addWater, undoLast } =
    useWaterLog();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Progress Ring */}
      <View style={styles.ringSection}>
        <ProgressRing
          progress={progress}
          size={220}
          strokeWidth={14}
          label={`${totalOz} / ${goal} oz`}
          sublabel="today"
        />
      </View>

      {/* Quick Add Buttons */}
      <View style={styles.buttonRow}>
        {QUICK_ADD.map((item) => (
          <TouchableOpacity
            key={item.amount}
            style={styles.addButton}
            onPress={() => addWater(item.amount)}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Undo Button */}
      <TouchableOpacity
        style={[styles.undoButton, entries.length === 0 && styles.undoDisabled]}
        onPress={undoLast}
        disabled={entries.length === 0}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.undoText,
            entries.length === 0 && styles.undoTextDisabled,
          ]}
        >
          Undo Last
        </Text>
      </TouchableOpacity>

      {/* Timeline */}
      <View style={styles.timeline}>
        <Text style={styles.timelineTitle}>Today&apos;s Log</Text>
        {entries.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet. Start drinking!</Text>
        ) : (
          [...entries].reverse().map((entry) => (
            <View key={entry.id} style={styles.timelineEntry}>
              <View style={styles.dot} />
              <View style={styles.entryInfo}>
                <Text style={styles.entryAmount}>+{entry.amount} oz</Text>
                <Text style={styles.entryTime}>
                  {formatTime(entry.timestamp)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBackground,
  },
  content: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  ringSection: {
    marginVertical: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  addButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  undoButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  undoDisabled: {
    opacity: 0.4,
  },
  undoText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  undoTextDisabled: {
    color: '#555',
  },
  timeline: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 24,
  },
  timelineTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  timelineEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    marginRight: 12,
  },
  entryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  entryAmount: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  entryTime: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
});
