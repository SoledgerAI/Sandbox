// Dashboard screen -- daily overview
// Phase 5: Dashboard Layout
// P1-08: Deferred setup cards (Days 1-4 after onboarding)

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../../src/utils/storage';
import type { AppSettings } from '../../src/types/profile';
import { useDailySummary } from '../../src/hooks/useDailySummary';
import { useDeferredSetup } from '../../src/hooks/useDeferredSetup';
import { useMoodTrend } from '../../src/hooks/useMoodTrend';
import { useMilestone } from '../../src/hooks/useMilestone';
import { ScoreRing } from '../../src/components/charts/ScoreRing';
import { CalorieSummary } from '../../src/components/dashboard/CalorieSummary';
import { StreakCounter } from '../../src/components/dashboard/StreakCounter';
import { MilestoneCard } from '../../src/components/dashboard/MilestoneCard';
import { DeferredSetupCard } from '../../src/components/dashboard/DeferredSetupCard';
import { MoodResourceCard } from '../../src/components/dashboard/MoodResourceCard';
import { ALL_DEFAULT_TAGS } from '../../src/constants/tags';
import { BodyCard } from '../../src/components/dashboard/BodyCard';
import { RecoveryCard } from '../../src/components/dashboard/RecoveryCard';
import { TagCardWithData } from '../../src/components/dashboard/TagCardWithData';
import type { DeferredSetupKey } from '../../src/hooks/useDeferredSetup';

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

  const {
    activeCard,
    dismissItem,
    completeItem,
  } = useDeferredSetup();

  const {
    showCard: showMoodResource,
    showVeteransLine,
    dismiss: dismissMoodResource,
  } = useMoodTrend();

  const {
    milestone,
    acknowledge: acknowledgeMilestone,
  } = useMilestone(streak);

  const [hideCalories, setHideCalories] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  useEffect(() => {
    storageGet<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS).then((s) => {
      setHideCalories(s?.hide_calories ?? false);
    });
  }, []);

  const handleSetUp = useCallback((key: DeferredSetupKey) => {
    completeItem(key);
  }, [completeItem]);

  const handleDismiss = useCallback((key: DeferredSetupKey) => {
    dismissItem(key);
  }, [dismissItem]);

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

      {/* Mood Resource Card — safety feature, always at TOP */}
      {showMoodResource && (
        <MoodResourceCard
          showVeteransLine={showVeteransLine}
          onDismiss={dismissMoodResource}
        />
      )}

      {/* Score Ring */}
      <View style={styles.ringContainer}>
        <ScoreRing score={scoreValue} />
        <Pressable
          style={styles.scoreInfoToggle}
          onPress={() => setShowScoreInfo(!showScoreInfo)}
          accessibilityRole="button"
          accessibilityLabel={showScoreInfo ? 'Hide score explanation' : 'How your daily score works'}
        >
          <Ionicons name="information-circle-outline" size={16} color={Colors.accentText} />
          <Text style={styles.scoreInfoToggleText}>
            {showScoreInfo ? 'Hide' : 'How is this calculated?'}
          </Text>
        </Pressable>
        {showScoreInfo && (
          <View style={styles.scoreInfoBox}>
            <Text style={styles.scoreInfoTitle}>How Your Daily Score Works</Text>
            <Text style={styles.scoreInfoText}>
              Your Daily Score (0–100) measures how closely today's logging matches your personal targets. It factors in:
            </Text>
            <Text style={styles.scoreInfoText}>{'\u2022'} Calorie accuracy — how close you are to your daily target</Text>
            <Text style={styles.scoreInfoText}>{'\u2022'} Protein target — meeting your protein goal</Text>
            <Text style={styles.scoreInfoText}>{'\u2022'} Hydration — water intake relative to your goal</Text>
            <Text style={styles.scoreInfoText}>{'\u2022'} Activity — whether you logged movement today</Text>
            <Text style={styles.scoreInfoText}>{'\u2022'} Logging consistency — completing your daily check-in</Text>
            <Text style={[styles.scoreInfoText, { marginTop: 8 }]}>
              Each factor is weighted based on your selected goals. The score resets each day.
            </Text>
          </View>
        )}
      </View>

      {/* Deferred Setup Card (one at a time, Days 1-4) */}
      {activeCard && (
        <DeferredSetupCard
          title={activeCard.title}
          description={activeCard.description}
          icon={activeCard.icon}
          route={activeCard.route}
          itemKey={activeCard.key}
          onSetUp={handleSetUp}
          onDismiss={handleDismiss}
        />
      )}

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
          hideCalories={hideCalories}
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

      {/* Milestone Card — one at a time, earned moments only (P2-05) */}
      {milestone && (
        <MilestoneCard milestone={milestone} onAcknowledge={acknowledgeMilestone} />
      )}

      {/* Body Card */}
      <BodyCard />

      {/* Recovery Score */}
      <RecoveryCard />

      {/* MASTER-53: Tag Cards — no sex-based filtering (P0-08) */}
      {orderedTags.map((tagId) => {
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
  scoreInfoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  scoreInfoToggleText: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '500',
  },
  scoreInfoBox: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    width: '100%',
  },
  scoreInfoTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  scoreInfoText: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
  },
});
