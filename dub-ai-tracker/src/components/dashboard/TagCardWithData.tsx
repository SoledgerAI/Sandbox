// Tag card with real 7-day data and today's summary
// MASTER-53: Replace empty shells with actual data
// MASTER-56: Each card loads its own data lazily

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { DashboardCard } from './DashboardCard';
import { SparkLine } from '../charts/SparkLine';
import { useTagCardData } from '../../hooks/useTagCardData';
import type { TagDefault } from '../../constants/tags';

// Map tag IDs to their logging route
const TAG_LOG_ROUTES: Record<string, string> = {
  'nutrition.food': '/log/food',
  'hydration.water': '/log/water',
  'fitness.workout': '/log/workout',
  'strength.training': '/log/strength',
  'body.measurements': '/log/body',
  'sleep.tracking': '/log/sleep',
  'supplements.daily': '/log/supplements',
  'health.markers': '/log/bloodwork',
  'mental.wellness': '/log/mood',
  'substances.tracking': '/log/substances',
  'sexual.activity': '/log/sexual',
  'digestive.health': '/log/digestive',
  'personal.care': '/log/personalcare',
  'womens.health': '/log/cycle',
  'injury.pain': '/log/injury',
  'custom.tag': '/log/custom',
  'recovery.score': '/log/body',
};

interface TagCardWithDataProps {
  tagId: string;
  tagDef: TagDefault;
}

export function TagCardWithData({ tagId, tagDef }: TagCardWithDataProps) {
  const { loading, todaySummary, sparkData, hasDataToday } = useTagCardData(tagId);
  const logRoute = TAG_LOG_ROUTES[tagId];

  const handlePress = () => {
    if (logRoute) {
      router.push(logRoute as any);
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
      <DashboardCard title={tagDef.name}>
        <View style={styles.content}>
          <View style={styles.textCol}>
            {loading ? (
              <Text style={styles.loadingText}>Loading...</Text>
            ) : hasDataToday && todaySummary ? (
              <Text style={styles.summaryValue}>{todaySummary}</Text>
            ) : (
              <Text style={styles.noDataText}>Not logged yet — tap to log</Text>
            )}
          </View>
          <SparkLine
            data={sparkData}
            width={80}
            height={30}
            color={hasDataToday ? Colors.accent : Colors.divider}
          />
        </View>
      </DashboardCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    marginRight: 12,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  noDataText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontStyle: 'italic',
  },
  loadingText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
});
