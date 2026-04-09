// Settings > Engagement Tier
// Phase 17: Settings and Profile Management
// Change engagement tier, Coach acknowledges change

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { TIER_DEFINITIONS } from '../../src/constants/tiers';
import { getDefaultTagsForTier } from '../../src/constants/tags';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import type { EngagementTier } from '../../src/types/profile';

export default function TierScreen() {
  const [loading, setLoading] = useState(true);
  const [currentTier, setCurrentTier] = useState<EngagementTier>('balanced');
  const [selectedTier, setSelectedTier] = useState<EngagementTier>('balanced');

  const loadTier = useCallback(async () => {
    setLoading(true);
    const tier = await storageGet<EngagementTier>(STORAGE_KEYS.TIER);
    const t = tier || 'balanced';
    setCurrentTier(t);
    setSelectedTier(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTier();
  }, [loadTier]);

  async function handleSave() {
    if (selectedTier === currentTier) {
      router.back();
      return;
    }

    Alert.alert(
      'Change Tier',
      `Switch from ${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} to ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}? Default tracking categories will update for the new tier. Your manually-selected categories will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            await storageSet(STORAGE_KEYS.TIER, selectedTier);

            // Update default tags for new tier, preserve sensitive manual tags
            const enabledTags = await storageGet<string[]>(STORAGE_KEYS.TAGS_ENABLED);
            const newDefaults = getDefaultTagsForTier(selectedTier);
            const oldDefaults = getDefaultTagsForTier(currentTier);

            // Keep manually-added tags (not in old defaults) + new defaults
            const manualTags = (enabledTags || []).filter(
              (t) => !oldDefaults.includes(t),
            );
            const mergedTags = [...new Set([...newDefaults, ...manualTags])];
            await storageSet(STORAGE_KEYS.TAGS_ENABLED, mergedTags);

            setCurrentTier(selectedTier);
            Alert.alert(
              'Tier Updated',
              `You are now on the ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} tier. Coach DUB will adjust its tone and tracking.`,
              [{ text: 'OK', onPress: () => router.back() }],
            );
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Engagement Tier</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.subtitle}>
        Your tier controls Coach tone, notification frequency, and scoring weights.
      </Text>

      {TIER_DEFINITIONS.map((tier) => (
        <TouchableOpacity
          key={tier.id}
          style={[styles.tierCard, selectedTier === tier.id && styles.tierCardSelected]}
          onPress={() => setSelectedTier(tier.id)}
          activeOpacity={0.7}
        >
          <View style={styles.tierHeader}>
            <View style={styles.tierNameRow}>
              <Text style={[styles.tierName, selectedTier === tier.id && styles.tierNameSelected]}>
                {tier.name}
              </Text>
              <Text style={styles.tierLabel}>{tier.label}</Text>
            </View>
            {selectedTier === tier.id && (
              <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
            )}
            {currentTier === tier.id && selectedTier !== tier.id && (
              <Text style={styles.currentBadge}>Current</Text>
            )}
          </View>
          <Text style={styles.tierDesc}>{tier.description}</Text>
          <View style={styles.tierMeta}>
            <Text style={styles.tierMetaItem}>
              Adherence: {tier.adherenceTarget.split('.')[0]}
            </Text>
            <Text style={styles.tierMetaItem}>Notifications: {tier.notificationCadence}</Text>
            <Text style={styles.tierMetaItem}>Tone: {tier.coachTonePreview}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            selectedTier === currentTier && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={selectedTier === currentTier}
          activeOpacity={0.7}
        >
          <Text style={styles.saveButtonText}>
            {selectedTier === currentTier ? 'Current Tier' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  tierCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierCardSelected: { borderColor: Colors.accent },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tierNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierName: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  tierNameSelected: { color: Colors.accentText },
  tierLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadge: {
    color: Colors.successText,
    fontSize: 12,
    fontWeight: '600',
  },
  tierDesc: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  tierMeta: { gap: 4 },
  tierMetaItem: { color: Colors.secondaryText, fontSize: 12, lineHeight: 16 },
  footer: { marginTop: 8, marginBottom: 32 },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '600',
  },
});
