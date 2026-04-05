// FTC Disclosure component for marketplace product cards
// Phase 22: Marketplace, Influencer System, and Polish
// Per FTC Endorsement Guides 16 CFR Part 255 (effective July 26, 2023)
// Disclosure must be clear, conspicuous, proximate, and visible without scrolling

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { Disclosure } from '../../types/marketplace';

interface FTCDisclosureProps {
  disclosures: Disclosure[];
}

export function FTCDisclosure({ disclosures }: FTCDisclosureProps) {
  if (disclosures.length === 0) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="information-circle" size={14} color={Colors.warning} />
      <View style={styles.textContainer}>
        {disclosures.map((d, i) => (
          <Text key={i} style={styles.text}>
            {d.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(212, 168, 67, 0.08)',
    borderLeftWidth: 2,
    borderLeftColor: Colors.warning,
    borderRadius: 4,
    padding: 8,
    gap: 6,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  text: {
    color: Colors.secondaryText,
    fontSize: 11,
    lineHeight: 14,
  },
});
