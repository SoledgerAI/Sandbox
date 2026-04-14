// Settings > About
// Sprint 26: App info, powered by SoledgerAI, links, feedback

import { useState, useEffect } from 'react';
import {
  Linking,
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
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version ?? '1.1.0';
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.extra?.buildNumber ?? '2';

export default function AboutScreen() {
  const [hideCalories, setHideCalories] = useState(false);

  useEffect(() => {
    storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS).then((s) => {
      setHideCalories((s?.hide_calories as boolean) ?? false);
    });
  }, []);

  async function toggleHideCalories(value: boolean) {
    setHideCalories(value);
    const settings = (await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS)) || {};
    await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, hide_calories: value });
  }

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>About</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* App Info */}
        <View style={styles.appCard}>
          <Text style={styles.appName}>DUB Tracker</Text>
          <Text style={styles.appVersion}>Version {APP_VERSION} (build {BUILD_NUMBER})</Text>
          <Text style={styles.poweredBy}>Powered by SoledgerAI</Text>
          <Text style={styles.appDesc}>
            Your personal health and wellness tracking companion, powered by AI.
          </Text>
        </View>

        {/* Privacy & Data */}
        <Text style={styles.sectionTitle}>Privacy & Data</Text>
        <View style={styles.privacyCard}>
          <Text style={styles.privacyItem}>
            All health data is stored locally on your device. Nothing is uploaded to SoledgerAI servers.
          </Text>
          <Text style={styles.privacyItem}>
            Your API key is stored in encrypted secure storage (iOS Keychain) and never leaves your device.
          </Text>
          <Text style={styles.privacyItem}>
            When you use Coach DUB, your health context and messages are sent to Anthropic's Claude API for processing. Anthropic's usage policy applies.
          </Text>
          <Text style={styles.privacyItem}>
            DUB Tracker does not collect, transmit, or sell your personal data.
          </Text>
        </View>

        {/* Display Preferences */}
        <Text style={styles.sectionTitle}>Display</Text>
        <View style={styles.privacyCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.privacyItem, { marginBottom: 2 }]}>Hide Calorie Totals</Text>
              <Text style={{ color: Colors.secondaryText, fontSize: 12 }}>
                Show nutrient breakdown without calorie counts
              </Text>
            </View>
            <Switch
              value={hideCalories}
              onValueChange={toggleHideCalories}
              trackColor={{ false: Colors.divider, true: Colors.accent }}
              thumbColor={Colors.text}
            />
          </View>
        </View>

        {/* Links */}
        <Text style={styles.sectionTitle}>Links</Text>
        <LinkRow
          icon="globe-outline"
          label="dubtracker.ai"
          subtitle="Visit our website"
          onPress={() => Linking.openURL('https://dubtracker.ai')}
        />
        <LinkRow
          icon="document-text-outline"
          label="Privacy Policy"
          subtitle="How we handle your data"
          onPress={() => router.push('/settings/privacy')}
        />
        <LinkRow
          icon="shield-outline"
          label="Terms of Service"
          subtitle="Terms and conditions"
          onPress={() => Linking.openURL('https://dubtracker.ai/terms')}
        />
        <LinkRow
          icon="document-outline"
          label="Open Source Licenses"
          subtitle="Third-party library licenses"
          onPress={() => router.push('/settings/licenses')}
        />

        {/* Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <LinkRow
          icon="mail-outline"
          label="Send Feedback"
          subtitle="Let us know how we can improve"
          onPress={() => Linking.openURL('mailto:jwilliams@soledgerai.com?subject=DUB Tracker Feedback')}
        />
        <LinkRow
          icon="hand-left-outline"
          label="Third-Party Data Processing"
          subtitle="Anthropic API data disclosure"
          onPress={() => router.push('/settings/privacy')}
        />

        <Text style={styles.copyright}>
          DUB Tracker v{APP_VERSION} | Powered by SoledgerAI
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

function LinkRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: string;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={20} color={Colors.accent} />
      <View style={styles.linkInfo}>
        <Text style={styles.linkLabel}>{label}</Text>
        <Text style={styles.linkSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  appCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: { color: Colors.accentText, fontSize: 22, fontWeight: 'bold' },
  appVersion: { color: Colors.secondaryText, fontSize: 14, marginTop: 4 },
  poweredBy: { color: Colors.accent, fontSize: 13, fontWeight: '600', marginTop: 6 },
  appDesc: {
    color: Colors.secondaryText,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
  },
  privacyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  privacyItem: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  linkInfo: { flex: 1 },
  linkLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  linkSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  copyright: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
});
