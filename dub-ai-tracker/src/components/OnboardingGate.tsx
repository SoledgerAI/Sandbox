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
    let cancelled = false;
    async function check() {
      try {
        const done = await isOnboardingComplete();
        if (cancelled) return;
        setComplete(done);
      } catch {
        // Storage error — default to not complete so user sees onboarding
        if (!cancelled) setComplete(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  // Safety net: if onboarding check hangs, force past checking after 5 seconds.
  // Uses requestAnimationFrame because setTimeout may not fire in Hermes release builds.
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    function rafCheck() {
      if (cancelled) return;
      if (Date.now() - start >= 5000) {
        setChecking(false);
        return;
      }
      requestAnimationFrame(rafCheck);
    }
    requestAnimationFrame(rafCheck);
    return () => { cancelled = true; };
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
