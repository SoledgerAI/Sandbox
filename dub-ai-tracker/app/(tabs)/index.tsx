// Dashboard screen -- daily overview
// Phase 5: Dashboard Layout

import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { useDailySummary } from '../../src/hooks/useDailySummary';
import { ScoreRing } from '../../src/components/charts/ScoreRing';
import { CalorieSummary } from '../../src/components/dashboard/CalorieSummary';
import { StreakCounter } from '../../src/components/dashboard/StreakCounter';
import { ALL_DEFAULT_TAGS } from '../../src/constants/tags';
import { BodyCard } from '../../src/components/dashboard/BodyCard';
import { RecoveryCard } from '../../src/components/dashboard/RecoveryCard';
import { TagCardWithData } from '../../src/components/dashboard/TagCardWithData';
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
    dailyScore,
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

  // MASTER-48: Multi-factor daily score from tier-weighted computation
  const scoreValue = dailyScore.total;

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
        <ScoreRing score={scoreValue} />
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

      {/* MASTER-53: Tag Cards with real data, MASTER-56: lazy rendered */}
      {orderedTags.filter((tagId) => isTagVisibleForUser(tagId, userSex)).map((tagId) => {
        const tagDef = ALL_DEFAULT_TAGS.find((t) => t.id === tagId);
        if (tagDef == null) return null;

        return (
          <TagCardWithData key={tagId} tagId={tagId} tagDef={tagDef} />
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
});
