// Settings > Taste Profile
// Phase 20: Data Expansion and Recipe Engine
// Manage cuisine preferences, dietary restrictions, and ingredient dislikes

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
import { useToast } from '../../src/contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { TasteProfile } from '../../src/components/coach/TasteProfile';
import {
  getTasteProfile,
  saveTasteProfile,
  DEFAULT_TASTE_PROFILE,
} from '../../src/ai/recipe_engine';
import type { TasteProfile as TasteProfileType } from '../../src/ai/recipe_engine';

export default function TasteScreen() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TasteProfileType>(DEFAULT_TASTE_PROFILE);
  const [original, setOriginal] = useState<TasteProfileType>(DEFAULT_TASTE_PROFILE);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const saved = await getTasteProfile();
    setProfile(saved);
    setOriginal(saved);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const hasChanges =
    JSON.stringify(profile) !== JSON.stringify(original);

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      router.back();
      return;
    }
    setSaving(true);
    try {
      await saveTasteProfile(profile);
      setOriginal(profile);
      showToast('Taste profile saved', 'success');
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save taste profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [profile, hasChanges]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset Preferences',
      'This will clear all your taste preferences. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => setProfile(DEFAULT_TASTE_PROFILE),
        },
      ],
    );
  }, []);

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
        <Text style={styles.title}>Taste Profile</Text>
        <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={22} color={Colors.secondaryText} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Configure your food preferences. Coach DUB will use these when recommending recipes.
      </Text>

      <TasteProfile profile={profile} onChange={setProfile} />

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Current Preferences</Text>
        <Text style={styles.summaryItem}>
          Cuisines: {profile.cuisines.length > 0 ? profile.cuisines.join(', ') : 'Any'}
        </Text>
        <Text style={styles.summaryItem}>
          Restrictions: {profile.restrictions.length > 0 ? profile.restrictions.join(', ') : 'None'}
        </Text>
        <Text style={styles.summaryItem}>
          Dislikes: {profile.dislikes.length > 0 ? profile.dislikes.join(', ') : 'None'}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color={Colors.primaryBackground} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              {hasChanges ? 'Save Preferences' : 'No Changes'}
            </Text>
          )}
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
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 6,
  },
  summaryTitle: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryItem: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: { marginTop: 20, marginBottom: 32 },
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
