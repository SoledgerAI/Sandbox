// Repeat-last-entry banner -- shows at top of logging screens when a previous entry exists
// Wave 2 P1: Repeat Last Entry (Global)

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface RepeatLastEntryProps {
  tagLabel: string;
  subtitle?: string;
  visible: boolean;
  onRepeat: () => void;
}

export function RepeatLastEntry({ tagLabel, subtitle, visible, onRepeat }: RepeatLastEntryProps) {
  if (!visible) return null;

  return (
    <TouchableOpacity style={styles.banner} onPress={onRepeat} activeOpacity={0.7}>
      <Ionicons name="repeat-outline" size={20} color={Colors.accent} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>Repeat last {tagLabel}</Text>
        {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
});
