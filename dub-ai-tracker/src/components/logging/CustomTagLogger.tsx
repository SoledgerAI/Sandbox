// Custom tag logger -- user-created tags with configurable data types
// Phase 13: Supplements, Personal Care, and Remaining Tags

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { CustomEntry } from '../../types';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { todayDateString } from '../../utils/dayBoundary';


type CustomDataType = 'checkbox' | 'numeric' | 'scale_1_5' | 'scale_1_10' | 'text' | 'duration';

interface CustomTagDef {
  id: string;
  name: string;
  icon: string;
  data_type: CustomDataType;
  unit: string | null;
}

const DATA_TYPE_OPTIONS: { value: CustomDataType; label: string }[] = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'scale_1_5', label: 'Scale 1-5' },
  { value: 'scale_1_10', label: 'Scale 1-10' },
  { value: 'text', label: 'Text' },
  { value: 'duration', label: 'Duration (min)' },
];

const ICON_OPTIONS = [
  'star-outline', 'heart-outline', 'flame-outline', 'leaf-outline',
  'trophy-outline', 'book-outline', 'musical-notes-outline', 'game-controller-outline',
  'globe-outline', 'bulb-outline', 'flag-outline', 'rocket-outline',
];

export function CustomTagLogger() {
  const [tags, setTags] = useState<CustomTagDef[]>([]);
  const [entries, setEntries] = useState<CustomEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('star-outline');
  const [newDataType, setNewDataType] = useState<CustomDataType>('checkbox');
  const [newUnit, setNewUnit] = useState('');

  // Per-tag input values
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<CustomEntry>('custom.tag');

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    if (typeof lastEntry.value !== 'boolean') {
      setInputValues((prev) => ({ ...prev, [lastEntry.tag_id]: String(lastEntry.value) }));
    }
  }, [lastEntry]);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const [storedTags, storedEntries] = await Promise.all([
      storageGet<CustomTagDef[]>(STORAGE_KEYS.TAGS_ENABLED + '.custom'),
      storageGet<CustomEntry[]>(dateKey(STORAGE_KEYS.LOG_CUSTOM, today)),
    ]);
    setTags(storedTags ?? []);
    setEntries(storedEntries ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createTag = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Required', 'Please enter a tag name.');
      return;
    }

    const tag: CustomTagDef = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      icon: newIcon,
      data_type: newDataType,
      unit: newUnit.trim() || null,
    };

    const updated = [...tags, tag];
    await storageSet(STORAGE_KEYS.TAGS_ENABLED + '.custom', updated);
    setTags(updated);
    setNewName('');
    setNewUnit('');
    setShowCreate(false);
  }, [tags, newName, newIcon, newDataType, newUnit]);

  const deleteTag = useCallback(
    async (tagId: string) => {
      Alert.alert('Delete Tag', 'This will remove the tag definition. Existing entries remain.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = tags.filter((t) => t.id !== tagId);
            await storageSet(STORAGE_KEYS.TAGS_ENABLED + '.custom', updated);
            setTags(updated);
          },
        },
      ]);
    },
    [tags],
  );

  const logEntry = useCallback(
    async (tag: CustomTagDef) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_CUSTOM, today);
      const raw = inputValues[tag.id] ?? '';

      let value: string | number | boolean;
      switch (tag.data_type) {
        case 'checkbox':
          value = true;
          break;
        case 'numeric':
        case 'duration':
          value = parseFloat(raw) || 0;
          break;
        case 'scale_1_5':
          value = Math.min(5, Math.max(1, parseInt(raw, 10) || 3));
          break;
        case 'scale_1_10':
          value = Math.min(10, Math.max(1, parseInt(raw, 10) || 5));
          break;
        default:
          value = raw;
      }

      const entry: CustomEntry = {
        id: `custom_entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tag_id: tag.id,
        timestamp: new Date().toISOString(),
        value,
        notes: null,
      };

      const updated = [...entries, entry];
      await storageSet(key, updated);
      setEntries(updated);
      setInputValues((prev) => ({ ...prev, [tag.id]: '' }));
      await saveAsLast(entry);
    },
    [entries, inputValues, saveAsLast],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_CUSTOM, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <RepeatLastEntry
        tagLabel="custom entry"
        subtitle={lastEntry?.tag_id ?? undefined}
        visible={!lastEntryLoading && lastEntry !== null}
        onRepeat={handleRepeatLast}
      />

      {/* Create new tag button */}
      <TouchableOpacity
        style={styles.createToggle}
        onPress={() => setShowCreate(!showCreate)}
        activeOpacity={0.7}
      >
        <Ionicons name={showCreate ? 'close' : 'add-circle'} size={22} color={Colors.accent} />
        <Text style={styles.createToggleText}>
          {showCreate ? 'Cancel' : 'Create Custom Tag'}
        </Text>
      </TouchableOpacity>

      {/* Create form */}
      {showCreate && (
        <View style={styles.createForm}>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Tag name"
            placeholderTextColor={Colors.secondaryText}
          />

          <Text style={styles.formLabel}>Icon</Text>
          <View style={styles.iconGrid}>
            {ICON_OPTIONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[styles.iconBtn, newIcon === icon && styles.iconBtnActive]}
                onPress={() => setNewIcon(icon)}
              >
                <Ionicons
                  name={icon as any}
                  size={20}
                  color={newIcon === icon ? Colors.primaryBackground : Colors.secondaryText}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Data Type</Text>
          <View style={styles.dataTypeGrid}>
            {DATA_TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.dataTypeBtn, newDataType === opt.value && styles.dataTypeBtnActive]}
                onPress={() => setNewDataType(opt.value)}
              >
                <Text
                  style={[
                    styles.dataTypeText,
                    newDataType === opt.value && styles.dataTypeTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(newDataType === 'numeric' || newDataType === 'duration') && (
            <TextInput
              style={styles.input}
              value={newUnit}
              onChangeText={setNewUnit}
              placeholder="Unit (optional, e.g., lbs, min)"
              placeholderTextColor={Colors.secondaryText}
            />
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={createTag} activeOpacity={0.7}>
            <Text style={styles.saveBtnText}>Create Tag</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tag list with logging */}
      {tags.length > 0 && <Text style={styles.sectionTitle}>Your Custom Tags</Text>}
      {tags.map((tag) => {
        const tagEntries = entries.filter((e) => e.tag_id === tag.id);

        return (
          <View key={tag.id} style={styles.tagCard}>
            <View style={styles.tagHeader}>
              <Ionicons name={tag.icon as any} size={20} color={Colors.accent} />
              <Text style={styles.tagName}>{tag.name}</Text>
              <Text style={styles.tagType}>{tag.data_type}</Text>
              <TouchableOpacity
                onPress={() => deleteTag(tag.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            {/* Input based on data type */}
            <View style={styles.tagInputRow}>
              {tag.data_type === 'checkbox' ? (
                <TouchableOpacity style={styles.checkBtn} onPress={() => logEntry(tag)}>
                  <Ionicons name="checkbox-outline" size={20} color={Colors.accent} />
                  <Text style={styles.checkBtnText}>Check</Text>
                </TouchableOpacity>
              ) : tag.data_type === 'scale_1_5' ? (
                <View style={styles.scaleRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.scaleBtn,
                        inputValues[tag.id] === String(n) && styles.scaleBtnActive,
                      ]}
                      onPress={() => {
                        setInputValues((prev) => ({ ...prev, [tag.id]: String(n) }));
                      }}
                    >
                      <Text style={styles.scaleBtnText}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.logSmallBtn}
                    onPress={() => logEntry(tag)}
                  >
                    <Ionicons name="checkmark" size={18} color={Colors.primaryBackground} />
                  </TouchableOpacity>
                </View>
              ) : tag.data_type === 'scale_1_10' ? (
                <View style={styles.scaleRow}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.scaleBtnSmall,
                        inputValues[tag.id] === String(n) && styles.scaleBtnActive,
                      ]}
                      onPress={() => {
                        setInputValues((prev) => ({ ...prev, [tag.id]: String(n) }));
                      }}
                    >
                      <Text style={styles.scaleBtnTextSmall}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.logSmallBtn}
                    onPress={() => logEntry(tag)}
                  >
                    <Ionicons name="checkmark" size={18} color={Colors.primaryBackground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.textInputRow}>
                  <TextInput
                    style={[styles.tagInput, { flex: 1 }]}
                    value={inputValues[tag.id] ?? ''}
                    onChangeText={(v) =>
                      setInputValues((prev) => ({ ...prev, [tag.id]: v }))
                    }
                    placeholder={
                      tag.data_type === 'numeric'
                        ? `Enter value${tag.unit ? ` (${tag.unit})` : ''}`
                        : tag.data_type === 'duration'
                          ? 'Minutes'
                          : 'Enter text'
                    }
                    placeholderTextColor={Colors.secondaryText}
                    keyboardType={
                      tag.data_type === 'numeric' || tag.data_type === 'duration'
                        ? 'numeric'
                        : 'default'
                    }
                  />
                  <TouchableOpacity
                    style={styles.logSmallBtn}
                    onPress={() => logEntry(tag)}
                  >
                    <Ionicons name="checkmark" size={18} color={Colors.primaryBackground} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Tag entries */}
            {tagEntries.length > 0 && (
              <View style={styles.tagEntries}>
                {tagEntries
                  .slice()
                  .reverse()
                  .map((e) => (
                    <View key={e.id} style={styles.entryRow}>
                      <Text style={styles.entryValue}>
                        {typeof e.value === 'boolean' ? (e.value ? 'Done' : '-') : String(e.value)}
                        {tag.unit ? ` ${tag.unit}` : ''}
                      </Text>
                      <Text style={styles.entryTime}>
                        {new Date(e.timestamp).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                      <TouchableOpacity
                        onPress={() => deleteEntry(e.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            )}
          </View>
        );
      })}

      {tags.length === 0 && !showCreate && (
        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={48} color={Colors.divider} />
          <Text style={styles.emptyTitle}>No custom tags</Text>
          <Text style={styles.emptySubtitle}>
            Create a custom tag to track anything you want
          </Text>
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  createToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  createToggleText: { color: Colors.accent, fontSize: 15, fontWeight: '600' },
  createForm: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 8,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  iconBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dataTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dataTypeBtn: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  dataTypeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dataTypeText: { color: Colors.secondaryText, fontSize: 12 },
  dataTypeTextActive: { color: Colors.primaryBackground, fontWeight: '600' },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: Colors.primaryBackground, fontSize: 15, fontWeight: '700' },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  tagCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  tagHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tagName: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },
  tagType: { color: Colors.secondaryText, fontSize: 11 },
  tagInputRow: { marginBottom: 4 },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  checkBtnText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  scaleRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  scaleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  scaleBtnSmall: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  scaleBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  scaleBtnText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  scaleBtnTextSmall: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  logSmallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  textInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tagInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  tagEntries: { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 8 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  entryValue: { flex: 1, color: Colors.text, fontSize: 13 },
  entryTime: { color: Colors.secondaryText, fontSize: 11 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});
