// Root layout — FORENSIC FIX: Flat init architecture
// - AuthGate renders children ALWAYS (lock UI is an overlay, not a blocker)
// - OnboardingGate REMOVED — onboarding handled via router navigation
// - Stack ALWAYS renders — Expo Router initializes immediately
// - isOnboardingComplete() now reads AsyncStorage first (fast, no Keychain)
// - Single init effect: check onboarding, navigate if needed

import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, AppState, AppStateStatus, Linking, Text, View } from 'react-native';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../src/utils/storage';
import { processQueue } from '../src/utils/offline';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';
import { OfflineBanner } from '../src/components/common/OfflineBanner';
import { AuthGate } from '../src/components/AuthGate';
import { LoadingIndicator } from '../src/components/common/LoadingIndicator';
import { ToastProvider } from '../src/contexts/ToastContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { isOnboardingComplete } from '../src/services/onboardingService';
import { handleStravaCallback } from '../src/services/strava';
import type { AppSettings } from '../src/types/profile';

// Keep splash screen visible until initialization completes
SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_MIN_MS = 2500;
const SPLASH_FADE_MS = 500;

export default function RootLayout() {
  const [initDone, setInitDone] = useState(false);
  const [splashMinTimeMet, setSplashMinTimeMet] = useState(false);
  const [showFadeOverlay, setShowFadeOverlay] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const navigationState = useRootNavigationState();

  // D8-001: Privacy screen overlay driven by AppState + setting
  // SEC: Default to true — protect app switcher screenshots until user explicitly opts out
  const [privacyOverlay, setPrivacyOverlay] = useState(false);
  const privacyEnabledRef = useRef(true);

  // D8-002: Triple-tap quick-hide gesture
  const [quickHideActive, setQuickHideActive] = useState(false);
  const tapTimestampsRef = useRef<number[]>([]);

  // Sprint 8 Fix 3: Splash minimum display timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashMinTimeMet(true);
    }, SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // Load privacy_screen_enabled setting
  useEffect(() => {
    storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)
      .then((settings) => {
        privacyEnabledRef.current = settings?.privacy_screen_enabled ?? true;
      })
      .catch(() => {
        privacyEnabledRef.current = true;
      });
  }, []);

  // D8-001: Listen for AppState changes + MASTER-62: process offline queue on resume
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'active') {
        setPrivacyOverlay(false);
        // MASTER-62: Process offline queue when app returns to foreground
        processQueue().catch((error) => {
          console.warn('Queue sync failed:', error);
        });
      } else if (nextState === 'inactive' || nextState === 'background') {
        if (privacyEnabledRef.current) {
          setPrivacyOverlay(true);
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // MASTER-62: Also process queue on initial launch
    processQueue().catch((error) => {
      console.warn('Queue sync failed:', error);
    });


    return () => subscription.remove();
  }, []);

  // Sprint 11: Strava OAuth deep link handler
  useEffect(() => {
    function handleDeepLink(event: { url: string }) {
      const url = event.url;
      if (!url) return;

      // Handle Strava callback: dubaitracker://strava-callback?code=...
      if (url.includes('strava-callback') || url.includes('strava/callback')) {
        const params = new URL(url).searchParams;
        const code = params.get('code');
        if (code) {
          handleStravaCallback(code).catch(() => {
            // Error handled inside service
          });
        }
      }
    }

    const linkingSub = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => linkingSub.remove();
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
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [navigationState?.key]);

  // Sprint 8 Fix 3: Hide splash only when BOTH init AND min timer are met, then fade
  useEffect(() => {
    if (initDone && splashMinTimeMet) {
      SplashScreen.hideAsync().catch(() => {});
      // Show fade overlay to smooth the transition
      setShowFadeOverlay(true);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
        useNativeDriver: true,
      }).start(() => {
        setShowFadeOverlay(false);
      });
    }
  }, [initDone, splashMinTimeMet, fadeAnim]);

  // Hard deadline: force past init after 8 seconds (2.5s splash + margin)
  useEffect(() => {
    let cancelled = false;

    function forceReady() {
      if (cancelled) return;
      cancelled = true;
      setInitDone(true);
      setSplashMinTimeMet(true);
    }

    const timer = setTimeout(forceReady, 8000);

    // Backup: RAF polling
    const start = Date.now();
    function rafCheck() {
      if (cancelled) return;
      if (Date.now() - start >= 8000) {
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
      <ThemeProvider>
      <ToastProvider>
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
          {(!initDone || !splashMinTimeMet) && (
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
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 16 }}>DUB</Text>
              <LoadingIndicator size="large" />
            </View>
          )}

          {/* Sprint 8 Fix 3: Fade overlay — smooth transition from splash */}
          {showFadeOverlay && (
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 101,
                backgroundColor: Colors.primaryBackground,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: fadeAnim,
              }}
              pointerEvents="none"
            >
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '600' }}>DUB</Text>
            </Animated.View>
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
      </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
