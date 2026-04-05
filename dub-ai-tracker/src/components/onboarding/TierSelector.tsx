// Step 3 (Part A): Engagement Tier Selection
// Phase 3: Onboarding Flow
// Per Section 8 Step 3 and Section 9: Five engagement tiers

import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { TIER_DEFINITIONS, DEFAULT_TIER } from '../../constants/tiers';
import type { EngagementTier } from '../../types/profile';

interface TierSelectorProps {
  currentTier: EngagementTier | null;
  onSelect: (tier: EngagementTier) => void;
}

export function TierSelector({ currentTier, onSelect }: TierSelectorProps) {
  const [selected, setSelected] = useState<EngagementTier>(currentTier ?? DEFAULT_TIER);

  function handleSelect(tier: EngagementTier) {
    setSelected(tier);
    onSelect(tier);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Choose Your Approach</Text>
      <Text style={styles.sectionSubtitle}>
        This shapes how the Coach communicates and how detailed your tracking is.
        Change anytime in Settings.
      </Text>

      <View style={styles.tiers}>
        {TIER_DEFINITIONS.map((tier) => {
          const isSelected = selected === tier.id;
          const isDefault = tier.id === DEFAULT_TIER;
          return (
            <TouchableOpacity
              key={tier.id}
              style={[styles.tierCard, isSelected && styles.tierSelected]}
              onPress={() => handleSelect(tier.id)}
              activeOpacity={0.7}
            >
              <View style={styles.tierHeader}>
                <Text style={[styles.tierName, isSelected && styles.tierNameSelected]}>
                  {tier.name}
                </Text>
                <Text style={styles.tierLabel}>{tier.label}</Text>
                {isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              <Text style={styles.tierDescription}>{tier.description}</Text>
              {isSelected && (
                <View style={styles.tierDetails}>
                  <Text style={styles.tierDetail}>
                    Coach: {tier.coachTonePreview}
                  </Text>
                  <Text style={styles.tierDetail}>
                    Notifications: {tier.notificationCadence}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  tiers: {
    gap: 10,
  },
  tierCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierSelected: {
    borderColor: Colors.accent,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tierName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  tierNameSelected: {
    color: Colors.accentText,
  },
  tierLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  defaultBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: Colors.primaryBackground,
    fontSize: 11,
    fontWeight: '700',
  },
  tierDescription: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  tierDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 4,
  },
  tierDetail: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 16,
  },
});
