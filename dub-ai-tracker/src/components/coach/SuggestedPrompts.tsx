// Suggested prompts for Coach screen
// Phase 14: AI Coach
// Rotates daily based on day-of-year

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';

const ALL_PROMPTS = [
  'How am I doing this week?',
  'What should I eat for dinner tonight?',
  'Design a workout for today',
  'What patterns have you noticed?',
  'Help me understand my recovery score',
  'Analyze my sleep this week',
  'Am I getting enough protein?',
  "What's my calorie trend looking like?",
];

function getDailyPrompts(): string[] {
  // Rotate based on day of year, show 4 at a time
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const offset = dayOfYear % ALL_PROMPTS.length;

  const result: string[] = [];
  for (let i = 0; i < 4; i++) {
    result.push(ALL_PROMPTS[(offset + i) % ALL_PROMPTS.length]);
  }
  return result;
}

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  visible: boolean;
}

export function SuggestedPrompts({ onSelect, visible }: SuggestedPromptsProps) {
  if (!visible) return null;

  const prompts = getDailyPrompts();

  return (
    <View style={styles.container}>
      {prompts.map((prompt) => (
        <TouchableOpacity
          key={prompt}
          style={styles.chip}
          onPress={() => onSelect(prompt)}
          activeOpacity={0.7}
        >
          <Text style={styles.chipText}>{prompt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    width: '47%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  chipText: {
    color: Colors.accent,
    fontSize: 13,
  },
});
