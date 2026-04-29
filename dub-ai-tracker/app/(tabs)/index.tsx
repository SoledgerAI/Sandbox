// Dashboard screen -- daily overview
// Phase 5: Dashboard Layout
// P1-08: Deferred setup cards (Days 1-4 after onboarding)
// Sprint 25: Dashboard Overhaul — Daily Snapshot, Priorities, Coach, Reminders, Streaks

import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Pressable, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { LoadingIndicator } from '../../src/components/common/LoadingIndicator';
import { storageGet, STORAGE_KEYS, dateKey } from '../../src/utils/storage';
import type { AppSettings } from '../../src/types/profile';
import type { ComplianceResult, HydrationGoalSettings } from '../../src/types';
import type { ChatMessage } from '../../src/types/coach';
import { useDailySummary } from '../../src/hooks/useDailySummary';
import { useDeferredSetup } from '../../src/hooks/useDeferredSetup';
import { useMoodTrend } from '../../src/hooks/useMoodTrend';
import { useMilestone } from '../../src/hooks/useMilestone';
import { useStorageWatcher } from '../../src/hooks/useStorageWatcher';
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
import { shareDailySummary } from '../../src/components/sharing/DailySummaryCard';
import { MissedDayCard } from '../../src/components/dashboard/MissedDayCard';
import { CoachDubBadge } from '../../src/components/dashboard/CoachDubBadge';
import { StreakBadge } from '../../src/components/dashboard/StreakBadge';
import { DoctorFollowUpCard } from '../../src/components/dashboard/DoctorFollowUpCard';
import { ComplianceCard } from '../../src/components/dashboard/ComplianceCard';
import { DailySnapshotCard } from '../../src/components/dashboard/DailySnapshotCard';
import { QuickActionTiles } from '../../src/components/dashboard/QuickActionTiles';
import { StrengthFrequencyTile } from '../../src/components/dashboard/StrengthFrequencyTile';
import { TodaysPrioritiesCard } from '../../src/components/dashboard/TodaysPrioritiesCard';
import { RecentCoachCard } from '../../src/components/dashboard/RecentCoachCard';
import { UpcomingRemindersCard } from '../../src/components/dashboard/UpcomingRemindersCard';
import { ActiveStreaksCard } from '../../src/components/dashboard/ActiveStreaksCard';
import { NutrientAlertCard } from '../../src/components/dashboard/NutrientAlertCard';
import { calculateAllStreaks, calculateAllHabitStreaks, type CategoryStreak } from '../../src/utils/streakCalculator';
import { loadHabitDefinitions } from '../../src/components/logging/HabitsChecklist';
import { refreshCompliance } from '../../src/services/complianceEngine';
import { todayDateString } from '../../src/utils/dayBoundary';
import { hydrationToOz } from '../../src/types';
import type { ElectInCategoryId } from '../../src/types';
import { getEnabledCategories, isTagAllowedByElection } from '../../src/utils/categoryElection';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import type { DeferredSetupKey } from '../../src/hooks/useDeferredSetup';

export default function DashboardScreen() {
  if (__DEV__) console.log('[ONBOARD-09] Dashboard mounting');
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
    lastRefresh,
    refresh,
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

  // Feature #6: dynamic metabolic burn ticks every minute so the "Burned"
  // line grows through the day rather than sitting at the logged total.
  const [burnTick, setBurnTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setBurnTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Sprint 25: New dashboard state
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [lastCoachMessage, setLastCoachMessage] = useState<ChatMessage | null>(null);
  const [activeStreaks, setActiveStreaks] = useState<CategoryStreak[]>([]);
  const [waterGoalOz, setWaterGoalOz] = useState(64);
  const [dashboardReady, setDashboardReady] = useState(false);
  // TF-07: Track elected categories so category-gated tag cards hide when off.
  const [enabledCategories, setEnabledCategories] = useState<ElectInCategoryId[]>([]);

  // Fix 1: Determine if dashboard is empty (no data logged today)
  const isDashboardEmpty =
    summary.calories_consumed === 0 &&
    summary.water_oz === 0 &&
    summary.tags_logged.length === 0 &&
    summary.active_minutes === 0 &&
    summary.sleep_hours == null;

  // Fix 8: Stale data time-ago formatter
  const getTimeAgo = (): { text: string; isStale: boolean } => {
    if (!lastRefresh) return { text: '', isStale: false };
    const diffMs = Date.now() - lastRefresh.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    if (diffMin < 1) return { text: 'Updated just now', isStale: false };
    if (diffMin < 60) return { text: `Updated ${diffMin} min ago`, isStale: false };
    if (diffHr < 24) return { text: `Updated ${diffHr} hr ago`, isStale: diffHr >= 1 };
    return { text: 'Updated yesterday', isStale: true };
  };
  const timeAgo = getTimeAgo();

  // Fix 3: Scroll-to-top on tab re-tap
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const [refreshing, setRefreshing] = useState(false);

  // Sprint 25: Load dashboard extras in parallel
  // S33-B: habit streaks merged into activeStreaks (category streaks first,
  // then top-5 habit streaks sorted desc by current count).
  const loadDashboardExtras = useCallback(async () => {
    const today = todayDateString();
    const [complianceResult, coachHistory, streakSummary, hydrationGoal, electedCats, habitDefs] = await Promise.all([
      refreshCompliance(today),
      storageGet<ChatMessage[]>(STORAGE_KEYS.COACH_HISTORY),
      calculateAllStreaks(),
      storageGet<HydrationGoalSettings>(STORAGE_KEYS.SETTINGS_HYDRATION_GOAL),
      getEnabledCategories(),
      loadHabitDefinitions(),
    ]);
    setEnabledCategories(electedCats);

    setCompliance(complianceResult);

    // Find last assistant message from today
    if (coachHistory && coachHistory.length > 0) {
      const lastAssistant = [...coachHistory].reverse().find(
        (m) => m.role === 'assistant' && m.content,
      );
      setLastCoachMessage(lastAssistant ?? null);
    }

    const habitStreaks = await calculateAllHabitStreaks(habitDefs);
    setActiveStreaks([...streakSummary.streaks, ...habitStreaks]);

    // Calculate water goal in oz
    if (hydrationGoal) {
      setWaterGoalOz(Math.round(hydrationToOz(hydrationGoal.daily_goal, hydrationGoal.unit)));
    }

    setDashboardReady(true);
  }, []);

  // F-02: Refresh all data when tab gains focus
  useFocusEffect(
    useCallback(() => {
      refresh();
      loadDashboardExtras();
      storageGet<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS).then((s) => {
        setHideCalories(s?.hide_calories ?? false);
      });
    }, [refresh, loadDashboardExtras]),
  );

  // S29-C: Live refresh while the Home tab is foregrounded. Subscribes
  // to today's dated log keys plus a small set of aggregates. When
  // Coach DUB writes weight (or any other logger writes), the
  // dashboard re-queries without requiring a tab change or restart.
  // Subscription set is intentionally narrow — current-day keys only —
  // to avoid render storms.
  const watchedKeys = [
    dateKey(STORAGE_KEYS.LOG_FOOD, todayDateString()),
    dateKey(STORAGE_KEYS.LOG_WATER, todayDateString()),
    dateKey(STORAGE_KEYS.LOG_BODY, todayDateString()),
    dateKey(STORAGE_KEYS.LOG_WORKOUT, todayDateString()),
    dateKey(STORAGE_KEYS.LOG_SLEEP, todayDateString()),
    dateKey(STORAGE_KEYS.LOG_MOOD, todayDateString()),
    dateKey(STORAGE_KEYS.LOG_CAFFEINE, todayDateString()),
    STORAGE_KEYS.STREAKS,
    STORAGE_KEYS.COMPLIANCE,
    STORAGE_KEYS.COACH_HISTORY,
  ];
  useStorageWatcher(watchedKeys, () => {
    refresh();
    loadDashboardExtras();
  });

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    await loadDashboardExtras();
    setRefreshing(false);
  }, [refresh, loadDashboardExtras]);

  const handleSetUp = useCallback((key: DeferredSetupKey) => {
    completeItem(key);
  }, [completeItem]);

  const handleDismiss = useCallback((key: DeferredSetupKey) => {
    dismissItem(key);
  }, [dismissItem]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingIndicator size="large" />
      </View>
    );
  }

  // MASTER-48: Multi-factor daily score from tier-weighted computation
  const scoreValue = dailyScore.total;

  // Feature #6: metabolic burn accrues linearly across the calendar day
  // (tdee / 24 per hour). Logged workout calories are already in
  // summary.calories_burned, so we just add the time-weighted portion.
  const now = new Date(burnTick);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hoursElapsed = Math.min(24, Math.max(0, (now.getTime() - startOfDay.getTime()) / 3_600_000));
  const metabolicBurnSoFar = tdee > 0 ? (tdee / 24) * hoursElapsed : 0;
  const totalBurned = Math.round(summary.calories_burned + metabolicBurnSoFar);
  const adjustedNet = summary.calories_consumed - totalBurned;
  // Target already includes TDEE (full-day metabolic burn), so Remaining
  // must not add burn on top — that would double-count.
  const adjustedRemaining = calorieTarget - summary.calories_consumed;

  // B1: Show first-use label below score ring for first 7 days
  const isFirstWeek = streak != null && (streak.current_streak ?? 0) <= 7;

  // Order tags by configured order, falling back to enabled order.
  // TF-07: also filter out tags whose elect-in category is disabled so that
  // blood glucose / blood pressure / substances / etc. don't render when the
  // user hasn't elected the corresponding category.
  const orderedTagsRaw = tagOrder.length > 0
    ? tagOrder.filter((id) => enabledTags.includes(id))
    : enabledTags;
  const orderedTags = orderedTagsRaw.filter((id) => isTagAllowedByElection(id, enabledCategories));

  return (
    <ScreenWrapper>
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onPullRefresh}
          tintColor={Colors.accent}
          colors={[Colors.accent]}
        />
      }
    >
      {/* Sprint 15: Coach DUB badge — top right */}
      <View style={styles.coachBadgeRow}>
        <CoachDubBadge />
      </View>

      {/* Greeting — F-06: centered banner */}
      <View style={styles.header}>
        {/* Left spacer (matches share button width for centering) */}
        <View style={styles.headerSide} />
        <View style={styles.headerCenter}>
          <Text
            style={styles.greeting}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {greeting}
          </Text>
          <Text style={styles.date}>{dateDisplay}</Text>
        </View>
        <View style={styles.headerSide}>
          {!loading && summary.calories_consumed > 0 && (
            <TouchableOpacity
              style={styles.shareDayBtn}
              onPress={() =>
                shareDailySummary({
                  summary,
                  calorieTarget: Math.round(calorieTarget),
                  proteinTarget: calorieTarget > 0 ? Math.round(calorieTarget * 0.3 / 4) : 0,
                  streakCount: streak?.current_streak,
                })
              }
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={20} color={Colors.accentText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mood Resource Card — safety feature, always at TOP */}
      {showMoodResource && (
        <MoodResourceCard
          showVeteransLine={showVeteransLine}
          onDismiss={dismissMoodResource}
        />
      )}

      {/* Fix 1: Profile incomplete banner */}
      {!profileComplete && (
        <TouchableOpacity
          style={styles.profileBanner}
          onPress={() => router.push('/settings/profile')}
          activeOpacity={0.7}
        >
          <Ionicons name="person-circle-outline" size={24} color={Colors.accentText} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.profileBannerTitle}>Complete Your Profile</Text>
            <Text style={styles.profileBannerSubtitle}>Set up your stats to unlock calorie targets and daily scores</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.accentText} />
        </TouchableOpacity>
      )}

      {/* TF-05: Quick-action tiles (3x2 grid, configurable) */}
      <QuickActionTiles enabledTags={enabledTags} />

      {/* S36: Optional strength frequency tile — opt-in via Customize Tiles. */}
      <StrengthFrequencyTile />

      {/* Sprint 25: Daily Snapshot Card — top of dashboard (replaces inline score ring for returning users) */}
      {dashboardReady && !isDashboardEmpty && (
        <DailySnapshotCard
          greeting={greeting}
          dateDisplay={dateDisplay}
          compliancePct={compliance?.percentage ?? 0}
          streak={streak}
          summary={summary}
          waterGoalOz={waterGoalOz}
          enabledTags={enabledTags}
        />
      )}

      {/* Score Ring — show when dashboard has no snapshot data or for empty state */}
      {(isDashboardEmpty || !dashboardReady) && (
        <View style={styles.ringContainer}>
          <ScoreRing score={scoreValue} />
          {isFirstWeek && (
            <Text style={styles.scoreFirstUseLabel}>
              Your Daily Score — tracks how closely you hit your targets today.
            </Text>
          )}
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
      )}

      {/* Sprint 15: Streak Badge */}
      <StreakBadge />

      {/* Sprint 25: Today's Priorities — unlogged compliance goals */}
      {dashboardReady && (
        <TodaysPrioritiesCard compliance={compliance} />
      )}

      {/* Sprint 18: Daily Compliance Scorecard */}
      {/* TF-08: pass total_days_logged so the card can show a warm empty /
         building state during the first days of use instead of red 0%. */}
      <ComplianceCard totalDaysLogged={streak?.total_days_logged ?? 0} />

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
          burned={totalBurned}
          net={adjustedNet}
          remaining={adjustedRemaining}
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
            Complete your profile in Settings to see your daily target.
          </Text>
          <Text style={{ color: Colors.accentText, fontSize: 13, fontWeight: '600', marginTop: 6 }}>
            Go to Settings
          </Text>
        </TouchableOpacity>
      )}

      {/* Sprint 22: Nutrient UL alerts (iron, B6, etc. exceeding safe limits) */}
      <NutrientAlertCard />

      {/* Sprint 25: Recent Coach Interaction */}
      {dashboardReady && (
        <RecentCoachCard lastMessage={lastCoachMessage} />
      )}

      {/* Sprint 25: Upcoming Reminders */}
      {dashboardReady && <UpcomingRemindersCard />}

      {/* Streak Counter */}
      <StreakCounter streak={streak} />

      {/* Sprint 25: Active Streaks */}
      {dashboardReady && activeStreaks.length > 0 && (
        <ActiveStreaksCard streaks={activeStreaks} />
      )}

      {/* Milestone Card — one at a time, earned moments only (P2-05) */}
      {milestone && (
        <MilestoneCard milestone={milestone} onAcknowledge={acknowledgeMilestone} />
      )}

      {/* Missed Day Backfill Nudge — Prompt 14 */}
      <MissedDayCard />

      {/* Doctor Follow-up Reminders — Sprint 17 */}
      <DoctorFollowUpCard />

      {/* Body Card */}
      <BodyCard />

      {/* Recovery Score */}
      <RecoveryCard />

      {/* Sprint 25: Insights link */}
      {dashboardReady && !isDashboardEmpty && (
        <TouchableOpacity
          style={styles.insightsLink}
          onPress={() => router.push('/insights')}
          activeOpacity={0.7}
        >
          <Ionicons name="analytics-outline" size={20} color={Colors.accentText} />
          <Text style={styles.insightsLinkText}>View Insights & Trends</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
        </TouchableOpacity>
      )}

      {/* Fix 8: Stale data indicator */}
      {timeAgo.text ? (
        <Text style={[styles.timeAgo, timeAgo.isStale && styles.timeAgoStale]}>{timeAgo.text}</Text>
      ) : null}

      {/* MASTER-53: Tag Cards — no sex-based filtering (P0-08) */}
      <View style={!profileComplete ? { opacity: 0.4 } : undefined}>
      {orderedTags.map((tagId) => {
        const tagDef = ALL_DEFAULT_TAGS.find((t) => t.id === tagId);
        if (tagDef == null) return null;

        return (
          <TagCardWithData key={tagId} tagId={tagId} tagDef={tagDef} />
        );
      })}
      </View>
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 12,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    width: 48,
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  shareDayBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    color: Colors.text,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  date: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  ringContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  scoreFirstUseLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
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
  // Fix 1: Profile banner
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  profileBannerTitle: {
    color: Colors.accentText,
    fontSize: 15,
    fontWeight: FontWeight.semibold,
  },
  profileBannerSubtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  // Sprint 25: Insights link
  insightsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: Spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  insightsLinkText: {
    flex: 1,
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  // Fix 8: Time ago
  timeAgo: {
    color: Colors.secondaryText,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  timeAgoStale: {
    color: Colors.dangerText,
  },
});
