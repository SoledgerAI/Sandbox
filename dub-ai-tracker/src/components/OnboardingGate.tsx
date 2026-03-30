// OnboardingGate: blocks app until personalization onboarding is complete
// Prompt 03 v2: Smart Onboarding
// Renders after AuthGate, before main app content

import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/colors';
import { isOnboardingComplete } from '../services/onboardingService';
import { PersonalizationFlow } from './PersonalizationFlow';

interface OnboardingGateProps {
  children: React.ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const done = await isOnboardingComplete();
        setComplete(done);
      } finally {
        setChecking(false);
      }
    }
    check();
  }, []);

  const handleComplete = useCallback(() => {
    setComplete(true);
  }, []);

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!complete) {
    return <PersonalizationFlow onComplete={handleComplete} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
