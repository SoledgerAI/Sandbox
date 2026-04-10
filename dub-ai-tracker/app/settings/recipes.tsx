// My Recipes management screen
// Sprint 20: Recipe Builder — list, search, sort, edit, delete, duplicate

import { useState, useCallback, useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { PremiumButton } from '../../src/components/common/PremiumButton';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { useToast } from '../../src/contexts/ToastContext';
import { hapticSelection, hapticWarning, hapticSuccess } from '../../src/utils/haptics';
import {
  getMyRecipes,
  deleteRecipe,
  duplicateRecipe,
} from '../../src/utils/recipeLibrary';
import type { MyRecipe } from '../../src/types/food';

type SortMode = 'recent' | 'alpha' | 'created';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'recent', label: 'Recently Used' },
  { id: 'alpha', label: 'A-Z' },
  { id: 'created', label: 'Date Created' },
];

export default function RecipesScreen() {
  const { showToast } = useToast();
  const [recipes, setRecipes] = useState<MyRecipe[]>([]);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRecipes = useCallback(async () => {
    const loaded = await getMyRecipes();
    setRecipes(loaded);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [loadRecipes]),
  );

  const filteredRecipes = useMemo(() => {
    let result = [...recipes];
    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }
    // Sort
    switch (sortMode) {
      case 'alpha':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'created':
        result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'recent':
      default:
        // Already sorted by recency from getMyRecipes()
        break;
    }
    return result;
  }, [recipes, search, sortMode]);

  const handleDelete = useCallback((recipe: MyRecipe) => {
    hapticWarning();
    Alert.alert(
      'Delete Recipe',
      `Delete "${recipe.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRecipe(recipe.id);
            showToast('Recipe deleted', 'success');
            loadRecipes();
          },
        },
      ],
    );
  }, [loadRecipes, showToast]);

  const handleDuplicate = useCallback(async (recipe: MyRecipe) => {
    hapticSuccess();
    const copy = await duplicateRecipe(recipe.id);
    if (copy) {
      showToast(`Duplicated as "${copy.name}"`, 'success');
      loadRecipes();
    }
  }, [loadRecipes, showToast]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Recipes</Text>
          <TouchableOpacity
            onPress={() => router.push('/settings/recipe-import' as any)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="cloud-download-outline" size={24} color={Colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={Colors.secondaryText} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search recipes..."
            placeholderTextColor={Colors.secondaryText}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.sortChip, sortMode === opt.id && styles.sortChipActive]}
              onPress={() => { hapticSelection(); setSortMode(opt.id); }}
            >
              <Text style={[styles.sortChipText, sortMode === opt.id && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredRecipes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={48} color={Colors.secondaryText} />
              <Text style={styles.emptyTitle}>
                {search ? 'No recipes match your search' : 'No recipes yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search ? 'Try a different search term' : 'Create your first recipe to get started'}
              </Text>
            </View>
          ) : (
            filteredRecipes.map((recipe) => (
              <PremiumCard key={recipe.id}>
                <TouchableOpacity
                  style={styles.recipeRow}
                  onPress={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeName}>{recipe.name}</Text>
                    <Text style={styles.recipeMacros}>
                      {recipe.totalMacros.calories} cal {'\u2022'} {recipe.totalMacros.protein}p {'\u2022'} {recipe.totalMacros.carbs}c {'\u2022'} {recipe.totalMacros.fat}f
                    </Text>
                    <Text style={styles.recipeMeta}>
                      {recipe.totalServings} serving{recipe.totalServings !== 1 ? 's' : ''}
                      {recipe.timesLogged > 0 ? ` \u2022 Logged ${recipe.timesLogged}x` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={expandedId === recipe.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.secondaryText}
                  />
                </TouchableOpacity>

                {/* Expanded: ingredient list + actions */}
                {expandedId === recipe.id && (
                  <View style={styles.expandedSection}>
                    <View style={styles.divider} />
                    <Text style={styles.ingredientLabel}>
                      Ingredients ({recipe.ingredients.length})
                    </Text>
                    {recipe.ingredients.map((ing, i) => (
                      <Text key={i} style={styles.ingredientItem}>
                        {'\u2022'} {ing.amount} {ing.unit} {ing.name} — {ing.calories} cal
                      </Text>
                    ))}
                    <View style={styles.divider} />
                    <Text style={styles.perServingLabel}>Per Serving</Text>
                    <Text style={styles.perServingMacros}>
                      {recipe.macrosPerServing.calories} cal {'\u2022'} {recipe.macrosPerServing.protein}p {'\u2022'} {recipe.macrosPerServing.carbs}c {'\u2022'} {recipe.macrosPerServing.fat}f
                    </Text>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => router.push(`/settings/recipe-log?recipeId=${recipe.id}` as any)}
                      >
                        <Ionicons name="add-circle" size={18} color={Colors.accent} />
                        <Text style={styles.actionText}>Log It</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => router.push(`/settings/recipe-create?recipeId=${recipe.id}` as any)}
                      >
                        <Ionicons name="pencil" size={18} color={Colors.accent} />
                        <Text style={styles.actionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDuplicate(recipe)}
                      >
                        <Ionicons name="copy" size={18} color={Colors.accent} />
                        <Text style={styles.actionText}>Duplicate</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDelete(recipe)}
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                        <Text style={[styles.actionText, { color: Colors.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </PremiumCard>
            ))
          )}

          <View style={{ height: Spacing.jumbo }} />
        </ScrollView>

        {/* FAB: Create new recipe */}
        <View style={styles.fabRow}>
          <PremiumButton
            label="New Recipe"
            onPress={() => router.push('/settings/recipe-create' as any)}
            icon={<Ionicons name="add" size={20} color={Colors.primaryBackground} />}
            size="large"
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 10,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sortChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  sortChipText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  recipeMacros: {
    color: Colors.accentText,
    fontSize: 13,
    marginTop: 2,
  },
  recipeMeta: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  expandedSection: {
    marginTop: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  ingredientLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ingredientItem: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  perServingLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  perServingMacros: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  fabRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
});
