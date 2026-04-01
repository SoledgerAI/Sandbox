// Coach interaction hook
// Phase 14: AI Coach

import { useState, useEffect, useCallback, useRef } from 'react';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';
import { sendMessage, hasApiKey as checkApiKey, AnthropicError } from '../services/anthropic';
import { buildCoachContext } from '../ai/context_builder';
import { buildSystemPrompt, filterCoachResponse } from '../ai/coach_system_prompt';
import { runPatternEngine } from '../ai/pattern_engine';
import { estimateTokens } from '../utils/tokenEstimator';
import type { ChatMessage } from '../types/coach';
import type { AnthropicMessage } from '../services/anthropic';

const MAX_HISTORY = 200;

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface UseCoachResult {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  apiKeyConfigured: boolean;
  error: string | null;
  tagsLogged: string[];
  sendUserMessage: (text: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCoach(): UseCoachResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsLogged, setTagsLogged] = useState<string[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [history, hasKey] = await Promise.all([
        storageGet<ChatMessage[]>(STORAGE_KEYS.COACH_HISTORY),
        checkApiKey(),
      ]);

      setMessages(history ?? []);
      setApiKeyConfigured(hasKey);

      // Run pattern engine on load
      runPatternEngine().catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendUserMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setError(null);
    setSending(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    messagesRef.current = updatedMessages;

    try {
      // Build context
      const { context, conditionalSections } = await buildCoachContext(trimmed);
      setTagsLogged(context.today_data.tags_logged);

      const systemPrompt = buildSystemPrompt(context, conditionalSections);

      if (__DEV__) {
        console.log(`[Coach] System prompt: ~${estimateTokens(systemPrompt)} estimated tokens`);
      }

      // Build conversation history for API (last 10 messages for context window)
      // MASTER-64: Ensure messages start with user role and alternate properly
      const recentMessages = updatedMessages.slice(-10);
      let filteredMessages = recentMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Ensure starts with user (Anthropic API requirement)
      while (filteredMessages.length > 0 && filteredMessages[0].role !== 'user') {
        filteredMessages.shift();
      }

      // Ensure alternation (no consecutive same-role messages)
      const apiMessages: AnthropicMessage[] = [];
      for (const msg of filteredMessages) {
        if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].role !== msg.role) {
          apiMessages.push(msg);
        }
      }

      // Send to API
      const responseText = await sendMessage({
        systemPrompt,
        messages: apiMessages,
        tier: context.tier,
      });

      // Apply post-generation safety filter (D6-008)
      const { text: filteredText } = filterCoachResponse(responseText, context);

      // Add assistant message
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: filteredText,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...messagesRef.current, assistantMsg].slice(-MAX_HISTORY);
      setMessages(finalMessages);
      messagesRef.current = finalMessages;

      // Persist
      await storageSet(STORAGE_KEYS.COACH_HISTORY, finalMessages);
    } catch (e) {
      if (e instanceof AnthropicError) {
        setError(e.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    setMessages([]);
    messagesRef.current = [];
    await storageSet(STORAGE_KEYS.COACH_HISTORY, []);
  }, []);

  const refresh = useCallback(async () => {
    const hasKey = await checkApiKey();
    setApiKeyConfigured(hasKey);
  }, []);

  return {
    messages,
    loading,
    sending,
    apiKeyConfigured,
    error,
    tagsLogged,
    sendUserMessage,
    clearHistory,
    refresh,
  };
}
