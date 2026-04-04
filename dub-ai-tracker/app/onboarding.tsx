// Onboarding route — redirects to Dashboard
// Express onboarding is handled by OnboardingGate + PersonalizationFlow.
// This route exists as a fallback; if reached, complete and go to Dashboard.

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { isOnboardingComplete } from '../src/services/onboardingService';

export default function OnboardingScreen() {
  useEffect(() => {
    isOnboardingComplete().then((done) => {
      if (done) {
        router.replace('/(tabs)');
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
