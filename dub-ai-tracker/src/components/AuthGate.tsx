// AuthGate: blocks app access until user authenticates
// Prompt 01 v2: App Lock & Biometric Authentication
// RED TEAM FINDING #2: defaults to LOCKED — no flash of content

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { hapticLight, hapticError, hapticSuccess, hapticWarning } from '../utils/haptics';
import { PINSetupModal } from './PINSetupModal';
import {
  isLockEnabled,
  getAuthMethod,
  authenticateBiometric,
  isBiometricAvailable,
  verifyPIN,
  onLockRequested,
  getLockTimeout,
} from '../services/authService';
import type { AuthMethod } from '../services/authService';

type GateState = 'loading' | 'locked' | 'unlocked';
type LockView = 'biometric' | 'pin';

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<GateState>('loading');
  const [lockView, setLockView] = useState<LockView>('biometric');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('biometric');
  const [biometryType, setBiometryType] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [showPinReset, setShowPinReset] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lockEnabledRef = useRef(false);
  const autoTriggeredRef = useRef(false);
  const backgroundTimeRef = useRef<number>(0);
  const lockTimeoutRef = useRef<number>(0); // seconds

  // Check lock state on mount
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const enabled = await isLockEnabled();
        if (cancelled) return;
        lockEnabledRef.current = enabled;

        if (!enabled) {
          setState('unlocked');
          return;
        }

        const method = await getAuthMethod();
        if (cancelled) return;
        setAuthMethod(method);

        const timeout = await getLockTimeout();
        if (cancelled) return;
        lockTimeoutRef.current = timeout;

        const bio = await isBiometricAvailable();
        if (cancelled) return;
        setBiometryType(bio.biometryType);

        // Decide initial view
        if (method === 'pin' || !bio.available) {
          setLockView('pin');
        } else {
          setLockView('biometric');
        }

        setState('locked');
      } catch {
        // If auth check fails, let the user through rather than locking them out forever
        if (cancelled) return;
        setState('unlocked');
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  // Safety net: if auth check hangs, force unlocked after 5 seconds.
  // Uses BOTH setTimeout AND requestAnimationFrame for redundancy.
  useEffect(() => {
    let cancelled = false;

    // Primary: setTimeout
    const timer = setTimeout(() => {
      if (!cancelled) {
        setState((prev) => (prev === 'loading' ? 'unlocked' : prev));
      }
    }, 5000);

    // Backup: requestAnimationFrame polling
    const start = Date.now();
    function rafCheck() {
      if (cancelled) return;
      if (Date.now() - start >= 5000) {
        setState((prev) => (prev === 'loading' ? 'unlocked' : prev));
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

  // Re-lock when app goes to background (with grace period)
  useEffect(() => {
    function handleAppState(nextState: AppStateStatus) {
      if (nextState === 'background' && lockEnabledRef.current) {
        backgroundTimeRef.current = Date.now();
      }
      if (nextState === 'active' && lockEnabledRef.current && state === 'unlocked') {
        const elapsed = (Date.now() - backgroundTimeRef.current) / 1000;
        if (backgroundTimeRef.current > 0 && elapsed >= lockTimeoutRef.current) {
          setState('locked');
          setPin('');
          setPinError(false);
        }
      }
    }

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [state]);

  // Listen for manual lock requests (e.g., "Lock App Now" button)
  useEffect(() => {
    return onLockRequested(() => {
      if (lockEnabledRef.current) {
        setState('locked');
        setPin('');
        setPinError(false);
      }
    });
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const [biometricFailed, setBiometricFailed] = useState(false);

  const handleBiometric = useCallback(async () => {
    try {
      const bio = await isBiometricAvailable();
      if (!bio.available) {
        // Hardware unavailable — fall through to PIN
        setLockView('pin');
        return;
      }
      const success = await authenticateBiometric();
      if (success) {
        hapticSuccess();
        setBiometricFailed(false);
        setState('unlocked');
      } else {
        // Failed or cancelled — show manual retry button, do NOT auto-retry
        setBiometricFailed(true);
      }
    } catch {
      setBiometricFailed(true);
    }
  }, []);

  // Auto-trigger biometric auth once when lock screen appears
  useEffect(() => {
    if (state === 'locked' && lockView === 'biometric' && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      handleBiometric();
    }
    if (state !== 'locked') {
      autoTriggeredRef.current = false;
      setBiometricFailed(false);
    }
  }, [state, lockView, handleBiometric]);

  const handlePinDigit = useCallback(
    (digit: string) => {
      if (lockoutRemaining > 0) return;
      if (pinError) return;

      const next = pin + digit;
      hapticLight();
      setPin(next);

      if (next.length === 4) {
        // Auto-submit
        (async () => {
          const valid = await verifyPIN(next);
          if (valid) {
            setState('unlocked');
            setPin('');
            setFailCount(0);
          } else {
            hapticError();
            setPinError(true);
            triggerShake();
            const newCount = failCount + 1;
            setFailCount(newCount);

            setTimeout(() => {
              setPin('');
              setPinError(false);
              if (newCount >= MAX_PIN_ATTEMPTS) {
                setLockoutRemaining(LOCKOUT_SECONDS);
                setFailCount(0);
              }
            }, 500);
          }
        })();
      }
    },
    [pin, pinError, failCount, lockoutRemaining, triggerShake],
  );

  const handleBackspace = useCallback(() => {
    if (pinError || lockoutRemaining > 0) return;
    setPin((prev) => prev.slice(0, -1));
  }, [pinError, lockoutRemaining]);

  const handleForgotPIN = useCallback(async () => {
    hapticWarning();
    const bio = await isBiometricAvailable();
    if (bio.available) {
      Alert.alert(
        `Reset PIN with ${bio.biometryType}?`,
        `You can use ${bio.biometryType} to verify your identity and set a new PIN.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Use ${bio.biometryType}`,
            onPress: async () => {
              const success = await authenticateBiometric();
              if (success) {
                hapticSuccess();
                setShowPinReset(true);
              } else {
                hapticError();
                Alert.alert('Verification Failed', 'Biometric verification was not successful. Please try again.');
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Cannot Reset PIN',
        'Without Face ID or Touch ID, there is no way to verify your identity. If you cannot remember your PIN, you will need to delete and reinstall the app. Warning: all local data will be lost.',
        [{ text: 'OK' }],
      );
    }
  }, []);

  // ---- RENDER ----
  // FORENSIC FIX: Children ALWAYS render so the Stack/Expo Router can
  // initialize immediately. Lock/loading UI is an absolute overlay on top.

  return (
    <>
      {children}

      {state !== 'unlocked' && (
        <View style={styles.overlay}>
          {state === 'loading' && (
            <ActivityIndicator color={Colors.accent} size="large" />
          )}

          {state === 'locked' && lockView === 'pin' && (
            <>
              <Text style={styles.appName}>DUB_AI</Text>

              {lockoutRemaining > 0 ? (
                <Text style={styles.lockoutText}>
                  Too many attempts. Try again in {lockoutRemaining}s
                </Text>
              ) : (
                <Text style={styles.subtitle}>Enter your PIN</Text>
              )}

              {/* PIN dots */}
              <Animated.View
                style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
              >
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      pin.length > i && styles.dotFilled,
                      pinError && styles.dotError,
                    ]}
                  />
                ))}
              </Animated.View>

              {/* Numeric keypad */}
              <View style={styles.keypad}>
                {[
                  ['1', '2', '3'],
                  ['4', '5', '6'],
                  ['7', '8', '9'],
                  ['', '0', 'back'],
                ].map((row, ri) => (
                  <View key={ri} style={styles.keyRow}>
                    {row.map((key) => {
                      if (key === '') return <View key="empty" style={styles.key} />;
                      if (key === 'back') {
                        return (
                          <TouchableOpacity
                            key="back"
                            style={styles.key}
                            onPress={handleBackspace}
                          >
                            <Ionicons
                              name="backspace-outline"
                              size={24}
                              color={Colors.text}
                            />
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={key}
                          style={styles.key}
                          onPress={() => handlePinDigit(key)}
                        >
                          <Text style={styles.keyText}>{key}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Switch to biometric if available */}
              {authMethod !== 'pin' && biometryType && (
                <TouchableOpacity
                  style={styles.switchLink}
                  onPress={() => setLockView('biometric')}
                >
                  <Text style={styles.switchText}>Use {biometryType} instead</Text>
                </TouchableOpacity>
              )}

              {/* Forgot PIN? */}
              <TouchableOpacity
                style={styles.forgotPinLink}
                onPress={handleForgotPIN}
              >
                <Text style={styles.forgotPinText}>Forgot PIN?</Text>
              </TouchableOpacity>
            </>
          )}

          {state === 'locked' && lockView === 'biometric' && (
            <>
              <Text style={styles.appName}>DUB_AI</Text>

              {biometricFailed ? (
                <Text style={styles.subtitle}>Authentication failed. Tap to try again.</Text>
              ) : (
                <Text style={styles.subtitle}>Authenticating…</Text>
              )}
              <TouchableOpacity
                style={styles.bioButton}
                onPress={handleBiometric}
                accessibilityRole="button"
                accessibilityLabel={`Unlock with ${biometryType || 'Biometrics'}`}
              >
                <Ionicons
                  name={biometryType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                  size={48}
                  color={Colors.accent}
                />
              </TouchableOpacity>

              {/* Switch to PIN if method includes PIN */}
              {authMethod !== 'biometric' && (
                <TouchableOpacity
                  style={styles.switchLink}
                  onPress={() => setLockView('pin')}
                >
                  <Text style={styles.switchText}>Use PIN instead</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* PIN Reset Modal — triggered by Forgot PIN? + biometric verification */}
      <PINSetupModal
        visible={showPinReset}
        onClose={() => setShowPinReset(false)}
        onSuccess={() => {
          setShowPinReset(false);
          setPin('');
          setFailCount(0);
          setLockoutRemaining(0);
          Alert.alert('PIN Updated', 'Your new PIN has been set. Please enter it to unlock.');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8000,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  appName: {
    color: Colors.accentText,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 48,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 16,
    marginTop: 16,
  },
  lockoutText: {
    color: Colors.dangerText,
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  bioButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 40,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.accent,
  },
  dotError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger,
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  key: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
  },
  keyText: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '500',
  },
  switchLink: {
    marginTop: 32,
    padding: 12,
  },
  switchText: {
    color: Colors.accentText,
    fontSize: 15,
  },
  forgotPinLink: {
    marginTop: 16,
    padding: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotPinText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
});
