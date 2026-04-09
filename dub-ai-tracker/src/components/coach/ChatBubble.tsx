// Chat message bubble component
// Phase 14: AI Coach
// Sprint 12: Expert labels, photo bubbles, tool confirmation cards

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getExpert } from '../../ai/experts';
import { getToolLabel } from '../../hooks/useCoach';
import type { ChatMessage, ToolUseRequest } from '../../types/coach';

interface ChatBubbleProps {
  message: ChatMessage;
  onConfirmTool?: () => void;
  onCancelTool?: () => void;
}

const TOOL_ICONS: Record<string, string> = {
  log_drink: '💧',
  log_food: '🍽️',
  log_weight: '⚖️',
  log_exercise: '🏃',
  log_supplement: '💊',
  log_feedback: '📝',
};

export const ChatBubble = React.memo(function ChatBubble({
  message,
  onConfirmTool,
  onCancelTool,
}: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const expert = message.expertId ? getExpert(message.expertId) : undefined;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {/* Expert response header */}
        {!isUser && expert && (
          <Text style={styles.expertLabel}>
            {expert.emoji} {expert.name}
          </Text>
        )}

        {/* Photo display for user image messages */}
        {isUser && message.imageUri && (
          <Image source={{ uri: message.imageUri }} style={styles.photoPreview} resizeMode="cover" />
        )}

        {/* Message text */}
        {message.content ? (
          <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
            {message.content}
            {message.streaming ? '▊' : ''}
          </Text>
        ) : message.streaming ? (
          <Text style={styles.textAssistant}>▊</Text>
        ) : null}

        {/* Tool use confirmation card */}
        {message.toolUse && message.toolUse.name !== 'log_feedback' && (
          <ToolConfirmationCard
            toolUse={message.toolUse}
            onConfirm={onConfirmTool}
            onCancel={onCancelTool}
          />
        )}

        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
});

function ToolConfirmationCard({
  toolUse,
  onConfirm,
  onCancel,
}: {
  toolUse: ToolUseRequest;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const icon = TOOL_ICONS[toolUse.name] || '📋';
  const label = getToolLabel(toolUse.name, toolUse.input);

  if (toolUse.status === 'confirmed') {
    return (
      <View style={styles.toolCard}>
        <Text style={styles.toolLabel}>{icon} Logged: {label} ✓</Text>
      </View>
    );
  }

  if (toolUse.status === 'cancelled') {
    return (
      <View style={styles.toolCard}>
        <Text style={[styles.toolLabel, { color: Colors.secondaryText }]}>{icon} {label} — skipped</Text>
      </View>
    );
  }

  // Pending confirmation
  return (
    <View style={styles.toolCard}>
      <Text style={styles.toolLabel}>{icon} Log {label}?</Text>
      <View style={styles.toolActions}>
        <TouchableOpacity style={styles.toolConfirmBtn} onPress={onConfirm} activeOpacity={0.7}>
          <Text style={styles.toolConfirmText}>Confirm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolCancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.toolCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.cardBackground,
    borderBottomLeftRadius: 4,
  },
  expertLabel: {
    color: Colors.accentText,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 6,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textUser: {
    color: Colors.primaryBackground,
  },
  textAssistant: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.secondaryText,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  // Tool confirmation card
  toolCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  toolLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  toolActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  toolConfirmBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toolConfirmText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '600',
  },
  toolCancelBtn: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  toolCancelText: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
});
