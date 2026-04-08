// Ingredient flag configuration UI
// Phase 19: Ingredient Flag System and NLP/Photo Food Logging

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../contexts/ToastContext';
import { LoadingIndicator } from '../common/LoadingIndicator';
import { Colors } from '../../constants/colors';
import {
  DEFAULT_INGREDIENT_FLAGS,
  loadIngredientFlags,
  saveIngredientFlags,
} from '../../utils/ingredients';
import type { IngredientFlag } from '../../types/food';

interface IngredientFlagsProps {
  onSave?: () => void;
  onBack?: () => void;
}

const DISCLAIMER =
  'Ingredient flags are informational only. DUB_AI does not make health claims about specific ingredients.';

export function IngredientFlags({ onSave, onBack }: IngredientFlagsProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<IngredientFlag[]>([]);
  const [customName, setCustomName] = useState('');
  const [customKeywords, setCustomKeywords] = useState('');

  const loadFlags = useCallback(async () => {
    setLoading(true);
    const stored = await loadIngredientFlags();
    setFlags(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  function toggleFlag(id: string) {
    setFlags((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
    );
  }

  function addCustomFlag() {
    const name = customName.trim();
    if (!name) {
      Alert.alert('Name Required', 'Enter a name for the custom ingredient flag.');
      return;
    }
    const keywords = customKeywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    if (keywords.length === 0) {
      keywords.push(name.toLowerCase());
    }

    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setFlags((prev) => [
      ...prev,
      { id, name, keywords, enabled: true },
    ]);
    setCustomName('');
    setCustomKeywords('');
  }

  function removeCustomFlag(id: string) {
    const isDefault = DEFAULT_INGREDIENT_FLAGS.some((f) => f.id === id);
    if (isDefault) return;
    Alert.alert('Remove Flag', 'This will remove the flag definition. Existing entries will not be affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setFlags((prev) => prev.filter((f) => f.id !== id)),
      },
    ]);
  }

  async function handleSave() {
    await saveIngredientFlags(flags);
    showToast('Ingredient flag preferences saved', 'success');
    onSave?.();
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingIndicator size="large" />
      </View>
    );
  }

  const defaultFlags = flags.filter((f) =>
    DEFAULT_INGREDIENT_FLAGS.some((d) => d.id === f.id),
  );
  const customFlags = flags.filter(
    (f) => !DEFAULT_INGREDIENT_FLAGS.some((d) => d.id === f.id),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onBack && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Ingredient Flags</Text>
          <View style={{ width: 24 }} />
        </View>
      )}

      <View style={styles.disclaimerBox}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
        <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
      </View>

      <Text style={styles.sectionTitle}>Default Flags</Text>
      <Text style={styles.sectionSubtitle}>
        Toggle flags for ingredients you want to track. A flag icon will appear on food entries containing these ingredients.
      </Text>

      {defaultFlags.map((flag) => (
        <TouchableOpacity
          key={flag.id}
          style={styles.flagRow}
          onPress={() => toggleFlag(flag.id)}
          activeOpacity={0.7}
        >
          <View style={styles.flagInfo}>
            <Text style={styles.flagName}>{flag.name}</Text>
            <Text style={styles.flagKeywords} numberOfLines={1}>
              {flag.keywords.join(', ')}
            </Text>
          </View>
          <View
            style={[styles.toggle, flag.enabled && styles.toggleEnabled]}
          >
            {flag.enabled && (
              <Ionicons name="checkmark" size={14} color={Colors.primaryBackground} />
            )}
          </View>
        </TouchableOpacity>
      ))}

      {/* Custom Flags */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        Custom Flags
      </Text>
      <Text style={styles.sectionSubtitle}>
        Add your own ingredient names to flag.
      </Text>

      {customFlags.map((flag) => (
        <View key={flag.id} style={styles.flagRow}>
          <TouchableOpacity
            style={styles.flagInfo}
            onPress={() => toggleFlag(flag.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.flagName}>{flag.name}</Text>
            <Text style={styles.flagKeywords} numberOfLines={1}>
              {flag.keywords.join(', ')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => removeCustomFlag(flag.id)}
            hitSlop={8}
            style={styles.removeBtn}
          >
            <Ionicons name="close-circle" size={20} color={Colors.danger} />
          </TouchableOpacity>
          <View
            style={[styles.toggle, flag.enabled && styles.toggleEnabled]}
          >
            {flag.enabled && (
              <Ionicons name="checkmark" size={14} color={Colors.primaryBackground} />
            )}
          </View>
        </View>
      ))}

      <View style={styles.addCustom}>
        <TextInput
          style={styles.input}
          placeholder="Ingredient name"
          placeholderTextColor={Colors.secondaryText}
          value={customName}
          onChangeText={setCustomName}
        />
        <TextInput
          style={styles.input}
          placeholder="Keywords (comma-separated, optional)"
          placeholderTextColor={Colors.secondaryText}
          value={customKeywords}
          onChangeText={setCustomKeywords}
        />
        <TouchableOpacity style={styles.addButton} onPress={addCustomFlag} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color={Colors.primaryBackground} />
          <Text style={styles.addButtonText}>Add Custom Flag</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.7}>
        <Text style={styles.saveButtonText}>Save Flag Preferences</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 16, paddingBottom: 40 },
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
    marginBottom: 16,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  disclaimerText: {
    color: Colors.secondaryText,
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
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
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  flagInfo: { flex: 1 },
  flagName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  flagKeywords: { color: Colors.secondaryText, fontSize: 11, marginTop: 2 },
  toggle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleEnabled: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  removeBtn: { padding: 4 },
  addCustom: { marginTop: 12, gap: 8 },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  addButtonText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '600',
  },
});
