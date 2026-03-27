// Notification card for EOD questionnaire
// Phase 15: EOD Questionnaire and Notifications

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ALL_DEFAULT_TAGS } from '../../constants/tags';
import { storageGet, storageSet, dateKey, STORAGE_KEYS } from '../../utils/storage';

// ============================================================
// Tag-specific quick input types
// ============================================================

type QuickInputType = 'water' | 'scale_1_5' | 'numeric' | 'boolean' | 'text' | 'summary';

interface TagCardConfig {
  tagId: string;
  name: string;
  icon: string;
  inputType: QuickInputType;
  storageKey: string;
  placeholder?: string;
  unit?: string;
  scaleLabels?: string[];
}

const TAG_CARD_CONFIGS: Record<string, TagCardConfig> = {
  'hydration.water': {
    tagId: 'hydration.water',
    name: 'Hydration',
    icon: 'water-outline',
    inputType: 'water',
    storageKey: STORAGE_KEYS.LOG_WATER,
    unit: 'oz',
  },
  'nutrition.food': {
    tagId: 'nutrition.food',
    name: 'Nutrition',
    icon: 'nutrition-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_FOOD,
    placeholder: 'Logged all meals?',
  },
  'fitness.workout': {
    tagId: 'fitness.workout',
    name: 'Fitness',
    icon: 'fitness-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_WORKOUT,
    placeholder: 'Did you work out today?',
  },
  'strength.training': {
    tagId: 'strength.training',
    name: 'Strength',
    icon: 'barbell-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_STRENGTH,
    placeholder: 'Strength training today?',
  },
  'body.measurements': {
    tagId: 'body.measurements',
    name: 'Body',
    icon: 'body-outline',
    inputType: 'numeric',
    storageKey: STORAGE_KEYS.LOG_BODY,
    placeholder: 'Weight',
    unit: 'lbs',
  },
  'sleep.tracking': {
    tagId: 'sleep.tracking',
    name: 'Sleep',
    icon: 'moon-outline',
    inputType: 'scale_1_5',
    storageKey: STORAGE_KEYS.LOG_SLEEP,
    scaleLabels: ['Terrible', 'Poor', 'Fair', 'Good', 'Excellent'],
  },
  'recovery.score': {
    tagId: 'recovery.score',
    name: 'Recovery',
    icon: 'pulse-outline',
    inputType: 'scale_1_5',
    storageKey: STORAGE_KEYS.RECOVERY,
    scaleLabels: ['Very Low', 'Low', 'Moderate', 'Good', 'Excellent'],
  },
  'supplements.daily': {
    tagId: 'supplements.daily',
    name: 'Supplements',
    icon: 'medkit-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_SUPPLEMENTS,
    placeholder: 'Took supplements today?',
  },
  'health.markers': {
    tagId: 'health.markers',
    name: 'Health Markers',
    icon: 'heart-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_BLOODWORK,
    placeholder: 'Any health data to log?',
  },
  'mental.wellness': {
    tagId: 'mental.wellness',
    name: 'Mental Wellness',
    icon: 'happy-outline',
    inputType: 'scale_1_5',
    storageKey: STORAGE_KEYS.LOG_MOOD,
    scaleLabels: ['Rough', 'Low', 'Neutral', 'Good', 'Great'],
  },
  'substances.tracking': {
    tagId: 'substances.tracking',
    name: 'Substances',
    icon: 'wine-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_SUBSTANCES,
    placeholder: 'Any substances today?',
  },
  'sexual.activity': {
    tagId: 'sexual.activity',
    name: 'Sexual Activity',
    icon: 'flame-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_SEXUAL,
    placeholder: 'Activity today?',
  },
  'digestive.health': {
    tagId: 'digestive.health',
    name: 'Digestive Health',
    icon: 'leaf-outline',
    inputType: 'scale_1_5',
    storageKey: STORAGE_KEYS.LOG_DIGESTIVE,
    scaleLabels: ['Terrible', 'Poor', 'Fair', 'Good', 'Excellent'],
  },
  'personal.care': {
    tagId: 'personal.care',
    name: 'Personal Care',
    icon: 'sparkles-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_PERSONALCARE,
    placeholder: 'Completed routines?',
  },
  'womens.health': {
    tagId: 'womens.health',
    name: "Women's Health",
    icon: 'flower-outline',
    inputType: 'boolean',
    storageKey: STORAGE_KEYS.LOG_CYCLE,
    placeholder: 'Cycle data to log?',
  },
  'injury.pain': {
    tagId: 'injury.pain',
    name: 'Injury / Pain',
    icon: 'bandage-outline',
    inputType: 'scale_1_5',
    storageKey: STORAGE_KEYS.LOG_INJURY,
    scaleLabels: ['None', 'Mild', 'Moderate', 'Severe', 'Extreme'],
  },
};

// ============================================================
// NotificationCard Component
// ============================================================

interface NotificationCardProps {
  tagId: string;
  todayStr: string;
  onComplete: (tagId: string) => void;
  onSkip: (tagId: string) => void;
}

export function NotificationCard({ tagId, todayStr, onComplete, onSkip }: NotificationCardProps) {
  const config = TAG_CARD_CONFIGS[tagId];
  const tagMeta = ALL_DEFAULT_TAGS.find((t) => t.id === tagId);
  const [saving, setSaving] = useState(false);

  // Fallback for unknown tags
  const name = config?.name ?? tagMeta?.name ?? tagId;
  const icon = config?.icon ?? tagMeta?.icon ?? 'ellipse-outline';
  const inputType = config?.inputType ?? 'boolean';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={24} color={Colors.accent} />
        </View>
        <Text style={styles.cardTitle}>{name}</Text>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => onSkip(tagId)}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputArea}>
        {inputType === 'water' && (
          <WaterQuickInput
            storageKey={config!.storageKey}
            todayStr={todayStr}
            saving={saving}
            setSaving={setSaving}
            onComplete={() => onComplete(tagId)}
          />
        )}
        {inputType === 'scale_1_5' && (
          <ScaleQuickInput
            storageKey={config!.storageKey}
            todayStr={todayStr}
            labels={config!.scaleLabels ?? ['1', '2', '3', '4', '5']}
            saving={saving}
            setSaving={setSaving}
            onComplete={() => onComplete(tagId)}
          />
        )}
        {inputType === 'numeric' && (
          <NumericQuickInput
            storageKey={config!.storageKey}
            todayStr={todayStr}
            placeholder={config!.placeholder ?? 'Value'}
            unit={config!.unit ?? ''}
            saving={saving}
            setSaving={setSaving}
            onComplete={() => onComplete(tagId)}
          />
        )}
        {inputType === 'boolean' && (
          <BooleanQuickInput
            storageKey={config!.storageKey}
            todayStr={todayStr}
            prompt={config?.placeholder ?? `Log ${name}?`}
            saving={saving}
            setSaving={setSaving}
            onComplete={() => onComplete(tagId)}
          />
        )}
        {inputType === 'text' && (
          <TextQuickInput
            storageKey={config!.storageKey}
            todayStr={todayStr}
            placeholder={config?.placeholder ?? 'Notes...'}
            saving={saving}
            setSaving={setSaving}
            onComplete={() => onComplete(tagId)}
          />
        )}
      </View>
    </View>
  );
}

// ============================================================
// Quick Input Sub-components
// ============================================================

interface QuickInputProps {
  storageKey: string;
  todayStr: string;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onComplete: () => void;
}

function WaterQuickInput({ storageKey, todayStr, saving, setSaving, onComplete }: QuickInputProps) {
  const [value, setValue] = useState('');

  const quickAmounts = [8, 16, 24, 32];

  const handleSave = async (oz: number) => {
    setSaving(true);
    try {
      const key = dateKey(storageKey, todayStr);
      const existing = await storageGet<{ total_oz: number }>(key);
      const newTotal = (existing?.total_oz ?? 0) + oz;
      await storageSet(key, { total_oz: newTotal, logged_at: new Date().toISOString() });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.quickRow}>
      {quickAmounts.map((oz) => (
        <TouchableOpacity
          key={oz}
          style={styles.quickButton}
          onPress={() => handleSave(oz)}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primaryBackground} />
          ) : (
            <Text style={styles.quickButtonText}>{oz}oz</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ScaleQuickInput({
  storageKey,
  todayStr,
  saving,
  setSaving,
  onComplete,
  ...rest
}: QuickInputProps & { labels: string[] }) {
  const labels = (rest as any).labels as string[];

  const handleSelect = async (value: number) => {
    setSaving(true);
    try {
      const key = dateKey(storageKey, todayStr);
      await storageSet(key, { value, logged_at: new Date().toISOString() });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.scaleContainer}>
      {labels.map((label, i) => (
        <TouchableOpacity
          key={i}
          style={styles.scaleButton}
          onPress={() => handleSelect(i + 1)}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Text style={styles.scaleNumber}>{i + 1}</Text>
          <Text style={styles.scaleLabel} numberOfLines={1}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NumericQuickInput({
  storageKey,
  todayStr,
  saving,
  setSaving,
  onComplete,
  ...rest
}: QuickInputProps & { placeholder: string; unit: string }) {
  const { placeholder, unit } = rest as { placeholder: string; unit: string };
  const [value, setValue] = useState('');

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setSaving(true);
    try {
      const key = dateKey(storageKey, todayStr);
      await storageSet(key, { value: num, unit, logged_at: new Date().toISOString() });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.numericRow}>
      <TextInput
        style={styles.numericInput}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={Colors.secondaryText}
        keyboardType="decimal-pad"
        editable={!saving}
      />
      {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
      <TouchableOpacity
        style={[styles.saveSmallButton, !value.trim() && styles.saveSmallDisabled]}
        onPress={handleSave}
        disabled={!value.trim() || saving}
        activeOpacity={0.7}
      >
        {saving ? (
          <ActivityIndicator size="small" color={Colors.primaryBackground} />
        ) : (
          <Text style={styles.saveSmallText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function BooleanQuickInput({
  storageKey,
  todayStr,
  saving,
  setSaving,
  onComplete,
  ...rest
}: QuickInputProps & { prompt: string }) {
  const { prompt } = rest as { prompt: string };

  const handleSelect = async (answer: boolean) => {
    setSaving(true);
    try {
      const key = dateKey(storageKey, todayStr);
      if (answer) {
        // Mark as logged with minimal entry
        await storageSet(key, { logged: true, logged_at: new Date().toISOString() });
      }
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={styles.promptText}>{prompt}</Text>
      <View style={styles.booleanRow}>
        <TouchableOpacity
          style={styles.booleanNo}
          onPress={() => handleSelect(false)}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Text style={styles.booleanNoText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.booleanYes}
          onPress={() => handleSelect(true)}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primaryBackground} />
          ) : (
            <Text style={styles.booleanYesText}>Yes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TextQuickInput({
  storageKey,
  todayStr,
  saving,
  setSaving,
  onComplete,
  ...rest
}: QuickInputProps & { placeholder: string }) {
  const { placeholder } = rest as { placeholder: string };
  const [value, setValue] = useState('');

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const key = dateKey(storageKey, todayStr);
      await storageSet(key, { text: value.trim(), logged_at: new Date().toISOString() });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={2}
        editable={!saving}
      />
      <TouchableOpacity
        style={[styles.saveFullButton, !value.trim() && styles.saveSmallDisabled]}
        onPress={handleSave}
        disabled={!value.trim() || saving}
        activeOpacity={0.7}
      >
        {saving ? (
          <ActivityIndicator size="small" color={Colors.primaryBackground} />
        ) : (
          <Text style={styles.saveSmallText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Summary Card (AI-generated daily summary)
// ============================================================

interface SummaryCardProps {
  summary: string | null;
  loading: boolean;
  onDismiss: () => void;
}

export function SummaryCard({ summary, loading, onDismiss }: SummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="sparkles" size={24} color={Colors.accent} />
        </View>
        <Text style={styles.cardTitle}>Daily Summary</Text>
      </View>

      <View style={styles.summaryArea}>
        {loading ? (
          <View style={styles.summaryLoading}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.summaryLoadingText}>Generating your summary...</Text>
          </View>
        ) : summary ? (
          <Text style={styles.summaryText}>{summary}</Text>
        ) : (
          <Text style={styles.summaryText}>No summary available.</Text>
        )}
      </View>

      <TouchableOpacity style={styles.doneButton} onPress={onDismiss} activeOpacity={0.7}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  inputArea: {
    marginTop: 4,
  },
  // Water quick input
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickButtonText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '600',
  },
  // Scale input
  scaleContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  scaleButton: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  scaleNumber: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  scaleLabel: {
    color: Colors.secondaryText,
    fontSize: 9,
    marginTop: 2,
  },
  // Numeric input
  numericRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numericInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  unitText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  saveSmallButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveSmallDisabled: {
    opacity: 0.4,
  },
  saveSmallText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '600',
  },
  // Boolean input
  promptText: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginBottom: 10,
  },
  booleanRow: {
    flexDirection: 'row',
    gap: 10,
  },
  booleanNo: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  booleanNoText: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  booleanYes: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  booleanYesText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '600',
  },
  // Text input
  textInput: {
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  saveFullButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  // Summary card
  summaryArea: {
    marginBottom: 16,
  },
  summaryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  summaryLoadingText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  summaryText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  doneButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: Colors.primaryBackground,
    fontSize: 16,
    fontWeight: '600',
  },
});
