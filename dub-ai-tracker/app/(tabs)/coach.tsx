// Coach DUB chat interface
// Phase 14: AI Coach

import { useState, useRef, useEffect } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import type { ChatMessage, PatternInsight } from '../../src/types/coach';

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const {
    messages,
    loading,
    sending,
    apiKeyConfigured,
    error,
    tagsLogged,
    lastUserMessage,
    sendUserMessage,
    retry,
    refresh,
  } = useCoach();

  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOffline = !isConnected || isInternetReachable === false;

  const [inputText, setInputText] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [patterns, setPatterns] = useState<PatternInsight[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  // Fix 3: Scroll-to-top on tab re-tap
  useScrollToTop(flatListRef);
  const { summary, calorieTarget } = useDailySummary();

  // Check if coach disclaimer and Anthropic consent have been acknowledged
  useEffect(() => {
    (async () => {
      const settings = await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
      if (settings && settings.coach_disclaimer_acknowledged) {
        setShowDisclaimer(false);
      }
      // Check Anthropic data consent (MASTER-05)
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

  const acknowledgeDisclaimer = async () => {
    const settings = (await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS)) || {};
    await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, coach_disclaimer_acknowledged: true });
    setShowDisclaimer(false);
    // After disclaimer, show Anthropic consent if not yet granted
    if (!consentGranted) {
      setShowConsentModal(true);
    }
  };

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

  // Refresh API key status on focus
  useEffect(() => {
    refresh();
  }, [refresh]);

  // MASTER-57: Load patterns for Coach Lite
  useEffect(() => {
    if (!apiKeyConfigured) {
      storageGet<PatternInsight[]>(STORAGE_KEYS.COACH_PATTERNS).then((p) => {
        setPatterns(p ?? []);
      });
    }
  }, [apiKeyConfigured]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    await sendUserMessage(text);
  };

  const handleSuggestedPrompt = async (prompt: string) => {
    if (sending) return;
    await sendUserMessage(prompt);
  };

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
          {patterns.length > 0 && (
            <View style={styles.liteSectionCard}>
              <Text style={styles.liteSectionTitle}>Pattern Insights</Text>
              {patterns.slice(0, 3).map((p) => (
                <View key={p.id} style={styles.litePatternRow}>
                  <Ionicons name="analytics-outline" size={16} color={Colors.accent} />
                  <Text style={styles.litePatternText}>{p.observation}</Text>
                </View>
              ))}
              {patterns.length === 0 && (
                <Text style={styles.liteNoDataText}>
                  Keep logging for 7+ days to see pattern insights
                </Text>
              )}
            </View>
          )}

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
        <Text style={styles.greetingSubtitle}>Your AI wellness companion.</Text>
        <Text style={styles.emptySubtitle}>
          I can help with meal plans, analyze your trends, and answer health questions based on your data.
        </Text>
        <Text style={styles.greetingPromptHint}>Pick a prompt below or type your own question.</Text>
        <SuggestedPrompts onSelect={handleSuggestedPrompt} visible />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Modal
        visible={showDisclaimer && apiKeyConfigured}
        transparent
        animationType="slide"
        onRequestClose={acknowledgeDisclaimer}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>About Coach DUB</Text>
            <Text style={styles.modalText}>
              Coach DUB is an AI wellness assistant powered by Anthropic's Claude. It is NOT a
              licensed healthcare provider, dietitian, or trainer. Do not use it for medical
              emergencies, diagnosis, or treatment decisions. Always consult qualified professionals
              for medical advice.
            </Text>
            <Text style={styles.modalText}>
              Your messages are sent to Anthropic's Claude API using your API key. Anthropic's
              usage policy applies. DUB_AI does not store or access your conversations.
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={acknowledgeDisclaimer}>
              <Text style={styles.modalButtonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AnthropicConsentModal
        visible={showConsentModal || (!showDisclaimer && apiKeyConfigured && !consentGranted)}
        onConsent={handleAnthropicConsent}
      />

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
        renderItem={({ item }) => <ChatBubble message={item} />}
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

      {sending && (
        <View style={styles.typingRow}>
          <LoadingIndicator size="small" />
          <Text style={styles.typingText}>
            {messages.length > 0 && messages[messages.length - 1].role === 'user'
              ? 'Coach DUB is thinking...'
              : 'Sending...'}
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={24} color={Colors.dangerText} />
          <Text style={styles.errorCardText}>
            Something went wrong. Your message wasn't lost.
          </Text>
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

      {apiKeyConfigured && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={isOffline ? 'Reconnect to chat with Coach DUB' : 'Ask Coach DUB...'}
            placeholderTextColor={Colors.secondaryText}
            value={inputText}
            onChangeText={setInputText}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '600',
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
