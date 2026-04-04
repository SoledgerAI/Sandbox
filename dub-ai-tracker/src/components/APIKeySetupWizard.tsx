// API Key Setup Wizard — single-page guided walkthrough
// Redesign: hero + 3 numbered steps + cost callout + FAQ

import { useState, useCallback } from 'react';
import {
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/colors';
import {
  validateKeyFormat,
  testApiKey,
  setApiKey,
} from '../services/apiKeyService';
import { logAuditEvent } from '../utils/audit';
import type { KeyFormatResult, KeyTestResult } from '../services/apiKeyService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isUpdate?: boolean;
}

type ValidationState = 'idle' | 'testing' | 'success' | 'error';

export function APIKeySetupWizard({ visible, onClose, onSuccess, isUpdate }: Props) {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [formatResult, setFormatResult] = useState<KeyFormatResult | null>(null);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const reset = useCallback(() => {
    setKeyInput('');
    setShowKey(false);
    setFormatResult(null);
    setValidationState('idle');
    setValidationMessage('');
    setExpandedFaq(null);
  }, []);

  const handleClose = useCallback(() => {
    if (keyInput.length > 0 && validationState !== 'success') {
      Alert.alert(
        'Discard Key?',
        'You have a key partially entered. Close without saving?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              reset();
              onClose();
            },
          },
        ],
      );
    } else {
      reset();
      onClose();
    }
  }, [keyInput, validationState, reset, onClose]);

  const runValidation = useCallback(async (key: string) => {
    setValidationState('testing');
    setValidationMessage('');

    const result: KeyTestResult = await testApiKey(key);

    if (result.valid) {
      await setApiKey(key);
      await logAuditEvent(isUpdate ? 'API_KEY_UPDATED' : 'API_KEY_CREATED', {});
      setValidationState('success');
      setValidationMessage('Connected! Your AI Coach is ready.');
    } else if (result.errorType === 'network') {
      // Save the key on network failure — verify later
      await setApiKey(key);
      await logAuditEvent(isUpdate ? 'API_KEY_UPDATED' : 'API_KEY_CREATED', {});
      setValidationState('success');
      setValidationMessage("Saved your key \u2014 we'll verify when you're back online.");
    } else if (result.errorType === 'no_funds') {
      setValidationState('error');
      setValidationMessage('Set up billing at console.anthropic.com/settings/billing');
    } else if (result.errorType === 'invalid_key') {
      setValidationState('error');
      setValidationMessage('Double-check you copied the full key.');
    } else {
      setValidationState('error');
      setValidationMessage(result.error || 'Verification failed. Please try again.');
    }
  }, [isUpdate]);

  const handleKeyChange = useCallback((text: string) => {
    setKeyInput(text);
    setValidationState('idle');
    setValidationMessage('');
    if (text.trim().length > 0) {
      setFormatResult(validateKeyFormat(text));
    } else {
      setFormatResult(null);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (!text || !text.trim()) {
      Alert.alert('Nothing to Paste', 'Your clipboard is empty.');
      return;
    }
    const trimmed = text.trim();
    setKeyInput(trimmed);
    const format = validateKeyFormat(trimmed);
    setFormatResult(format);

    // Auto-validate if format looks good
    if (format.valid) {
      await runValidation(trimmed);
    }
  }, [runValidation]);

  const handleVerify = useCallback(async () => {
    await runValidation(keyInput.trim());
  }, [keyInput, runValidation]);

  const handleDone = useCallback(() => {
    reset();
    onSuccess();
  }, [reset, onSuccess]);

  const toggleFaq = useCallback((index: number) => {
    setExpandedFaq((prev) => (prev === index ? null : index));
  }, []);

  const isFormatValid = formatResult?.valid === true;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>API Key Setup</Text>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ============ HERO ============ */}
          <View style={styles.heroSection}>
            <Ionicons name="sparkles" size={48} color={Colors.accent} />
            <Text style={styles.heroTitle}>Unlock Your AI Coach</Text>
            <Text style={styles.heroSubtitle}>
              Get personalized nutrition advice, workout tips, and daily coaching powered by Claude AI.
            </Text>
          </View>

          {/* ============ STEP 1 ============ */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Create a free account at console.anthropic.com</Text>
            </View>
            <TouchableOpacity
              style={styles.consoleButton}
              onPress={() => Linking.openURL('https://console.anthropic.com')}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={18} color={Colors.primaryBackground} style={{ marginRight: 8 }} />
              <Text style={styles.consoleButtonText}>Open Anthropic Console</Text>
            </TouchableOpacity>
          </View>

          {/* ============ STEP 2 ============ */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>
                Click "API Keys", then "Create Key"
              </Text>
            </View>
            <Text style={styles.stepHint}>
              Name it anything (e.g., "DUB_AI"). Copy the full key before closing the page.
            </Text>
          </View>

          {/* ============ STEP 3 ============ */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <Text style={styles.stepTitle}>Paste your key below</Text>
            </View>

            <View style={styles.keyInputContainer}>
              <TextInput
                style={styles.keyInput}
                placeholder="sk-ant-api03-..."
                placeholderTextColor={Colors.divider}
                value={keyInput}
                onChangeText={handleKeyChange}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKey}
                multiline={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowKey(!showKey)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showKey ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={Colors.secondaryText}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.pasteButton}
              onPress={handlePaste}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={18} color={Colors.accent} />
              <Text style={styles.pasteButtonText}>Paste from Clipboard</Text>
            </TouchableOpacity>

            {/* Format validation feedback */}
            {formatResult && validationState === 'idle' && (
              <View style={styles.validationRow}>
                {formatResult.keyType === 'oauth_token' ? (
                  <>
                    <Ionicons name="warning-outline" size={18} color="#FF9800" />
                    <Text style={[styles.validationText, { color: '#FF9800' }]}>
                      {formatResult.error}
                    </Text>
                  </>
                ) : formatResult.valid ? (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    <Text style={[styles.validationText, { color: Colors.successText }]}>
                      Format looks good
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color={Colors.danger} />
                    <Text style={[styles.validationText, { color: Colors.dangerText }]}>
                      {formatResult.error}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Live validation state */}
            {validationState === 'testing' && (
              <View style={styles.validationRow}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={[styles.validationText, { color: Colors.secondaryText }]}>
                  Verifying your key...
                </Text>
              </View>
            )}

            {validationState === 'success' && (
              <View style={styles.validationRow}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={[styles.validationText, { color: Colors.successText }]}>
                  {validationMessage}
                </Text>
              </View>
            )}

            {validationState === 'error' && (
              <View style={styles.validationRow}>
                <Ionicons name="close-circle" size={18} color={Colors.danger} />
                <Text style={[styles.validationText, { color: Colors.dangerText }]}>
                  {validationMessage}
                </Text>
              </View>
            )}

            {/* Action buttons */}
            {validationState === 'success' ? (
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }]}
                onPress={handleDone}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }, (!isFormatValid || validationState === 'testing') && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={!isFormatValid || validationState === 'testing'}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>Verify & Save</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ============ COST CALLOUT ============ */}
          <View style={styles.costBox}>
            <Ionicons name="wallet-outline" size={18} color={Colors.accent} />
            <Text style={styles.costText}>
              Typical cost: $2-5/month. You control spending in the Anthropic console.
            </Text>
          </View>

          {/* ============ FAQ ============ */}
          <View style={styles.faqSection}>
            <Text style={styles.faqSectionTitle}>Frequently Asked Questions</Text>

            <FaqItem
              question="What is an API key?"
              answer="An API key is a unique code that lets DUB_AI communicate securely with Claude, Anthropic's AI. Think of it like a password that connects your app to the AI service."
              expanded={expandedFaq === 0}
              onToggle={() => toggleFaq(0)}
            />
            <FaqItem
              question="Is it secure?"
              answer="Yes. Your key is stored in your device's secure enclave (Keychain on iOS, Keystore on Android) using hardware-backed encryption. It is never sent to DUB_AI servers or stored in app logs."
              expanded={expandedFaq === 1}
              onToggle={() => toggleFaq(1)}
            />
            <FaqItem
              question="How much does it cost?"
              answer="Typical usage is $2-5 per month. Each Coach conversation costs about $0.01-0.05. You set your own spending limits in the Anthropic console."
              expanded={expandedFaq === 2}
              onToggle={() => toggleFaq(2)}
            />
            <FaqItem
              question="Can I skip this?"
              answer="Yes! All health tracking works without an API key. You can log food, water, workouts, mood, sleep, and everything else. The API key only unlocks the AI Coach feature."
              expanded={expandedFaq === 3}
              onToggle={() => toggleFaq(3)}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================================
// Sub-components
// ============================================================

function FaqItem({
  question,
  answer,
  expanded,
  onToggle,
}: {
  question: string;
  answer: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.faqQuestion}>
        <Text style={styles.faqQuestionText}>{question}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.secondaryText}
        />
      </View>
      {expanded && (
        <Text style={styles.faqAnswer}>{answer}</Text>
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: Colors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  // Steps
  stepCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  stepHint: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 40,
  },

  // Console button
  consoleButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 40,
  },
  consoleButtonText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '700',
  },

  // Key input
  keyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginLeft: 40,
  },
  keyInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    padding: 14,
  },
  eyeButton: {
    padding: 14,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
    marginLeft: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  pasteButtonText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    marginLeft: 40,
  },
  validationText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 40,
  },
  primaryButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  // Cost
  costBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 4,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  costText: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // FAQ
  faqSection: {
    marginBottom: 16,
  },
  faqSectionTitle: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  faqItem: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestionText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  faqAnswer: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
});
