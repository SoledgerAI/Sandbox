// Step 4 (Part B): Notification Preferences
// Phase 3: Onboarding Flow
// Per Section 8 Step 4: Notification preferences with tier-based cadence preview

import { useState } from 'react';
import { StyleSheet, Text, View, Switch } from 'react-native';
import { Colors } from '../../constants/colors';
import { getTierDefinition } from '../../constants/tiers';
import type { EngagementTier } from '../../types/profile';

interface NotificationStepProps {
  tier: EngagementTier | null;
  notificationsEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function NotificationStep({
  tier,
  notificationsEnabled,
  onToggle,
}: NotificationStepProps) {
  const [enabled, setEnabled] = useState(notificationsEnabled);
  const tierDef = getTierDefinition(tier ?? 'balanced');

  function handleToggle(value: boolean) {
    setEnabled(value);
    onToggle(value);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Notifications</Text>
      <Text style={styles.sectionSubtitle}>
        Stay on track with reminders. Customize anytime in Settings.
      </Text>

      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Enable Push Notifications</Text>
          <Text style={styles.toggleDescription}>
            Meal reminders, drink nudges, and end-of-day check-ins
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: Colors.divider, true: Colors.accent }}
          thumbColor={Colors.text}
        />
      </View>

      {/* Tier-based cadence preview */}
      <View style={styles.preview}>
        <Text style={styles.previewTitle}>
          Based on your {tierDef.name} tier:
        </Text>
        <Text style={styles.previewText}>
          {tierDef.notificationCadence}
        </Text>

        <View style={styles.previewDetails}>
          {tierDef.notificationsPerDay[0] >= 6 && (
            <>
              <PreviewItem label="Drink reminders" />
              <PreviewItem label="Meal window alerts" />
              <PreviewItem label="Macro check-ins" />
              <PreviewItem label="End-of-day review" />
            </>
          )}
          {tierDef.notificationsPerDay[0] >= 3 &&
            tierDef.notificationsPerDay[0] < 6 && (
              <>
                <PreviewItem label="Morning overview" />
                <PreviewItem label="Meal window reminders" />
                <PreviewItem label="End-of-day review" />
              </>
            )}
          {tierDef.notificationsPerDay[0] < 3 && (
            <>
              <PreviewItem label="Morning check-in" />
              <PreviewItem label="End-of-day summary" />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function PreviewItem({ label }: { label: string }) {
  return (
    <View style={styles.previewItem}>
      <View style={styles.previewDot} />
      <Text style={styles.previewItemText}>{label}</Text>
    </View>
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
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleDescription: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  preview: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
  },
  previewTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  previewText: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewDetails: {
    gap: 6,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  previewItemText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
});
