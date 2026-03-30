// API Key Setup Wizard — 4-screen guided BYOK flow
// Prompt 04 v2: BYOK UX

import { useState, useCallback } from 'react';
import {
  Alert,
  ActivityIndicator,
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
import * as Linking from 'expo-linking';
import { Colors } from '../constants/colors';
import {
  validateKeyFormat,
  testApiKey,
  setApiKey,
} from '../services/apiKeyService';
import { logAuditEvent } from '../utils/audit';
import type { KeyFormatResult } from '../services/apiKeyService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isUpdate?: boolean;
}

type Screen = 'intro' | 'howto' | 'enter' | 'verify';

const SCREENS: Screen[] = ['intro', 'howto', 'enter', 'verify'];

export function APIKeySetupWizard({ visible, onClose, onSuccess, isUpdate }: Props) {
  const [screen, setScreen] = useState<Screen>('intro');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [formatResult, setFormatResult] = useState<KeyFormatResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);

  const reset = useCallback(() => {
    setScreen('intro');
    setKeyInput('');
    setShowKey(false);
    setFormatResult(null);
    setVerifying(false);
    setVerifyError(null);
    setVerifySuccess(false);
  }, []);

  const handleClose = useCallback(() => {
    if (screen === 'enter' && keyInput.length > 0) {
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
  }, [screen, keyInput, reset, onClose]);

  const handleKeyChange = useCallback((text: string) => {
    setKeyInput(text);
    setVerifyError(null);
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
    setFormatResult(validateKeyFormat(trimmed));
  }, []);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);
    setVerifySuccess(false);
    setScreen('verify');

    const result = await testApiKey(keyInput.trim());

    if (result.valid) {
      await setApiKey(keyInput.trim());
      await logAuditEvent(isUpdate ? 'API_KEY_UPDATED' : 'API_KEY_CREATED', {});
      setVerifySuccess(true);
    } else {
      setVerifyError(result.error || 'Verification failed');
    }
    setVerifying(false);
  }, [keyInput, isUpdate]);

  const handleSaveAnyway = useCallback(async () => {
    Alert.alert(
      'Save Without Verification',
      "The key couldn't be verified right now. Save it anyway? You can test it later in Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save Anyway',
          onPress: async () => {
            await setApiKey(keyInput.trim());
            await logAuditEvent(isUpdate ? 'API_KEY_UPDATED' : 'API_KEY_CREATED', {});
            setVerifySuccess(true);
          },
        },
      ],
    );
  }, [keyInput, isUpdate]);

  const handleDone = useCallback(() => {
    reset();
    onSuccess();
  }, [reset, onSuccess]);

  const goBack = useCallback(() => {
    const idx = SCREENS.indexOf(screen);
    if (idx > 0) {
      setScreen(SCREENS[idx - 1]);
      if (screen === 'verify') {
        setVerifyError(null);
        setVerifySuccess(false);
      }
    }
  }, [screen]);

  const screenIndex = SCREENS.indexOf(screen);
  const isFormatValid = formatResult?.valid === true;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {screenIndex > 0 && !verifySuccess ? (
            <TouchableOpacity onPress={goBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}

          {/* Progress dots */}
          <View style={styles.progressDots}>
            {SCREENS.map((s, i) => (
              <View
                key={s}
                style={[styles.dot, i <= screenIndex && styles.dotActive]}
              />
            ))}
          </View>

          <TouchableOpacity onPress={handleClose} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ============ SCREEN 1: INTRO ============ */}
          {screen === 'intro' && (
            <View style={styles.screenContent}>
              <Ionicons name="key-outline" size={56} color={Colors.accent} style={styles.screenIcon} />
              <Text style={styles.screenTitle}>Connect Your AI</Text>
              <Text style={styles.screenBody}>
                DUB_AI uses your own Anthropic API key to power the AI Coach. Your key is stored
                securely on your device and never sent to our servers.
              </Text>
              <Text style={[styles.screenBody, { marginTop: 16 }]}>You'll need:</Text>
              <View style={styles.bulletList}>
                <BulletItem text="An Anthropic account (free to create)" />
                <BulletItem text="An API key from console.anthropic.com" />
                <BulletItem text="A funded API balance (pay-as-you-go, typically $0.01-0.05 per Coach conversation)" />
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setScreen('howto')}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setScreen('enter')}
                activeOpacity={0.7}
              >
                <Text style={styles.linkButtonText}>I already have a key</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ============ SCREEN 2: HOW TO ============ */}
          {screen === 'howto' && (
            <View style={styles.screenContent}>
              <Text style={styles.screenTitle}>How to Get a Key</Text>
              <View style={styles.stepList}>
                <StepItem number={1} text="Go to console.anthropic.com" />
                <StepItem number={2} text="Sign up or log in" />
                <StepItem number={3} text='Click "API Keys" in the left sidebar' />
                <StepItem number={4} text='Click "Create Key"' />
                <StepItem number={5} text='Name it anything (e.g., "DUB_AI")' />
                <StepItem number={6} text="Copy the key — it starts with sk-ant-api03-" />
              </View>
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={18} color={Colors.warning} />
                <Text style={styles.warningText}>
                  Copy the full key. You won't be able to see it again after closing the page.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={18} color={Colors.primaryBackground} style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Open Anthropic Console</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 12, backgroundColor: Colors.cardBackground }]}
                onPress={() => setScreen('enter')}
                activeOpacity={0.7}
              >
                <Text style={[styles.primaryButtonText, { color: Colors.text }]}>I have my key</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ============ SCREEN 3: ENTER KEY ============ */}
          {screen === 'enter' && (
            <View style={styles.screenContent}>
              <Text style={styles.screenTitle}>Paste Your API Key</Text>

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
              {formatResult && (
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
                      <Text style={[styles.validationText, { color: Colors.success }]}>
                        Format looks good
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={18} color={Colors.danger} />
                      <Text style={[styles.validationText, { color: Colors.danger }]}>
                        {formatResult.error}
                      </Text>
                    </>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 24 }, !isFormatValid && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={!isFormatValid}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>Verify & Save</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ============ SCREEN 4: VERIFICATION ============ */}
          {screen === 'verify' && (
            <View style={styles.screenContent}>
              {verifying && (
                <>
                  <ActivityIndicator size="large" color={Colors.accent} style={{ marginBottom: 20 }} />
                  <Text style={styles.screenTitle}>Verifying your key...</Text>
                  <Text style={styles.screenBody}>
                    Making a test call to the Anthropic API to confirm your key works.
                  </Text>
                </>
              )}

              {verifySuccess && (
                <>
                  <Ionicons name="checkmark-circle" size={64} color={Colors.success} style={styles.screenIcon} />
                  <Text style={styles.screenTitle}>Key Verified!</Text>
                  <Text style={styles.screenBody}>
                    Your AI Coach is ready.
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 24 }]}
                    onPress={handleDone}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.primaryButtonText}>Done</Text>
                  </TouchableOpacity>
                </>
              )}

              {!verifying && verifyError && (
                <>
                  <Ionicons name="close-circle" size={64} color={Colors.danger} style={styles.screenIcon} />
                  <Text style={styles.screenTitle}>Verification Failed</Text>
                  <Text style={[styles.screenBody, { color: Colors.danger }]}>
                    {verifyError}
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 24 }]}
                    onPress={() => setScreen('enter')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.primaryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={handleSaveAnyway}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.linkButtonText, { fontSize: 13 }]}>
                      Save Anyway
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================================
// Sub-components
// ============================================================

function BulletItem({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>{'\u2022'}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
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
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.divider,
  },
  dotActive: {
    backgroundColor: Colors.accent,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    paddingBottom: 40,
  },
  screenContent: {
    alignItems: 'center',
  },
  screenIcon: {
    marginBottom: 20,
  },
  screenTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  screenBody: {
    color: Colors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  bulletList: {
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: 8,
    gap: 8,
  },
  bullet: {
    color: Colors.accent,
    fontSize: 15,
    lineHeight: 22,
  },
  bulletText: {
    color: Colors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  stepList: {
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 20,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepText: {
    color: Colors.text,
    fontSize: 15,
    flex: 1,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 24,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  warningText: {
    color: Colors.warning,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  keyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignSelf: 'stretch',
    marginTop: 16,
  },
  keyInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    padding: 16,
  },
  eyeButton: {
    padding: 16,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  pasteButtonText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    alignSelf: 'stretch',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  validationText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  linkButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  linkButtonText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '500',
  },
});
