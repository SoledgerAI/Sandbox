// PINSetupModal: create or change a 4-digit PIN
// Prompt 01 v2: App Lock & Biometric Authentication

import { useState, useCallback, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { hapticLight } from '../utils/haptics';
import { setPIN } from '../services/authService';

interface PINSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requireCurrent?: boolean;
  verifyCurrentPIN?: (pin: string) => Promise<boolean>;
}

type Step = 'current' | 'enter' | 'confirm';

export function PINSetupModal({
  visible,
  onClose,
  onSuccess,
  requireCurrent = false,
  verifyCurrentPIN,
}: PINSetupModalProps) {
  const [step, setStep] = useState<Step>(requireCurrent ? 'current' : 'enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const reset = useCallback(() => {
    setStep(requireCurrent ? 'current' : 'enter');
    setPin('');
    setFirstPin('');
    setError('');
  }, [requireCurrent]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (error) return;

      const next = pin + digit;
      hapticLight();
      setPin(next);

      if (next.length === 4) {
        (async () => {
          if (step === 'current') {
            const valid = verifyCurrentPIN ? await verifyCurrentPIN(next) : false;
            if (valid) {
              setPin('');
              setStep('enter');
            } else {
              setError('Incorrect PIN');
              triggerShake();
              setTimeout(() => {
                setPin('');
                setError('');
              }, 500);
            }
            return;
          }

          if (step === 'enter') {
            setFirstPin(next);
            setPin('');
            setStep('confirm');
            return;
          }

          // step === 'confirm'
          if (next === firstPin) {
            await setPIN(next);
            reset();
            onSuccess();
          } else {
            setError('PINs do not match');
            triggerShake();
            setTimeout(() => {
              setPin('');
              setFirstPin('');
              setError('');
              setStep('enter');
            }, 800);
          }
        })();
      }
    },
    [pin, step, firstPin, error, verifyCurrentPIN, triggerShake, reset, onSuccess],
  );

  const handleBackspace = useCallback(() => {
    if (error) return;
    setPin((prev) => prev.slice(0, -1));
  }, [error]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const stepLabel = (): string => {
    if (step === 'current') return 'Enter current PIN';
    if (step === 'enter') return 'Enter a 4-digit PIN';
    return 'Confirm your PIN';
  };

  const stepIndicator = (): string => {
    if (step === 'current') return '';
    if (step === 'enter') return 'Step 1 of 2';
    return 'Step 2 of 2';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          {stepIndicator() !== '' && (
            <Text style={styles.stepText}>{stepIndicator()}</Text>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{stepLabel()}</Text>

          {error !== '' && <Text style={styles.errorText}>{error}</Text>}

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
                  error !== '' && styles.dotError,
                ]}
              />
            ))}
          </Animated.View>

          {/* Keypad */}
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
                      onPress={() => handleDigit(key)}
                    >
                      <Text style={styles.keyText}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  cancelBtn: {
    padding: 8,
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.accentText,
    fontSize: 16,
  },
  stepText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 32,
  },
  errorText: {
    color: Colors.dangerText,
    fontSize: 14,
    marginBottom: 12,
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
});
