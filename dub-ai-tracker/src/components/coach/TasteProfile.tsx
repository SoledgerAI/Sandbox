// Taste profile editor component (cuisine, restrictions, dislikes)
// Phase 20: Data Expansion and Recipe Engine

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { CUISINE_OPTIONS, RESTRICTION_OPTIONS } from '../../ai/recipe_engine';
import type { TasteProfile as TasteProfileType } from '../../ai/recipe_engine';

interface TasteProfileProps {
  profile: TasteProfileType;
  onChange: (profile: TasteProfileType) => void;
}

export function TasteProfile({ profile, onChange }: TasteProfileProps) {
  const [dislikeInput, setDislikeInput] = useState('');

  const toggleCuisine = useCallback((cuisine: string) => {
    const updated = profile.cuisines.includes(cuisine)
      ? profile.cuisines.filter((c) => c !== cuisine)
      : [...profile.cuisines, cuisine];
    onChange({ ...profile, cuisines: updated });
  }, [profile, onChange]);

  const toggleRestriction = useCallback((restriction: string) => {
    let updated: string[];
    if (restriction === 'None') {
      updated = profile.restrictions.includes('None') ? [] : ['None'];
    } else {
      updated = profile.restrictions.filter((r) => r !== 'None');
      if (updated.includes(restriction)) {
        updated = updated.filter((r) => r !== restriction);
      } else {
        updated = [...updated, restriction];
      }
    }
    onChange({ ...profile, restrictions: updated });
  }, [profile, onChange]);

  const addDislike = useCallback(() => {
    const trimmed = dislikeInput.trim().toLowerCase();
    if (trimmed && !profile.dislikes.includes(trimmed)) {
      onChange({ ...profile, dislikes: [...profile.dislikes, trimmed] });
    }
    setDislikeInput('');
  }, [dislikeInput, profile, onChange]);

  const removeDislike = useCallback((item: string) => {
    onChange({ ...profile, dislikes: profile.dislikes.filter((d) => d !== item) });
  }, [profile, onChange]);

  return (
    <View style={styles.container}>
      {/* Preferred Cuisines */}
      <Text style={styles.sectionTitle}>Preferred Cuisines</Text>
      <Text style={styles.sectionHint}>Select cuisines you enjoy. Leave empty for any.</Text>
      <View style={styles.chipGrid}>
        {CUISINE_OPTIONS.map((cuisine) => {
          const selected = profile.cuisines.includes(cuisine);
          return (
            <TouchableOpacity
              key={cuisine}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleCuisine(cuisine)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {cuisine}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Dietary Restrictions */}
      <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
      <Text style={styles.sectionHint}>Recipes will respect all selected restrictions.</Text>
      <View style={styles.chipGrid}>
        {RESTRICTION_OPTIONS.map((restriction) => {
          const selected = profile.restrictions.includes(restriction);
          return (
            <TouchableOpacity
              key={restriction}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleRestriction(restriction)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {restriction}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Dislikes */}
      <Text style={styles.sectionTitle}>Disliked Ingredients</Text>
      <Text style={styles.sectionHint}>Ingredients to always exclude from recipes.</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g., cilantro"
          placeholderTextColor={Colors.secondaryText}
          value={dislikeInput}
          onChangeText={setDislikeInput}
          onSubmitEditing={addDislike}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addButton, !dislikeInput.trim() && styles.addButtonDisabled]}
          onPress={addDislike}
          disabled={!dislikeInput.trim()}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color={Colors.primaryBackground} />
        </TouchableOpacity>
      </View>
      {profile.dislikes.length > 0 && (
        <View style={styles.chipGrid}>
          {profile.dislikes.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.dislikeChip}
              onPress={() => removeDislike(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.dislikeText}>{item}</Text>
              <Ionicons name="close" size={14} color={Colors.danger} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  sectionHint: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.accent + '22',
    borderColor: Colors.accent,
  },
  chipText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: Colors.accentText,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.4 },
  dislikeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.danger + '22',
    borderWidth: 1,
    borderColor: Colors.danger + '44',
  },
  dislikeText: {
    color: Colors.text,
    fontSize: 13,
  },
});
