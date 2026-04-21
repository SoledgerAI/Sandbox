// Settings tab: navigation hub to all settings sub-screens
// H6 split: inline sections (Security, Personalization, Appearance, My Macros)
// extracted into app/settings/{security,personalization,appearance,macros}.tsx

import { useRef } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { hapticWarning } from '../../src/utils/haptics';
import { SECURE_KEYS, deleteSecure as deleteSecureKey } from '../../src/services/secureStorageService';
import { SETTINGS_SECTIONS } from '../../src/config/settingsNav';

function handleResetOnboarding() {
  hapticWarning();
  Alert.alert(
    'Reset App Data',
    'This will delete ALL your health data and reset the app to its initial state. Your API key will be preserved. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          Alert.alert('Are you sure? All data will be permanently deleted.', '', [
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
          ]);
        },
      },
    ],
  );
}

export default function SettingsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  return (
    <ScreenWrapper>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {SETTINGS_SECTIONS.map((section) => (
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
                  <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeader}>DANGER ZONE</Text>
          <View style={styles.section}>
            <TouchableOpacity style={styles.settingRow} onPress={handleResetOnboarding} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={22} color={Colors.dangerText} />
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: Colors.dangerText }]}>Reset Onboarding</Text>
                <Text style={styles.settingSubtitle}>Show personalization questionnaire again</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: Spacing.lg, paddingTop: 12, paddingBottom: Spacing.xxxl },
  title: { color: Colors.text, fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, marginBottom: Spacing.xl },
  sectionGroup: { marginBottom: 20 },
  sectionHeader: { color: Colors.secondaryText, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  section: { gap: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBackground, borderRadius: 10, padding: Spacing.lg, gap: Spacing.md },
  settingInfo: { flex: 1 },
  settingLabel: { color: Colors.text, fontSize: FontSize.base, fontWeight: FontWeight.medium },
  settingSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
});
