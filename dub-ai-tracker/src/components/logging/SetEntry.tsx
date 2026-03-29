// Set entry component -- weight, reps, RPE per set
// Phase 11: Fitness and Workout Logging

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { ExerciseSet } from '../../types/workout';

interface SetEntryProps {
  set: ExerciseSet;
  onUpdate: (updated: ExerciseSet) => void;
  onDelete: () => void;
  isPR?: boolean;
}

export function SetEntry({ set, onUpdate, onDelete, isPR }: SetEntryProps) {
  const updateField = <K extends keyof ExerciseSet>(field: K, value: ExerciseSet[K]) => {
    onUpdate({ ...set, [field]: value });
  };

  return (
    <View style={[styles.container, set.is_warmup && styles.warmupContainer]}>
      <View style={styles.header}>
        <View style={styles.setNumContainer}>
          <Text style={styles.setNum}>
            {set.is_warmup ? 'W' : set.set_number}
          </Text>
        </View>

        {isPR && (
          <View style={styles.prBadge}>
            <Ionicons name="trophy" size={12} color={Colors.primaryBackground} />
            <Text style={styles.prText}>PR</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.warmupToggle}
          onPress={() => updateField('is_warmup', !set.is_warmup)}
        >
          <Text style={[styles.warmupText, set.is_warmup && styles.warmupTextActive]}>
            Warmup
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fieldsRow}>
        {/* Weight */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Weight</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.fieldInput}
              value={set.weight > 0 ? String(set.weight) : ''}
              onChangeText={(t) => updateField('weight', parseFloat(t) || 0)}
              placeholder="0"
              placeholderTextColor={Colors.secondaryText}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.unitBtn}
              onPress={() =>
                updateField('weight_unit', set.weight_unit === 'lbs' ? 'kg' : 'lbs')
              }
            >
              <Text style={styles.unitText}>{set.weight_unit}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reps */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Reps</Text>
          <TextInput
            style={styles.fieldInput}
            value={set.reps > 0 ? String(set.reps) : ''}
            onChangeText={(t) => updateField('reps', parseInt(t, 10) || 0)}
            placeholder="0"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="number-pad"
          />
        </View>

        {/* RPE */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>RPE</Text>
          <TextInput
            style={styles.fieldInput}
            value={set.rpe !== null ? String(set.rpe) : ''}
            onChangeText={(t) => {
              const val = parseFloat(t);
              updateField('rpe', isNaN(val) ? null : Math.min(10, Math.max(1, val)));
            }}
            placeholder="--"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="close-circle" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  warmupContainer: {
    opacity: 0.7,
    borderLeftWidth: 3,
    borderLeftColor: Colors.secondaryText,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  setNumContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNum: {
    color: Colors.primaryBackground,
    fontSize: 13,
    fontWeight: '700',
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prText: {
    color: Colors.primaryBackground,
    fontSize: 10,
    fontWeight: '700',
  },
  warmupToggle: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupText: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '500',
  },
  warmupTextActive: {
    color: Colors.accent,
  },
  fieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  fieldGroup: {
    flex: 1,
  },
  fieldLabel: {
    color: Colors.secondaryText,
    fontSize: 10,
    marginBottom: 3,
  },
  fieldInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 4,
  },
  unitBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  unitText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
