// Root layout — FORENSIC FIX: Flat init architecture
// - AuthGate renders children ALWAYS (lock UI is an overlay, not a blocker)
// - OnboardingGate REMOVED — onboarding handled via router navigation
// - Stack ALWAYS renders — Expo Router initializes immediately
// - isOnboardingComplete() now reads AsyncStorage first (fast, no Keychain)
// - Single init effect: check onboarding, navigate if needed

import { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Text, View } from 'react-native';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../src/utils/storage';
import { processQueue } from '../src/utils/offline';
import { initDayBoundary } from '../src/utils/dayBoundary';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';
import { OfflineBanner } from '../src/components/common/OfflineBanner';
import { AuthGate } from '../src/components/AuthGate';
import { isOnboardingComplete } from '../src/services/onboardingService';
import type { AppSettings } from '../src/types/profile';

// Keep splash screen visible until initialization completes
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [initDone, setInitDone] = useState(false);
  const navigationState = useRootNavigationState();

  // D8-001: Privacy screen overlay driven by AppState + setting
  const [privacyOverlay, setPrivacyOverlay] = useState(false);
  const privacyEnabledRef = useRef(false);

  // D8-002: Triple-tap quick-hide gesture
  const [quickHideActive, setQuickHideActive] = useState(false);
  const tapTimestampsRef = useRef<number[]>([]);

  // Load privacy_screen_enabled setting
  useEffect(() => {
    storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)
      .then((settings) => {
        privacyEnabledRef.current = settings?.privacy_screen_enabled ?? false;
      })
      .catch(() => {
        privacyEnabledRef.current = false;
      });
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

    // P1-21: Load day boundary setting
    initDayBoundary().catch(() => {});

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

  // Single init: once Expo Router is ready, check onboarding and navigate
  useEffect(() => {
    if (!navigationState?.key) return;
    let cancelled = false;

    async function init() {
      try {
        const complete = await isOnboardingComplete();
        if (!cancelled && !complete) {
          router.replace('/onboarding');
        }
      } catch {
        // Storage error — route to onboarding to be safe
        if (!cancelled) router.replace('/onboarding');
      } finally {
        if (!cancelled) {
          setInitDone(true);
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [navigationState?.key]);

  // Hide splash screen immediately on mount — prevents Hermes timer deadlock
  // where native splash covering the RN view stops RAF/setTimeout from firing.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Hard deadline: force past init after 5 seconds, no matter what.
  // Uses BOTH setTimeout AND RAF for redundancy.
  useEffect(() => {
    let cancelled = false;

    function forceReady() {
      if (cancelled) return;
      cancelled = true;
      setInitDone(true);
      SplashScreen.hideAsync().catch(() => {});
    }

    // Primary: setTimeout
    const timer = setTimeout(forceReady, 5000);

    // Backup: RAF polling
    const start = Date.now();
    function rafCheck() {
      if (cancelled) return;
      if (Date.now() - start >= 5000) {
        forceReady();
        return;
      }
      requestAnimationFrame(rafCheck);
    }
    requestAnimationFrame(rafCheck);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const showOverlay = privacyOverlay || quickHideActive;

  return (
    <ErrorBoundary>
      <AuthGate>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: Colors.primaryBackground }}>
          {/* P1-22: Offline banner — slides in when connectivity lost */}
          <OfflineBanner />

          {/* Stack ALWAYS renders — no gate blocks Expo Router initialization */}
          <View style={{ flex: 1 }} onTouchEnd={handleTouchEnd}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.primaryBackground },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            </Stack>
          </View>

          {/* Loading overlay — covers Stack until init completes */}
          {!initDone && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 100,
                backgroundColor: Colors.primaryBackground,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color={Colors.accent} size="large" />
            </View>
          )}

          {/* D8-001 / D8-002: Privacy + quick-hide overlay */}
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
        </View>
      </AuthGate>
    </ErrorBoundary>
  );
}
