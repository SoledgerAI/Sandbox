// Sprint 21: Perimenopause Symptom Logger
// Daily entry with hot flashes, night sweats, mood shifts,
// sleep disruption, brain fog, joint pain, energy

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import type {
  PerimenopauseEntry,
  PerimenopauseSeverity,
  JointPainArea,
  HotFlashEntry,
} from '../../types';
import { JOINT_PAIN_AREAS } from '../../types';

const SEVERITY_OPTIONS: { value: PerimenopauseSeverity; label: string; color: string }[] = [
  { value: 'mild', label: 'Mild', color: '#4CAF50' },
  { value: 'moderate', label: 'Moderate', color: '#FF9800' },
  { value: 'severe', label: 'Severe', color: '#EF5350' },
];

const SCALE_LABELS: Record<string, string[]> = {
  mood_shifts: ['Stable', 'Slight', 'Moderate', 'Variable', 'Highly variable'],
  sleep_disruption: ['None', 'Mild', 'Moderate', 'Significant', 'Severe'],
  brain_fog: ['Clear', 'Mild', 'Moderate', 'Significant', 'Severe'],
  joint_pain: ['None', 'Mild', 'Moderate', 'Significant', 'Severe'],
  energy_level: ['Exhausted', 'Low', 'Moderate', 'Good', 'Energized'],
};

export function PerimenopauseLogger() {
  const { showToast } = useToast();
  const today = getActiveDate();

  const [hotFlashCount, setHotFlashCount] = useState(0);
  const [hotFlashes, setHotFlashes] = useState<HotFlashEntry[]>([]);
  const [nightSweats, setNightSweats] = useState(false);
  const [nightSweatsSeverity, setNightSweatsSeverity] = useState<PerimenopauseSeverity | null>(null);
  const [moodShifts, setMoodShifts] = useState(1);
  const [sleepDisruption, setSleepDisruption] = useState(1);
  const [brainFog, setBrainFog] = useState(1);
  const [jointPain, setJointPain] = useState(1);
  const [jointPainAreas, setJointPainAreas] = useState<JointPainArea[]>([]);
  const [cycleIrregularityDays, setCycleIrregularityDays] = useState<string>('');
  const [energyLevel, setEnergyLevel] = useState(3);
  const [notes, setNotes] = useState('');
  const [existingEntry, setExistingEntry] = useState<PerimenopauseEntry | null>(null);

  // Load existing entry for today
  useEffect(() => {
    (async () => {
      const key = dateKey(STORAGE_KEYS.LOG_PERIMENOPAUSE, today);
      const existing = await storageGet<PerimenopauseEntry>(key);
      if (existing) {
        setExistingEntry(existing);
        setHotFlashCount(existing.hot_flashes_count);
        setHotFlashes(existing.hot_flashes);
        setNightSweats(existing.night_sweats);
        setNightSweatsSeverity(existing.night_sweats_severity);
        setMoodShifts(existing.mood_shifts);
        setSleepDisruption(existing.sleep_disruption);
        setBrainFog(existing.brain_fog);
        setJointPain(existing.joint_pain);
        setJointPainAreas(existing.joint_pain_areas);
        setCycleIrregularityDays(existing.cycle_irregularity_days?.toString() ?? '');
        setEnergyLevel(existing.energy_level);
        setNotes(existing.notes ?? '');
      }
    })();
  }, [today]);

  // Sync hot flash entries with count
  useEffect(() => {
    if (hotFlashCount > hotFlashes.length) {
      const newFlashes = [...hotFlashes];
      while (newFlashes.length < hotFlashCount) {
        newFlashes.push({ severity: 'moderate' });
      }
      setHotFlashes(newFlashes);
    } else if (hotFlashCount < hotFlashes.length) {
      setHotFlashes(hotFlashes.slice(0, hotFlashCount));
    }
  }, [hotFlashCount]);

  const toggleJointPainArea = useCallback((area: JointPainArea) => {
    hapticSelection();
    setJointPainAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }, []);

  const updateHotFlashSeverity = useCallback((index: number, severity: PerimenopauseSeverity) => {
    hapticSelection();
    setHotFlashes((prev) => {
      const updated = [...prev];
      updated[index] = { severity };
      return updated;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const key = dateKey(STORAGE_KEYS.LOG_PERIMENOPAUSE, today);
    const entry: PerimenopauseEntry = {
      id: existingEntry?.id ?? `peri_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      date: today,
      hot_flashes_count: hotFlashCount,
      hot_flashes: hotFlashes,
      night_sweats: nightSweats,
      night_sweats_severity: nightSweats ? nightSweatsSeverity : null,
      mood_shifts: moodShifts,
      sleep_disruption: sleepDisruption,
      brain_fog: brainFog,
      joint_pain: jointPain,
      joint_pain_areas: jointPain > 1 ? jointPainAreas : [],
      cycle_irregularity_days: cycleIrregularityDays ? parseInt(cycleIrregularityDays, 10) : null,
      energy_level: energyLevel,
      notes: notes.trim() || null,
    };
    await storageSet(key, entry);
    hapticSuccess();
    showToast('Perimenopause entry saved', 'success');
  }, [
    today, existingEntry, hotFlashCount, hotFlashes,
    nightSweats, nightSweatsSeverity, moodShifts, sleepDisruption,
    brainFog, jointPain, jointPainAreas, cycleIrregularityDays,
    energyLevel, notes, showToast,
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
        <Text style={styles.scaleLabel}>{label}: <Text style={styles.scaleValue}>{labels[value - 1]} ({value}/5)</Text></Text>
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hot Flashes */}
      <PremiumCard>
        <Text style={styles.cardTitle}>Hot Flashes</Text>
        <View style={styles.counterRow}>
          <TouchableOpacity
            style={styles.counterBtn}
            onPress={() => { hapticSelection(); setHotFlashCount(Math.max(0, hotFlashCount - 1)); }}
          >
            <Ionicons name="remove-circle-outline" size={28} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={styles.counterValue}>{hotFlashCount}</Text>
          <TouchableOpacity
            style={styles.counterBtn}
            onPress={() => { hapticSelection(); setHotFlashCount(Math.min(20, hotFlashCount + 1)); }}
          >
            <Ionicons name="add-circle-outline" size={28} color={Colors.accent} />
          </TouchableOpacity>
        </View>
        {hotFlashes.map((flash, i) => (
          <View key={i} style={styles.flashRow}>
            <Text style={styles.flashLabel}>Flash {i + 1}:</Text>
            <View style={styles.severityRow}>
              {SEVERITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.severityPill,
                    flash.severity === opt.value && { backgroundColor: opt.color, borderColor: opt.color },
                  ]}
                  onPress={() => updateHotFlashSeverity(i, opt.value)}
                >
                  <Text style={[styles.severityText, flash.severity === opt.value && { color: '#fff' }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </PremiumCard>

      {/* Night Sweats */}
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>Night Sweats</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !nightSweats && styles.toggleBtnActive]}
            onPress={() => { hapticSelection(); setNightSweats(false); }}
          >
            <Text style={[styles.toggleText, !nightSweats && styles.toggleTextActive]}>No</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, nightSweats && styles.toggleBtnActive]}
            onPress={() => { hapticSelection(); setNightSweats(true); }}
          >
            <Text style={[styles.toggleText, nightSweats && styles.toggleTextActive]}>Yes</Text>
          </TouchableOpacity>
        </View>
        {nightSweats && (
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.severityPill,
                  nightSweatsSeverity === opt.value && { backgroundColor: opt.color, borderColor: opt.color },
                ]}
                onPress={() => { hapticSelection(); setNightSweatsSeverity(opt.value); }}
              >
                <Text style={[styles.severityText, nightSweatsSeverity === opt.value && { color: '#fff' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </PremiumCard>

      {/* Scales */}
      <PremiumCard style={styles.card}>
        {renderScaleSelector('Mood Shifts', 'mood_shifts', moodShifts, setMoodShifts)}
        <View style={styles.scaleDivider} />
        {renderScaleSelector('Sleep Disruption', 'sleep_disruption', sleepDisruption, setSleepDisruption)}
        <View style={styles.scaleDivider} />
        {renderScaleSelector('Brain Fog', 'brain_fog', brainFog, setBrainFog)}
        <View style={styles.scaleDivider} />
        {renderScaleSelector('Energy Level', 'energy_level', energyLevel, setEnergyLevel)}
      </PremiumCard>

      {/* Joint Pain */}
      <PremiumCard style={styles.card}>
        {renderScaleSelector('Joint Pain', 'joint_pain', jointPain, setJointPain)}
        {jointPain > 1 && (
          <View style={styles.areaGrid}>
            {JOINT_PAIN_AREAS.map((area) => {
              const isSelected = jointPainAreas.includes(area.value);
              return (
                <TouchableOpacity
                  key={area.value}
                  style={[styles.areaPill, isSelected && styles.areaPillActive]}
                  onPress={() => toggleJointPainArea(area.value)}
                >
                  <Text style={[styles.areaPillText, isSelected && styles.areaPillTextActive]}>
                    {area.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </PremiumCard>

      {/* Cycle Irregularity */}
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>Cycle Irregularity</Text>
        <Text style={styles.helperText}>Days since last period (leave blank if unknown)</Text>
        <TextInput
          style={styles.textInput}
          value={cycleIrregularityDays}
          onChangeText={(t) => setCycleIrregularityDays(t.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 45"
          placeholderTextColor={Colors.divider}
          keyboardType="number-pad"
          maxLength={4}
        />
      </PremiumCard>

      {/* Notes */}
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

      <View style={styles.saveRow}>
        <PremiumButton
          label={existingEntry ? 'Update Entry' : 'Save Entry'}
          onPress={handleSave}
          variant="primary"
          size="large"
        />
      </View>

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

  // Counter
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  counterBtn: { padding: 4 },
  counterValue: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: 'bold',
    minWidth: 48,
    textAlign: 'center',
  },

  // Flash severity
  flashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  flashLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    width: 60,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  severityPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  severityText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  toggleBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
  },
  toggleText: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.accentText,
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

  // Joint pain areas
  areaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  areaPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  areaPillActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
  },
  areaPillText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  areaPillTextActive: {
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
