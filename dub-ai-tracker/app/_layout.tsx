// Root layout: checks onboarding state on launch
// Phase 3: Onboarding Flow
// Per Section 8: If dub.onboarding.complete is true, skip to Dashboard

import { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Text, View } from 'react-native';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../src/utils/storage';
import { processQueue } from '../src/utils/offline';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';
import { AuthGate } from '../src/components/AuthGate';
import { OnboardingGate } from '../src/components/OnboardingGate';
import type { AppSettings } from '../src/types/profile';

// Keep the splash screen visible until we explicitly hide it
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [checking, setChecking] = useState(true);
  const navigationState = useRootNavigationState();

  // D8-001: Privacy screen overlay driven by AppState + setting
  const [privacyOverlay, setPrivacyOverlay] = useState(false);
  const privacyEnabledRef = useRef(false);

  // D8-002: Triple-tap quick-hide gesture
  const [quickHideActive, setQuickHideActive] = useState(false);
  const tapTimestampsRef = useRef<number[]>([]);

  // Load privacy_screen_enabled setting
  useEffect(() => {
    async function loadPrivacySetting() {
      try {
        const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
        privacyEnabledRef.current = settings?.privacy_screen_enabled ?? false;
      } catch {
        privacyEnabledRef.current = false;
      }
    }
    loadPrivacySetting();
  }, []);

  // D8-001: Listen for AppState changes + MASTER-62: process offline queue on resume
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'active') {
        setPrivacyOverlay(false);
        // MASTER-62: Process offline queue when app returns to foreground
        processQueue().catch(() => {});
      } else if (nextState === 'inactive' || nextState === 'background') {
        if (privacyEnabledRef.current) {
          setPrivacyOverlay(true);
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // MASTER-62: Also process queue on initial launch
    processQueue().catch(() => {});

    return () => subscription.remove();
  }, []);

  // D8-002: Triple-tap handler
  const handleTouchEnd = useCallback(() => {
    const now = Date.now();
    const timestamps = tapTimestampsRef.current;
    timestamps.push(now);

    // Keep only taps within the last 800ms
    const recentTaps = timestamps.filter((t) => now - t <= 800);
    tapTimestampsRef.current = recentTaps;

    if (recentTaps.length >= 3) {
      setQuickHideActive(true);
      tapTimestampsRef.current = [];
    }
  }, []);

  // D8-002: Dismiss quick-hide on single tap
  const handleOverlayTap = useCallback(() => {
    setQuickHideActive(false);
  }, []);

  useEffect(() => {
    if (!navigationState?.key) return;

    async function checkOnboarding() {
      try {
        const complete = await storageGet<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETE);
        if (!complete) {
          router.replace('/onboarding');
        }
      } finally {
        setChecking(false);
        // Always dismiss the native splash screen, even if checks fail
        SplashScreen.hideAsync().catch(() => {});
      }
    }
    checkOnboarding();
  }, [navigationState?.key]);

  // Safety net: if navigation state never resolves, hide splash after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setChecking(false);
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  const showOverlay = privacyOverlay || quickHideActive;

  return (
    <ErrorBoundary>
      <AuthGate>
        <OnboardingGate>
          <StatusBar style="light" />
          {checking && (
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.primaryBackground,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color={Colors.accent} size="large" />
            </View>
          )}
          <View style={{ flex: 1 }} onTouchEnd={handleTouchEnd}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.primaryBackground },
              }}
            >
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            </Stack>
          </View>
          {showOverlay && (
            <View
              onTouchEnd={quickHideActive ? handleOverlayTap : undefined}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                backgroundColor: Colors.primaryBackground,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '600' }}>
                dub
              </Text>
            </View>
          )}
        </OnboardingGate>
      </AuthGate>
    </ErrorBoundary>
  );
}
