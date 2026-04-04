// Root layout: checks onboarding state on launch
// Phase 3: Onboarding Flow
// Per Section 8: If dub.onboarding.complete is true, skip to Dashboard

import { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Text, View } from 'react-native';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage'; // DEBUG: REMOVE BEFORE PRODUCTION — diagnostic
import * as SecureStore from 'expo-secure-store'; // DEBUG: REMOVE BEFORE PRODUCTION — diagnostic
import { Colors } from '../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../src/utils/storage';
import { processQueue } from '../src/utils/offline';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';
import { AuthGate } from '../src/components/AuthGate';
import { OnboardingGate } from '../src/components/OnboardingGate';
import { isOnboardingComplete } from '../src/services/onboardingService';
import { DebugOverlay, debugStep } from '../src/components/DebugOverlay'; // DEBUG: REMOVE BEFORE PRODUCTION
import type { AppSettings } from '../src/types/profile';

// DEBUG: REMOVE BEFORE PRODUCTION — hide splash IMMEDIATELY so debug overlay is visible
// We no longer keep the splash screen up; we want to see the debug text instead.
debugStep('STEP 0: Module loaded — hiding splash immediately');
SplashScreen.hideAsync().catch(() => {});

// DEBUG: REMOVE BEFORE PRODUCTION — Raw storage diagnostic
// Runs at module scope BEFORE any component renders.
// Tests whether native modules respond at all in release builds.
// Uses dual setTimeout + requestAnimationFrame timeout to diagnose which timer works.
const DIAG_TIMEOUT = 3000;

/** Race a promise against a dual setTimeout+raf timeout (for diagnostics) */
function diagRace<T>(promise: Promise<T>, label: string): Promise<T> {
  let settled = false;
  const timeout = new Promise<T>((_, rej) => {
    const start = Date.now();
    const timer = setTimeout(() => {
      if (!settled) { settled = true; rej(new Error(`setTimeout TIMEOUT ${DIAG_TIMEOUT}ms`)); }
    }, DIAG_TIMEOUT);
    function rafCheck() {
      if (settled) { clearTimeout(timer); return; }
      if (Date.now() - start >= DIAG_TIMEOUT) {
        clearTimeout(timer); settled = true;
        rej(new Error(`raf TIMEOUT ${DIAG_TIMEOUT}ms`));
        return;
      }
      requestAnimationFrame(rafCheck);
    }
    requestAnimationFrame(rafCheck);
  });
  return Promise.race([promise, timeout]).then(
    (v) => { settled = true; return v; },
    (e) => { settled = true; throw e; },
  );
}

(async () => {
  // Test 1: AsyncStorage — read a non-existent key (should return null fast)
  debugStep('DIAG-1: AsyncStorage.getItem (non-existent key)...');
  try {
    const t0 = Date.now();
    const val = await diagRace(AsyncStorage.getItem('__DIAG_NOKEY__'), 'DIAG-1');
    debugStep(`DIAG-1: result = ${JSON.stringify(val)} (${Date.now() - t0}ms)`);
  } catch (e: unknown) {
    debugStep(`DIAG-1: FAIL — ${e instanceof Error ? e.message : e}`);
  }

  // Test 2: AsyncStorage — full set/get/remove cycle
  debugStep('DIAG-2: AsyncStorage set+get+remove...');
  try {
    const t0 = Date.now();
    await diagRace(AsyncStorage.setItem('__DIAG__', 'ok'), 'DIAG-2-set');
    const val = await diagRace(AsyncStorage.getItem('__DIAG__'), 'DIAG-2-get');
    debugStep(`DIAG-2: result = ${JSON.stringify(val)} (${Date.now() - t0}ms)`);
    AsyncStorage.removeItem('__DIAG__').catch(() => {});
  } catch (e: unknown) {
    debugStep(`DIAG-2: FAIL — ${e instanceof Error ? e.message : e}`);
  }

  // Test 3: SecureStore — full set/get/remove cycle
  debugStep('DIAG-3: SecureStore set+get+remove...');
  try {
    const t0 = Date.now();
    await diagRace(SecureStore.setItemAsync('__DIAG__', 'ok'), 'DIAG-3-set');
    const val = await diagRace(SecureStore.getItemAsync('__DIAG__'), 'DIAG-3-get');
    debugStep(`DIAG-3: result = ${JSON.stringify(val)} (${Date.now() - t0}ms)`);
    SecureStore.deleteItemAsync('__DIAG__').catch(() => {});
  } catch (e: unknown) {
    debugStep(`DIAG-3: FAIL — ${e instanceof Error ? e.message : e}`);
  }

  debugStep('DIAG: All storage tests complete');
})();

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
        debugStep('STEP 2c: reading ONBOARDING_COMPLETE from SecureStore (3s timeout)...'); // DEBUG: REMOVE BEFORE PRODUCTION
        const t0 = Date.now(); // DEBUG: REMOVE BEFORE PRODUCTION
        const complete = await isOnboardingComplete();
        const elapsed = Date.now() - t0; // DEBUG: REMOVE BEFORE PRODUCTION
        debugStep(`STEP 2d: ONBOARDING_COMPLETE = ${complete} (${elapsed}ms${elapsed >= 3000 ? ' TIMEOUT-FALLBACK' : ''})`); // DEBUG: REMOVE BEFORE PRODUCTION
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

  // Safety net: if navigation state never resolves, force past checking after 5 seconds.
  // Uses requestAnimationFrame polling because setTimeout may not fire
  // in Hermes release builds.
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    function rafCheck() {
      if (cancelled) return;
      if (Date.now() - start >= 5000) {
        debugStep('STEP TIMEOUT: 5s raf safety net fired — forcing checking=false'); // DEBUG: REMOVE BEFORE PRODUCTION
        setChecking(false);
        return;
      }
      requestAnimationFrame(rafCheck);
    }
    requestAnimationFrame(rafCheck);
    return () => { cancelled = true; };
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
