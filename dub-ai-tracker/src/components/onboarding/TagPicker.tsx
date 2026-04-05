// Tag Selection Grid — used in Settings and deferred setup
// P0-08: Tag visibility DECOUPLED from sex. All tags visible to all users.
// P1-14: No developer jargon — "tags" replaced with user-facing language

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { HEALTH_FITNESS_TAGS, PERSONAL_PRIVATE_TAGS } from '../../constants/tags';
import type { TagDefault } from '../../constants/tags';

interface TagPickerProps {
  enabledTags: string[];
  onToggle: (tagId: string) => void;
}

export function TagPicker({ enabledTags, onToggle }: TagPickerProps) {
  return (
    <View style={styles.container}>
      {/* Section 1: Health & Fitness */}
      <Text style={styles.sectionTitle}>Health & Fitness</Text>
      <View style={styles.grid}>
        {HEALTH_FITNESS_TAGS.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            enabled={enabledTags.includes(tag.id)}
            onToggle={() => onToggle(tag.id)}
          />
        ))}
      </View>

      {/* Section 2: Personal & Private */}
      <View style={styles.sensitiveSection}>
        <Text style={styles.sectionTitle}>Personal & Private</Text>
        <Text style={styles.sensitiveNote}>
          These categories track sensitive health data. They are completely private,
          stored only on your device, and optional.
        </Text>
        <View style={styles.grid}>
          {PERSONAL_PRIVATE_TAGS.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              enabled={enabledTags.includes(tag.id)}
              onToggle={() => onToggle(tag.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function TagChip({
  tag,
  enabled,
  onToggle,
}: {
  tag: TagDefault;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, enabled && styles.chipEnabled]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Ionicons
        name={tag.icon as React.ComponentProps<typeof Ionicons>['name']}
        size={18}
        color={enabled ? Colors.accent : Colors.secondaryText}
      />
      <Text style={[styles.chipText, enabled && styles.chipTextEnabled]}>
        {tag.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  sensitiveSection: {
    marginTop: 24,
  },
  sensitiveNote: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 48,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  chipEnabled: {
    borderColor: Colors.accent,
    backgroundColor: Colors.inputBackground,
  },
  chipText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextEnabled: {
    color: Colors.accentText,
  },
});
