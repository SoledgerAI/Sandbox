// Daily Habits Checklist — Sprint 16
// Binary toggle list with gold checkmark, user-customizable habits

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { HabitEntry, HabitDefinition } from '../../types';
import { DEFAULT_HABITS } from '../../types';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { getActiveDate } from '../../services/dateContextService';

function generateId(): string {
  return `habit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Load habit definitions from settings, or return defaults */
export async function loadHabitDefinitions(): Promise<HabitDefinition[]> {
  const stored = await storageGet<HabitDefinition[]>(STORAGE_KEYS.SETTINGS_HABITS);
  if (stored && stored.length > 0) return stored;
  // Initialize with defaults
  const defaults: HabitDefinition[] = DEFAULT_HABITS.map((h, i) => ({
    id: generateId() + '_' + i,
    name: h.name,
    order: h.order,
  }));
  await storageSet(STORAGE_KEYS.SETTINGS_HABITS, defaults);
  return defaults;
}

/** Load today's habit entries, merging with current definitions */
async function loadTodayHabits(definitions: HabitDefinition[]): Promise<HabitEntry[]> {
  const today = getActiveDate();
  const key = dateKey(STORAGE_KEYS.LOG_HABITS, today);
  const stored = await storageGet<HabitEntry[]>(key);

  // Merge: keep completed state for existing habits, add new ones
  return definitions
    .sort((a, b) => a.order - b.order)
    .map((def) => {
      const existing = stored?.find((h) => h.id === def.id);
      return {
        id: def.id,
        name: def.name,
        completed: existing?.completed ?? false,
        completedAt: existing?.completedAt ?? null,
      };
    });
}

export function HabitsChecklist() {
  const [habits, setHabits] = useState<HabitEntry[]>([]);
  const [definitions, setDefinitions] = useState<HabitDefinition[]>([]);
  // Track animation values per habit
  const [scaleAnims] = useState<Map<string, Animated.Value>>(new Map());

  const getScaleAnim = useCallback((id: string): Animated.Value => {
    if (!scaleAnims.has(id)) {
      scaleAnims.set(id, new Animated.Value(1));
    }
    return scaleAnims.get(id)!;
  }, [scaleAnims]);

  const loadData = useCallback(async () => {
    const defs = await loadHabitDefinitions();
    setDefinitions(defs);
    const todayHabits = await loadTodayHabits(defs);
    setHabits(todayHabits);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveHabits = useCallback(async (updated: HabitEntry[]) => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_HABITS, today);
    await storageSet(key, updated);
    setHabits(updated);
  }, []);

  const toggleHabit = useCallback((habitId: string) => {
    setHabits((prev) => {
      const updated = prev.map((h) => {
        if (h.id !== habitId) return h;
        const nowCompleted = !h.completed;
        return {
          ...h,
          completed: nowCompleted,
          completedAt: nowCompleted ? new Date().toISOString() : null,
        };
      });

      // Save async
      const today = getActiveDate();
      const key = dateKey(STORAGE_KEYS.LOG_HABITS, today);
      storageSet(key, updated);

      return updated;
    });

    // Animate the checkmark
    const anim = getScaleAnim(habitId);
    const target = habits.find((h) => h.id === habitId);
    if (target && !target.completed) {
      // Completing — bounce animation + success haptic
      hapticSuccess();
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.3, duration: 120, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
    } else {
      // Uncompleting
      hapticSelection();
    }
  }, [habits, getScaleAnim]);

  const completedCount = habits.filter((h) => h.completed).length;
  const totalCount = habits.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Summary */}
      <PremiumCard>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryValue}>
            {completedCount}/{totalCount}
          </Text>
          <Text style={styles.summaryLabel}>habits today</Text>
        </View>
        {completedCount === totalCount && totalCount > 0 && (
          <Text style={styles.allDoneText}>All done! Great job.</Text>
        )}
      </PremiumCard>

      {/* Habit List */}
      <PremiumCard>
        {habits.length === 0 ? (
          <Text style={styles.emptyText}>
            No habits configured. Go to Profile {'>'} Daily Habits to add some.
          </Text>
        ) : (
          habits.map((habit) => {
            const scaleAnim = getScaleAnim(habit.id);
            return (
              <TouchableOpacity
                key={habit.id}
                style={[
                  styles.habitRow,
                  habit.completed && styles.habitRowCompleted,
                ]}
                onPress={() => toggleHabit(habit.id)}
                activeOpacity={0.7}
              >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Ionicons
                    name={habit.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={habit.completed ? Colors.accent : Colors.secondaryText}
                  />
                </Animated.View>
                <Text
                  style={[
                    styles.habitName,
                    habit.completed && styles.habitNameCompleted,
                    !habit.completed && styles.habitNameIncomplete,
                  ]}
                >
                  {habit.name}
                </Text>
                {habit.completedAt && (
                  <Text style={styles.habitTime}>
                    {new Date(habit.completedAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </PremiumCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  summaryRow: {
    alignItems: 'center',
  },
  summaryValue: {
    color: Colors.accent,
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  allDoneText: {
    color: Colors.successText,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  habitRowCompleted: {
    opacity: 1,
  },
  habitName: {
    flex: 1,
    fontSize: 15,
  },
  habitNameCompleted: {
    color: Colors.accentText,
    fontWeight: '600',
  },
  habitNameIncomplete: {
    color: Colors.secondaryText,
  },
  habitTime: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
});
