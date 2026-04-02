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
import { DebugOverlay, debugStep } from '../src/components/DebugOverlay'; // DEBUG: REMOVE BEFORE PRODUCTION
import type { AppSettings } from '../src/types/profile';

// DEBUG: REMOVE BEFORE PRODUCTION — hide splash IMMEDIATELY so debug overlay is visible
// We no longer keep the splash screen up; we want to see the debug text instead.
debugStep('STEP 0: Module loaded — hiding splash immediately');
SplashScreen.hideAsync().catch(() => {});

export default function RootLayout() {
  debugStep('STEP 1: RootLayout function body executing'); // DEBUG: REMOVE BEFORE PRODUCTION
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

  // DEBUG: REMOVE BEFORE PRODUCTION — log navigation state on every render
  useEffect(() => {
    debugStep(`STEP 2: navigationState.key = ${navigationState?.key ?? 'UNDEFINED'}`);
  }, [navigationState?.key]);

  useEffect(() => {
    if (!navigationState?.key) {
      debugStep('STEP 2a: navigationState.key is falsy — waiting...'); // DEBUG: REMOVE BEFORE PRODUCTION
      return;
    }

    debugStep('STEP 2b: navigationState ready — checking onboarding...'); // DEBUG: REMOVE BEFORE PRODUCTION
    async function checkOnboarding() {
      try {
        debugStep('STEP 2c: reading ONBOARDING_COMPLETE from storage...'); // DEBUG: REMOVE BEFORE PRODUCTION
        const complete = await storageGet<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETE);
        debugStep(`STEP 2d: ONBOARDING_COMPLETE = ${complete}`); // DEBUG: REMOVE BEFORE PRODUCTION
        if (!complete) {
          debugStep('STEP 2e: routing to /onboarding'); // DEBUG: REMOVE BEFORE PRODUCTION
          router.replace('/onboarding');
        }
      } catch (err) {
        debugStep(`STEP 2x: checkOnboarding ERROR: ${err}`); // DEBUG: REMOVE BEFORE PRODUCTION
      } finally {
        setChecking(false);
        debugStep('STEP 2 DONE: checking=false'); // DEBUG: REMOVE BEFORE PRODUCTION
      }
    }
    checkOnboarding();
  }, [navigationState?.key]);

  // Safety net: if navigation state never resolves, force past checking after 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      debugStep('STEP TIMEOUT: 5s safety net fired — forcing checking=false'); // DEBUG: REMOVE BEFORE PRODUCTION
      setChecking(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  const showOverlay = privacyOverlay || quickHideActive;

  debugStep(`STEP 5: RootLayout render — checking=${checking}`); // DEBUG: REMOVE BEFORE PRODUCTION

  return (
    <ErrorBoundary>
      {/* DEBUG: REMOVE BEFORE PRODUCTION — debug overlay renders on top of everything */}
      <DebugOverlay />
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
          {/* DEBUG: REMOVE BEFORE PRODUCTION */}
          {(() => { debugStep('STEP 6: Main app content rendering (Stack navigator)'); return null; })()}
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
