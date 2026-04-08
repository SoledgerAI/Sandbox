// Tag card with real 7-day data and today's summary
// MASTER-53: Replace empty shells with actual data
// MASTER-56: Each card loads its own data lazily

import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { DashboardCard } from './DashboardCard';
import { SparkLine } from '../charts/SparkLine';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { useTagCardData } from '../../hooks/useTagCardData';
import { storageGet, STORAGE_KEYS } from '../../utils/storage';
import {
  PopulationNorms,
  getSleepAgeBracket,
  POPULATION_NORMS_CITATION,
} from '../../constants/populationNorms';
import type { UserProfile, AppSettings } from '../../types/profile';
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
  const [sleepComparison, setSleepComparison] = useState<string | null>(null);

  // Load sleep population comparison when applicable
  useEffect(() => {
    if (tagId !== 'sleep.tracking' || !todaySummary) return;
    (async () => {
      const [settings, profile] = await Promise.all([
        storageGet<AppSettings>(STORAGE_KEYS.SETTINGS),
        storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
      ]);
      if (
        !settings?.show_population_comparison ||
        !profile?.dob ||
        !profile?.sex ||
        profile.sex === 'prefer_not_to_say' ||
        profile.sex === 'intersex'
      ) {
        setSleepComparison(null);
        return;
      }
      const hours = parseFloat(todaySummary);
      if (isNaN(hours)) return;

      const bracket = getSleepAgeBracket(profile.dob);
      const norms = PopulationNorms.sleep_duration[bracket];
      if (hours >= norms.recommended.min && hours <= norms.recommended.max) {
        setSleepComparison('Within recommended range for your age');
      } else if (hours < norms.recommended.min) {
        setSleepComparison(`Below recommended for your age (${norms.recommended.min}-${norms.recommended.max} hrs)`);
      } else {
        setSleepComparison(`Above recommended for your age (${norms.recommended.min}-${norms.recommended.max} hrs)`);
      }
    })();
  }, [tagId, todaySummary]);

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
              <SkeletonLoader width="80%" height={18} borderRadius={6} />
            ) : hasDataToday && todaySummary ? (
              <>
                <Text style={styles.summaryValue}>{todaySummary}</Text>
                {sleepComparison && (
                  <View style={styles.popComparisonRow}>
                    <Text style={styles.popComparisonText}>{sleepComparison}</Text>
                    <Pressable
                      onPress={() => Alert.alert('Population Comparison', POPULATION_NORMS_CITATION)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.popInfoIcon}>{'\u24D8'}</Text>
                    </Pressable>
                  </View>
                )}
              </>
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
  popComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  popComparisonText: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  popInfoIcon: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
});
