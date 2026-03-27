// Settings > API Key Management
// Phase 17: Settings and Profile Management
// Enter, update, delete API key with expo-secure-store

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import {
  getApiKey,
  setApiKey,
  deleteApiKey,
  hasApiKey as checkHasApiKey,
} from '../../src/services/anthropic';
import { logAuditEvent } from '../../src/utils/audit';

export default function ApiKeyScreen() {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');

  const loadKeyStatus = useCallback(async () => {
    setLoading(true);
    const exists = await checkHasApiKey();
    setHasKey(exists);
    if (exists) {
      const key = await getApiKey();
      if (key) {
        setMaskedKey(`${key.substring(0, 10)}...${key.substring(key.length - 4)}`);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadKeyStatus();
  }, [loadKeyStatus]);

  async function handleSave() {
    const key = keyInput.trim();
    if (!key) return;

    if (!key.startsWith('sk-ant-')) {
      Alert.alert('Invalid Key', 'Anthropic API keys start with "sk-ant-". Please check your key.');
      return;
    }

    setSaving(true);
    try {
      const isUpdate = hasKey;
      await setApiKey(key);
      await logAuditEvent(isUpdate ? 'API_KEY_UPDATED' : 'API_KEY_CREATED', {});
      setHasKey(true);
      setShowInput(false);
      setKeyInput('');
      setMaskedKey(`${key.substring(0, 10)}...${key.substring(key.length - 4)}`);
    } catch {
      Alert.alert('Error', 'Failed to save API key. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleRemove() {
    Alert.alert(
      'Remove API Key',
      'Coach DUB will not be able to respond without an API key. Remove it?',
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
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
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
          securely using hardware-backed encryption (Keychain on iOS, EncryptedSharedPreferences
          on Android). Estimated cost: $3-8/month (~$0.02 per message).
        </Text>
      </View>

      <View style={styles.securityBox}>
        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.success} />
        <Text style={styles.securityText}>
          Your API key is stored in the device's secure enclave and never transmitted
          except to the Anthropic API. It is never stored in app storage or logs.
        </Text>
      </View>

      {/* Current Key Status */}
      {hasKey ? (
        <View style={styles.keyCard}>
          <View style={styles.keyStatusRow}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            <View style={styles.keyInfo}>
              <Text style={styles.keyStatusText}>API key configured</Text>
              <Text style={styles.keyMasked}>{maskedKey}</Text>
            </View>
          </View>
          <View style={styles.keyActions}>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={() => setShowInput(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={16} color={Colors.accent} />
              <Text style={styles.updateButtonText}>Update</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemove}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.noKeyCard}>
          <Ionicons name="key-outline" size={32} color={Colors.secondaryText} />
          <Text style={styles.noKeyText}>No API key configured</Text>
          <Text style={styles.noKeySubtext}>
            Add your Anthropic API key to enable Coach DUB
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowInput(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>Add API Key</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Key Input */}
      {showInput && (
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>
            {hasKey ? 'Enter new API key:' : 'Enter your Anthropic API key:'}
          </Text>
          <TextInput
            style={styles.keyInput}
            placeholder="sk-ant-..."
            placeholderTextColor={Colors.secondaryText}
            value={keyInput}
            onChangeText={setKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!saving}
          />
          <View style={styles.inputButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowInput(false);
                setKeyInput('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, !keyInput.trim() && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!keyInput.trim() || saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.primaryBackground} />
              ) : (
                <Text style={styles.saveButtonText}>Save Key</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* How to get a key */}
      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>How to get an API key</Text>
        <Text style={styles.helpStep}>1. Go to console.anthropic.com</Text>
        <Text style={styles.helpStep}>2. Sign in or create an account</Text>
        <Text style={styles.helpStep}>3. Navigate to API Keys</Text>
        <Text style={styles.helpStep}>4. Create a new key and copy it</Text>
        <Text style={styles.helpStep}>5. Paste it here</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
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
  securityText: { color: Colors.success, fontSize: 13, lineHeight: 18, flex: 1 },
  keyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  keyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  keyInfo: { flex: 1 },
  keyStatusText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  keyMasked: { color: Colors.secondaryText, fontSize: 12, marginTop: 2, fontFamily: 'monospace' },
  keyActions: { flexDirection: 'row', gap: 10 },
  updateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  updateButtonText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  removeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  removeButtonText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
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
  addButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  addButtonText: { color: Colors.primaryBackground, fontSize: 15, fontWeight: '600' },
  inputCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  inputLabel: { color: Colors.text, fontSize: 14, fontWeight: '500', marginBottom: 10 },
  keyInput: {
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 12,
  },
  inputButtons: { flexDirection: 'row', gap: 10 },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cancelButtonText: { color: Colors.secondaryText, fontSize: 15, fontWeight: '600' },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.accent,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: Colors.primaryBackground, fontSize: 15, fontWeight: '600' },
  helpCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  helpTitle: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  helpStep: { color: Colors.secondaryText, fontSize: 13, lineHeight: 22 },
});
