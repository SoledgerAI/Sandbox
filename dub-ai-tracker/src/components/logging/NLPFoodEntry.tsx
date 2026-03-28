// Natural language food input
// Phase 19: Ingredient Flag System and NLP/Photo Food Logging
// User types free-text like "2 eggs, toast with butter, coffee with cream"
// Parsed to food items via Anthropic API, user ALWAYS confirms before saving

import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getApiKey, AnthropicError } from '../../services/anthropic';
import { COACH_MODEL_ID } from '../../constants/formulas';
import type { MealType, NutritionInfo, FoodSource } from '../../types/food';

interface NLPFoodItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
}

interface NLPFoodEntryProps {
  mealType: MealType;
  onConfirm: (items: NLPFoodItem[]) => void;
  onCancel: () => void;
}

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const NLP_SYSTEM_PROMPT = `You are a nutrition estimation assistant. Parse the user's natural language food description into individual food items with estimated nutrition.

Return ONLY a JSON array. Each item must have these exact fields:
- name: string (food name)
- portion: string (estimated portion description)
- calories: number
- protein_g: number
- carbs_g: number
- fat_g: number
- fiber_g: number or null
- sugar_g: number or null
- sodium_mg: number or null

Be realistic with portion sizes and nutrition estimates. Use USDA-aligned values when possible.
Do not include any text outside the JSON array.`;

export function NLPFoodEntry({ mealType, onConfirm, onCancel }: NLPFoodEntryProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedItems, setParsedItems] = useState<NLPFoodItem[] | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const parseInput = useCallback(async () => {
    const text = input.trim();
    if (!text) {
      Alert.alert('Enter Food', 'Describe what you ate in natural language.');
      return;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      Alert.alert('API Key Required', 'Add your Anthropic API key in Settings to use NLP food entry.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: COACH_MODEL_ID,
          max_tokens: 1024,
          system: NLP_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: text }],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) throw new AnthropicError('Invalid API key.', status);
        if (status === 429) throw new AnthropicError('Rate limited. Try again shortly.', status);
        throw new AnthropicError('API request failed.', status);
      }

      const data = await response.json();
      const textBlock = data.content?.find((b: any) => b.type === 'text');
      if (!textBlock?.text) {
        throw new Error('Empty response from API');
      }

      // Extract JSON from the response (handle markdown code blocks)
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const items: NLPFoodItem[] = JSON.parse(jsonText);
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No food items parsed');
      }

      setParsedItems(items);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse food description';
      Alert.alert('Parse Error', msg);
    } finally {
      setLoading(false);
    }
  }, [input]);

  function updateItem(index: number, field: keyof NLPFoodItem, value: string) {
    setParsedItems((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      const item = { ...copy[index] };
      if (field === 'name' || field === 'portion') {
        (item as any)[field] = value;
      } else {
        const num = parseFloat(value);
        (item as any)[field] = isNaN(num) ? 0 : num;
      }
      copy[index] = item;
      return copy;
    });
  }

  function removeItem(index: number) {
    setParsedItems((prev) => prev ? prev.filter((_, i) => i !== index) : prev);
  }

  function handleConfirm() {
    if (!parsedItems || parsedItems.length === 0) return;
    onConfirm(parsedItems);
  }

  // Show parsed results for confirmation
  if (parsedItems) {
    const totalCal = parsedItems.reduce((s, i) => s + i.calories, 0);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Confirm Items</Text>
          <Text style={styles.subtitle}>
            Review and edit before saving. Tap an item to edit.
          </Text>
        </View>

        <FlatList
          data={parsedItems}
          keyExtractor={(_, i) => String(i)}
          style={styles.list}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.itemCard}
              onPress={() => setEditingIndex(editingIndex === index ? null : index)}
              activeOpacity={0.7}
            >
              <View style={styles.itemHeader}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPortion}>{item.portion}</Text>
                </View>
                <Text style={styles.itemCal}>{Math.round(item.calories)} kcal</Text>
                <TouchableOpacity onPress={() => removeItem(index)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.macroRow}>
                <Text style={styles.macroText}>P: {Math.round(item.protein_g)}g</Text>
                <Text style={styles.macroText}>C: {Math.round(item.carbs_g)}g</Text>
                <Text style={styles.macroText}>F: {Math.round(item.fat_g)}g</Text>
              </View>

              {editingIndex === index && (
                <View style={styles.editSection}>
                  <EditRow label="Name" value={item.name} onChange={(v) => updateItem(index, 'name', v)} />
                  <EditRow label="Portion" value={item.portion} onChange={(v) => updateItem(index, 'portion', v)} />
                  <EditRow label="Calories" value={String(item.calories)} onChange={(v) => updateItem(index, 'calories', v)} numeric />
                  <EditRow label="Protein (g)" value={String(item.protein_g)} onChange={(v) => updateItem(index, 'protein_g', v)} numeric />
                  <EditRow label="Carbs (g)" value={String(item.carbs_g)} onChange={(v) => updateItem(index, 'carbs_g', v)} numeric />
                  <EditRow label="Fat (g)" value={String(item.fat_g)} onChange={(v) => updateItem(index, 'fat_g', v)} numeric />
                </View>
              )}
            </TouchableOpacity>
          )}
        />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{Math.round(totalCal)} kcal</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setParsedItems(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Re-enter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleConfirm}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Save All</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Input screen
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Describe Your Meal</Text>
        <Text style={styles.subtitle}>
          Type what you ate in plain language. AI will estimate nutrition.
        </Text>
      </View>

      <TextInput
        style={styles.textArea}
        placeholder='e.g., "2 eggs, toast with butter, coffee with cream"'
        placeholderTextColor={Colors.secondaryText}
        value={input}
        onChangeText={setInput}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        autoFocus
      />

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.loadingText}>Analyzing your food...</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, !input.trim() && styles.disabledButton]}
            onPress={parseInput}
            disabled={!input.trim()}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={16} color={Colors.primaryBackground} />
            <Text style={styles.primaryButtonText}>Analyze</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function EditRow({
  label,
  value,
  onChange,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholderTextColor={Colors.secondaryText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 16 },
  title: { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: Colors.secondaryText, fontSize: 13, marginTop: 4 },
  textArea: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 14,
    color: Colors.text,
    fontSize: 15,
    minHeight: 100,
    lineHeight: 22,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  loadingText: { color: Colors.secondaryText, fontSize: 14 },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: { opacity: 0.5 },
  list: { flex: 1 },
  itemCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemInfo: { flex: 1 },
  itemName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  itemPortion: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  itemCal: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginRight: 4,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  macroText: { color: Colors.secondaryText, fontSize: 12 },
  editSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 6,
  },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editLabel: { color: Colors.secondaryText, fontSize: 12, width: 80 },
  editInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: Colors.text,
    fontSize: 13,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  totalLabel: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  totalValue: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
});
