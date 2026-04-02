// OnboardingGate: blocks app until personalization onboarding is complete
// Prompt 03 v2: Smart Onboarding
// Renders after AuthGate, before main app content

import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/colors';
import { isOnboardingComplete } from '../services/onboardingService';
import { debugStep } from './DebugOverlay'; // DEBUG: REMOVE BEFORE PRODUCTION
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
        debugStep('STEP 4a: OnboardingGate — checking isOnboardingComplete...'); // DEBUG: REMOVE BEFORE PRODUCTION
        const done = await isOnboardingComplete();
        debugStep(`STEP 4b: OnboardingGate — complete = ${done}`); // DEBUG: REMOVE BEFORE PRODUCTION
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
    debugStep('STEP 4: OnboardingGate render — checking...'); // DEBUG: REMOVE BEFORE PRODUCTION
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!complete) {
    debugStep('STEP 4c: OnboardingGate — NOT complete, showing PersonalizationFlow'); // DEBUG: REMOVE BEFORE PRODUCTION
    return <PersonalizationFlow onComplete={handleComplete} />;
  }

  debugStep('STEP 4 DONE: OnboardingGate — complete, rendering children'); // DEBUG: REMOVE BEFORE PRODUCTION
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
