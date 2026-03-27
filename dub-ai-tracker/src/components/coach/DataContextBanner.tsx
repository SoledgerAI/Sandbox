// Data context banner showing what data Coach can see
// Phase 14: AI Coach

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface DataContextBannerProps {
  tagsLogged: string[];
  hasApiKey: boolean;
}

const TAG_LABELS: Record<string, string> = {
  'nutrition.food': 'Nutrition',
  'hydration.water': 'Hydration',
  'sleep.tracking': 'Sleep',
  'mental.wellness': 'Mood',
  'body.measurements': 'Body',
  'fitness.workout': 'Fitness',
  'strength.training': 'Strength',
  'recovery.score': 'Recovery',
  'supplements.daily': 'Supplements',
  'substances.tracking': 'Substances',
};

export function DataContextBanner({ tagsLogged, hasApiKey }: DataContextBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!hasApiKey) {
    return (
      <View style={styles.banner}>
        <Ionicons name="key-outline" size={16} color={Colors.warning} />
        <Text style={styles.warningText}>
          Add your Anthropic API key in Settings to start chatting with Coach DUB
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <Ionicons name="eye-outline" size={16} color={Colors.secondaryText} />
      <Text style={styles.bannerText}>
        Coach can see: {tagsLogged.length > 0
          ? tagsLogged.map((t) => TAG_LABELS[t] ?? t).join(', ')
          : 'No data logged today'}
      </Text>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={14}
        color={Colors.secondaryText}
      />
      {expanded && (
        <View style={styles.details}>
          <Text style={styles.detailText}>
            Coach DUB uses your logged data to provide personalized guidance.
            It sees today's entries, your profile, and 7-day trends when relevant.
            Therapy notes are never shared — only a yes/no session flag.
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.inputBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 6,
    flexWrap: 'wrap',
  },
  bannerText: {
    color: Colors.secondaryText,
    fontSize: 12,
    flex: 1,
  },
  warningText: {
    color: Colors.warning,
    fontSize: 12,
    flex: 1,
  },
  details: {
    width: '100%',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  detailText: {
    color: Colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
  },
});
