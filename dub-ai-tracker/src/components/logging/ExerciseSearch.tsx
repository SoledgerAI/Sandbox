// Exercise search component -- search with muscle group and equipment filters
// Phase 11: Fitness and Workout Logging

import { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import exerciseDb from '../../data/exercises.json';
import muscleGroupData from '../../data/muscle_groups.json';
import equipmentData from '../../data/equipment.json';

export interface ExerciseItem {
  id: string;
  name: string;
  primary: string[];
  secondary: string[];
  equipment: string;
}

interface ExerciseSearchProps {
  onSelect: (exercise: ExerciseItem) => void;
  onClose: () => void;
}

export function ExerciseSearch({ onSelect, onClose }: ExerciseSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);

  const exercises = exerciseDb.exercises as ExerciseItem[];
  const muscleGroups = muscleGroupData.muscle_groups;
  const equipment = equipmentData.equipment;

  const filtered = useMemo(() => {
    let results = exercises;

    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      results = results.filter((ex) => ex.name.toLowerCase().includes(lowerQuery));
    }

    if (selectedMuscle) {
      results = results.filter(
        (ex) =>
          ex.primary.includes(selectedMuscle) || ex.secondary.includes(selectedMuscle),
      );
    }

    if (selectedEquipment) {
      results = results.filter((ex) => ex.equipment === selectedEquipment);
    }

    return results.slice(0, 50);
  }, [query, selectedMuscle, selectedEquipment, exercises]);

  const clearFilters = useCallback(() => {
    setSelectedMuscle(null);
    setSelectedEquipment(null);
    setQuery('');
  }, []);

  const getMuscleLabel = (id: string) =>
    muscleGroups.find((m) => m.id === id)?.name ?? id;
  const getEquipmentLabel = (id: string) =>
    equipment.find((e) => e.id === id)?.name ?? id;

  const renderExercise = useCallback(
    ({ item }: { item: ExerciseItem }) => (
      <TouchableOpacity
        style={styles.exerciseRow}
        onPress={() => onSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <Text style={styles.exerciseMeta}>
            {item.primary.map(getMuscleLabel).join(', ')}
            {' \u00B7 '}
            {getEquipmentLabel(item.equipment)}
          </Text>
        </View>
        <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
      </TouchableOpacity>
    ),
    [onSelect],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Select Exercise</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search input */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.secondaryText} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises..."
          placeholderTextColor={Colors.secondaryText}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Muscle group filter */}
      <Text style={styles.filterLabel}>Muscle Group</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {muscleGroups.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.filterChip, selectedMuscle === m.id && styles.filterChipActive]}
            onPress={() => setSelectedMuscle(selectedMuscle === m.id ? null : m.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedMuscle === m.id && styles.filterChipTextActive,
              ]}
            >
              {m.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Equipment filter */}
      <Text style={styles.filterLabel}>Equipment</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {equipment.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={[
              styles.filterChip,
              selectedEquipment === e.id && styles.filterChipActive,
            ]}
            onPress={() =>
              setSelectedEquipment(selectedEquipment === e.id ? null : e.id)
            }
          >
            <Text
              style={[
                styles.filterChipText,
                selectedEquipment === e.id && styles.filterChipTextActive,
              ]}
            >
              {e.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Active filters */}
      {(selectedMuscle || selectedEquipment) && (
        <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
          <Ionicons name="close-circle" size={14} color={Colors.accent} />
          <Text style={styles.clearBtnText}>Clear filters</Text>
        </TouchableOpacity>
      )}

      {/* Results count */}
      <Text style={styles.resultsCount}>
        {filtered.length} exercise{filtered.length !== 1 ? 's' : ''}
        {filtered.length === 50 ? '+' : ''}
      </Text>

      {/* Exercise list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderExercise}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  filterLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  filterScroll: {
    marginBottom: 10,
    maxHeight: 36,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipText: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.primaryBackground,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  clearBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  resultsCount: {
    color: Colors.secondaryText,
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseMeta: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
});
