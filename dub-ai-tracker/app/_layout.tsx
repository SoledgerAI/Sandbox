// Root layout — FORENSIC FIX: Flat init architecture
// - AuthGate renders children ALWAYS (lock UI is an overlay, not a blocker)
// - OnboardingGate REMOVED — onboarding handled via router navigation
// - Stack ALWAYS renders — Expo Router initializes immediately
// - isOnboardingComplete() now reads AsyncStorage first (fast, no Keychain)
// - Single init effect: check onboarding, navigate if needed

import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, AppState, AppStateStatus, Linking, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../src/utils/storage';
import { findUnresolvableTileRoutes } from '../src/constants/dashboardTiles';
import { runMigrations } from '../src/utils/schemaMigration';
import { processQueue } from '../src/utils/offline';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';
import { OfflineBanner } from '../src/components/common/OfflineBanner';
import { AuthGate } from '../src/components/AuthGate';
import { LoadingIndicator } from '../src/components/common/LoadingIndicator';
import { ToastProvider } from '../src/contexts/ToastContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { isOnboardingComplete } from '../src/services/onboardingService';
import { handleStravaCallback } from '../src/services/strava';
import { onAppLaunchSync } from '../src/services/notificationService';
import type { AppSettings } from '../src/types/profile';

// Keep splash screen visible until initialization completes
SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_MIN_MS = 2500;
const SPLASH_FADE_MS = 500;

// Bug #15: Module-level flag — once the app has booted once during this
// process's lifetime, never re-show the loading splash. Protects against
// any transient re-mount of the root layout (rapid navigation, HMR in dev,
// etc.) from flashing the splash mid-session.
let sessionInitComplete = false;

const BRAND_GOLD = '#D4A843';
const TAGLINE_COLOR = '#888';
const TAGLINE_TEXT = 'Bloomberg Terminal for the Body';

export default function RootLayout() {
  const [initDone, setInitDone] = useState(sessionInitComplete);
  const [splashMinTimeMet, setSplashMinTimeMet] = useState(sessionInitComplete);
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

  // S29-D: Dev-time tile route validator. Catches typos like
  // '/log/mood_mental' (the file is mood-mental.tsx) at boot instead of
  // when the user taps the tile and lands on Unmatched Route.
  useEffect(() => {
    if (!__DEV__) return;
    const broken = findUnresolvableTileRoutes();
    if (broken.length > 0) {
      console.warn(
        '[S29-D] Unresolvable dashboard tile routes:',
        broken.map((t) => `${t.id} → ${t.route}`).join(', '),
      );
    }
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
        // Sprint 24: Re-sync notifications on foreground (iOS clears them on update)
        onAppLaunchSync().catch((error) => {
          console.warn('Notification sync failed:', error);
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

      // Handle Strava callback: dubaitracker://strava-callback?code=...&state=...
      if (url.includes('strava-callback') || url.includes('strava/callback')) {
        const params = new URL(url).searchParams;
        const code = params.get('code');
        const returnedState = params.get('state');
        if (code) {
          handleStravaCallback(code, returnedState).catch(() => {
            // Error handled inside service; typed UX added in step 6.
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
        // H2: Run schema migrations before any screens read data.
        // Failure is logged but non-fatal — app continues with existing
        // data, and the migration will be retried on next boot.
        const migrationResult = await runMigrations();
        if (!migrationResult.success) {
          console.error('[MIGRATION] Failed:', migrationResult);
        } else if (migrationResult.migrationsRun > 0 && __DEV__) {
          console.log(
            `[MIGRATION] Ran ${migrationResult.migrationsRun} migration(s): v${migrationResult.fromVersion} → v${migrationResult.toVersion}`,
          );
        }

        if (__DEV__) console.log('[ONBOARD-08] _layout init: checking onboarding status...');
        const complete = await isOnboardingComplete();
        if (__DEV__) console.log('[ONBOARD-08] _layout init: isOnboardingComplete =', complete);
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
      // Bug #15: Lock in session state so any re-mount doesn't re-flash splash
      if (!sessionInitComplete) {
        sessionInitComplete = true;
        // Show fade overlay to smooth the transition — only on first launch
        setShowFadeOverlay(true);
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: SPLASH_FADE_MS,
          useNativeDriver: true,
        }).start(() => {
          setShowFadeOverlay(false);
        });
      }
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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

          {/* Bug #15: Loading overlay — covers Stack until init completes (first launch only) */}
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
              <Text style={{ color: BRAND_GOLD, fontSize: 40, fontWeight: '500', letterSpacing: 2 }}>DUB</Text>
              <Text style={{ color: TAGLINE_COLOR, fontSize: 13, fontWeight: '500', marginTop: 8, marginBottom: 28 }}>
                {TAGLINE_TEXT}
              </Text>
              <LoadingIndicator size="large" />
            </View>
          )}

          {/* Bug #15: Fade overlay — smooth transition from splash */}
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
              <Text style={{ color: BRAND_GOLD, fontSize: 40, fontWeight: '500', letterSpacing: 2 }}>DUB</Text>
              <Text style={{ color: TAGLINE_COLOR, fontSize: 13, fontWeight: '500', marginTop: 8 }}>
                {TAGLINE_TEXT}
              </Text>
            </Animated.View>
          )}

          {/* Bug #15: D8-001 / D8-002 Privacy + quick-hide overlay — also rebranded */}
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
              <Text style={{ color: BRAND_GOLD, fontSize: 40, fontWeight: '500', letterSpacing: 2 }}>DUB</Text>
              <Text style={{ color: TAGLINE_COLOR, fontSize: 13, fontWeight: '500', marginTop: 8 }}>
                {TAGLINE_TEXT}
              </Text>
            </View>
          )}
        </View>
      </AuthGate>
      </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
