// Daily Habits Checklist — Sprint 16
// Binary toggle list with gold checkmark, user-customizable habits.
// S33-B: cadence-aware. Off-day habits don't render in main list; "Show
// all" toggle reveals them as visually distinct, non-tappable.

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { TimestampPicker } from '../common/TimestampPicker';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { HabitEntry, HabitDefinition } from '../../types';
import { DEFAULT_HABITS, normalizeHabit } from '../../types';
import { isDueOnDate, describeRule } from '../../utils/cadence';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { getActiveDate } from '../../services/dateContextService';

function generateId(): string {
  return `habit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Load habit definitions from settings, or return defaults. Read-time
 *  normalization (S33-B) ensures cadence is always populated. */
export async function loadHabitDefinitions(): Promise<HabitDefinition[]> {
  const stored = await storageGet<HabitDefinition[]>(STORAGE_KEYS.SETTINGS_HABITS);
  if (stored && stored.length > 0) return stored.map(normalizeHabit);
  // Initialize with defaults (Sprint 16 bathroom routine, all daily).
  const defaults: HabitDefinition[] = DEFAULT_HABITS.map((h, i) => ({
    id: generateId() + '_' + i,
    name: h.name,
    order: h.order,
    cadence: { kind: 'daily' },
  }));
  await storageSet(STORAGE_KEYS.SETTINGS_HABITS, defaults);
  return defaults;
}

function activeDateAsDate(): Date {
  const s = getActiveDate();
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Load today's habit entries, merging only due-today definitions. */
async function loadTodayHabits(definitions: HabitDefinition[]): Promise<HabitEntry[]> {
  const today = getActiveDate();
  const todayDate = activeDateAsDate();
  const key = dateKey(STORAGE_KEYS.LOG_HABITS, today);
  const stored = await storageGet<HabitEntry[]>(key);

  return definitions
    .filter((def) => !def.archived && isDueOnDate(normalizeHabit(def).cadence, todayDate))
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
  const [timestamp, setTimestamp] = useState(new Date());
  const [showAll, setShowAll] = useState(false);
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

  const offDayDefs = useMemo(() => {
    const todayDate = activeDateAsDate();
    return definitions
      .filter((d) => !d.archived && !isDueOnDate(normalizeHabit(d).cadence, todayDate))
      .sort((a, b) => a.order - b.order);
  }, [definitions]);

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

      const today = getActiveDate();
      const key = dateKey(STORAGE_KEYS.LOG_HABITS, today);
      storageSet(key, updated);

      return updated;
    });

    const anim = getScaleAnim(habitId);
    const target = habits.find((h) => h.id === habitId);
    if (target && !target.completed) {
      hapticSuccess();
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.3, duration: 120, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
    } else {
      hapticSelection();
    }
  }, [habits, getScaleAnim]);

  const completedCount = habits.filter((h) => h.completed).length;
  const totalCount = habits.length;
  const nothingDueToday = totalCount === 0 && definitions.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TimestampPicker value={timestamp} onChange={setTimestamp} />
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
        {definitions.length === 0 ? (
          <Text style={styles.emptyText}>
            No habits configured. Go to Profile {'>'} Daily Habits to add some.
          </Text>
        ) : nothingDueToday ? (
          <Text style={styles.emptyText}>
            Nothing scheduled today. Enjoy the day off.
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

      {/* Show-all toggle for off-day habits */}
      {offDayDefs.length > 0 && (
        <TouchableOpacity
          onPress={() => setShowAll((v) => !v)}
          style={styles.showAllRow}
          accessibilityLabel={showAll ? 'Hide off-schedule habits' : 'Show all habits'}
        >
          <Ionicons
            name={showAll ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.secondaryText}
          />
          <Text style={styles.showAllText}>
            {showAll ? 'Hide off-schedule habits' : `Show all habits (+${offDayDefs.length})`}
          </Text>
        </TouchableOpacity>
      )}

      {showAll && offDayDefs.length > 0 && (
        <PremiumCard>
          {offDayDefs.map((def) => {
            const norm = normalizeHabit(def);
            return (
              <View key={def.id} style={[styles.habitRow, styles.habitRowDimmed]}>
                <Ionicons name="ellipse-outline" size={26} color={Colors.divider} />
                <View style={styles.offDayTextWrap}>
                  <Text style={[styles.habitName, styles.habitNameDimmed]}>
                    {def.name}
                  </Text>
                  <Text style={styles.cadenceBadge}>{describeRule(norm.cadence)}</Text>
                </View>
              </View>
            );
          })}
        </PremiumCard>
      )}
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
  habitRowDimmed: {
    opacity: 0.55,
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
  habitNameDimmed: {
    color: Colors.secondaryText,
  },
  habitTime: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  showAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
  },
  showAllText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  offDayTextWrap: {
    flex: 1,
  },
  cadenceBadge: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
