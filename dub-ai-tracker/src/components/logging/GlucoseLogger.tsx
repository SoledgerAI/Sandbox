// Blood glucose logging component
// Numeric reading (mg/dL), timing selector, optional meal link, notes
// Reference bands per ADA general guidelines

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
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { GlucoseEntry, GlucoseTiming, FoodEntry } from '../../types';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { todayDateString } from '../../utils/dayBoundary';


const TIMING_OPTIONS: { value: GlucoseTiming; label: string }[] = [
  { value: 'fasting', label: 'Fasting' },
  { value: 'before_meal', label: 'Before meal' },
  { value: '1hr_after_meal', label: '1hr after meal' },
  { value: '2hr_after_meal', label: '2hr after meal' },
  { value: 'before_exercise', label: 'Before exercise' },
  { value: 'after_exercise', label: 'After exercise' },
  { value: 'bedtime', label: 'Bedtime' },
  { value: 'other', label: 'Other' },
];

type RangeBand = 'normal' | 'pre_diabetic' | 'above_range';

interface RangeResult {
  band: RangeBand;
  label: string;
  color: string;
}

function getGlucoseRange(reading: number, timing: GlucoseTiming): RangeResult {
  const isPostMeal = timing === '1hr_after_meal' || timing === '2hr_after_meal';

  if (isPostMeal) {
    // Post-meal 2hr reference bands
    if (reading < 140) return { band: 'normal', label: 'Normal range', color: '#4CAF50' };
    if (reading < 200) return { band: 'pre_diabetic', label: 'Pre-diabetic range', color: '#FFC107' };
    return { band: 'above_range', label: 'Above range', color: '#EF5350' };
  }

  // Fasting / all other timings use fasting reference bands
  if (reading < 100) return { band: 'normal', label: 'Normal range', color: '#4CAF50' };
  if (reading < 126) return { band: 'pre_diabetic', label: 'Pre-diabetic range', color: '#FFC107' };
  return { band: 'above_range', label: 'Above range', color: '#EF5350' };
}

interface GlucoseLoggerProps {
  onEntryLogged?: () => void;
}

export function GlucoseLogger({ onEntryLogged }: GlucoseLoggerProps) {
  const { lastEntry, loading: lastLoading, saveAsLast } = useLastEntry<GlucoseEntry>('blood.glucose');
  const [entries, setEntries] = useState<GlucoseEntry[]>([]);
  const [reading, setReading] = useState('');
  const [timing, setTiming] = useState<GlucoseTiming>('fasting');
  const [notes, setNotes] = useState('');
  const [linkedFoodId, setLinkedFoodId] = useState<string | null>(null);
  const [todayFoods, setTodayFoods] = useState<FoodEntry[]>([]);
  const [showFoodPicker, setShowFoodPicker] = useState(false);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const [stored, foods] = await Promise.all([
      storageGet<GlucoseEntry[]>(dateKey(STORAGE_KEYS.LOG_GLUCOSE, today)),
      storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, today)),
    ]);
    setEntries(stored ?? []);
    setTodayFoods(foods ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const readingNum = parseFloat(reading);
  const isValidReading = !isNaN(readingNum) && readingNum > 0;
  const isOutOfRange = isValidReading && (readingNum < 20 || readingNum > 600);
  const rangeResult = isValidReading ? getGlucoseRange(readingNum, timing) : null;

  const logGlucose = useCallback(async () => {
    if (!isValidReading) return;

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_GLUCOSE, today);

    const entry: GlucoseEntry = {
      id: `glucose_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      reading_mg_dl: readingNum,
      timing,
      linked_food_entry_id: linkedFoodId,
      notes: notes.trim() || null,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    await saveAsLast(entry);
    setEntries(updated);
    setReading('');
    setNotes('');
    setLinkedFoodId(null);
    onEntryLogged?.();
  }, [entries, readingNum, timing, linkedFoodId, notes, isValidReading, onEntryLogged, saveAsLast]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_GLUCOSE, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  const linkedFood = linkedFoodId
    ? todayFoods.find((f) => f.id === linkedFoodId)
    : null;

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    setReading(String(lastEntry.reading_mg_dl));
    setTiming(lastEntry.timing);
  }, [lastEntry]);

  const repeatSubtitle = lastEntry
    ? `${lastEntry.reading_mg_dl} mg/dL`
    : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <RepeatLastEntry
        tagLabel="glucose"
        subtitle={repeatSubtitle}
        visible={!lastLoading && lastEntry != null}
        onRepeat={handleRepeatLast}
      />
      {/* Reading input */}
      <Text style={styles.sectionTitle}>Reading (mg/dL)</Text>
      <TextInput
        style={styles.readingInput}
        value={reading}
        onChangeText={setReading}
        placeholder="e.g. 95"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="numeric"
        accessibilityLabel="Blood glucose reading in milligrams per deciliter"
      />

      {/* Out-of-range warning */}
      {isOutOfRange && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={16} color="#FFC107" />
          <Text style={styles.warningText}>
            Reading outside typical range (20-600 mg/dL). Entry will still save.
          </Text>
        </View>
      )}

      {/* Range band indicator */}
      {rangeResult && !isOutOfRange && (
        <View style={[styles.rangeBand, { borderLeftColor: rangeResult.color }]}>
          <View style={[styles.rangeDot, { backgroundColor: rangeResult.color }]} />
          <Text style={[styles.rangeLabel, { color: rangeResult.color }]}>
            {rangeResult.label}
          </Text>
        </View>
      )}

      {/* Timing selector */}
      <Text style={styles.sectionTitle}>Timing</Text>
      <View style={styles.timingGrid}>
        {TIMING_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.timingBtn, timing === opt.value && styles.timingBtnActive]}
            onPress={() => setTiming(opt.value)}
            accessibilityLabel={opt.label}
            accessibilityRole="radio"
          >
            <Text style={[styles.timingLabel, timing === opt.value && styles.timingLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Meal link (optional) */}
      {todayFoods.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Link to meal (optional)</Text>
          {linkedFood ? (
            <View style={styles.linkedMealCard}>
              <View style={styles.linkedMealInfo}>
                <Text style={styles.linkedMealName} numberOfLines={1}>{linkedFood.food_item.name}</Text>
                <Text style={styles.linkedMealTime}>
                  {new Date(linkedFood.timestamp).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setLinkedFoodId(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close-circle" size={20} color={Colors.secondaryText} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.linkBtn} onPress={() => setShowFoodPicker(!showFoodPicker)}>
              <Ionicons name="link-outline" size={18} color={Colors.accentText} />
              <Text style={styles.linkBtnText}>Link a meal</Text>
            </TouchableOpacity>
          )}
          {showFoodPicker && !linkedFood && (
            <View style={styles.foodPickerList}>
              {todayFoods.map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={styles.foodPickerItem}
                  onPress={() => {
                    setLinkedFoodId(food.id);
                    setShowFoodPicker(false);
                  }}
                >
                  <Text style={styles.foodPickerName} numberOfLines={1}>{food.food_item.name}</Text>
                  <Text style={styles.foodPickerTime}>
                    {new Date(food.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes (optional)</Text>
      <TextInput
        style={styles.noteInput}
        value={notes}
        onChangeText={(text) => setNotes(text.slice(0, 200))}
        placeholder="Any context for this reading"
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={2}
        maxLength={200}
      />
      <Text style={styles.charCount}>{notes.length}/200</Text>

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, !isValidReading && styles.logBtnDisabled]}
        onPress={logGlucose}
        activeOpacity={0.7}
        disabled={!isValidReading}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Reading</Text>
      </TouchableOpacity>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        General guidelines. Consult your healthcare provider.
      </Text>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Today's Readings</Text>
          {entries
            .slice()
            .reverse()
            .map((entry) => {
              const entryRange = getGlucoseRange(entry.reading_mg_dl, entry.timing);
              const timingLabel = TIMING_OPTIONS.find((t) => t.value === entry.timing)?.label ?? entry.timing;
              return (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={[styles.entryDot, { backgroundColor: entryRange.color }]} />
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryReading}>
                      {entry.reading_mg_dl} mg/dL
                    </Text>
                    <Text style={styles.entryTiming}>
                      {timingLabel} — {entryRange.label}
                    </Text>
                    {entry.notes && (
                      <Text style={styles.entryNote} numberOfLines={2}>{entry.notes}</Text>
                    )}
                    <Text style={styles.entryTime}>
                      {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteEntry(entry.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  readingInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 12,
    textAlign: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  warningText: {
    color: '#FFC107',
    fontSize: 13,
    flex: 1,
  },
  rangeBand: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
    marginBottom: 20,
    gap: 8,
  },
  rangeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  timingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  timingBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timingBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  timingLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  timingLabelActive: {
    color: Colors.accentText,
    fontWeight: '600',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 16,
  },
  linkBtnText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '500',
  },
  linkedMealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  linkedMealInfo: {
    flex: 1,
  },
  linkedMealName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  linkedMealTime: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  foodPickerList: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  foodPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  foodPickerName: {
    color: Colors.text,
    fontSize: 14,
    flex: 1,
  },
  foodPickerTime: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginLeft: 8,
  },
  noteInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  charCount: {
    color: Colors.secondaryText,
    fontSize: 11,
    textAlign: 'right',
    marginBottom: 20,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 8,
  },
  logBtnDisabled: {
    opacity: 0.5,
  },
  logBtnText: {
    color: Colors.primaryBackground,
    fontSize: 17,
    fontWeight: '700',
  },
  disclaimer: {
    color: Colors.secondaryText,
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  entryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  entryInfo: {
    flex: 1,
  },
  entryReading: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  entryTiming: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  entryNote: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  entryTime: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
});
