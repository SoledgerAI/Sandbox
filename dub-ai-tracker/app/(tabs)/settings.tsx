// Settings tab: navigation hub to all settings sub-screens
// Phase 17: Settings and Profile Management
// Per Phase 17 spec: navigation hub to sub-screens

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../../src/utils/storage';
import { hasApiKey as checkHasApiKey } from '../../src/services/anthropic';
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
} from '../../src/services/authService';
import type { AuthMethod } from '../../src/services/authService';
import { PINSetupModal } from '../../src/components/PINSetupModal';
import type { UserProfile, EngagementTier } from '../../src/types/profile';

interface SettingsItem {
  id: string;
  icon: string;
  label: string;
  subtitle: string;
  route: string;
  badge?: string;
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [tier, setTier] = useState<string>('');
  const [hasKey, setHasKey] = useState(false);

  // Security state
  const [lockEnabled, setLockEnabledState] = useState(false);
  const [authMethodVal, setAuthMethodVal] = useState<AuthMethod>('biometric');
  const [biometryType, setBiometryType] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalRequireCurrent, setPinModalRequireCurrent] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profile, tierVal, keyExists, lockVal, methodVal, bio, pinSet] =
      await Promise.all([
        storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
        storageGet<EngagementTier>(STORAGE_KEYS.TIER),
        checkHasApiKey(),
        isLockEnabled(),
        getAuthMethod(),
        isBiometricAvailable(),
        hasPIN(),
      ]);
    setProfileName(profile?.name || 'Not set');
    setTier(tierVal ? tierVal.charAt(0).toUpperCase() + tierVal.slice(1) : 'Balanced');
    setHasKey(keyExists);
    setLockEnabledState(lockVal);
    setAuthMethodVal(methodVal);
    setBiometryType(bio.biometryType);
    setBioAvailable(bio.available);
    setHasPinSet(pinSet);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Also reload on component re-mount (navigation back)
  useEffect(() => {
    loadData();
  }, []);

  const handleToggleLock = useCallback(
    async (value: boolean) => {
      if (value) {
        // Enabling lock
        if (bioAvailable) {
          await setLockEnabled(true);
          await setAuthMethod('biometric');
          setLockEnabledState(true);
          setAuthMethodVal('biometric');
        } else {
          // No biometric — require PIN setup
          setPinModalRequireCurrent(false);
          setPinModalVisible(true);
        }
      } else {
        // Disabling lock — require auth first
        let authenticated = false;
        if (bioAvailable && (authMethodVal === 'biometric' || authMethodVal === 'both')) {
          authenticated = await authenticateBiometric();
        }
        if (!authenticated && hasPinSet) {
          // Fallback: prompt PIN via Alert (simple approach)
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
        // Need to set PIN first
        setPinModalRequireCurrent(false);
        setPinModalVisible(true);
        // After PIN is set, we'll update the method in onPINSuccess
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
    // If lock wasn't enabled yet (PIN-only setup flow), enable it now
    if (!lockEnabled) {
      await setLockEnabled(true);
      await setAuthMethod('pin');
      setLockEnabledState(true);
      setAuthMethodVal('pin');
    }
  }, [lockEnabled]);

  const settingsSections: { title: string; items: SettingsItem[] }[] = [
    {
      title: 'TRACKING',
      items: [
        {
          id: 'tags',
          icon: 'pricetags-outline',
          label: 'Tags',
          subtitle: 'Manage tracking categories',
          route: '/settings/tags',
        },
        {
          id: 'taste',
          icon: 'restaurant-outline',
          label: 'Taste Profile',
          subtitle: 'Cuisines, restrictions, dislikes',
          route: '/settings/taste',
        },
      ],
    },
    {
      title: 'AI COACH',
      items: [
        {
          id: 'apikey',
          icon: 'key-outline',
          label: 'API Key',
          subtitle: hasKey ? 'Configured' : 'Not configured',
          route: '/settings/apikey',
          badge: hasKey ? undefined : 'Setup',
        },
      ],
    },
    {
      title: 'NOTIFICATIONS',
      items: [
        {
          id: 'notifications',
          icon: 'notifications-outline',
          label: 'Notifications',
          subtitle: 'Reminders and check-ins',
          route: '/settings/notifications',
        },
      ],
    },
    {
      title: 'INTEGRATIONS',
      items: [
        {
          id: 'devices',
          icon: 'watch-outline',
          label: 'Devices',
          subtitle: 'Connected health devices',
          route: '/settings/devices',
        },
        {
          id: 'marketplace',
          icon: 'cart-outline',
          label: 'Marketplace',
          subtitle: 'Products, influencers, deals',
          route: '/marketplace',
        },
      ],
    },
    {
      title: 'DATA',
      items: [
        {
          id: 'export',
          icon: 'download-outline',
          label: 'Data Export',
          subtitle: 'Export your data as JSON',
          route: '/settings/export',
        },
        {
          id: 'tier',
          icon: 'speedometer-outline',
          label: 'Engagement Tier',
          subtitle: `${tier} tier`,
          route: '/settings/tier',
        },
      ],
    },
    {
      title: 'ABOUT',
      items: [
        {
          id: 'about',
          icon: 'information-circle-outline',
          label: 'About & Legal',
          subtitle: 'Version, privacy, data deletion',
          route: '/settings/about',
        },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : (
        <>
          {/* Profile Card */}
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => router.push('/settings/profile')}
            activeOpacity={0.7}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {profileName.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profileName}</Text>
              <Text style={styles.profileTier}>{tier} tier</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.secondaryText} />
          </TouchableOpacity>

          {/* Security Section */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>SECURITY</Text>
            <View style={styles.section}>
              {/* App Lock toggle */}
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
                  onValueChange={handleToggleLock}
                  trackColor={{ false: Colors.divider, true: Colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Auth method selector — only when lock enabled */}
              {lockEnabled && (
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => {
                    const methods: AuthMethod[] = bioAvailable
                      ? ['biometric', 'pin', 'both']
                      : ['pin'];
                    const labels = bioAvailable
                      ? [biometryType || 'Biometric', 'PIN', 'Both']
                      : ['PIN'];
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

              {/* Change PIN — only when lock enabled and method includes PIN */}
              {lockEnabled &&
                (authMethodVal === 'pin' || authMethodVal === 'both') && (
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={handleChangePIN}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="keypad-outline" size={22} color={Colors.accent} />
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Change PIN</Text>
                      <Text style={styles.settingSubtitle}>
                        Update your 4-digit PIN
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
                  </TouchableOpacity>
                )}

              {/* Biometric availability info */}
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
            </View>
          </View>

          {/* PIN Setup Modal */}
          <PINSetupModal
            visible={pinModalVisible}
            onClose={() => setPinModalVisible(false)}
            onSuccess={handlePINSuccess}
            requireCurrent={pinModalRequireCurrent}
            verifyCurrentPIN={verifyPIN}
          />

          {/* Grouped Settings */}
          {settingsSections.map((section) => (
            <View key={section.title} style={styles.sectionGroup}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              <View style={styles.section}>
                {section.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.settingRow}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={item.icon as any} size={22} color={Colors.accent} />
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>{item.label}</Text>
                      <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                    </View>
                    {item.badge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  loader: { paddingVertical: 40 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: Colors.primaryBackground,
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: { flex: 1 },
  profileName: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  profileTier: { color: Colors.secondaryText, fontSize: 13, marginTop: 2 },
  sectionGroup: { marginBottom: 20 },
  sectionHeader: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: { gap: 6 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  settingInfo: { flex: 1 },
  settingLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  settingSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: Colors.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: Colors.primaryBackground, fontSize: 11, fontWeight: '700' },
});
