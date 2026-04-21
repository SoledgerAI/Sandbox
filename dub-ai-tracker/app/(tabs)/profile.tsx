// Profile tab — replaces Settings in tab bar (Sprint 9)
// Hub for user identity, quick access to settings sub-screens

import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import { hapticWarning } from '../../src/utils/haptics';
import { resetOnboarding } from '../../src/services/onboardingService';
import { SECURE_KEYS, deleteSecure as deleteSecureKey } from '../../src/services/secureStorageService';
import type { UserProfile, EngagementTier } from '../../src/types/profile';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';

interface MenuItem {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  route?: string;
  onPress?: () => void;
  danger?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function ProfileScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const [profileName, setProfileName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [tier, setTier] = useState('');

  const loadData = useCallback(async () => {
    const [profile, tierVal, uri] = await Promise.all([
      storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
      storageGet<EngagementTier>(STORAGE_KEYS.TIER),
      AsyncStorage.getItem('PROFILE_AVATAR_URI'),
    ]);
    setProfileName(profile?.name || 'Not set');
    setTier(tierVal ? tierVal.charAt(0).toUpperCase() + tierVal.slice(1) : 'Balanced');
    setAvatarUri(uri);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleResetOnboarding = useCallback(() => {
    hapticWarning();
    Alert.alert(
      'Reset Onboarding',
      'This will reset the onboarding questionnaire. Your health data will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetOnboarding();
            router.replace('/onboarding');
          },
        },
      ],
    );
  }, []);

  const handleDeleteAllData = useCallback(() => {
    hapticWarning();
    Alert.alert(
      'Delete All Data',
      'This will delete ALL your health data and reset the app. Your API key will be preserved. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            Alert.alert(
              'Are you sure? All data will be permanently deleted.',
              '',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await AsyncStorage.clear();
                      await Promise.all([
                        deleteSecureKey(SECURE_KEYS.APP_LOCK_ENABLED),
                        deleteSecureKey(SECURE_KEYS.AUTH_PIN_HASH),
                        deleteSecureKey(SECURE_KEYS.AUTH_PIN_SALT),
                        deleteSecureKey(SECURE_KEYS.AUTH_PIN_MIGRATED),
                        deleteSecureKey(SECURE_KEYS.AUTH_METHOD),
                        deleteSecureKey(SECURE_KEYS.USER_SEX),
                        deleteSecureKey(SECURE_KEYS.ONBOARDING_COMPLETE),
                        deleteSecureKey(SECURE_KEYS.CONSENT_RECORD),
                      ]);
                      Alert.alert('Done', 'All data cleared. The app will restart from onboarding.');
                      router.replace('/onboarding');
                    } catch {
                      Alert.alert('Error', 'Something went wrong. Please try again.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, []);

  const menuSections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        { id: 'profile', icon: 'person-outline', label: 'Edit Profile', route: '/settings/profile' },
        { id: 'apikey', icon: 'key-outline', label: 'API Key', route: '/settings/apikey' },
        { id: 'tier', icon: 'diamond-outline', label: 'Engagement Tier', route: '/settings/tier' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { id: 'units', icon: 'options-outline', label: 'Units', route: '/settings/units' },
        { id: 'categories', icon: 'grid-outline', label: 'My Categories', route: '/settings/categories' },
        { id: 'notifications', icon: 'notifications-outline', label: 'Notifications', route: '/settings/notifications' },
        { id: 'habits', icon: 'checkbox-outline', label: 'Daily Habits', route: '/settings/habits' },
        { id: 'foods', icon: 'restaurant-outline', label: 'My Foods', route: '/settings/taste' },
        { id: 'recipes', icon: 'book-outline', label: 'My Recipes', route: '/settings/recipes' },
        { id: 'supplements', icon: 'flask-outline', label: 'My Supplements', route: '/log/supplements' },
        { id: 'devices', icon: 'watch-outline', label: 'Devices', route: '/settings/devices' },
        { id: 'allergy-profile', icon: 'alert-circle-outline', label: 'Allergy Profile', route: '/settings/allergy-profile' },
      ],
    },
    {
      title: 'Data',
      items: [
        { id: 'export', icon: 'download-outline', label: 'Export My Data', route: '/settings/export' },
        { id: 'healthreport', icon: 'document-text-outline', label: 'Health Report', route: '/settings/healthreport' },
        { id: 'data', icon: 'server-outline', label: 'Data Management', route: '/settings/data' },
      ],
    },
    {
      title: 'Support',
      items: [
        { id: 'about', icon: 'information-circle-outline', label: 'About', route: '/settings/about' },
        { id: 'feedback', icon: 'chatbox-ellipses-outline', label: 'Feedback Log', route: '/settings/feedback' },
        { id: 'agreement', icon: 'document-text-outline', label: 'User Agreement', route: '/settings/agreement' },
        { id: 'crisis', icon: 'call-outline', label: '988 Crisis Support', route: '/settings/crisis-support' },
      ],
    },
  ];

  const dangerItems: MenuItem[] = [
    { id: 'reset', icon: 'refresh-outline', label: 'Reset Onboarding', onPress: handleResetOnboarding, danger: true },
  ];

  return (
    <ScreenWrapper>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {profileName.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{profileName}</Text>
          <Text style={styles.profileTier}>{tier} tier</Text>
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => router.push('/settings/profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={16} color={Colors.accent} />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, sIdx) => (
          <View key={sIdx} style={styles.menuSection}>
            {section.title ? (
              <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            ) : null}
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuRow}
                onPress={() => item.route ? router.push(item.route as any) : item.onPress?.()}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={22} color={Colors.accent} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerHeader}>DANGER ZONE</Text>
          {dangerItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuRow}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={22} color={Colors.dangerText} />
              <Text style={[styles.menuLabel, { color: Colors.dangerText }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.versionText}>DUB Tracker v1.1.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 12,
    paddingBottom: Spacing.xxxl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: Colors.primaryBackground,
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileName: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: 2,
  },
  profileTier: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginBottom: 12,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  editProfileText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  menuSection: {
    marginBottom: 16,
    gap: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  menuLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  dangerSection: {
    marginTop: 8,
    gap: 6,
  },
  dangerHeader: {
    color: Colors.dangerText,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginLeft: 4,
  },
  sectionTitle: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 4,
  },
  versionText: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
