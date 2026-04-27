// Coach interaction hook
// Phase 14: AI Coach
// Sprint 12: Streaming, expert panel, tool use, photo capture

import { useState, useEffect, useCallback, useRef } from 'react';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';
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
import { estimateTokens } from '../utils/tokenEstimator';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import type { ChatMessage, ExpertId, ToolUseRequest, CoachToolName, ToolTier } from '../types/coach';
import {
  executeTool as executeToolImpl,
  reverseLastTool as reverseLastToolImpl,
  MAX_TOOL_TURNS,
  type UndoRecord,
  type ExecuteToolResult,
} from '../services/coachToolExecutor';
import { classifyTier } from '../services/coachToolRouter';

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
  /** Sprint 30: multi-tool checklist batch awaiting confirmation */
  pendingBatch: ToolUseRequest[] | null;
  /** Sprint 30: most recent auto_commit tool that can be undone within 5s */
  undoableTool: { record: UndoRecord; expiresAt: number } | null;
  sendUserMessage: (text: string, imageUri?: string) => Promise<void>;
  confirmTool: () => Promise<void>;
  cancelTool: () => void;
  /** Sprint 30: confirm a multi-tool checklist batch */
  confirmBatch: (tools: ToolUseRequest[]) => Promise<void>;
  cancelBatch: () => void;
  /** Sprint 30: undo the most recent auto-committed tool */
  undoLastTool: () => Promise<void>;
  retry: () => Promise<void>;
  clearHistory: () => Promise<void>;
  refresh: () => Promise<void>;
}

const UNDO_WINDOW_MS = 5000;

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
  const [pendingBatch, setPendingBatch] = useState<ToolUseRequest[] | null>(null);
  const [undoableTool, setUndoableTool] = useState<{ record: UndoRecord; expiresAt: number } | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const streamingMsgIdRef = useRef<string | null>(null);
  // Store context for tool result continuation
  const pendingContextRef = useRef<{
    systemPrompt: string;
    tier: import('../types/profile').EngagementTier;
    expertId: ExpertId | undefined;
    userMessageText: string;
    userMessageHadImage: boolean;
  } | null>(null);
  const undoableToolRef = useRef<{ record: UndoRecord; expiresAt: number } | null>(null);
  /** Sprint 30: tool_use blocks emitted during the current stream */
  const turnToolsRef = useRef<ToolUseRequest[]>([]);

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
      pendingContextRef.current = {
        systemPrompt,
        tier: context.tier,
        expertId,
        userMessageText: cleanText,
        userMessageHadImage: imageUri != null,
      };

      // Build conversation history for API (last 10 messages for context window)
      const recentMessages = updatedMessages.slice(-10);
      const apiMessages: AnthropicMessage[] = [];

      for (const m of recentMessages) {
        if (m.role !== 'user' && m.role !== 'assistant') continue;

        // Build content blocks for the API
        if (m.imageUri && m.role === 'user') {
          // Image message — convert to multi-content
          // Bug #11: stripExifMetadata also resizes the image to ≤1568px
          // long edge so it fits Anthropic's 5MB request ceiling. Errors
          // here used to be silently swallowed and the message sent text-
          // only, which produced a confusing "Something went wrong" with
          // no diagnostic. Surface the actual error instead.
          try {
            const { stripExifMetadata } = await import('../utils/imagePrivacy');
            const strippedUri = await stripExifMetadata(m.imageUri);
            const base64 = await readAsStringAsync(strippedUri, { encoding: EncodingType.Base64 });
            const mediaType = 'image/jpeg' as const; // stripExifMetadata always emits JPEG
            const content: AnthropicContentBlock[] = [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            ];
            if (m.content && m.content !== 'Sent a photo') {
              content.push({ type: 'text', text: m.content });
            } else {
              content.push({ type: 'text', text: 'What food is in this photo? Identify items and estimate nutrition.' });
            }
            apiMessages.push({ role: 'user', content });
          } catch (err) {
            const e = err as { message?: string; stack?: string; response?: { data?: unknown; status?: number } };
            console.error(
              '[Coach] ERROR:',
              e?.message,
              e?.stack,
              e?.response?.data ?? e?.response?.status,
            );
            throw new Error(
              `Photo upload failed: ${err instanceof Error ? err.message : 'unknown error'}`,
            );
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
      turnToolsRef.current = [];

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
            // Sprint 30: classify the tool's tier and either queue it for the
            // post-stream dispatcher (auto_commit, checklist, explicit) or
            // immediately auto-confirm legacy feedback logging.
            const tier: ToolTier = name === 'log_feedback'
              ? 'auto_commit'
              : classifyTier({
                  toolName: name,
                  toolInput: input,
                  userMessageHadImage: imageUri != null,
                  userMessageText: cleanText,
                });
            const toolReq: ToolUseRequest = {
              toolUseId,
              name,
              input,
              status: tier === 'auto_commit' ? 'confirmed' : 'pending',
              tier,
            };
            turnToolsRef.current.push(toolReq);

            if (tier !== 'auto_commit') {
              // Show confirmation UI for the FIRST non-auto tool only — multi-tool
              // checklists are rendered as a consolidated card after onDone.
              setMessages((prev) => prev.map((m) =>
                m.id === assistantMsgId ? { ...m, toolUse: toolReq } : m,
              ));
              messagesRef.current = messagesRef.current.map((m) =>
                m.id === assistantMsgId ? { ...m, toolUse: toolReq } : m,
              );
            }
          },
          onDone: (fullText, stopReason) => {
            // Apply post-generation safety filter
            const { text: filteredText } = filterCoachResponse(fullText, context);

            // Finalize the message
            setMessages((prev) => prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: filteredText, streaming: undefined }
                : m,
            ));
            messagesRef.current = messagesRef.current.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: filteredText, streaming: undefined }
                : m,
            );

            setLastUserMessage(null);
            streamingMsgIdRef.current = null;

            // Sprint 30: dispatch the collected tool batch.
            const collected = turnToolsRef.current;
            turnToolsRef.current = [];

            const autoCommit = collected.filter((t) => t.tier === 'auto_commit');
            const checklist = collected.filter((t) => t.tier === 'checklist');
            const explicit = collected.filter((t) => t.tier === 'explicit');

            if (collected.length === 0 || stopReason !== 'tool_use') {
              setStreaming(false);
              setSending(false);
              const toSave = messagesRef.current.slice(-MAX_HISTORY);
              storageSet(STORAGE_KEYS.COACH_HISTORY, toSave).catch(() => {});
              return;
            }

            // Run the dispatcher in a microtask so React state from this
            // onDone settles first.
            (async () => {
              if (autoCommit.length > 0 && checklist.length === 0 && explicit.length === 0) {
                // All auto_commit — execute and continue the conversation.
                const labels = new Map<string, string>();
                for (const t of autoCommit) {
                  const r = await executeTool(t, cleanText, { trackUndo: true });
                  labels.set(t.toolUseId, r.ok ? r.label : t.name);
                }
                const apiMessages = buildContinuationMessages(autoCommit, labels);
                await runContinuationLoop(apiMessages);
              } else if (checklist.length > 0 && explicit.length === 0) {
                // Render consolidated checklist card; do not execute yet.
                setPendingBatch(checklist);
                setStreaming(false);
                setSending(false);
              } else if (explicit.length === 1 && checklist.length === 0 && autoCommit.length === 0) {
                // Single explicit tool — existing pendingToolUse path.
                setPendingToolUse(explicit[0]);
                setStreaming(false);
                setSending(false);
              } else {
                // Mixed — fall back to checklist for everything that needs
                // confirmation, after auto-committing the rest.
                for (const t of autoCommit) {
                  await executeTool(t, cleanText, { trackUndo: true });
                }
                setPendingBatch([...checklist, ...explicit]);
                setStreaming(false);
                setSending(false);
              }
              const toSave = messagesRef.current.slice(-MAX_HISTORY);
              storageSet(STORAGE_KEYS.COACH_HISTORY, toSave).catch(() => {});
            })().catch((e) => {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('[Coach] dispatch failed:', e);
              }
              setStreaming(false);
              setSending(false);
            });
          },
          onError: (err) => {
            const e = err as AnthropicError & { response?: { data?: unknown; status?: number } };
            console.error(
              '[Coach] ERROR:',
              e?.message,
              e?.stack,
              e?.response?.data ?? e?.response?.status ?? e?.status ?? e?.code,
            );
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

  // Execute a tool (write data to AsyncStorage). Sprint 30: returns the
  // executor's result so callers can format tool_result content and track
  // undo records. Errors are returned, not thrown.
  const executeTool = useCallback(async (
    toolReq: ToolUseRequest,
    userMessageText: string,
    options?: { trackUndo?: boolean },
  ): Promise<ExecuteToolResult> => {
    const result = await executeToolImpl(toolReq, userMessageText);
    if (result.ok && options?.trackUndo && toolReq.name !== 'log_feedback') {
      const record: UndoRecord = {
        toolUseId: toolReq.toolUseId,
        toolName: toolReq.name,
        storageKey: result.storageKey,
        prevValue: result.prevValue,
        executedAt: Date.now(),
      };
      const slot = { record, expiresAt: Date.now() + UNDO_WINDOW_MS };
      undoableToolRef.current = slot;
      setUndoableTool(slot);
      // Auto-clear after the undo window expires.
      setTimeout(() => {
        if (undoableToolRef.current && undoableToolRef.current.record.toolUseId === toolReq.toolUseId) {
          undoableToolRef.current = null;
          setUndoableTool(null);
        }
      }, UNDO_WINDOW_MS);
    }
    return result;
  }, []);

  /**
   * Sprint 30: drive the model through repeated tool_use → tool_result
   * rounds using the active streaming session. Capped at MAX_TOOL_TURNS to
   * prevent runaway loops.
   */
  const runContinuationLoop = useCallback(async (
    initialApiMessages: AnthropicMessage[],
  ): Promise<void> => {
    const ctx = pendingContextRef.current;
    if (!ctx) return;
    let apiMessages = initialApiMessages;
    let turn = 0;

    while (turn < MAX_TOOL_TURNS) {
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

      const collectedTools: ToolUseRequest[] = [];
      let finalText = '';
      let stopReason = 'end_turn';
      let errored = false;

      await sendToolResult({
        systemPrompt: ctx.systemPrompt,
        messages: apiMessages,
        tier: ctx.tier,
        callbacks: {
          onText: (fullText) => {
            finalText = fullText;
            setMessages((prev) => prev.map((m) => (m.id === continuationId ? { ...m, content: fullText } : m)));
            messagesRef.current = messagesRef.current.map((m) =>
              m.id === continuationId ? { ...m, content: fullText } : m,
            );
          },
          onToolUse: (id, name, input) => {
            collectedTools.push({ toolUseId: id, name, input, status: 'pending' });
          },
          onDone: (fullText, sr) => {
            finalText = fullText;
            stopReason = sr;
          },
          onError: () => { errored = true; },
        },
      });

      // Finalize this assistant message regardless of branch.
      setMessages((prev) => prev.map((m) =>
        m.id === continuationId ? { ...m, content: finalText, streaming: undefined } : m,
      ));
      messagesRef.current = messagesRef.current.map((m) =>
        m.id === continuationId ? { ...m, content: finalText, streaming: undefined } : m,
      );

      if (errored || stopReason !== 'tool_use' || collectedTools.length === 0) {
        break;
      }

      // Execute every tool in this batch; errors don't break the loop.
      const assistantBlocks: AnthropicContentBlock[] = [];
      if (finalText) assistantBlocks.push({ type: 'text', text: finalText });
      const toolResults: AnthropicContentBlock[] = [];
      for (const t of collectedTools) {
        assistantBlocks.push({ type: 'tool_use', id: t.toolUseId, name: t.name, input: t.input });
        const result = await executeTool(t, ctx.userMessageText, { trackUndo: true });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: t.toolUseId,
          content: result.ok ? `Logged: ${result.label}` : `Error: ${result.error}`,
        });
      }

      apiMessages = [
        ...apiMessages,
        { role: 'assistant', content: assistantBlocks },
        { role: 'user', content: toolResults },
      ];

      turn++;
      if (turn >= MAX_TOOL_TURNS) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Coach] Tool turn limit reached');
        }
        break;
      }
    }

    setStreaming(false);
    setSending(false);
    streamingMsgIdRef.current = null;
    const toSave = messagesRef.current.slice(-MAX_HISTORY);
    storageSet(STORAGE_KEYS.COACH_HISTORY, toSave).catch(() => {});
  }, [executeTool]);

  /**
   * Build the API messages array carrying the assistant tool_use blocks and
   * the user tool_result blocks for the given confirmed tools, preserving
   * conversation history.
   */
  const buildContinuationMessages = useCallback((
    confirmedTools: ToolUseRequest[],
    toolLabels: Map<string, string>,
  ): AnthropicMessage[] => {
    const recentMessages = messagesRef.current.slice(-12);
    const out: AnthropicMessage[] = [];
    const handledToolUseIds = new Set(confirmedTools.map((t) => t.toolUseId));

    for (const m of recentMessages) {
      if (m.role === 'user') {
        out.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        if (m.toolUse && handledToolUseIds.has(m.toolUse.toolUseId)) {
          const blocks: AnthropicContentBlock[] = [];
          if (m.content) blocks.push({ type: 'text', text: m.content });
          for (const t of confirmedTools) {
            if (t.toolUseId === m.toolUse.toolUseId) {
              blocks.push({ type: 'tool_use', id: t.toolUseId, name: t.name, input: t.input });
            }
          }
          out.push({ role: 'assistant', content: blocks });
        } else {
          out.push({ role: 'assistant', content: m.content });
        }
      }
    }

    const toolResults: AnthropicContentBlock[] = confirmedTools.map((t) => ({
      type: 'tool_result',
      tool_use_id: t.toolUseId,
      content: `Logged successfully: ${toolLabels.get(t.toolUseId) ?? t.name}`,
    }));
    out.push({ role: 'user', content: toolResults });

    while (out.length > 0 && out[0].role !== 'user') out.shift();
    return out;
  }, []);

  // User confirms a tool use (single-tool explicit/checklist tier)
  const confirmTool = useCallback(async () => {
    if (!pendingToolUse || !pendingContextRef.current) return;

    const confirmed = { ...pendingToolUse, status: 'confirmed' as const };
    setPendingToolUse(null);

    const ctx = pendingContextRef.current;
    const result = await executeTool(confirmed, ctx.userMessageText, { trackUndo: false });

    setMessages((prev) => prev.map((m) =>
      m.toolUse?.toolUseId === confirmed.toolUseId ? { ...m, toolUse: confirmed } : m,
    ));
    messagesRef.current = messagesRef.current.map((m) =>
      m.toolUse?.toolUseId === confirmed.toolUseId ? { ...m, toolUse: confirmed } : m,
    );

    const labels = new Map<string, string>();
    labels.set(confirmed.toolUseId, result.ok ? result.label : confirmed.name);
    const apiMessages = buildContinuationMessages([confirmed], labels);
    await runContinuationLoop(apiMessages);
  }, [pendingToolUse, executeTool, buildContinuationMessages, runContinuationLoop]);

  // User confirms a multi-tool checklist batch
  const confirmBatch = useCallback(async (tools: ToolUseRequest[]) => {
    if (!pendingContextRef.current || tools.length === 0) return;
    const ctx = pendingContextRef.current;
    setPendingBatch(null);

    const labels = new Map<string, string>();
    const confirmedTools: ToolUseRequest[] = [];
    for (const t of tools) {
      const confirmed = { ...t, status: 'confirmed' as const };
      confirmedTools.push(confirmed);
      const result = await executeTool(confirmed, ctx.userMessageText, { trackUndo: false });
      labels.set(t.toolUseId, result.ok ? result.label : t.name);
    }
    const apiMessages = buildContinuationMessages(confirmedTools, labels);
    await runContinuationLoop(apiMessages);
  }, [executeTool, buildContinuationMessages, runContinuationLoop]);

  const cancelBatch = useCallback(() => {
    setPendingBatch(null);
    setStreaming(false);
    setSending(false);
  }, []);

  const undoLastTool = useCallback(async () => {
    const slot = undoableToolRef.current;
    if (!slot) return;
    if (Date.now() > slot.expiresAt) {
      undoableToolRef.current = null;
      setUndoableTool(null);
      return;
    }
    await reverseLastToolImpl(slot.record);
    undoableToolRef.current = null;
    setUndoableTool(null);
  }, []);

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
    pendingBatch,
    undoableTool,
    sendUserMessage,
    confirmTool,
    cancelTool,
    confirmBatch,
    cancelBatch,
    undoLastTool,
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
    case 'log_body_composition': {
      const parts: string[] = [];
      if (input.body_fat_pct != null) parts.push(`BF ${input.body_fat_pct}%`);
      if (input.skeletal_muscle_lbs != null) parts.push(`SMM ${input.skeletal_muscle_lbs}`);
      if (input.bmi != null) parts.push(`BMI ${input.bmi}`);
      return parts.length > 0 ? parts.join(', ') : 'body composition';
    }
    case 'log_sleep':
      return `${input.hours ?? '?'}h sleep`;
    case 'log_mood':
      return `mood ${input.mood_rating ?? '?'}/5`;
    case 'log_substance':
      return `${input.category ?? 'substance'}${input.amount != null ? ` ${input.amount}${input.unit ?? ''}` : ''}`;
    default:
      return name;
  }
}

export { getToolLabel };
