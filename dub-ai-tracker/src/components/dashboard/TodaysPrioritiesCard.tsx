// Sprint 25: Today's Priorities Card
// Shows top 3-5 unlogged items from compliance goals

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import type { ComplianceResult, DailyGoalId } from '../../types';

interface TodaysPrioritiesCardProps {
  compliance: ComplianceResult | null;
}

const GOAL_ROUTES: Partial<Record<DailyGoalId, string>> = {
  log_food: '/log/food',
  hit_calorie_target: '/log/food',
  hit_protein_target: '/log/food',
  log_water: '/log/water',
  exercise: '/log/workout',
  pushups: '/log/reps',
  pullups: '/log/reps',
  situps: '/log/reps',
  log_weight: '/log/body',
  log_sleep: '/log/sleep',
  take_supplements: '/log/supplements',
  complete_habits: '/log/habits',
  meditate: '/log/meditation',
  mood_logged: '/log/mood_mental',
  medications_logged: '/log/medications',
  cycle_logged: '/log/cycle',
  journal: '/log/journal',
};

const GOAL_ICONS: Partial<Record<DailyGoalId, string>> = {
  log_food: 'restaurant-outline',
  hit_calorie_target: 'flame-outline',
  hit_protein_target: 'barbell-outline',
  log_water: 'water-outline',
  exercise: 'bicycle-outline',
  log_weight: 'scale-outline',
  log_sleep: 'moon-outline',
  take_supplements: 'medkit-outline',
  complete_habits: 'checkbox-outline',
  meditate: 'leaf-outline',
  mood_logged: 'happy-outline',
  medications_logged: 'medical-outline',
  cycle_logged: 'flower-outline',
  journal: 'book-outline',
};

export function TodaysPrioritiesCard({ compliance }: TodaysPrioritiesCardProps) {
  if (!compliance || compliance.total === 0) return null;

  const unloggedItems = compliance.items.filter((i) => !i.completed).slice(0, 5);
  const allComplete = unloggedItems.length === 0;

  return (
    <PremiumCard style={allComplete ? styles.goldBorder : undefined}>
      <Text style={styles.title}>
        {allComplete ? '\u{2728} All Goals Met!' : "Today's Priorities"}
      </Text>

      {allComplete ? (
        <Text style={styles.congratsText}>
          Great work! You've completed all your daily goals.
        </Text>
      ) : (
        <View style={styles.itemList}>
          {unloggedItems.map((item) => {
            const route = GOAL_ROUTES[item.id];
            const icon = GOAL_ICONS[item.id] ?? 'ellipse-outline';
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.itemRow}
                onPress={route ? () => router.push(route as any) : undefined}
                activeOpacity={0.7}
                disabled={!route}
              >
                <Ionicons name={icon as any} size={18} color={Colors.secondaryText} />
                <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
                {item.detail && (
                  <Text style={styles.itemDetail}>{item.detail}</Text>
                )}
                {route && (
                  <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  goldBorder: {
    borderColor: Colors.accent,
    borderWidth: 1,
  },
  title: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  congratsText: {
    color: Colors.accentText,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  itemList: {
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  itemLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
  },
  itemDetail: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
