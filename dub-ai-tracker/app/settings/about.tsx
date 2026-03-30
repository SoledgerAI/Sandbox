// Settings > About / Legal
// Phase 17: Settings and Profile Management
// App version, legal links, privacy policy, terms of service, data deletion

import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { storageClearAll } from '../../src/utils/storage';
import { deleteSecure, SECURE_KEYS } from '../../src/services/secureStorageService';
import { logAuditEvent } from '../../src/utils/audit';

const APP_VERSION = '1.1.0';

export default function AboutScreen() {
  const [deleting, setDeleting] = useState(false);

  function handleDeleteData() {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your DUB_AI data including your profile, logs, settings, and API key. Audit logs are retained for compliance.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I understand, delete my data',
          style: 'destructive',
          onPress: () => confirmDelete(),
        },
      ],
    );
  }

  async function confirmDelete() {
    Alert.alert(
      'Final Confirmation',
      'Are you absolutely sure? All your health data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await logAuditEvent('DATA_DELETION_INITIATED', {});

              // Clear all AsyncStorage dub.* keys
              await storageClearAll();

              // Clear all secure store keys
              try {
                await deleteSecure(SECURE_KEYS.ANTHROPIC_API_KEY);
                await deleteSecure(SECURE_KEYS.APP_LOCK_ENABLED);
                await deleteSecure(SECURE_KEYS.AUTH_PIN_HASH);
                await deleteSecure(SECURE_KEYS.AUTH_METHOD);
                await deleteSecure(SECURE_KEYS.USER_SEX);
                await deleteSecure(SECURE_KEYS.ONBOARDING_COMPLETE);
                await deleteSecure(SECURE_KEYS.CONSENT_RECORD);
              } catch {
                // Keys may not exist
              }

              await logAuditEvent('DATA_DELETION_COMPLETED', {});

              Alert.alert(
                'Data Deleted',
                'All your DUB_AI data has been permanently deleted. The app will restart at onboarding.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/onboarding'),
                  },
                ],
              );
            } catch {
              Alert.alert('Error', 'Failed to delete data. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
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
        <Text style={styles.appName}>DUB_AI Tracker</Text>
        <Text style={styles.appVersion}>Version {APP_VERSION}</Text>
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
          DUB_AI does not collect, transmit, or sell your personal data. You can delete all data at any time below.
        </Text>
      </View>

      {/* Legal Links */}
      <Text style={styles.sectionTitle}>Legal</Text>
      <LinkRow
        icon="document-text-outline"
        label="Privacy Policy"
        subtitle="How we handle your data"
        onPress={() => {
          Alert.alert('Privacy Policy', 'Privacy policy will be available at launch. Your data is stored locally on your device. When using Coach DUB, your health data and messages are transmitted to Anthropic, PBC for processing.');
        }}
      />
      <LinkRow
        icon="shield-outline"
        label="Terms of Service"
        subtitle="Terms and conditions"
        onPress={() => {
          Alert.alert('Terms of Service', 'Terms of service will be available at launch.');
        }}
      />
      <LinkRow
        icon="hand-left-outline"
        label="Third-Party Data Processing"
        subtitle="Anthropic API data disclosure"
        onPress={() => {
          Alert.alert(
            'Third-Party Data Processing',
            'When you use the AI Coach feature, your health data and messages are transmitted to Anthropic, PBC for processing. Anthropic processes this data to generate Coach responses.\n\nData transmitted includes: profile summary, today\'s logged data, 7-day statistics, and your messages.\n\nTherapy notes are NEVER transmitted.',
          );
        }}
      />
      <LinkRow
        icon="document-outline"
        label="Open Source Licenses"
        subtitle="Third-party library licenses"
        onPress={() => {
          Alert.alert('Open Source Licenses', 'Open source license details will be available at launch.');
        }}
      />

      {/* Support */}
      <Text style={styles.sectionTitle}>Support</Text>
      <LinkRow
        icon="help-circle-outline"
        label="Help & FAQ"
        subtitle="Common questions and troubleshooting"
        onPress={() => {
          Alert.alert('Help & FAQ', 'Help documentation will be available at launch.');
        }}
      />
      <LinkRow
        icon="mail-outline"
        label="Contact Support"
        subtitle="Get help with DUB_AI"
        onPress={() => {
          Alert.alert('Contact Support', 'Support contact information will be available at launch.');
        }}
      />

      {/* Data Deletion */}
      <Text style={styles.sectionTitle}>Data Management</Text>
      <TouchableOpacity
        style={styles.deleteCard}
        onPress={handleDeleteData}
        disabled={deleting}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color={Colors.danger} />
        <View style={styles.deleteInfo}>
          <Text style={styles.deleteLabel}>Delete My Data</Text>
          <Text style={styles.deleteDesc}>
            Permanently delete all stored data. This cannot be undone.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.danger} />
      </TouchableOpacity>

      <Text style={styles.auditNote}>
        Audit logs are retained for compliance even after data deletion, as disclosed
        in the privacy policy. Audit logs contain no health data.
      </Text>

      <Text style={styles.copyright}>
        DUB_AI Tracker v{APP_VERSION}
      </Text>
    </ScrollView>
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
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
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
  appName: { color: Colors.accent, fontSize: 22, fontWeight: 'bold' },
  appVersion: { color: Colors.secondaryText, fontSize: 14, marginTop: 4 },
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
  deleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  deleteInfo: { flex: 1 },
  deleteLabel: { color: Colors.danger, fontSize: 15, fontWeight: '600' },
  deleteDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  auditNote: {
    color: Colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  copyright: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
});
