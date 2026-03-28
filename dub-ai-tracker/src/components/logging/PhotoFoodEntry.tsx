// Camera + AI food estimation
// Phase 19: Ingredient Flag System and NLP/Photo Food Logging
// Takes photo, sends to Anthropic Messages API with image content,
// estimates food items and nutrition. User ALWAYS confirms before saving.

import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getApiKey, AnthropicError } from '../../services/anthropic';
import { COACH_MODEL_ID } from '../../constants/formulas';
import type { MealType, PhotoConfidence } from '../../types/food';

interface PhotoFoodItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: PhotoConfidence;
  note: string | null;
}

interface PhotoFoodEntryProps {
  mealType: MealType;
  onConfirm: (items: PhotoFoodItem[], photoUri: string) => void;
  onCancel: () => void;
}

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const PHOTO_SYSTEM_PROMPT = `You are a food identification and nutrition estimation assistant. Analyze the photo and identify all visible food items with estimated portions and nutrition.

Return ONLY a JSON array. Each item must have these exact fields:
- name: string (food name)
- portion: string (estimated portion size description)
- calories: number (estimated)
- protein_g: number
- carbs_g: number
- fat_g: number
- confidence: "high" | "medium" | "low" (how confident you are in the identification)
- note: string or null (any relevant note about the estimate)

Be realistic. If uncertain about a food, set confidence to "low". Use USDA-aligned estimates.
Do not include any text outside the JSON array.`;

export function PhotoFoodEntry({ mealType, onConfirm, onCancel }: PhotoFoodEntryProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedItems, setParsedItems] = useState<PhotoFoodItem[] | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to photograph food.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setParsedItems(null);
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setParsedItems(null);
    }
  }, []);

  const analyzePhoto = useCallback(async () => {
    if (!photoUri) return;

    const apiKey = await getApiKey();
    if (!apiKey) {
      Alert.alert('API Key Required', 'Add your Anthropic API key in Settings to use photo food entry.');
      return;
    }

    setLoading(true);
    try {
      // Read photo as base64
      const base64 = await readAsStringAsync(photoUri, {
        encoding: EncodingType.Base64,
      });

      // Determine media type from URI
      const ext = photoUri.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';

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
          system: PHOTO_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64,
                  },
                },
                {
                  type: 'text',
                  text: 'Identify the food items in this photo and estimate portions and nutrition. Return structured data.',
                },
              ],
            },
          ],
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

      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const items: PhotoFoodItem[] = JSON.parse(jsonText);
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No food items identified in photo');
      }

      setParsedItems(items);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to analyze photo';
      Alert.alert('Analysis Error', msg);
    } finally {
      setLoading(false);
    }
  }, [photoUri]);

  function updateItem(index: number, field: keyof PhotoFoodItem, value: string) {
    setParsedItems((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      const item = { ...copy[index] };
      if (field === 'name' || field === 'portion' || field === 'note' || field === 'confidence') {
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
    if (!parsedItems || parsedItems.length === 0 || !photoUri) return;
    onConfirm(parsedItems, photoUri);
  }

  const confidenceColor = (c: PhotoConfidence) => {
    switch (c) {
      case 'high': return Colors.success;
      case 'medium': return Colors.accent;
      case 'low': return Colors.danger;
    }
  };

  // Parsed results - confirm before saving
  if (parsedItems && photoUri) {
    const totalCal = parsedItems.reduce((s, i) => s + i.calories, 0);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Confirm Items</Text>
          <Text style={styles.subtitle}>
            Review AI estimates and edit before saving. No food is logged without your confirmation.
          </Text>
        </View>

        <FlatList
          data={parsedItems}
          keyExtractor={(_, i) => String(i)}
          style={styles.list}
          ListHeaderComponent={
            <Image source={{ uri: photoUri }} style={styles.thumbnailSmall} resizeMode="cover" />
          }
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
                <View style={styles.calBadge}>
                  <Text style={styles.itemCal}>{Math.round(item.calories)}</Text>
                  <Text style={styles.calUnit}>kcal</Text>
                </View>
                <TouchableOpacity onPress={() => removeItem(index)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.macroRow}>
                  <Text style={styles.macroText}>P: {Math.round(item.protein_g)}g</Text>
                  <Text style={styles.macroText}>C: {Math.round(item.carbs_g)}g</Text>
                  <Text style={styles.macroText}>F: {Math.round(item.fat_g)}g</Text>
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor(item.confidence) + '20' }]}>
                  <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(item.confidence) }]} />
                  <Text style={[styles.confidenceText, { color: confidenceColor(item.confidence) }]}>
                    {item.confidence}
                  </Text>
                </View>
              </View>

              {item.note && (
                <Text style={styles.noteText}>{item.note}</Text>
              )}

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
            onPress={() => { setParsedItems(null); setPhotoUri(null); }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Retake</Text>
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

  // Photo captured, ready to analyze
  if (photoUri) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Analyze Photo</Text>
          <Text style={styles.subtitle}>AI will identify food items and estimate nutrition.</Text>
        </View>

        <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.loadingText}>Identifying food items...</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setPhotoUri(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={analyzePhoto}
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

  // Initial: capture or pick photo
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Photo Food Entry</Text>
        <Text style={styles.subtitle}>
          Take a photo of your food and AI will estimate the nutrition.
        </Text>
      </View>

      <View style={styles.captureOptions}>
        <TouchableOpacity style={styles.captureButton} onPress={takePhoto} activeOpacity={0.7}>
          <Ionicons name="camera" size={32} color={Colors.accent} />
          <Text style={styles.captureLabel}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureButton} onPress={pickFromGallery} activeOpacity={0.7}>
          <Ionicons name="images" size={32} color={Colors.accent} />
          <Text style={styles.captureLabel}>From Gallery</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
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
  captureOptions: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 40,
  },
  captureButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  captureLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  cancelButton: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
  },
  cancelText: { color: Colors.secondaryText, fontSize: 15 },
  preview: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
  },
  thumbnailSmall: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 12,
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
  calBadge: { alignItems: 'flex-end', marginRight: 4 },
  itemCal: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  calUnit: { color: Colors.secondaryText, fontSize: 10, marginTop: -2 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  macroRow: { flexDirection: 'row', gap: 12 },
  macroText: { color: Colors.secondaryText, fontSize: 12 },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  confidenceText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  noteText: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
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
