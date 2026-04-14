// Sprint 22: Mood & Mental Health Logger
// Core feature (not elect-in). Includes CrisisSupport988 banner at bottom.

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { PremiumCard } from '../common/PremiumCard';
import { PremiumButton } from '../common/PremiumButton';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../../utils/storage';
import { getActiveDate } from '../../services/dateContextService';
import { hapticSuccess, hapticSelection } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import { CrisisSupport988 } from '../CrisisSupport988';
import type {
  MoodMentalEntry,
  MoodEmotion,
  MoodTrigger,
  CopingStrategy,
} from '../../types';
import {
  MOOD_EMOTION_OPTIONS,
  MOOD_TRIGGER_OPTIONS,
  COPING_STRATEGY_OPTIONS,
} from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MOOD_EMOJIS = ['', '😞', '😔', '😐', '🙂', '😊', '😃', '😄', '🤩', '😁', '🌟'];

const SCALE_LABELS: Record<string, string[]> = {
  energy: ['Exhausted', 'Low', 'Moderate', 'Good', 'Energized'],
  anxiety: ['None', 'Mild', 'Moderate', 'High', 'Severe'],
  stress: ['None', 'Mild', 'Moderate', 'High', 'Severe'],
  clarity: ['Foggy', 'Hazy', 'Moderate', 'Clear', 'Sharp'],
  sleep: ['Terrible', 'Poor', 'OK', 'Good', 'Great'],
};

export function MoodMentalLogger() {
  const { showToast } = useToast();
  const today = getActiveDate();

  const [overallMood, setOverallMood] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [anxietyLevel, setAnxietyLevel] = useState(1);
  const [stressLevel, setStressLevel] = useState(1);
  const [mentalClarity, setMentalClarity] = useState(3);
  const [emotions, setEmotions] = useState<MoodEmotion[]>([]);
  const [triggers, setTriggers] = useState<MoodTrigger[]>([]);
  const [triggerOtherText, setTriggerOtherText] = useState('');
  const [copingUsed, setCopingUsed] = useState<CopingStrategy[]>([]);
  const [copingOtherText, setCopingOtherText] = useState('');
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [existingEntry, setExistingEntry] = useState<MoodMentalEntry | null>(null);
  const [quickMode, setQuickMode] = useState(false);

  // Collapsible sections
  const [emotionsExpanded, setEmotionsExpanded] = useState(true);
  const [triggersExpanded, setTriggersExpanded] = useState(false);
  const [copingExpanded, setCopingExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const existing = await storageGet<MoodMentalEntry>(dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today));
      if (existing) {
        setExistingEntry(existing);
        setOverallMood(existing.overall_mood);
        setEnergyLevel(existing.energy_level);
        setAnxietyLevel(existing.anxiety_level);
        setStressLevel(existing.stress_level);
        setMentalClarity(existing.mental_clarity);
        setEmotions(existing.emotions);
        setTriggers(existing.triggers);
        setTriggerOtherText(existing.trigger_other_text ?? '');
        setCopingUsed(existing.coping_used);
        setCopingOtherText(existing.coping_other_text ?? '');
        setSleepQuality(existing.sleep_quality_last_night);
        setNotes(existing.notes ?? '');
      }
    })();
  }, [today]);

  const toggleCollapsible = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    hapticSelection();
    setter((prev) => !prev);
  }, []);

  const toggleMultiSelect = useCallback(<T extends string>(
    value: T,
    setter: React.Dispatch<React.SetStateAction<T[]>>,
  ) => {
    hapticSelection();
    setter((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  }, []);

  const handleSave = useCallback(async () => {
    const key = dateKey(STORAGE_KEYS.LOG_MOOD_MENTAL, today);
    const entry: MoodMentalEntry = {
      id: existingEntry?.id ?? `mood_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      date: today,
      overall_mood: overallMood,
      energy_level: energyLevel,
      anxiety_level: quickMode ? 1 : anxietyLevel,
      stress_level: quickMode ? 1 : stressLevel,
      mental_clarity: quickMode ? 3 : mentalClarity,
      emotions: quickMode ? [] : emotions,
      triggers: quickMode ? [] : triggers,
      trigger_other_text: !quickMode && triggers.includes('other') ? triggerOtherText.trim() || null : null,
      coping_used: quickMode ? [] : copingUsed,
      coping_other_text: !quickMode && copingUsed.includes('other') ? copingOtherText.trim() || null : null,
      sleep_quality_last_night: sleepQuality,
      notes: quickMode ? null : notes.trim() || null,
    };
    await storageSet(key, entry);
    hapticSuccess();
    showToast('Mood & mental health entry saved', 'success');
  }, [
    today, existingEntry, overallMood, energyLevel, anxietyLevel, stressLevel,
    mentalClarity, emotions, triggers, triggerOtherText, copingUsed, copingOtherText,
    sleepQuality, notes, quickMode, showToast,
  ]);

  const renderScaleSelector = (
    label: string,
    scaleKey: string,
    value: number,
    onChange: (v: number) => void,
  ) => {
    const labels = SCALE_LABELS[scaleKey];
    return (
      <View style={styles.scaleSection}>
        <Text style={styles.scaleLabel}>
          {label}: <Text style={styles.scaleValue}>{labels[value - 1]} ({value}/5)</Text>
        </Text>
        <View style={styles.scaleRow}>
          {[1, 2, 3, 4, 5].map((n) => {
            const isActive = n === value;
            const color = n <= 2 ? '#4CAF50' : n === 3 ? '#FF9800' : '#EF5350';
            return (
              <TouchableOpacity
                key={n}
                style={[styles.scaleDot, isActive && { backgroundColor: color, borderColor: color }]}
                onPress={() => { hapticSelection(); onChange(n); }}
              >
                <Text style={[styles.scaleDotText, isActive && { color: '#fff' }]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderCollapsibleHeader = (title: string, expanded: boolean, onToggle: () => void) => (
    <TouchableOpacity style={styles.collapsibleHeader} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={Colors.secondaryText}
      />
    </TouchableOpacity>
  );

  const renderPillGrid = <T extends string>(
    options: { value: T; label: string }[],
    selected: T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
  ) => (
    <View style={styles.pillGrid}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.pill, isSelected && styles.pillActive]}
            onPress={() => toggleMultiSelect(opt.value, setter)}
          >
            <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Quick mode toggle */}
      <PremiumCard>
        <TouchableOpacity
          style={styles.quickModeToggle}
          onPress={() => { hapticSelection(); setQuickMode(!quickMode); }}
        >
          <Ionicons
            name={quickMode ? 'checkbox' : 'square-outline'}
            size={22}
            color={quickMode ? Colors.accent : Colors.secondaryText}
          />
          <Text style={styles.quickModeText}>Quick mood check (mood + energy only)</Text>
        </TouchableOpacity>
      </PremiumCard>

      {/* Overall Mood (1-10 slider with emoji anchors) */}
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>
          Overall Mood: {MOOD_EMOJIS[overallMood]} <Text style={styles.scaleValue}>{overallMood}/10</Text>
        </Text>
        <View style={styles.moodRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            const isActive = n === overallMood;
            const color = n <= 3 ? '#EF5350' : n <= 5 ? '#FF9800' : n <= 7 ? '#FFC107' : '#4CAF50';
            return (
              <TouchableOpacity
                key={n}
                style={[styles.moodDot, isActive && { backgroundColor: color, borderColor: color }]}
                onPress={() => { hapticSelection(); setOverallMood(n); }}
              >
                <Text style={[styles.moodDotText, isActive && { color: '#fff' }]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </PremiumCard>

      {/* Energy Level */}
      <PremiumCard style={styles.card}>
        {renderScaleSelector('Energy Level', 'energy', energyLevel, setEnergyLevel)}
      </PremiumCard>

      {/* Detailed fields (hidden in quick mode) */}
      {!quickMode && (
        <>
          {/* Anxiety */}
          <PremiumCard style={styles.card}>
            {renderScaleSelector('Anxiety Level', 'anxiety', anxietyLevel, setAnxietyLevel)}
            <View style={styles.scaleDivider} />
            {renderScaleSelector('Stress Level', 'stress', stressLevel, setStressLevel)}
            <View style={styles.scaleDivider} />
            {renderScaleSelector('Mental Clarity', 'clarity', mentalClarity, setMentalClarity)}
          </PremiumCard>

          {/* Emotions */}
          <PremiumCard style={styles.card}>
            {renderCollapsibleHeader('Emotions', emotionsExpanded, () => toggleCollapsible(setEmotionsExpanded))}
            {emotionsExpanded && (
              <>
                <Text style={styles.sectionSubtitle}>Positive</Text>
                {renderPillGrid(
                  MOOD_EMOTION_OPTIONS.filter((o) => o.valence === 'positive'),
                  emotions,
                  setEmotions,
                )}
                <Text style={[styles.sectionSubtitle, { marginTop: 12 }]}>Negative</Text>
                {renderPillGrid(
                  MOOD_EMOTION_OPTIONS.filter((o) => o.valence === 'negative'),
                  emotions,
                  setEmotions,
                )}
              </>
            )}
          </PremiumCard>

          {/* Triggers */}
          <PremiumCard style={styles.card}>
            {renderCollapsibleHeader('Triggers', triggersExpanded, () => toggleCollapsible(setTriggersExpanded))}
            {triggersExpanded && (
              <>
                {renderPillGrid(MOOD_TRIGGER_OPTIONS, triggers, setTriggers)}
                {triggers.includes('other') && (
                  <TextInput
                    style={[styles.textInput, { marginTop: 8 }]}
                    value={triggerOtherText}
                    onChangeText={(t) => setTriggerOtherText(t.slice(0, 100))}
                    placeholder="Describe other trigger..."
                    placeholderTextColor={Colors.divider}
                  />
                )}
              </>
            )}
          </PremiumCard>

          {/* Coping Strategies */}
          <PremiumCard style={styles.card}>
            {renderCollapsibleHeader('Coping Strategies', copingExpanded, () => toggleCollapsible(setCopingExpanded))}
            {copingExpanded && (
              <>
                {renderPillGrid(COPING_STRATEGY_OPTIONS, copingUsed, setCopingUsed)}
                {copingUsed.includes('other') && (
                  <TextInput
                    style={[styles.textInput, { marginTop: 8 }]}
                    value={copingOtherText}
                    onChangeText={(t) => setCopingOtherText(t.slice(0, 100))}
                    placeholder="Describe other coping strategy..."
                    placeholderTextColor={Colors.divider}
                  />
                )}
              </>
            )}
          </PremiumCard>
        </>
      )}

      {/* Sleep quality (optional) */}
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>Sleep Quality Last Night</Text>
        <Text style={styles.helperText}>Skip if already logged in Sleep tracker</Text>
        <View style={styles.scaleRow}>
          {[1, 2, 3, 4, 5].map((n) => {
            const isActive = sleepQuality === n;
            const color = n <= 2 ? '#EF5350' : n === 3 ? '#FF9800' : '#4CAF50';
            return (
              <TouchableOpacity
                key={n}
                style={[styles.scaleDot, isActive && { backgroundColor: color, borderColor: color }]}
                onPress={() => { hapticSelection(); setSleepQuality(sleepQuality === n ? null : n); }}
              >
                <Text style={[styles.scaleDotText, isActive && { color: '#fff' }]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {sleepQuality != null && (
          <Text style={styles.sleepLabel}>{SCALE_LABELS.sleep[sleepQuality - 1]}</Text>
        )}
      </PremiumCard>

      {/* Notes */}
      {!quickMode && (
        <PremiumCard style={styles.card}>
          <Text style={styles.cardTitle}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={(t) => setNotes(t.slice(0, 500))}
            placeholder="Optional notes..."
            placeholderTextColor={Colors.divider}
            multiline
            maxLength={500}
          />
          <Text style={styles.charCount}>{notes.length}/500</Text>
        </PremiumCard>
      )}

      {/* Save */}
      <View style={styles.saveRow}>
        <PremiumButton
          label={existingEntry ? 'Update Entry' : 'Save Entry'}
          onPress={handleSave}
          variant="primary"
          size="large"
        />
      </View>

      {/* 988 Crisis Support — ALWAYS visible, never hidden */}
      <CrisisSupport988 />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  card: { marginTop: 12 },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  helperText: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 4,
  },

  // Quick mode
  quickModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickModeText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },

  // Mood row (1-10)
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  moodDot: {
    width: 32,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodDotText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },

  // Scale
  scaleSection: { marginBottom: 4 },
  scaleLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  scaleValue: {
    color: Colors.accentText,
    fontWeight: '600',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  scaleDot: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotText: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  scaleDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 12,
  },
  sleepLabel: {
    color: Colors.accentText,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },

  // Collapsible
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Pill grid
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  pillActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
  },
  pillText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  pillTextActive: {
    color: Colors.accentText,
  },

  // Input
  textInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: Colors.secondaryText,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },

  // Save
  saveRow: {
    marginTop: 20,
  },
});
