// Onboarding screen with 4-step navigation
// Phase 3: Onboarding Flow
// Per Section 8: 4 steps (redesigned per Expert 5 UX Audit)
//   Step 1: Profile & Consent
//   Step 2: Goal Selection
//   Step 3: Tier & Tags (skippable)
//   Step 4: Devices & Notifications (skippable)

import { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { ProgressBar } from '../src/components/common/ProgressBar';
import { Button } from '../src/components/common/Button';
import { ProfileStep } from '../src/components/onboarding/ProfileStep';
import { WeightGoalStep } from '../src/components/onboarding/WeightGoalStep';
import { TierSelector } from '../src/components/onboarding/TierSelector';
import { TagPicker } from '../src/components/onboarding/TagPicker';
import { DeviceConnect } from '../src/components/onboarding/DeviceConnect';
import { NotificationStep } from '../src/components/onboarding/NotificationStep';
import { OnboardingStep } from '../src/components/onboarding/OnboardingStep';
import { useProfile } from '../src/hooks/useProfile';
import { getDefaultTagsForTier } from '../src/constants/tags';
import { DEFAULT_TIER } from '../src/constants/tiers';
import type { GoalDirection, EngagementTier, UserProfile, ConsentRecord } from '../src/types/profile';

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const {
    profile,
    tier,
    enabledTags,
    saveProfile,
    saveConsent,
    saveTier,
    saveEnabledTags,
    saveSettings,
    completeOnboarding,
  } = useProfile();

  // Local state for in-progress edits
  const [selectedTier, setSelectedTier] = useState<EngagementTier>(tier ?? DEFAULT_TIER);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    enabledTags ?? getDefaultTagsForTier(DEFAULT_TIER),
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Step 1: Profile & Consent
  const handleProfileComplete = useCallback(
    async (profileData: Partial<UserProfile>, consent: ConsentRecord) => {
      await Promise.all([saveProfile(profileData), saveConsent(consent)]);
      setStep(2);
    },
    [saveProfile, saveConsent],
  );

  // Step 2: Goal Selection
  const handleGoalComplete = useCallback(
    async (direction: GoalDirection) => {
      await saveProfile({
        goal: {
          direction,
          target_weight: null,
          rate_lbs_per_week: direction === 'LOSE' ? 1.0 : null,
          gain_type: direction === 'GAIN' ? 'standard' : null,
          surplus_calories: direction === 'GAIN' ? 500 : null,
        },
      });
      setStep(3);
    },
    [saveProfile],
  );

  // Step 3: Tier & Tag changes
  const handleTierChange = useCallback(
    (newTier: EngagementTier) => {
      setSelectedTier(newTier);
      // Recompute default tags for new tier, preserving any manually toggled sensitive tags
      const defaultHealthTags = getDefaultTagsForTier(newTier);
      const currentSensitiveTags = selectedTags.filter(
        (id) => !getDefaultTagsForTier(selectedTier).includes(id) &&
          !getDefaultTagsForTier(newTier).includes(id),
      );
      setSelectedTags([...defaultHealthTags, ...currentSensitiveTags]);
    },
    [selectedTags, selectedTier],
  );

  const handleTagToggle = useCallback(
    (tagId: string) => {
      setSelectedTags((prev) =>
        prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
      );
    },
    [],
  );

  const handleStep3Complete = useCallback(async () => {
    await Promise.all([saveTier(selectedTier), saveEnabledTags(selectedTags)]);
    setStep(4);
  }, [saveTier, saveEnabledTags, selectedTier, selectedTags]);

  const handleStep3Skip = useCallback(async () => {
    // Per spec: If skipped, Balanced tier, default Health/Fitness tags, no sensitive
    await Promise.all([
      saveTier(DEFAULT_TIER),
      saveEnabledTags(getDefaultTagsForTier(DEFAULT_TIER)),
    ]);
    setStep(4);
  }, [saveTier, saveEnabledTags]);

  // Step 4: Devices & Notifications
  const handleComplete = useCallback(async () => {
    await saveSettings({ notification_enabled: notificationsEnabled });
    await completeOnboarding();
    router.replace('/(tabs)');
  }, [saveSettings, completeOnboarding, notificationsEnabled]);

  const handleStep4Skip = useCallback(async () => {
    await saveSettings({ notification_enabled: false });
    await completeOnboarding();
    router.replace('/(tabs)');
  }, [saveSettings, completeOnboarding]);

  return (
    <View style={styles.container}>
      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

      {step === 1 && (
        <ProfileStep profile={profile} onComplete={handleProfileComplete} />
      )}

      {step === 2 && (
        <WeightGoalStep
          currentGoal={profile?.goal?.direction ?? null}
          onComplete={handleGoalComplete}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <OnboardingStep
          title="Customize Your Experience"
          subtitle="Choose your tracking level and what you'd like to track. Skippable — defaults are sensible."
        >
          <TierSelector currentTier={selectedTier} onSelect={handleTierChange} />
          <TagPicker enabledTags={selectedTags} onToggle={handleTagToggle} />

          <View style={styles.footerRow}>
            <View style={styles.backBtn}>
              <Button title="Back" onPress={() => setStep(2)} variant="secondary" />
            </View>
            <View style={styles.skipBtn}>
              <Button title="Skip" onPress={handleStep3Skip} variant="ghost" />
            </View>
            <View style={styles.continueBtn}>
              <Button title="Continue" onPress={handleStep3Complete} />
            </View>
          </View>
        </OnboardingStep>
      )}

      {step === 4 && (
        <OnboardingStep
          title="Connect & Notify"
          subtitle="Link your devices and set up notifications. Skippable — configure anytime in Settings."
        >
          <DeviceConnect />
          <NotificationStep
            tier={selectedTier}
            notificationsEnabled={notificationsEnabled}
            onToggle={setNotificationsEnabled}
          />

          <View style={styles.footerRow}>
            <View style={styles.backBtn}>
              <Button title="Back" onPress={() => setStep(3)} variant="secondary" />
            </View>
            <View style={styles.skipBtn}>
              <Button title="Skip" onPress={handleStep4Skip} variant="ghost" />
            </View>
            <View style={styles.continueBtn}>
              <Button title="Get Started" onPress={handleComplete} />
            </View>
          </View>
        </OnboardingStep>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    paddingTop: 48,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 24,
  },
  backBtn: {
    flex: 1,
  },
  skipBtn: {
    flex: 1,
  },
  continueBtn: {
    flex: 2,
  },
});
