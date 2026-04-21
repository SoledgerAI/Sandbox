// Coach DUB chat interface
// Phase 14: AI Coach
// Sprint 12: Expert @mention panel, streaming, tool use, photo capture, disclaimer modal

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { stripExifMetadata } from '../../src/utils/imagePrivacy';
import { Colors } from '../../src/constants/colors';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { LoadingIndicator } from '../../src/components/common/LoadingIndicator';
import { ChatBubble } from '../../src/components/coach/ChatBubble';
import { SuggestedPrompts } from '../../src/components/coach/SuggestedPrompts';
import { DataContextBanner } from '../../src/components/coach/DataContextBanner';
import { APIKeySetupWizard } from '../../src/components/APIKeySetupWizard';
import { AnthropicConsentModal, CONSENT_VERSION } from '../../src/components/coach/AnthropicConsentModal';
import { useCoach } from '../../src/hooks/useCoach';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import { useDailySummary } from '../../src/hooks/useDailySummary';
import { runPatternEngine } from '../../src/ai/pattern_engine';
import { getAllExperts, getExpert } from '../../src/ai/experts';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import type { ChatMessage, PatternInsight, ExpertId } from '../../src/types/coach';

export default function CoachScreen() {
  const {
    messages,
    loading,
    sending,
    streaming,
    apiKeyConfigured,
    error,
    tagsLogged,
    lastUserMessage,
    activeExpert,
    pendingToolUse,
    sendUserMessage,
    confirmTool,
    cancelTool,
    retry,
    refresh,
  } = useCoach();

  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOffline = !isConnected || isInternetReachable === false;

  const [inputText, setInputText] = useState('');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGranted, setConsentGranted] = useState<boolean | null>(null);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [patterns, setPatterns] = useState<PatternInsight[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showExpertPicker, setShowExpertPicker] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  useScrollToTop(flatListRef);
  const { summary, calorieTarget } = useDailySummary();
  const inputRef = useRef<TextInput>(null);

  const allExperts = getAllExperts();

  // Check if Anthropic consent has been acknowledged
  useEffect(() => {
    (async () => {
      const settings = await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
      if (
        settings &&
        settings.anthropic_consent_date &&
        settings.anthropic_consent_version === CONSENT_VERSION
      ) {
        setConsentGranted(true);
      } else {
        setConsentGranted(false);
      }
    })();
  }, []);

  const handleAnthropicConsent = async () => {
    const settings = (await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS)) || {};
    await storageSet(STORAGE_KEYS.SETTINGS, {
      ...settings,
      anthropic_consent_date: new Date().toISOString(),
      anthropic_consent_version: CONSENT_VERSION,
    });
    setConsentGranted(true);
    setShowConsentModal(false);
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Also scroll during streaming
  useEffect(() => {
    if (streaming) {
      const interval = setInterval(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [streaming]);

  // Refresh API key status on focus
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sprint 22: handle deep-link prompts (e.g. "Ask Coach" from nutrient report).
  // Auto-sends the prompt once then clears the param so re-focusing doesn't
  // re-fire it.
  const { prompt: deepLinkPrompt } = useLocalSearchParams<{ prompt?: string }>();
  useEffect(() => {
    if (
      deepLinkPrompt &&
      apiKeyConfigured &&
      !sending &&
      consentGranted &&
      !streaming
    ) {
      const text = deepLinkPrompt;
      router.setParams({ prompt: undefined });
      sendUserMessage(text).catch(() => {
        // swallow — errors already surface through coach error state
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only triggers on prompt arrival
  }, [deepLinkPrompt, apiKeyConfigured, consentGranted]);

  // MASTER-57: Load patterns for Coach Lite
  useEffect(() => {
    if (!apiKeyConfigured) {
      storageGet<PatternInsight[]>(STORAGE_KEYS.COACH_PATTERNS).then((p) => {
        setPatterns(p ?? []);
      });
    }
  }, [apiKeyConfigured]);

  // Detect @ typing for autocomplete
  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    // Show expert picker when user types @ at end of text or standalone @
    const atEnd = text.endsWith('@') || text.match(/@\w{0,10}$/);
    setShowExpertPicker(!!atEnd && text.includes('@'));
  }, []);

  const handleExpertSelect = useCallback((expertId: ExpertId) => {
    // Replace partial @mention with full @mention
    const cleaned = inputText.replace(/@\w*$/, '');
    setInputText(`${cleaned}@${expertId} `);
    setShowExpertPicker(false);
    inputRef.current?.focus();
  }, [inputText]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    setShowExpertPicker(false);
    await sendUserMessage(text);
  };

  const handleSuggestedPrompt = async (prompt: string) => {
    if (sending) return;
    await sendUserMessage(prompt);
  };

  // Photo capture for Coach chat (Feature 4)
  // TF-01: strip EXIF + resize immediately on capture so the stored URI is a
  // stable file in the app cache (not a transient ImagePicker temp URI that
  // can fail to render, showing the bubble's gold background as a blank
  // rectangle). Mirrors the pattern in PhotoFoodEntry.
  const prepareAndSendPhoto = useCallback(async (rawUri: string) => {
    let strippedUri: string;
    try {
      strippedUri = await stripExifMetadata(rawUri, 0.7);
    } catch {
      Alert.alert('Photo Error', 'Unable to prepare photo. Please try again.');
      return;
    }
    const text = inputText.trim() || '';
    setInputText('');
    await sendUserMessage(text, strippedUri);
  }, [inputText, sendUserMessage]);

  const handlePhotoCapture = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      await prepareAndSendPhoto(result.assets[0].uri);
    }
  }, [prepareAndSendPhoto]);

  const handlePhotoLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      await prepareAndSendPhoto(result.assets[0].uri);
    }
  }, [prepareAndSendPhoto]);

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <LoadingIndicator size="large" />
        </View>
      );
    }

    if (!apiKeyConfigured) {
      // MASTER-57: Coach Lite — useful view without API key
      return (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.coachLiteContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Today's data summary */}
          <View style={styles.liteSummaryCard}>
            <Text style={styles.liteSectionTitle}>Today's Summary</Text>
            <Text style={styles.liteSummaryText}>
              {summary.calories_consumed > 0
                ? `${Math.round(summary.calories_consumed).toLocaleString()} cal`
                : 'No food logged'}
              {summary.protein_g > 0 ? ` | ${Math.round(summary.protein_g)}g protein` : ''}
              {summary.water_oz > 0 ? ` | ${summary.water_oz} oz water` : ''}
              {summary.active_minutes > 0 ? ` | ${summary.active_minutes} min active` : ''}
            </Text>
            {calorieTarget > 0 && summary.calories_consumed > 0 && (
              <Text style={styles.liteTargetText}>
                {Math.round(summary.calories_remaining)} cal remaining of {Math.round(calorieTarget)} target
              </Text>
            )}
          </View>

          {/* Pattern insights */}
          <View style={styles.liteSectionCard}>
            <Text style={styles.liteSectionTitle}>Pattern Insights</Text>
            {patterns.length > 0 ? (
              patterns.slice(0, 3).map((p) => (
                <View key={p.id} style={styles.litePatternRow}>
                  <Ionicons name="analytics-outline" size={16} color={Colors.accent} />
                  <Text style={styles.litePatternText}>{p.observation}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.liteNoDataText}>
                Keep logging for 7+ days to see pattern insights
              </Text>
            )}
          </View>

          {/* Unlock AI Coach — warm CTA, not blocking */}
          <View style={styles.liteUpgradeCard}>
            <Ionicons name="sparkles" size={28} color={Colors.accent} />
            <Text style={styles.liteUpgradeTitle}>Ready for Personal Coaching?</Text>
            <Text style={styles.liteUpgradeText}>
              Your tracking data is building a picture of your habits.
              Add an AI Coach to get personalized advice, meal ideas, and daily check-ins based on everything you log.
            </Text>
            <TouchableOpacity
              style={styles.setupButton}
              onPress={() => setShowWizard(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="key-outline" size={18} color={Colors.primaryBackground} style={{ marginRight: 8 }} />
              <Text style={styles.setupButtonText}>Set Up in 2 Minutes</Text>
            </TouchableOpacity>
            <Text style={styles.setupFooter}>
              Bring your own Anthropic API key. Typical cost: $2-5/month.{'\n'}
              All tracking features work without this.
            </Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color={Colors.divider} />
        <Text style={styles.emptyTitle}>Hi! I'm Coach DUB</Text>
        <Text style={styles.greetingSubtitle}>Your AI wellness panel — 11 experts, one chat.</Text>
        <Text style={styles.emptySubtitle}>
          Type @ to summon an expert: @dietician, @trainer, @sleep, and more.
          Or just ask me anything — I'm your general wellness coach.
        </Text>
        <Text style={styles.greetingPromptHint}>Pick a prompt below or type your own question.</Text>
        <SuggestedPrompts onSelect={handleSuggestedPrompt} visible />
      </View>
    );
  };

  // Active expert badge
  const activeExpertDef = activeExpert ? getExpert(activeExpert) : undefined;

  return (
    <ScreenWrapper scrollFade={false}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <AnthropicConsentModal
        visible={showConsentModal || (apiKeyConfigured && consentGranted === false)}
        onConsent={handleAnthropicConsent}
      />

      {/* Sprint 12: Info icon → modal (replaces tooltip) */}
      {apiKeyConfigured && (
        <View style={styles.infoIconRow}>
          <TouchableOpacity
            onPress={() => setShowDisclaimerModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Coach DUB information"
          >
            <Ionicons name="information-circle-outline" size={18} color={Colors.secondaryText} />
          </TouchableOpacity>

          {/* Active expert badge */}
          {activeExpertDef && (
            <View style={styles.expertBadge}>
              <Text style={styles.expertBadgeText}>
                {activeExpertDef.emoji} {activeExpertDef.name} mode
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Disclaimer modal (Feature 5) */}
      <Modal
        visible={showDisclaimerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisclaimerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.disclaimerCard}>
            <Ionicons name="information-circle" size={32} color={Colors.accent} />
            <Text style={styles.disclaimerTitle}>About Coach DUB</Text>
            <Text style={styles.disclaimerText}>
              Coach DUB provides wellness guidance based on your data.
              For medical concerns, consult a healthcare professional.
              See User Agreement for full terms.
            </Text>
            <TouchableOpacity
              style={styles.disclaimerOk}
              onPress={() => setShowDisclaimerModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.disclaimerOkText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isOffline && apiKeyConfigured && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.accentText} />
          <Text style={styles.offlineNoticeText}>AI Coach requires internet</Text>
        </View>
      )}

      <DataContextBanner tagsLogged={tagsLogged} hasApiKey={apiKeyConfigured} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatBubble
            message={item}
            onConfirmTool={item.toolUse?.status === 'pending' ? confirmTool : undefined}
            onCancelTool={item.toolUse?.status === 'pending' ? cancelTool : undefined}
          />
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.messageList}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
      />

      {/* C2: Persistent suggested prompts toggle */}
      {apiKeyConfigured && messages.length > 0 && showSuggestions && (
        <SuggestedPrompts onSelect={(p) => { setShowSuggestions(false); handleSuggestedPrompt(p); }} visible />
      )}

      {/* Streaming indicator */}
      {sending && !streaming && (
        <View style={styles.typingRow}>
          <LoadingIndicator size="small" />
          <Text style={styles.typingText}>Coach DUB is thinking...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={24} color={Colors.dangerText} />
          <Text style={styles.errorCardText}>{error}</Text>
          <Text style={styles.errorCardSubtext}>Your message wasn't lost.</Text>
          {lastUserMessage && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retry}
              disabled={sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <LoadingIndicator size="small" />
              ) : (
                <Text style={styles.retryButtonText}>Tap to Retry</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {apiKeyConfigured && messages.length > 0 && !inputText.trim() && (
        <TouchableOpacity
          style={styles.suggestionsPill}
          onPress={() => setShowSuggestions(!showSuggestions)}
          activeOpacity={0.7}
        >
          <Ionicons name="bulb-outline" size={14} color={Colors.accentText} />
          <Text style={styles.suggestionsPillText}>
            {showSuggestions ? 'Hide Suggestions' : 'Suggestions'}
          </Text>
        </TouchableOpacity>
      )}

      {/* @mention autocomplete dropdown */}
      {showExpertPicker && apiKeyConfigured && (
        <View style={styles.expertPicker}>
          <ScrollView style={styles.expertPickerScroll} keyboardShouldPersistTaps="always">
            {allExperts
              .filter((e) => {
                const partial = inputText.match(/@(\w*)$/)?.[1]?.toLowerCase() ?? '';
                return !partial || e.id.startsWith(partial) || e.shortLabel.toLowerCase().startsWith(partial);
              })
              .map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={styles.expertPickerRow}
                  onPress={() => handleExpertSelect(e.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.expertPickerEmoji}>{e.emoji}</Text>
                  <Text style={styles.expertPickerName}>@{e.id}</Text>
                  <Text style={styles.expertPickerLabel}>{e.shortLabel}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      )}

      {apiKeyConfigured && (
        <View style={styles.inputRow}>
          {/* Camera button (Feature 4) */}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => {
              Alert.alert(
                'Add Photo',
                'Choose how to add a photo to your message',
                [
                  { text: 'Take Photo', onPress: handlePhotoCapture },
                  { text: 'Choose from Library', onPress: handlePhotoLibrary },
                  { text: 'Cancel', style: 'cancel' },
                ],
              );
            }}
            disabled={sending || isOffline}
            activeOpacity={0.7}
          >
            <Ionicons
              name="camera"
              size={22}
              color={sending || isOffline ? Colors.secondaryText : Colors.accent}
            />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={isOffline ? 'Reconnect to chat with Coach DUB' : 'Ask Coach DUB... (type @ for experts)'}
            placeholderTextColor={Colors.secondaryText}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={2000}
            editable={!sending && !isOffline}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending || isOffline) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending || isOffline}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? Colors.primaryBackground : Colors.secondaryText}
            />
          </TouchableOpacity>
        </View>
      )}

      <APIKeySetupWizard
        visible={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          setShowWizard(false);
          refresh();
        }}
      />
    </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  messageList: {
    paddingVertical: 8,
    paddingTop: 12,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  emptySubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  greetingSubtitle: {
    color: Colors.secondaryText,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  greetingPromptHint: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  setupButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  setupFooter: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  typingText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontStyle: 'italic',
  },
  errorCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
    gap: 8,
  },
  errorCardText: {
    color: Colors.dangerText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorCardSubtext: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.primaryBackground,
    gap: 8,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: FontSize.base,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.divider,
  },
  // Sprint 12: Info icon row with expert badge
  infoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  expertBadge: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expertBadgeText: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '600',
  },
  // Sprint 12: Disclaimer modal (Feature 5)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  disclaimerCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 340,
  },
  disclaimerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  disclaimerText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  disclaimerOk: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginTop: 4,
  },
  disclaimerOkText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '700',
  },
  // Sprint 12: @mention autocomplete (Feature 1C)
  expertPicker: {
    maxHeight: 260,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  expertPickerScroll: {
    padding: 4,
  },
  expertPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  expertPickerEmoji: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  expertPickerName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  expertPickerLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  // C2: Suggestions pill
  suggestionsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    marginBottom: 4,
  },
  suggestionsPillText: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '500',
  },
  // P1-22: Offline notice
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: Colors.inputBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  offlineNoticeText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  // MASTER-57: Coach Lite styles
  coachLiteContainer: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  liteSummaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  liteSectionTitle: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  liteSummaryText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  liteTargetText: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 6,
  },
  liteSectionCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  litePatternRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  litePatternText: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  liteNoDataText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontStyle: 'italic',
  },
  liteUpgradeCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  liteUpgradeTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  liteUpgradeText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
});
