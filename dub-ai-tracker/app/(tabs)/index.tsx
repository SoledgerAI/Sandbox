// Dashboard screen -- daily overview
// Phase 5: Dashboard Layout

import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { useDailySummary } from '../../src/hooks/useDailySummary';
import { ScoreRing } from '../../src/components/charts/ScoreRing';
import { SparkLine } from '../../src/components/charts/SparkLine';
import { CalorieSummary } from '../../src/components/dashboard/CalorieSummary';
import { StreakCounter } from '../../src/components/dashboard/StreakCounter';
import { DashboardCard } from '../../src/components/dashboard/DashboardCard';
import { ALL_DEFAULT_TAGS } from '../../src/constants/tags';
import { BodyCard } from '../../src/components/dashboard/BodyCard';
import { RecoveryCard } from '../../src/components/dashboard/RecoveryCard';
import { isTagVisibleForUser } from '../../src/services/tagFilterService';
import { getUserSex } from '../../src/services/onboardingService';
import type { BiologicalSex } from '../../src/types/profile';

export default function DashboardScreen() {
  const {
    loading,
    greeting,
    dateDisplay,
    summary,
    bmr,
    tdee,
    calorieTarget,
    profileComplete,
    streak,
    enabledTags,
    tagOrder,
  } = useDailySummary();

  const [userSex, setUserSex] = useState<BiologicalSex | null>(null);

  useEffect(() => {
    getUserSex().then(setUserSex);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  // Compute a simple daily score: percentage of calorie target consumed, capped at 100
  const dailyScore =
    calorieTarget > 0
      ? Math.min(Math.round((summary.calories_consumed / calorieTarget) * 100), 100)
      : 0;

  // Order tags by configured order, falling back to enabled order
  const orderedTags = tagOrder.length > 0
    ? tagOrder.filter((id) => enabledTags.includes(id))
    : enabledTags;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.date}>{dateDisplay}</Text>
      </View>

      {/* Score Ring */}
      <View style={styles.ringContainer}>
        <ScoreRing score={dailyScore} />
      </View>

      {/* Calorie Summary */}
      {profileComplete ? (
        <CalorieSummary
          bmr={Math.round(bmr)}
          tdee={Math.round(tdee)}
          consumed={summary.calories_consumed}
          burned={summary.calories_burned}
          net={summary.calories_net}
          remaining={summary.calories_remaining}
          calorieTarget={Math.round(calorieTarget)}
        />
      ) : (
        <TouchableOpacity
          style={{ backgroundColor: Colors.cardBackground, borderRadius: 12, padding: 16, alignItems: 'center' }}
          onPress={() => router.push('/settings/profile')}
          activeOpacity={0.7}
        >
          <Text style={{ color: Colors.secondaryText, fontSize: 14, textAlign: 'center' }}>
            Set up your profile for accurate TDEE
          </Text>
          <Text style={{ color: Colors.accentText, fontSize: 13, fontWeight: '600', marginTop: 6 }}>
            Go to Profile
          </Text>
        </TouchableOpacity>
      )}

      {/* Streak Counter */}
      <StreakCounter streak={streak} />

      {/* Body Card */}
      <BodyCard />

      {/* Recovery Score */}
      <RecoveryCard />

      {/* Tag Cards */}
      {orderedTags.filter((tagId) => isTagVisibleForUser(tagId, userSex)).map((tagId) => {
        const tagDef = ALL_DEFAULT_TAGS.find((t) => t.id === tagId);
        if (tagDef == null) return null;

        return (
          <DashboardCard key={tagId} title={tagDef.name}>
            <View style={styles.tagCardContent}>
              <Text style={styles.tagDescription}>{tagDef.description}</Text>
              <SparkLine data={[]} />
            </View>
          </DashboardCard>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: 'bold',
  },
  date: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginTop: 4,
  },
  ringContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  tagCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagDescription: {
    color: Colors.secondaryText,
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
});
