// Daily Habits Settings — Sprint 16
// Add, remove, rename, reorder custom habit definitions

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { PremiumButton } from '../../src/components/common/PremiumButton';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import type { HabitDefinition } from '../../src/types';
import { loadHabitDefinitions } from '../../src/components/logging/HabitsChecklist';
import { hapticSuccess, hapticMedium, hapticWarning } from '../../src/utils/haptics';
import { useToast } from '../../src/contexts/ToastContext';

function generateId(): string {
  return `habit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function HabitsSettingsScreen() {
  const [habits, setHabits] = useState<HabitDefinition[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const defs = await loadHabitDefinitions();
    setHabits(defs.sort((a, b) => a.order - b.order));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveHabits = useCallback(async (updated: HabitDefinition[]) => {
    // Re-index order
    const reordered = updated.map((h, i) => ({ ...h, order: i }));
    await storageSet(STORAGE_KEYS.SETTINGS_HABITS, reordered);
    setHabits(reordered);
  }, []);

  const addHabit = useCallback(() => {
    const name = newHabitName.trim();
    if (!name) return;
    if (habits.some((h) => h.name.toLowerCase() === name.toLowerCase())) {
      showToast('Habit already exists', 'error');
      return;
    }
    const newHabit: HabitDefinition = {
      id: generateId(),
      name,
      order: habits.length,
    };
    const updated = [...habits, newHabit];
    saveHabits(updated);
    setNewHabitName('');
    hapticSuccess();
    showToast(`Added "${name}"`, 'success');
  }, [newHabitName, habits, saveHabits, showToast]);

  const removeHabit = useCallback((id: string) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    hapticWarning();
    Alert.alert(
      'Remove Habit',
      `Remove "${habit.name}" from your daily habits?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = habits.filter((h) => h.id !== id);
            saveHabits(updated);
            showToast(`Removed "${habit.name}"`, 'info');
          },
        },
      ],
    );
  }, [habits, saveHabits, showToast]);

  const startEditing = useCallback((habit: HabitDefinition) => {
    setEditingId(habit.id);
    setEditingName(habit.name);
  }, []);

  const finishEditing = useCallback(() => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    const updated = habits.map((h) =>
      h.id === editingId ? { ...h, name } : h,
    );
    saveHabits(updated);
    setEditingId(null);
    hapticMedium();
  }, [editingId, editingName, habits, saveHabits]);

  const onDragEnd = useCallback(
    ({ data }: { data: HabitDefinition[] }) => {
      saveHabits(data);
      hapticMedium();
    },
    [saveHabits],
  );

  const renderItem = useCallback(
    ({ item: habit, drag, isActive }: RenderItemParams<HabitDefinition>) => (
      <ScaleDecorator>
        <View style={[styles.habitRow, isActive && styles.habitRowActive]}>
          {/* Drag handle */}
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={150}
            disabled={isActive}
            hitSlop={8}
            style={styles.gripBtn}
            accessibilityLabel="Drag to reorder"
          >
            <Ionicons name="reorder-three" size={22} color={Colors.secondaryText} />
          </TouchableOpacity>

          {/* Name (editable) */}
          {editingId === habit.id ? (
            <TextInput
              style={styles.editInput}
              value={editingName}
              onChangeText={setEditingName}
              onBlur={finishEditing}
              onSubmitEditing={finishEditing}
              autoFocus
              maxLength={50}
            />
          ) : (
            <TouchableOpacity
              style={styles.nameWrap}
              onPress={() => startEditing(habit)}
              activeOpacity={0.7}
            >
              <Text style={styles.habitName}>{habit.name}</Text>
              <Ionicons name="create-outline" size={14} color={Colors.secondaryText} />
            </TouchableOpacity>
          )}

          {/* Delete */}
          <TouchableOpacity
            onPress={() => removeHabit(habit.id)}
            hitSlop={8}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.dangerText} />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    ),
    [editingId, editingName, finishEditing, removeHabit, startEditing],
  );

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Daily Habits</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Add new habit */}
          <PremiumCard>
            <Text style={styles.sectionTitle}>Add Custom Habit</Text>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={newHabitName}
                onChangeText={setNewHabitName}
                placeholder="Habit name..."
                placeholderTextColor={Colors.secondaryText}
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={addHabit}
              />
              <PremiumButton
                label="Add"
                onPress={addHabit}
                size="small"
                disabled={!newHabitName.trim()}
              />
            </View>
          </PremiumCard>

          {/* Habit list */}
          <PremiumCard>
            <Text style={styles.sectionTitle}>
              Your Habits ({habits.length})
            </Text>
            <Text style={styles.hintText}>Hold and drag to reorder.</Text>
            {habits.length === 0 ? (
              <Text style={styles.emptyText}>No habits yet. Add one above.</Text>
            ) : (
              <DraggableFlatList
                data={habits}
                onDragEnd={onDragEnd}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                scrollEnabled={false}
                activationDistance={8}
              />
            )}
          </PremiumCard>
        </ScrollView>
      </View>
    </ScreenWrapper>
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
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 8,
    backgroundColor: Colors.primaryBackground,
  },
  habitRowActive: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
  },
  gripBtn: {
    padding: 6,
  },
  hintText: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  nameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  habitName: {
    color: Colors.text,
    fontSize: 15,
    flex: 1,
  },
  editInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  deleteBtn: {
    padding: 6,
  },
});
