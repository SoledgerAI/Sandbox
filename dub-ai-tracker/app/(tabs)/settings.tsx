// Settings screen with API key management
// Phase 14: AI Coach

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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import {
  getApiKey,
  setApiKey,
  deleteApiKey,
  hasApiKey as checkHasApiKey,
} from '../../src/services/anthropic';

export default function SettingsScreen() {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadKeyStatus = useCallback(async () => {
    setLoading(true);
    const exists = await checkHasApiKey();
    setHasKey(exists);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadKeyStatus();
  }, [loadKeyStatus]);

  const handleSaveKey = async () => {
    const key = keyInput.trim();
    if (!key) return;

    if (!key.startsWith('sk-ant-')) {
      Alert.alert('Invalid Key', 'Anthropic API keys start with "sk-ant-". Please check your key.');
      return;
    }

    setSaving(true);
    try {
      await setApiKey(key);
      setHasKey(true);
      setShowKeyInput(false);
      setKeyInput('');
    } catch {
      Alert.alert('Error', 'Failed to save API key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKey = () => {
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
            setHasKey(false);
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* API Key Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coach DUB API Key</Text>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.infoText}>
            Coach DUB uses the Anthropic API with your personal API key.
            Estimated cost: $3-8/month depending on usage (approximately $0.02
            per Coach message). You can monitor your usage at console.anthropic.com.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={styles.loader} />
        ) : hasKey ? (
          <View style={styles.keyStatusRow}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.keyStatusText}>API key configured</Text>
            <TouchableOpacity onPress={handleRemoveKey} activeOpacity={0.7}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : showKeyInput ? (
          <View style={styles.keyInputContainer}>
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
            <View style={styles.keyButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowKeyInput(false);
                  setKeyInput('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !keyInput.trim() && styles.saveButtonDisabled]}
                onPress={handleSaveKey}
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
        ) : (
          <TouchableOpacity
            style={styles.addKeyButton}
            onPress={() => setShowKeyInput(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="key-outline" size={18} color={Colors.accent} />
            <Text style={styles.addKeyText}>Add Anthropic API Key</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Placeholder for other settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Text style={styles.placeholderText}>Preferences and configuration</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  content: {
    padding: 16,
    paddingTop: 60,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  loader: {
    paddingVertical: 12,
  },
  keyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  keyStatusText: {
    color: Colors.text,
    fontSize: 15,
    flex: 1,
  },
  removeText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  keyInputContainer: {
    gap: 10,
  },
  keyInput: {
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  keyButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cancelButtonText: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '600',
  },
  addKeyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
  },
  addKeyText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  placeholderText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
});
