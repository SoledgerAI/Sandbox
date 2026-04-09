// Coach interaction hook
// Phase 14: AI Coach
// Sprint 12: Streaming, expert panel, tool use, photo capture

import { useState, useEffect, useCallback, useRef } from 'react';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import {
  sendMessageStreaming,
  sendToolResult,
  hasApiKey as checkApiKey,
  AnthropicError,
  getApiKey,
} from '../services/anthropic';
import type { AnthropicMessage, AnthropicContentBlock } from '../services/anthropic';
import { buildCoachContext } from '../ai/context_builder';
import { buildSystemPrompt, filterCoachResponse } from '../ai/coach_system_prompt';
import { runPatternEngine } from '../ai/pattern_engine';
import { parseExpertMention, stripMention, getExpert } from '../ai/experts';
import { logFeedback } from '../utils/feedbackLog';
import { estimateTokens } from '../utils/tokenEstimator';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import type { ChatMessage, ExpertId, ToolUseRequest, CoachToolName } from '../types/coach';

const MAX_HISTORY = 200;

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseCoachResult {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  streaming: boolean;
  apiKeyConfigured: boolean;
  error: string | null;
  tagsLogged: string[];
  lastUserMessage: string | null;
  activeExpert: ExpertId | undefined;
  pendingToolUse: ToolUseRequest | null;
  sendUserMessage: (text: string, imageUri?: string) => Promise<void>;
  confirmTool: () => Promise<void>;
  cancelTool: () => void;
  retry: () => Promise<void>;
  clearHistory: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCoach(): UseCoachResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsLogged, setTagsLogged] = useState<string[]>([]);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [activeExpert, setActiveExpert] = useState<ExpertId | undefined>(undefined);
  const [pendingToolUse, setPendingToolUse] = useState<ToolUseRequest | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const streamingMsgIdRef = useRef<string | null>(null);
  // Store context for tool result continuation
  const pendingContextRef = useRef<{
    systemPrompt: string;
    tier: import('../types/profile').EngagementTier;
    expertId: ExpertId | undefined;
    userMessageText: string;
  } | null>(null);

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

      // Clear any stale streaming flags from persisted messages
      const cleaned = (history ?? []).map((m) => ({ ...m, streaming: undefined }));
      setMessages(cleaned);
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

  const sendUserMessage = useCallback(async (text: string, imageUri?: string) => {
    const trimmed = text.trim();
    if (!trimmed && !imageUri) return;

    setError(null);
    setSending(true);
    setLastUserMessage(trimmed);

    // Detect @mention
    const expertId = parseExpertMention(trimmed);
    setActiveExpert(expertId);

    // Strip @mention for the API message
    const cleanText = expertId ? stripMention(trimmed) : trimmed;

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: cleanText || (imageUri ? 'Sent a photo' : ''),
      timestamp: new Date().toISOString(),
      imageUri,
    };

    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    messagesRef.current = updatedMessages;

    try {
      // Build context
      const { context, conditionalSections } = await buildCoachContext(cleanText);
      setTagsLogged(context.today_data.tags_logged);

      const systemPrompt = buildSystemPrompt(context, conditionalSections, undefined, expertId);

      if (__DEV__) {
        console.warn(`[Coach] System prompt: ~${estimateTokens(systemPrompt)} estimated tokens${expertId ? ` (expert: @${expertId})` : ''}`);
      }

      // Store context for tool continuation
      pendingContextRef.current = { systemPrompt, tier: context.tier, expertId, userMessageText: cleanText };

      // Build conversation history for API (last 10 messages for context window)
      const recentMessages = updatedMessages.slice(-10);
      const apiMessages: AnthropicMessage[] = [];

      for (const m of recentMessages) {
        if (m.role !== 'user' && m.role !== 'assistant') continue;

        // Build content blocks for the API
        if (m.imageUri && m.role === 'user') {
          // Image message — convert to multi-content
          try {
            const base64 = await readAsStringAsync(m.imageUri, { encoding: EncodingType.Base64 });
            const ext = m.imageUri.split('.').pop()?.toLowerCase() ?? 'jpeg';
            const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';
            const content: AnthropicContentBlock[] = [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            ];
            if (m.content && m.content !== 'Sent a photo') {
              content.push({ type: 'text', text: m.content });
            } else {
              content.push({ type: 'text', text: 'What food is in this photo? Identify items and estimate nutrition.' });
            }
            apiMessages.push({ role: 'user', content });
          } catch {
            // If image read fails, send text only
            apiMessages.push({ role: 'user', content: m.content });
          }
        } else {
          apiMessages.push({ role: m.role as 'user' | 'assistant', content: m.content });
        }
      }

      // Ensure starts with user (Anthropic API requirement)
      while (apiMessages.length > 0 && apiMessages[0].role !== 'user') {
        apiMessages.shift();
      }

      // Ensure alternation (no consecutive same-role messages)
      const cleanedApiMessages: AnthropicMessage[] = [];
      for (const msg of apiMessages) {
        if (cleanedApiMessages.length === 0 || cleanedApiMessages[cleanedApiMessages.length - 1].role !== msg.role) {
          cleanedApiMessages.push(msg);
        }
      }

      // Create placeholder assistant message for streaming
      const assistantMsgId = generateId();
      streamingMsgIdRef.current = assistantMsgId;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        expertId,
        streaming: true,
      };

      const withPlaceholder = [...messagesRef.current, assistantMsg];
      setMessages(withPlaceholder);
      messagesRef.current = withPlaceholder;
      setStreaming(true);

      // Send with streaming
      await sendMessageStreaming({
        systemPrompt,
        messages: cleanedApiMessages,
        tier: context.tier,
        tools: true,
        callbacks: {
          onText: (fullText) => {
            // Update the streaming message in place
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: fullText } : m,
              ),
            );
            // Keep ref in sync
            messagesRef.current = messagesRef.current.map((m) =>
              m.id === assistantMsgId ? { ...m, content: fullText } : m,
            );
          },
          onToolUse: (toolUseId, name, input) => {
            const toolReq: ToolUseRequest = {
              toolUseId,
              name,
              input,
              status: name === 'log_feedback' ? 'confirmed' : 'pending',
            };

            if (name === 'log_feedback') {
              // Auto-confirm feedback logging — no user confirmation needed
              executeTool(toolReq, cleanText);
            } else {
              // Show confirmation UI
              setPendingToolUse(toolReq);
              // Update message with tool use info
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, toolUse: toolReq } : m,
                ),
              );
              messagesRef.current = messagesRef.current.map((m) =>
                m.id === assistantMsgId ? { ...m, toolUse: toolReq } : m,
              );
            }
          },
          onDone: (fullText, _stopReason) => {
            // Apply post-generation safety filter
            const { text: filteredText } = filterCoachResponse(fullText, context);

            // Finalize the message
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: filteredText, streaming: undefined }
                  : m,
              ),
            );
            messagesRef.current = messagesRef.current.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: filteredText, streaming: undefined }
                : m,
            );

            setStreaming(false);
            setSending(false);
            setLastUserMessage(null);
            streamingMsgIdRef.current = null;

            // Persist
            const toSave = messagesRef.current.slice(-MAX_HISTORY);
            storageSet(STORAGE_KEYS.COACH_HISTORY, toSave).catch(() => {});
          },
          onError: (err) => {
            // Remove placeholder on error
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
            messagesRef.current = messagesRef.current.filter((m) => m.id !== assistantMsgId);
            setError(err.message);
            setStreaming(false);
            setSending(false);
            streamingMsgIdRef.current = null;
          },
        },
      });
    } catch (e) {
      if (e instanceof AnthropicError) {
        setError(e.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setSending(false);
      setStreaming(false);
    }
  }, []);

  // Execute a tool (write data to AsyncStorage)
  const executeTool = useCallback(async (toolReq: ToolUseRequest, userMessageText: string) => {
    const today = new Date().toISOString().slice(0, 10);

    try {
      switch (toolReq.name) {
        case 'log_drink': {
          const key = dateKey(STORAGE_KEYS.LOG_WATER, today);
          const existing = (await storageGet<unknown[]>(key)) ?? [];
          existing.push({
            id: generateId(),
            timestamp: (toolReq.input.timestamp as string) || new Date().toISOString(),
            amount_oz: toolReq.input.amount_oz,
            beverage_type: toolReq.input.beverage_type,
            source: 'coach',
          });
          await storageSet(key, existing);
          break;
        }
        case 'log_food': {
          const key = dateKey(STORAGE_KEYS.LOG_FOOD, today);
          const existing = (await storageGet<unknown[]>(key)) ?? [];
          existing.push({
            id: generateId(),
            timestamp: (toolReq.input.timestamp as string) || new Date().toISOString(),
            name: toolReq.input.food_name,
            meal_type: toolReq.input.meal_type || 'snack',
            calories: toolReq.input.calories,
            protein_g: toolReq.input.protein_g || 0,
            carbs_g: toolReq.input.carbs_g || 0,
            fat_g: toolReq.input.fat_g || 0,
            source: 'coach',
          });
          await storageSet(key, existing);
          break;
        }
        case 'log_weight': {
          const key = dateKey(STORAGE_KEYS.LOG_BODY, today);
          const existing = (await storageGet<unknown[]>(key)) ?? [];
          existing.push({
            id: generateId(),
            timestamp: (toolReq.input.timestamp as string) || new Date().toISOString(),
            weight_lbs: toolReq.input.weight_lbs,
            source: 'coach',
          });
          await storageSet(key, existing);
          break;
        }
        case 'log_exercise': {
          const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, today);
          const existing = (await storageGet<unknown[]>(key)) ?? [];
          existing.push({
            id: generateId(),
            timestamp: (toolReq.input.timestamp as string) || new Date().toISOString(),
            exercise_type: toolReq.input.exercise_type,
            duration_minutes: toolReq.input.duration_minutes,
            calories_burned: toolReq.input.calories_burned || 0,
            distance_miles: toolReq.input.distance_miles,
            source: 'coach',
          });
          await storageSet(key, existing);
          break;
        }
        case 'log_supplement': {
          const key = dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, today);
          const existing = (await storageGet<unknown[]>(key)) ?? [];
          existing.push({
            id: generateId(),
            timestamp: (toolReq.input.timestamp as string) || new Date().toISOString(),
            supplement_name: toolReq.input.supplement_name,
            dosage: toolReq.input.dosage || '',
            source: 'coach',
          });
          await storageSet(key, existing);
          break;
        }
        case 'log_feedback': {
          await logFeedback({
            type: (toolReq.input.type as 'bug' | 'feature_request' | 'question') || 'question',
            description: (toolReq.input.description as string) || '',
            screen: (toolReq.input.screen as string) || '',
            userMessage: userMessageText,
          });
          break;
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[Coach] Tool execution failed:', e);
    }
  }, []);

  // User confirms a tool use
  const confirmTool = useCallback(async () => {
    if (!pendingToolUse || !pendingContextRef.current) return;

    const confirmed = { ...pendingToolUse, status: 'confirmed' as const };
    setPendingToolUse(null);

    // Execute the tool
    await executeTool(confirmed, pendingContextRef.current.userMessageText);

    // Update message to show confirmed state
    setMessages((prev) =>
      prev.map((m) =>
        m.toolUse?.toolUseId === confirmed.toolUseId
          ? { ...m, toolUse: confirmed }
          : m,
      ),
    );
    messagesRef.current = messagesRef.current.map((m) =>
      m.toolUse?.toolUseId === confirmed.toolUseId
        ? { ...m, toolUse: confirmed }
        : m,
    );

    // Send tool_result back to continue conversation
    const ctx = pendingContextRef.current;
    const recentMessages = messagesRef.current.slice(-12);
    const apiMessages: AnthropicMessage[] = [];

    for (const m of recentMessages) {
      if (m.role === 'user') {
        apiMessages.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        if (m.toolUse && m.toolUse.toolUseId === confirmed.toolUseId) {
          // Build assistant message with tool_use block
          const contentBlocks: AnthropicContentBlock[] = [];
          if (m.content) contentBlocks.push({ type: 'text', text: m.content });
          contentBlocks.push({
            type: 'tool_use',
            id: confirmed.toolUseId,
            name: confirmed.name,
            input: confirmed.input,
          });
          apiMessages.push({ role: 'assistant', content: contentBlocks });
        } else {
          apiMessages.push({ role: 'assistant', content: m.content });
        }
      }
    }

    // Add tool_result as user message
    const toolLabel = getToolLabel(confirmed.name, confirmed.input);
    apiMessages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: confirmed.toolUseId, content: `Logged successfully: ${toolLabel}` }],
    });

    // Ensure alternation
    while (apiMessages.length > 0 && apiMessages[0].role !== 'user') {
      apiMessages.shift();
    }

    // Create new streaming assistant message for continuation
    const continuationId = generateId();
    streamingMsgIdRef.current = continuationId;
    const contMsg: ChatMessage = {
      id: continuationId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      expertId: ctx.expertId,
      streaming: true,
    };
    const withCont = [...messagesRef.current, contMsg];
    setMessages(withCont);
    messagesRef.current = withCont;
    setStreaming(true);

    await sendToolResult({
      systemPrompt: ctx.systemPrompt,
      messages: apiMessages,
      tier: ctx.tier,
      callbacks: {
        onText: (fullText) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === continuationId ? { ...m, content: fullText } : m)),
          );
          messagesRef.current = messagesRef.current.map((m) =>
            m.id === continuationId ? { ...m, content: fullText } : m,
          );
        },
        onToolUse: () => {
          // Nested tool use not supported in continuation
        },
        onDone: (fullText) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === continuationId ? { ...m, content: fullText, streaming: undefined } : m,
            ),
          );
          messagesRef.current = messagesRef.current.map((m) =>
            m.id === continuationId ? { ...m, content: fullText, streaming: undefined } : m,
          );
          setStreaming(false);
          setSending(false);
          streamingMsgIdRef.current = null;
          const toSave = messagesRef.current.slice(-MAX_HISTORY);
          storageSet(STORAGE_KEYS.COACH_HISTORY, toSave).catch(() => {});
        },
        onError: () => {
          // Remove empty continuation on error
          if (!messagesRef.current.find((m) => m.id === continuationId)?.content) {
            setMessages((prev) => prev.filter((m) => m.id !== continuationId));
            messagesRef.current = messagesRef.current.filter((m) => m.id !== continuationId);
          }
          setStreaming(false);
          setSending(false);
          streamingMsgIdRef.current = null;
        },
      },
    });
  }, [pendingToolUse, executeTool]);

  // User cancels a tool use
  const cancelTool = useCallback(() => {
    if (!pendingToolUse) return;
    const cancelled = { ...pendingToolUse, status: 'cancelled' as const };
    setPendingToolUse(null);

    setMessages((prev) =>
      prev.map((m) =>
        m.toolUse?.toolUseId === cancelled.toolUseId
          ? { ...m, toolUse: cancelled }
          : m,
      ),
    );
    messagesRef.current = messagesRef.current.map((m) =>
      m.toolUse?.toolUseId === cancelled.toolUseId
        ? { ...m, toolUse: cancelled }
        : m,
    );

    setStreaming(false);
    setSending(false);

    const toSave = messagesRef.current.slice(-MAX_HISTORY);
    storageSet(STORAGE_KEYS.COACH_HISTORY, toSave).catch(() => {});
  }, [pendingToolUse]);

  const retry = useCallback(async () => {
    if (!lastUserMessage) return;
    // Remove the failed user message before re-sending
    const cleaned = [...messagesRef.current];
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user' && cleaned[cleaned.length - 1].content === lastUserMessage) {
      cleaned.pop();
      setMessages(cleaned);
      messagesRef.current = cleaned;
    }
    await sendUserMessage(lastUserMessage);
  }, [lastUserMessage, sendUserMessage]);

  const clearHistory = useCallback(async () => {
    setMessages([]);
    messagesRef.current = [];
    setActiveExpert(undefined);
    setPendingToolUse(null);
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
    clearHistory,
    refresh,
  };
}

// ============================================================
// Helper: human-readable tool label for confirmations
// ============================================================

function getToolLabel(name: CoachToolName, input: Record<string, unknown>): string {
  switch (name) {
    case 'log_drink':
      return `${input.amount_oz} oz ${input.beverage_type || 'water'}`;
    case 'log_food':
      return `${input.food_name}${input.calories ? ` (${input.calories} cal)` : ''}`;
    case 'log_weight':
      return `${input.weight_lbs} lbs`;
    case 'log_exercise':
      return `${input.exercise_type} — ${input.duration_minutes} min`;
    case 'log_supplement':
      return `${input.supplement_name}${input.dosage ? ` ${input.dosage}` : ''}`;
    case 'log_feedback':
      return `${input.type}: ${input.description}`;
    default:
      return name;
  }
}

export { getToolLabel };
