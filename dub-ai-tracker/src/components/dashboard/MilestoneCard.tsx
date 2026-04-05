// Subtle milestone recognition card — earned moments only
// P2-05: Navy card, 1px gold border, simple icon, factual text.
// No confetti, no badges, no XP, no animation.
// [Acknowledge] dismisses permanently for that milestone.

import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { MilestoneInfo } from '../../hooks/useMilestone';

interface MilestoneCardProps {
  milestone: MilestoneInfo;
  onAcknowledge: () => void;
}

export function MilestoneCard({ milestone, onAcknowledge }: MilestoneCardProps) {
  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`Milestone: ${milestone.title}. ${milestone.message}`}
    >
      <View style={styles.content}>
        <Ionicons
          name={milestone.icon}
          size={20}
          color={Colors.accentText}
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text style={styles.message}>{milestone.message}</Text>
        </View>
      </View>
      <Pressable
        style={styles.acknowledgeButton}
        onPress={onAcknowledge}
        accessibilityRole="button"
        accessibilityLabel="Acknowledge milestone"
        hitSlop={4}
      >
        <Text style={styles.acknowledgeText}>Acknowledge</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.primaryBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: 16,
    marginBottom: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: {
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  acknowledgeButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  acknowledgeText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
});
