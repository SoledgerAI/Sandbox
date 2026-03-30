// Coach DUB chat interface
// Phase 14: AI Coach

import { useState, useRef, useEffect } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { ChatBubble } from '../../src/components/coach/ChatBubble';
import { SuggestedPrompts } from '../../src/components/coach/SuggestedPrompts';
import { DataContextBanner } from '../../src/components/coach/DataContextBanner';
import { APIKeySetupWizard } from '../../src/components/APIKeySetupWizard';
import { useCoach } from '../../src/hooks/useCoach';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import type { ChatMessage } from '../../src/types/coach';

export default function CoachScreen() {
  const {
    messages,
    loading,
    sending,
    apiKeyConfigured,
    error,
    tagsLogged,
    sendUserMessage,
    refresh,
  } = useCoach();

  const [inputText, setInputText] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Check if coach disclaimer has already been acknowledged
  useEffect(() => {
    (async () => {
      const settings = await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
      if (settings && settings.coach_disclaimer_acknowledged) {
        setShowDisclaimer(false);
      }
    })();
  }, []);

  const acknowledgeDisclaimer = async () => {
    const settings = (await storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS)) || {};
    await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, coach_disclaimer_acknowledged: true });
    setShowDisclaimer(false);
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
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      );
    }

    if (!apiKeyConfigured) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="key-outline" size={56} color={Colors.accent} />
          <Text style={styles.emptyTitle}>Set Up Your AI Coach</Text>
          <Text style={styles.emptySubtitle}>
            Connect your Anthropic API key to unlock personalized health coaching powered by Claude.
          </Text>
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => setShowWizard(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.setupButtonText}>Set Up API Key</Text>
          </TouchableOpacity>
          <Text style={styles.setupFooter}>
            Your key stays on your device. Conversations use your own API balance (typically $0.01-0.05 each).
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color={Colors.divider} />
        <Text style={styles.emptyTitle}>Coach DUB</Text>
        <Text style={styles.emptySubtitle}>
          Your AI wellness coach. Ask about your nutrition, workouts, sleep, or any health topic.
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Modal
        visible={showDisclaimer && apiKeyConfigured}
        transparent
        animationType="fade"
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
            <TouchableOpacity style={styles.modalButton} onPress={acknowledgeDisclaimer}>
              <Text style={styles.modalButtonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      <SuggestedPrompts
        onSelect={handleSuggestedPrompt}
        visible={messages.length === 0 && apiKeyConfigured}
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.typingText}>Coach DUB is thinking...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {apiKeyConfigured && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask Coach DUB..."
            placeholderTextColor={Colors.secondaryText}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!sending}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
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
    fontSize: 22,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  setupButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 20,
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
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: Colors.inputBackground,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    flex: 1,
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
    fontSize: 15,
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
});
