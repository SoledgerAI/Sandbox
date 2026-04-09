// Onboarding route — renders PersonalizationFlow
// Express onboarding is handled by PersonalizationFlow.
// Root layout routes here if onboarding is not complete.

import { useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { isOnboardingComplete } from '../src/services/onboardingService';
import { PersonalizationFlow } from '../src/components/PersonalizationFlow';

export default function OnboardingScreen() {
  // If already complete (e.g. deep link), redirect immediately
  useEffect(() => {
    isOnboardingComplete().then((done) => {
      if (done) {
        router.replace('/(tabs)');
      }
    });
  }, []);

  const handleComplete = useCallback(() => {
    if (__DEV__) console.log('[ONBOARD-06] Parent received onComplete — navigating to /(tabs)');
    router.replace('/(tabs)');
    if (__DEV__) console.log('[ONBOARD-07] router.replace("/(tabs)") called');
  }, []);

  return <PersonalizationFlow onComplete={handleComplete} />;
}
