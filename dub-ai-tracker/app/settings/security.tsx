// Settings > Security
// H6 split: extracted from (tabs)/settings.tsx
// App Lock, Auth Method, Change PIN, Lock After, Lock App Now

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { LoadingIndicator } from '../../src/components/common/LoadingIndicator';
import { hapticSelection } from '../../src/utils/haptics';
import { PINSetupModal } from '../../src/components/PINSetupModal';
import {
  isLockEnabled,
  setLockEnabled,
  getAuthMethod,
  setAuthMethod,
  isBiometricAvailable,
  authenticateBiometric,
  verifyPIN,
  hasPIN,
  clearAuthData,
  lockApp,
  getLockTimeout,
  setLockTimeout,
} from '../../src/services/authService';
import type { AuthMethod, LockTimeout } from '../../src/services/authService';

export default function SecurityScreen() {
  const [loading, setLoading] = useState(true);
  const [lockEnabled, setLockEnabledState] = useState(false);
  const [authMethodVal, setAuthMethodVal] = useState<AuthMethod>('biometric');
  const [biometryType, setBiometryType] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalRequireCurrent, setPinModalRequireCurrent] = useState(false);
  const [lockTimeout, setLockTimeoutState] = useState<LockTimeout>(0);

  useEffect(() => {
    (async () => {
      const [lockVal, methodVal, bio, pinSet, timeout] = await Promise.all([
        isLockEnabled(),
        getAuthMethod(),
        isBiometricAvailable(),
        hasPIN(),
        getLockTimeout(),
      ]);
      setLockEnabledState(lockVal);
      setAuthMethodVal(methodVal);
      setBiometryType(bio.biometryType);
      setBioAvailable(bio.available);
      setHasPinSet(pinSet);
      setLockTimeoutState(timeout);
      setLoading(false);
    })();
  }, []);

  const handleToggleLock = useCallback(
    async (value: boolean) => {
      if (value) {
        if (bioAvailable) {
          await setLockEnabled(true);
          await setAuthMethod('biometric');
          setLockEnabledState(true);
          setAuthMethodVal('biometric');
        } else {
          setPinModalRequireCurrent(false);
          setPinModalVisible(true);
        }
      } else {
        let authenticated = false;
        if (bioAvailable && (authMethodVal === 'biometric' || authMethodVal === 'both')) {
          authenticated = await authenticateBiometric();
        }
        if (!authenticated && hasPinSet) {
          await new Promise<void>((resolve) => {
            Alert.prompt(
              'Enter PIN',
              'Enter your current PIN to disable App Lock',
              async (input) => {
                if (input && (await verifyPIN(input))) {
                  authenticated = true;
                }
                resolve();
              },
              'secure-text',
            );
          });
        }
        if (authenticated) {
          await clearAuthData();
          setLockEnabledState(false);
          setHasPinSet(false);
        }
      }
    },
    [bioAvailable, authMethodVal, hasPinSet],
  );

  const handleChangeAuthMethod = useCallback(
    async (method: AuthMethod) => {
      if ((method === 'pin' || method === 'both') && !hasPinSet) {
        setPinModalRequireCurrent(false);
        setPinModalVisible(true);
        return;
      }
      await setAuthMethod(method);
      setAuthMethodVal(method);
    },
    [hasPinSet],
  );

  const handleChangePIN = useCallback(() => {
    setPinModalRequireCurrent(true);
    setPinModalVisible(true);
  }, []);

  const handlePINSuccess = useCallback(async () => {
    setPinModalVisible(false);
    setHasPinSet(true);
    if (!lockEnabled) {
      await setLockEnabled(true);
      await setAuthMethod('pin');
      setLockEnabledState(true);
      setAuthMethodVal('pin');
    }
  }, [lockEnabled]);

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Security</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.loader}><LoadingIndicator /></View>
        ) : (
          <View style={styles.section}>
            <View style={styles.settingRow}>
              <Ionicons name="lock-closed-outline" size={22} color={Colors.accent} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>App Lock</Text>
                <Text style={styles.settingSubtitle}>
                  Require authentication to open app
                </Text>
              </View>
              <Switch
                value={lockEnabled}
                onValueChange={(v) => { hapticSelection(); handleToggleLock(v); }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {lockEnabled && (
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  const methods: AuthMethod[] = bioAvailable
                    ? ['biometric', 'pin', 'both']
                    : ['pin'];
                  const currentIdx = methods.indexOf(authMethodVal);
                  const nextIdx = (currentIdx + 1) % methods.length;
                  handleChangeAuthMethod(methods[nextIdx]);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="shield-checkmark-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Authentication Method</Text>
                  <Text style={styles.settingSubtitle}>
                    {authMethodVal === 'biometric'
                      ? biometryType || 'Biometric'
                      : authMethodVal === 'pin'
                        ? 'PIN'
                        : `${biometryType || 'Biometric'} + PIN`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              </TouchableOpacity>
            )}

            {lockEnabled && (authMethodVal === 'pin' || authMethodVal === 'both') && (
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleChangePIN}
                activeOpacity={0.7}
              >
                <Ionicons name="keypad-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Change PIN</Text>
                  <Text style={styles.settingSubtitle}>Update your 4-digit PIN</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              </TouchableOpacity>
            )}

            <View style={styles.settingRow}>
              <Ionicons name="finger-print-outline" size={22} color={Colors.secondaryText} />
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: Colors.secondaryText }]}>
                  Biometric type available
                </Text>
                <Text style={styles.settingSubtitle}>
                  {biometryType || 'Not available'}
                </Text>
              </View>
            </View>

            {lockEnabled && (
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  const timeouts: LockTimeout[] = [0, 60, 300, 900];
                  const idx = timeouts.indexOf(lockTimeout);
                  const next = timeouts[(idx + 1) % timeouts.length];
                  setLockTimeout(next);
                  setLockTimeoutState(next);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Lock After</Text>
                  <Text style={styles.settingSubtitle}>
                    {lockTimeout === 0 ? 'Immediately' : lockTimeout === 60 ? 'After 1 minute' : lockTimeout === 300 ? 'After 5 minutes' : 'After 15 minutes'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              </TouchableOpacity>
            )}

            {lockEnabled && (
              <TouchableOpacity
                style={styles.lockNowBtn}
                onPress={() => lockApp()}
                activeOpacity={0.7}
              >
                <Ionicons name="lock-closed" size={18} color={Colors.accent} />
                <Text style={styles.lockNowText}>Lock App Now</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <PINSetupModal
          visible={pinModalVisible}
          onClose={() => setPinModalVisible(false)}
          onSuccess={handlePINSuccess}
          requireCurrent={pinModalRequireCurrent}
          verifyCurrentPIN={verifyPIN}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: Spacing.lg, paddingTop: 12, paddingBottom: Spacing.xxxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  loader: { paddingVertical: 40 },
  section: { gap: 6 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingInfo: { flex: 1 },
  settingLabel: { color: Colors.text, fontSize: FontSize.base, fontWeight: FontWeight.medium },
  settingSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  lockNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  lockNowText: {
    color: Colors.accentText,
    fontSize: 15,
    fontWeight: '600',
  },
});
