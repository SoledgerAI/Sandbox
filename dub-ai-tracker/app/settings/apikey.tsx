// Settings > API Key Management
// Prompt 04 v2: BYOK UX — integrated with APIKeySetupWizard

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import {
  getApiKey,
  deleteApiKey,
  isApiKeySet,
  testApiKey,
} from '../../src/services/apiKeyService';
import { APIKeySetupWizard } from '../../src/components/APIKeySetupWizard';
import { logAuditEvent } from '../../src/utils/audit';

export default function ApiKeyScreen() {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maskedKey, setMaskedKey] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadKeyStatus = useCallback(async () => {
    setLoading(true);
    const exists = await isApiKeySet();
    setHasKey(exists);
    if (exists) {
      const key = await getApiKey();
      if (key) {
        // Show masked display with last 4 chars visible
        setMaskedKey(`${'•'.repeat(12)}${key.slice(-4)}`);
      }
    } else {
      setMaskedKey('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadKeyStatus();
  }, [loadKeyStatus]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    const key = await getApiKey();
    if (!key) {
      Alert.alert('Error', 'No API key found.');
      setTesting(false);
      return;
    }
    const result = await testApiKey(key);
    setTesting(false);
    if (result.valid) {
      Alert.alert('Success', 'Key is valid and working.');
    } else {
      Alert.alert('Test Failed', result.error || 'Key verification failed.');
    }
  }, []);

  const handleRemove = useCallback(() => {
    Alert.alert(
      'Remove API Key',
      'Remove your API key? The AI Coach will be disabled until you add a new key.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteApiKey();
            await logAuditEvent('API_KEY_DELETED', {});
            setHasKey(false);
            setMaskedKey('');
          },
        },
      ],
    );
  }, []);

  const handleWizardSuccess = useCallback(() => {
    setShowWizard(false);
    loadKeyStatus();
  }, [loadKeyStatus]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>API Key</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
        <Text style={styles.infoText}>
          Coach DUB uses the Anthropic API with your personal API key. Your key is stored
          securely using hardware-backed encryption (Keychain on iOS). Estimated cost: $0.01-0.05
          per conversation.
        </Text>
      </View>

      <View style={styles.securityBox}>
        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.success} />
        <Text style={styles.securityText}>
          Your API key is stored in the device's secure enclave and never transmitted
          except to the Anthropic API. It is never stored in app storage or logs.
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="key-outline" size={18} color={Colors.accent} />
        <Text style={styles.infoText}>
          DUB Tracker uses your personal Anthropic API key for Coach DUB.
          Get your key at console.anthropic.com
        </Text>
      </View>

      {hasKey ? (
        <>
          {/* Key Status Card */}
          <View style={styles.keyCard}>
            <View style={styles.keyStatusRow}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
              <View style={styles.keyInfo}>
                <Text style={styles.keyStatusText}>API key configured</Text>
                <Text style={styles.keyMasked}>{maskedKey}</Text>
              </View>
            </View>
          </View>

          {/* Action Rows */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setShowWizard(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal-outline" size={22} color={Colors.accent} />
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>Change API Key</Text>
                <Text style={styles.actionSubtitle}>Replace with a different key</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleTest}
              disabled={testing}
              activeOpacity={0.7}
            >
              <Ionicons name="flash-outline" size={22} color={Colors.accent} />
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>Test API Key</Text>
                <Text style={styles.actionSubtitle}>Verify the key works with Anthropic</Text>
              </View>
              {testing ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleRemove}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={22} color={Colors.danger} />
              <View style={styles.actionInfo}>
                <Text style={[styles.actionLabel, { color: Colors.dangerText }]}>Remove API Key</Text>
                <Text style={styles.actionSubtitle}>Disable AI Coach</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.noKeyCard}>
          <Ionicons name="key-outline" size={32} color={Colors.secondaryText} />
          <Text style={styles.noKeyText}>No API key configured</Text>
          <Text style={styles.noKeySubtext}>
            Add your Anthropic API key to enable Coach DUB
          </Text>
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => setShowWizard(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.setupButtonText}>Set Up API Key</Text>
          </TouchableOpacity>
        </View>
      )}

      <APIKeySetupWizard
        visible={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={handleWizardSuccess}
        isUpdate={hasKey}
      />
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoText: { color: Colors.secondaryText, fontSize: 13, lineHeight: 18, flex: 1 },
  securityBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  securityText: { color: Colors.successText, fontSize: 13, lineHeight: 18, flex: 1 },
  keyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  keyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keyInfo: { flex: 1 },
  keyStatusText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  keyMasked: { color: Colors.secondaryText, fontSize: 13, marginTop: 2, fontFamily: 'monospace' },
  actionsSection: {
    gap: 6,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  actionInfo: { flex: 1 },
  actionLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  actionSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  noKeyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  noKeyText: { color: Colors.text, fontSize: 16, fontWeight: '600', marginTop: 12 },
  noKeySubtext: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  setupButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  setupButtonText: { color: Colors.primaryBackground, fontSize: 15, fontWeight: '700' },
});
