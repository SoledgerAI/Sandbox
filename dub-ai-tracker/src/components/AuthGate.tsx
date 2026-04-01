// AuthGate: blocks app access until user authenticates
// Prompt 01 v2: App Lock & Biometric Authentication
// RED TEAM FINDING #2: defaults to LOCKED — no flash of content

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
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
import {
  isLockEnabled,
  getAuthMethod,
  authenticateBiometric,
  isBiometricAvailable,
  verifyPIN,
  onLockRequested,
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

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lockEnabledRef = useRef(false);

  // Check lock state on mount
  useEffect(() => {
    async function check() {
      const enabled = await isLockEnabled();
      lockEnabledRef.current = enabled;

      if (!enabled) {
        setState('unlocked');
        return;
      }

      const method = await getAuthMethod();
      setAuthMethod(method);

      const bio = await isBiometricAvailable();
      setBiometryType(bio.biometryType);

      // Decide initial view
      if (method === 'pin' || !bio.available) {
        setLockView('pin');
      } else {
        setLockView('biometric');
      }

      setState('locked');
    }
    check();
  }, []);

  // Re-lock when app goes to background
  useEffect(() => {
    function handleAppState(nextState: AppStateStatus) {
      if (nextState === 'background' && lockEnabledRef.current) {
        setState('locked');
        setPin('');
        setPinError(false);
      }
    }

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

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

  const handleBiometric = useCallback(async () => {
    const success = await authenticateBiometric();
    if (success) {
      setState('unlocked');
    }
  }, []);

  const handlePinDigit = useCallback(
    (digit: string) => {
      if (lockoutRemaining > 0) return;
      if (pinError) return;

      const next = pin + digit;
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

  // ---- RENDER ----

  if (state === 'loading') {
    return (
      <View style={styles.fullScreen}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (state === 'unlocked') {
    return <>{children}</>;
  }

  // LOCKED state
  if (lockView === 'pin') {
    return (
      <View style={styles.fullScreen}>
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
      </View>
    );
  }

  // Biometric view
  return (
    <View style={styles.fullScreen}>
      <Text style={styles.appName}>DUB_AI</Text>

      <TouchableOpacity style={styles.bioButton} onPress={handleBiometric}>
        <Ionicons
          name={biometryType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
          size={48}
          color={Colors.accent}
        />
      </TouchableOpacity>
      <Text style={styles.subtitle}>
        Tap to unlock with {biometryType || 'Biometrics'}
      </Text>

      {/* Switch to PIN if method includes PIN */}
      {authMethod !== 'biometric' && (
        <TouchableOpacity
          style={styles.switchLink}
          onPress={() => setLockView('pin')}
        >
          <Text style={styles.switchText}>Use PIN instead</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
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
    color: Colors.danger,
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
    maxWidth: 280,
    gap: 12,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  key: {
    width: 72,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
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
});
