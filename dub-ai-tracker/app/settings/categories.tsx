// Sprint 21: My Categories — Elect-In Category Management
// Toggle optional logging categories on/off
// Disabling preserves all existing data

import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
} from 'react-native';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { Ionicons } from '@expo/vector-icons';
import { hapticSelection } from '../../src/utils/haptics';
import { useToast } from '../../src/contexts/ToastContext';
import {
  getEnabledCategories,
  toggleCategory,
} from '../../src/utils/categoryElection';
import { onCategoryEnabled, onCategoryDisabled } from '../../src/services/notificationService';
import {
  ALL_ELECT_IN_CATEGORIES,
  ELECT_IN_CATEGORY_GROUPS,
} from '../../src/types';
import type { ElectInCategoryId, ElectInCategoryGroup } from '../../src/types';

export default function MyCategoriesScreen() {
  const [enabledIds, setEnabledIds] = useState<ElectInCategoryId[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const enabled = await getEnabledCategories();
    setEnabledIds(enabled);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleToggle = useCallback(async (categoryId: ElectInCategoryId) => {
    hapticSelection();
    const nowEnabled = await toggleCategory(categoryId);
    setEnabledIds((prev) =>
      nowEnabled
        ? [...prev, categoryId]
        : prev.filter((id) => id !== categoryId),
    );
    // Sprint 24: Sync notification scheduling when categories change
    if (nowEnabled) {
      onCategoryEnabled(categoryId).catch(() => {});
    } else {
      onCategoryDisabled(categoryId).catch(() => {});
    }
    const cat = ALL_ELECT_IN_CATEGORIES.find((c) => c.id === categoryId);
    if (cat) {
      showToast(
        nowEnabled ? `${cat.label} enabled` : `${cat.label} disabled`,
        nowEnabled ? 'success' : 'info',
      );
    }
  }, [showToast]);

  const renderGroup = (groupId: ElectInCategoryGroup, groupLabel: string) => {
    const categories = ALL_ELECT_IN_CATEGORIES.filter((c) => c.group === groupId);
    return (
      <View key={groupId} style={styles.groupContainer}>
        <Text style={styles.groupLabel}>{groupLabel}</Text>
        <PremiumCard>
          {categories.map((cat, index) => {
            const isEnabled = enabledIds.includes(cat.id);
            return (
              <View key={cat.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.categoryRow}>
                  <Ionicons
                    name={cat.icon as any}
                    size={22}
                    color={isEnabled ? Colors.accentText : Colors.secondaryText}
                    style={styles.categoryIcon}
                  />
                  <View style={styles.categoryInfo}>
                    <Text
                      style={[
                        styles.categoryLabel,
                        !isEnabled && styles.categoryLabelDisabled,
                      ]}
                    >
                      {cat.label}
                    </Text>
                    <Text style={styles.categoryDescription}>
                      {cat.description}
                    </Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => handleToggle(cat.id)}
                    trackColor={{ false: Colors.elevated, true: Colors.accent }}
                    thumbColor={isEnabled ? '#FFFFFF' : Colors.secondaryText}
                  />
                </View>
              </View>
            );
          })}
        </PremiumCard>
      </View>
    );
  };

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Categories</Text>
        <Text style={styles.subtitle}>
          Enable optional logging categories. Disabling a category hides it
          from the Log tab but preserves all your data.
        </Text>
        <Text style={styles.immediateNote}>Changes take effect immediately</Text>

        {ELECT_IN_CATEGORY_GROUPS.map((group) =>
          renderGroup(group.id, group.label),
        )}

        <Text style={styles.footerText}>
          All categories are available regardless of your profile settings.
          Your data is never deleted when you disable a category.
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  immediateNote: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 20,
  },
  groupContainer: {
    marginBottom: 20,
  },
  groupLabel: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 56,
  },
  categoryIcon: {
    width: 28,
    textAlign: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
    marginRight: 8,
  },
  categoryLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  categoryLabelDisabled: {
    color: Colors.secondaryText,
  },
  categoryDescription: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  footerText: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
