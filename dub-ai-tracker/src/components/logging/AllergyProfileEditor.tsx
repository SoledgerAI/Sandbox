// Allergy Profile Editor — Sprint 17
// Free-text tag input for known allergens, stored in dub.profile.allergies

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
} from '../../utils/storage';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';

const COMMON_ALLERGENS = [
  'Pollen', 'Dust', 'Pet Dander', 'Mold', 'Ragweed', 'Grass',
  'Tree Pollen', 'Shellfish', 'Peanuts', 'Tree Nuts', 'Dairy',
  'Eggs', 'Wheat', 'Soy', 'Latex', 'Insect Stings', 'Penicillin',
];

export function AllergyProfileEditor() {
  const [allergens, setAllergens] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const stored = await storageGet<string[]>(STORAGE_KEYS.PROFILE_ALLERGIES);
    setAllergens(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleAllergen = useCallback((name: string) => {
    hapticSelection();
    setAllergens((prev) =>
      prev.includes(name)
        ? prev.filter((a) => a !== name)
        : [...prev, name],
    );
  }, []);

  const addCustom = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed || allergens.includes(trimmed)) return;
    hapticSelection();
    setAllergens((prev) => [...prev, trimmed]);
    setCustomInput('');
  }, [customInput, allergens]);

  const save = useCallback(async () => {
    await storageSet(STORAGE_KEYS.PROFILE_ALLERGIES, allergens);
    hapticSuccess();
    showToast('Allergy profile saved');
  }, [allergens, showToast]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.description}>
          Select your known allergens. This helps Coach DUB give relevant advice and tracks allergy patterns.
        </Text>

        {/* Common allergens */}
        <Text style={styles.sectionTitle}>COMMON ALLERGENS</Text>
        <View style={styles.tagGrid}>
          {COMMON_ALLERGENS.map((name) => {
            const selected = allergens.includes(name);
            return (
              <TouchableOpacity
                key={name}
                style={[styles.tag, selected && styles.tagSelected]}
                onPress={() => toggleAllergen(name)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tagText, selected && styles.tagTextSelected]}>
                  {name}
                </Text>
                {selected && (
                  <Ionicons name="close-circle" size={16} color={Colors.primaryBackground} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom allergen input */}
        <Text style={styles.sectionTitle}>ADD CUSTOM</Text>
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="Type allergen name..."
            placeholderTextColor={Colors.secondaryText}
            value={customInput}
            onChangeText={setCustomInput}
            onSubmitEditing={addCustom}
            returnKeyType="done"
            maxLength={50}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addCustom} activeOpacity={0.7}>
            <Ionicons name="add" size={20} color={Colors.primaryBackground} />
          </TouchableOpacity>
        </View>

        {/* Custom (non-common) allergens */}
        {allergens.filter((a) => !COMMON_ALLERGENS.includes(a)).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>YOUR CUSTOM ALLERGENS</Text>
            <View style={styles.tagGrid}>
              {allergens
                .filter((a) => !COMMON_ALLERGENS.includes(a))
                .map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.tag, styles.tagSelected]}
                    onPress={() => toggleAllergen(name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagTextSelected}>{name}</Text>
                    <Ionicons name="close-circle" size={16} color={Colors.primaryBackground} />
                  </TouchableOpacity>
                ))}
            </View>
          </>
        )}

        {/* Summary */}
        <PremiumCard style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            {allergens.length} allergen{allergens.length === 1 ? '' : 's'} selected
          </Text>
          {allergens.length > 0 && (
            <Text style={styles.summaryList}>{allergens.join(', ')}</Text>
          )}
        </PremiumCard>

        {/* Save */}
        <View style={styles.saveSection}>
          <PremiumButton label="Save Allergy Profile" onPress={save} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingBottom: 48 },

  description: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },

  sectionTitle: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },

  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  tagSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tagText: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500' },
  tagTextSelected: { color: Colors.primaryBackground, fontSize: 13, fontWeight: '600' },

  customRow: { flexDirection: 'row', gap: 8 },
  customInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryCard: { marginTop: 20 },
  summaryTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  summaryList: { color: Colors.secondaryText, fontSize: 13, marginTop: 4, lineHeight: 18 },

  saveSection: { marginTop: 24 },
});
