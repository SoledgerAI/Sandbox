// Settings > Tag Management
// Phase 17: Settings and Profile Management
// Phase 19: Ingredient flag management link
// Add/remove tags, reorder dashboard cards

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../src/contexts/ToastContext';
import {
  Alert,
  SafeAreaView,
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
import {
  ALL_DEFAULT_TAGS,
  HEALTH_FITNESS_TAGS,
  PERSONAL_PRIVATE_TAGS,
} from '../../src/constants/tags';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import { IngredientFlags } from '../../src/components/logging/IngredientFlags';

export default function TagsScreen() {
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [enabledTags, setEnabledTags] = useState<string[]>([]);
  const [tagOrder, setTagOrder] = useState<string[]>([]);
  const [showIngredientFlags, setShowIngredientFlags] = useState(false);

  const loadTags = useCallback(async () => {
    setLoading(true);
    const [enabled, order] = await Promise.all([
      storageGet<string[]>(STORAGE_KEYS.TAGS_ENABLED),
      storageGet<string[]>(STORAGE_KEYS.TAGS_ORDER),
    ]);
    setEnabledTags(enabled || []);
    setTagOrder(order || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  function toggleTag(tagId: string) {
    const tag = ALL_DEFAULT_TAGS.find((t) => t.id === tagId);
    if (tag?.sensitive && !enabledTags.includes(tagId)) {
      Alert.alert(
        'Enable Sensitive Category',
        `"${tag.name}" contains personal/private data. This data will be stored on your device. Enable this category?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => {
              setEnabledTags((prev) => [...prev, tagId]);
              setTagOrder((prev) => [...prev, tagId]);
            },
          },
        ],
      );
      return;
    }

    if (enabledTags.includes(tagId)) {
      setEnabledTags((prev) => prev.filter((t) => t !== tagId));
      setTagOrder((prev) => prev.filter((t) => t !== tagId));
    } else {
      setEnabledTags((prev) => [...prev, tagId]);
      setTagOrder((prev) => [...prev, tagId]);
    }
  }

  function moveTag(tagId: string, direction: 'up' | 'down') {
    setTagOrder((prev) => {
      const idx = prev.indexOf(tagId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }

  async function handleSave() {
    await storageSet(STORAGE_KEYS.TAGS_ENABLED, enabledTags);
    await storageSet(STORAGE_KEYS.TAGS_ORDER, tagOrder);
    showToast('Tracking preferences saved', 'success');
    router.back();
  }

  if (showIngredientFlags) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primaryBackground }}>
        <IngredientFlags
          onBack={() => setShowIngredientFlags(false)}
          onSave={() => setShowIngredientFlags(false)}
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  const enabledOrderedTags = tagOrder
    .filter((id) => enabledTags.includes(id))
    .map((id) => ALL_DEFAULT_TAGS.find((t) => t.id === id))
    .filter(Boolean);

  return (
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>What You Track</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Dashboard Card Order */}
      {enabledOrderedTags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dashboard Card Order</Text>
          <Text style={styles.sectionSubtitle}>
            Reorder how cards appear on your Dashboard
          </Text>
          {enabledOrderedTags.map((tag, idx) => (
            <View key={tag!.id} style={styles.orderRow}>
              <Ionicons name={tag!.icon as any} size={20} color={Colors.accent} />
              <Text style={styles.orderTagName}>{tag!.name}</Text>
              <View style={styles.orderButtons}>
                <TouchableOpacity
                  onPress={() => moveTag(tag!.id, 'up')}
                  disabled={idx === 0}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-up"
                    size={20}
                    color={idx === 0 ? Colors.divider : Colors.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveTag(tag!.id, 'down')}
                  disabled={idx === enabledOrderedTags.length - 1}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={
                      idx === enabledOrderedTags.length - 1 ? Colors.divider : Colors.text
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Health & Fitness Tags */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health & Fitness</Text>
        {HEALTH_FITNESS_TAGS.map((tag) => (
          <TouchableOpacity
            key={tag.id}
            style={styles.tagRow}
            onPress={() => toggleTag(tag.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={tag.icon as any} size={20} color={Colors.accent} />
            <View style={styles.tagInfo}>
              <Text style={styles.tagName}>{tag.name}</Text>
              <Text style={styles.tagDesc}>{tag.description}</Text>
            </View>
            <View
              style={[
                styles.checkbox,
                enabledTags.includes(tag.id) && styles.checkboxChecked,
              ]}
            >
              {enabledTags.includes(tag.id) && (
                <Ionicons name="checkmark" size={14} color={Colors.primaryBackground} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Personal & Private Tags */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal & Private</Text>
        <Text style={styles.sensitiveNote}>
          These categories contain sensitive data and are never pre-selected.
        </Text>
        {PERSONAL_PRIVATE_TAGS.map((tag) => (
          <TouchableOpacity
            key={tag.id}
            style={styles.tagRow}
            onPress={() => toggleTag(tag.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={tag.icon as any} size={20} color={Colors.accent} />
            <View style={styles.tagInfo}>
              <Text style={styles.tagName}>{tag.name}</Text>
              <Text style={styles.tagDesc}>{tag.description}</Text>
            </View>
            <View
              style={[
                styles.checkbox,
                enabledTags.includes(tag.id) && styles.checkboxChecked,
              ]}
            >
              {enabledTags.includes(tag.id) && (
                <Ionicons name="checkmark" size={14} color={Colors.primaryBackground} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ingredient Flags */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredient Flags</Text>
        <Text style={styles.sectionSubtitle}>
          Flag specific ingredients to track in your food logs
        </Text>
        <TouchableOpacity
          style={styles.ingredientFlagButton}
          onPress={() => setShowIngredientFlags(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="flag" size={20} color={Colors.accent} />
          <Text style={styles.ingredientFlagText}>Manage Ingredient Flags</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.7}>
          <Text style={styles.saveButtonText}>Save Preferences</Text>
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
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginBottom: 12,
  },
  sensitiveNote: {
    color: Colors.warning,
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  tagInfo: { flex: 1 },
  tagName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  tagDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  orderTagName: { color: Colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
  orderButtons: { flexDirection: 'row', gap: 8 },
  ingredientFlagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  ingredientFlagText: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  footer: { marginTop: 8, marginBottom: 32 },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '600',
  },
});
