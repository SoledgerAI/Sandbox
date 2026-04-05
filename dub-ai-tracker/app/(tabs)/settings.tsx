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
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import { DAY_BOUNDARY_OPTIONS, setDayBoundaryHour } from '../../src/utils/dayBoundary';
import type { DayBoundaryHour } from '../../src/utils/dayBoundary';
import type { AppSettings } from '../../src/types/profile';
import { isApiKeySet as checkHasApiKey } from '../../src/services/apiKeyService';
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
} from '../../src/services/authService';
import type { AuthMethod } from '../../src/services/authService';
import { PINSetupModal } from '../../src/components/PINSetupModal';
import type { UserProfile, BiologicalSex, EngagementTier } from '../../src/types/profile';
import {
  getUserSex,
  setUserSex as saveUserSex,
  getUserAgeRange,
  setUserAgeRange as saveUserAgeRange,
  getUserZip,
  setUserZip as saveUserZip,
  resetOnboarding,
} from '../../src/services/onboardingService';
import type { AgeRange } from '../../src/services/onboardingService';

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

  // Personalization state
  const [userSex, setUserSexState] = useState<BiologicalSex | null>(null);
  const [userAgeRange, setUserAgeRangeState] = useState<AgeRange | null>(null);
  const [userZip, setUserZipState] = useState<string | null>(null);
  const [showSexPicker, setShowSexPicker] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);
  const [showZipInput, setShowZipInput] = useState(false);
  const [dayBoundary, setDayBoundary] = useState<DayBoundaryHour>(0);
  const [showDayBoundary, setShowDayBoundary] = useState(false);

  // Population comparison
  const [showPopulationComparison, setShowPopulationComparison] = useState(false);
  const [hasProfileForComparison, setHasProfileForComparison] = useState(false);

  // Fasting state
  const [fastingEnabled, setFastingEnabled] = useState(false);
  const [fastingProtocol, setFastingProtocol] = useState<'16:8' | '18:6' | '20:4' | 'custom'>('16:8');
  const [eatingWindowStart, setEatingWindowStart] = useState(12);
  const [eatingWindowEnd, setEatingWindowEnd] = useState(20);
  const [showFastingProtocol, setShowFastingProtocol] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profile, tierVal, keyExists, lockVal, methodVal, bio, pinSet, sex, age, zip] =
      await Promise.all([
        storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
        storageGet<EngagementTier>(STORAGE_KEYS.TIER),
        checkHasApiKey(),
        isLockEnabled(),
        getAuthMethod(),
        isBiometricAvailable(),
        hasPIN(),
        getUserSex(),
        getUserAgeRange(),
        getUserZip(),
      ]);
    // P1-21: Load day boundary from settings
    const appSettings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
    const dbh = appSettings?.day_boundary_hour;
    if (dbh === 3 || dbh === 4 || dbh === 5 || dbh === 6) {
      setDayBoundary(dbh);
    } else {
      setDayBoundary(0);
    }
    // Population comparison
    if (appSettings?.show_population_comparison) setShowPopulationComparison(true);
    setHasProfileForComparison(!!profile?.dob && !!profile?.sex && profile.sex !== 'prefer_not_to_say');

    // Fasting settings
    if (appSettings?.fasting_enabled) setFastingEnabled(true);
    if (appSettings?.fasting_protocol) setFastingProtocol(appSettings.fasting_protocol);
    if (appSettings?.eating_window_start != null) setEatingWindowStart(appSettings.eating_window_start);
    if (appSettings?.eating_window_end != null) setEatingWindowEnd(appSettings.eating_window_end);
    setProfileName(profile?.name || 'Not set');
    setTier(tierVal ? tierVal.charAt(0).toUpperCase() + tierVal.slice(1) : 'Balanced');
    setHasKey(keyExists);
    setLockEnabledState(lockVal);
    setAuthMethodVal(methodVal);
    setBiometryType(bio.biometryType);
    setBioAvailable(bio.available);
    setHasPinSet(pinSet);
    setUserSexState(sex);
    setUserAgeRangeState(age);
    setUserZipState(zip);
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

  // Personalization handlers
  const handleSexChange = useCallback(async (sex: BiologicalSex) => {
    await saveUserSex(sex);
    setUserSexState(sex);
    setShowSexPicker(false);
  }, []);

  const handleAgeChange = useCallback(async (range: AgeRange) => {
    await saveUserAgeRange(range);
    setUserAgeRangeState(range);
    setShowAgePicker(false);
  }, []);

  const handleZipSave = useCallback(async (zip: string) => {
    if (zip && /^\d{5}$/.test(zip)) {
      await saveUserZip(zip);
      setUserZipState(zip);
    }
    setShowZipInput(false);
  }, []);

  const handleDayBoundaryChange = useCallback(async (hour: DayBoundaryHour) => {
    const settings = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || {} as AppSettings;
    await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, day_boundary_hour: hour });
    setDayBoundaryHour(hour);
    setDayBoundary(hour);
    setShowDayBoundary(false);
  }, []);

  const FASTING_PROTOCOL_DEFAULTS: Record<string, { start: number; end: number }> = {
    '16:8': { start: 12, end: 20 },
    '18:6': { start: 12, end: 18 },
    '20:4': { start: 14, end: 18 },
    'custom': { start: 12, end: 20 },
  };

  const handlePopulationComparisonToggle = useCallback(async (enabled: boolean) => {
    const settings = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || {} as AppSettings;
    await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, show_population_comparison: enabled });
    setShowPopulationComparison(enabled);
  }, []);

  const handleFastingToggle = useCallback(async (enabled: boolean) => {
    const settings = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || {} as AppSettings;
    await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, fasting_enabled: enabled });
    setFastingEnabled(enabled);
  }, []);

  const handleFastingProtocol = useCallback(async (protocol: '16:8' | '18:6' | '20:4' | 'custom') => {
    const defaults = FASTING_PROTOCOL_DEFAULTS[protocol];
    const settings = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || {} as AppSettings;
    await storageSet(STORAGE_KEYS.SETTINGS, {
      ...settings,
      fasting_protocol: protocol,
      eating_window_start: defaults.start,
      eating_window_end: defaults.end,
    });
    setFastingProtocol(protocol);
    setEatingWindowStart(defaults.start);
    setEatingWindowEnd(defaults.end);
    setShowFastingProtocol(false);
  }, []);

  const handleEatingWindowChange = useCallback(async (start: number, end: number) => {
    const settings = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || {} as AppSettings;
    await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, eating_window_start: start, eating_window_end: end });
    setEatingWindowStart(start);
    setEatingWindowEnd(end);
  }, []);

  const handleResetOnboarding = useCallback(() => {
    Alert.alert(
      'Reset Onboarding',
      'This will show the onboarding questionnaire again on next app launch. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetOnboarding();
            Alert.alert('Done', 'Onboarding will appear on next app launch.');
          },
        },
      ],
    );
  }, []);

  const sexDisplayLabel = userSex === 'male' ? 'Male' : userSex === 'female' ? 'Female' : userSex === 'intersex' ? 'Intersex' : userSex === 'prefer_not_to_say' ? 'Prefer not to say' : 'Not set';

  const settingsSections: { title: string; items: SettingsItem[] }[] = [
    {
      title: 'ACCOUNT',
      items: [
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
      title: 'TRACKING SETUP',
      items: [
        {
          id: 'tags',
          icon: 'pricetags-outline',
          label: 'What You Track',
          subtitle: 'Manage tracking categories',
          route: '/settings/tags',
        },
        {
          id: 'devices',
          icon: 'watch-outline',
          label: 'Devices',
          subtitle: 'Connected health devices',
          route: '/settings/devices',
        },
      ],
    },
    {
      title: 'AI COACH',
      items: [
        {
          id: 'apikey',
          icon: 'key-outline',
          label: 'API Key Setup',
          subtitle: hasKey ? 'Configured' : 'Not configured',
          route: '/settings/apikey',
          badge: hasKey ? undefined : 'Setup',
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
          id: 'healthreport',
          icon: 'document-text-outline',
          label: 'Health Report',
          subtitle: 'Generate PDF health summary',
          route: '/settings/healthreport',
        },
      ],
    },
    {
      title: 'NOTIFICATIONS',
      items: [
        {
          id: 'notifications',
          icon: 'notifications-outline',
          label: 'Preferences',
          subtitle: 'Reminders and check-ins',
          route: '/settings/notifications',
        },
      ],
    },
    {
      title: 'ABOUT',
      items: [
        {
          id: 'about',
          icon: 'information-circle-outline',
          label: 'About DUB_AI',
          subtitle: 'Version, privacy, data deletion',
          route: '/settings/about',
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

              {/* Lock App Now */}
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
          </View>

          {/* PIN Setup Modal */}
          <PINSetupModal
            visible={pinModalVisible}
            onClose={() => setPinModalVisible(false)}
            onSuccess={handlePINSuccess}
            requireCurrent={pinModalRequireCurrent}
            verifyCurrentPIN={verifyPIN}
          />

          {/* Personalization Section */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>PERSONALIZATION</Text>
            <View style={styles.section}>
              {/* Sex */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowSexPicker(!showSexPicker)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Sex</Text>
                  <Text style={styles.settingSubtitle}>{sexDisplayLabel}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              </TouchableOpacity>

              {showSexPicker && (
                <View style={styles.pickerGroup}>
                  {(['male', 'female', 'prefer_not_to_say'] as BiologicalSex[]).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.pickerOption, userSex === opt && styles.pickerOptionSelected]}
                      onPress={() => handleSexChange(opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerOptionText, userSex === opt && styles.pickerOptionTextSelected]}>
                        {opt === 'male' ? 'Male' : opt === 'female' ? 'Female' : 'Prefer not to say'}
                      </Text>
                      {userSex === opt && (
                        <Ionicons name="checkmark" size={18} color={Colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Age Range */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowAgePicker(!showAgePicker)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Age Range</Text>
                  <Text style={styles.settingSubtitle}>{userAgeRange || 'Not set'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              </TouchableOpacity>

              {showAgePicker && (
                <View style={styles.pickerGroup}>
                  {(['18-29', '30-44', '45-59', '60+'] as AgeRange[]).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.pickerOption, userAgeRange === opt && styles.pickerOptionSelected]}
                      onPress={() => handleAgeChange(opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerOptionText, userAgeRange === opt && styles.pickerOptionTextSelected]}>
                        {opt}
                      </Text>
                      {userAgeRange === opt && (
                        <Ionicons name="checkmark" size={18} color={Colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ZIP Code */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  if (showZipInput) {
                    setShowZipInput(false);
                  } else {
                    setShowZipInput(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>ZIP Code</Text>
                  <Text style={styles.settingSubtitle}>{userZip || 'Not set'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              </TouchableOpacity>

              {showZipInput && (
                <View style={styles.pickerGroup}>
                  <ZipInputRow currentZip={userZip} onSave={handleZipSave} />
                </View>
              )}

              {/* P1-21: Day Boundary */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowDayBoundary(!showDayBoundary)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Day Starts At</Text>
                  <Text style={styles.settingSubtitle}>
                    {DAY_BOUNDARY_OPTIONS.find((o) => o.value === dayBoundary)?.label ?? 'Midnight'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              </TouchableOpacity>

              {showDayBoundary && (
                <View style={styles.pickerGroup}>
                  {DAY_BOUNDARY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.pickerOption, dayBoundary === opt.value && styles.pickerOptionSelected]}
                      onPress={() => handleDayBoundaryChange(opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerOptionText, dayBoundary === opt.value && styles.pickerOptionTextSelected]}>
                        {opt.label}
                      </Text>
                      {dayBoundary === opt.value && (
                        <Ionicons name="checkmark" size={18} color={Colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Fasting / Eating Window */}
              <View style={styles.settingRow}>
                <Ionicons name="timer-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Intermittent Fasting</Text>
                  <Text style={styles.settingSubtitle}>I practice intermittent fasting</Text>
                </View>
                <Switch
                  value={fastingEnabled}
                  onValueChange={handleFastingToggle}
                  trackColor={{ false: Colors.divider, true: Colors.accent }}
                  thumbColor={Colors.text}
                />
              </View>

              {fastingEnabled && (
                <>
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => setShowFastingProtocol(!showFastingProtocol)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="nutrition-outline" size={22} color={Colors.accent} />
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Protocol</Text>
                      <Text style={styles.settingSubtitle}>{fastingProtocol}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
                  </TouchableOpacity>

                  {showFastingProtocol && (
                    <View style={styles.pickerGroup}>
                      {(['16:8', '18:6', '20:4', 'custom'] as const).map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.pickerOption, fastingProtocol === opt && styles.pickerOptionSelected]}
                          onPress={() => handleFastingProtocol(opt)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.pickerOptionText, fastingProtocol === opt && styles.pickerOptionTextSelected]}>
                            {opt === 'custom' ? 'Custom' : `${opt} (${FASTING_PROTOCOL_DEFAULTS[opt].start > 12 ? FASTING_PROTOCOL_DEFAULTS[opt].start - 12 + 'pm' : FASTING_PROTOCOL_DEFAULTS[opt].start + 'pm'} – ${FASTING_PROTOCOL_DEFAULTS[opt].end > 12 ? FASTING_PROTOCOL_DEFAULTS[opt].end - 12 + 'pm' : FASTING_PROTOCOL_DEFAULTS[opt].end + 'pm'})`}
                          </Text>
                          {fastingProtocol === opt && (
                            <Ionicons name="checkmark" size={18} color={Colors.accent} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <View style={styles.settingRow}>
                    <Ionicons name="restaurant-outline" size={22} color={Colors.accent} />
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Eating Window</Text>
                      <Text style={styles.settingSubtitle}>
                        {eatingWindowStart > 12 ? `${eatingWindowStart - 12}pm` : eatingWindowStart === 12 ? '12pm' : `${eatingWindowStart}am`}
                        {' – '}
                        {eatingWindowEnd > 12 ? `${eatingWindowEnd - 12}pm` : eatingWindowEnd === 12 ? '12pm' : `${eatingWindowEnd}am`}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleEatingWindowChange(Math.max(0, eatingWindowStart - 1), eatingWindowEnd)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove-circle-outline" size={24} color={Colors.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleEatingWindowChange(Math.min(23, eatingWindowStart + 1), eatingWindowEnd)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Population Comparison */}
              <View style={styles.settingRow}>
                <Ionicons name="people-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show population comparison</Text>
                  <Text style={styles.settingSubtitle}>
                    {hasProfileForComparison
                      ? 'Compare your metrics to age/sex averages'
                      : 'Set your date of birth and biological sex in Profile to enable'}
                  </Text>
                </View>
                <Switch
                  value={showPopulationComparison}
                  onValueChange={handlePopulationComparisonToggle}
                  disabled={!hasProfileForComparison}
                  trackColor={{ false: Colors.divider, true: Colors.accent }}
                  thumbColor={Colors.text}
                />
              </View>

              {/* Reset Onboarding */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={handleResetOnboarding}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={22} color={Colors.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Reset Onboarding</Text>
                  <Text style={styles.settingSubtitle}>
                    Show personalization questionnaire again
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sharing Section — placeholder */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>SHARING</Text>
            <View style={styles.section}>
              <View style={[styles.settingRow, { opacity: 0.5 }]}>
                <Ionicons name="share-outline" size={22} color={Colors.secondaryText} />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: Colors.secondaryText }]}>
                    Share with healthcare provider
                  </Text>
                  <Text style={styles.settingSubtitle}>Coming soon</Text>
                </View>
              </View>
            </View>
          </View>

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
                {section.title === 'AI COACH' && (
                  <View style={styles.coachDisclosure}>
                    <Ionicons name="information-circle-outline" size={14} color={Colors.secondaryText} />
                    <Text style={styles.coachDisclosureText}>
                      Your AI Coach adapts its communication style based on your selected goals and tracking tier. More detailed tracking unlocks more specific coaching insights.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function ZipInputRow({ currentZip, onSave }: { currentZip: string | null; onSave: (zip: string) => void }) {
  const [value, setValue] = useState(currentZip || '');
  return (
    <View style={styles.zipRow}>
      <TextInput
        style={styles.zipInput}
        value={value}
        onChangeText={(text) => setValue(text.replace(/[^0-9]/g, '').slice(0, 5))}
        placeholder="00000"
        placeholderTextColor={Colors.divider}
        keyboardType="number-pad"
        maxLength={5}
        returnKeyType="done"
        onSubmitEditing={() => onSave(value)}
      />
      <TouchableOpacity
        style={styles.zipSaveBtn}
        onPress={() => onSave(value)}
        activeOpacity={0.7}
      >
        <Text style={styles.zipSaveBtnText}>Save</Text>
      </TouchableOpacity>
    </View>
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
  pickerGroup: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 6,
    gap: 4,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  pickerOptionSelected: {
    backgroundColor: Colors.cardBackground,
  },
  pickerOptionText: {
    color: Colors.text,
    fontSize: 15,
  },
  pickerOptionTextSelected: {
    color: Colors.accentText,
    fontWeight: '600',
  },
  zipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  zipInput: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    letterSpacing: 4,
  },
  zipSaveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  zipSaveBtnText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '600',
  },
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
  coachDisclosure: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  coachDisclosureText: {
    color: Colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
