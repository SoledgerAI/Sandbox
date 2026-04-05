// Cycle logger -- period logging, auto-computed cycle phases
// Phase 13: Supplements, Personal Care, and Remaining Tags

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  storageList,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { CycleEntry, FlowLevel, PeriodSymptom, CyclePhase } from '../../types';
import { useLastEntry } from '../../hooks/useLastEntry';
import { RepeatLastEntry } from './RepeatLastEntry';
import { todayDateString } from '../../utils/dayBoundary';


const FLOW_OPTIONS: { value: FlowLevel; label: string; color: string }[] = [
  { value: 'spotting', label: 'Spotting', color: '#E8A0A0' },
  { value: 'light', label: 'Light', color: '#E07070' },
  { value: 'medium', label: 'Medium', color: '#D04040' },
  { value: 'heavy', label: 'Heavy', color: '#B02020' },
];

const SYMPTOM_OPTIONS: { value: PeriodSymptom; label: string; icon: string }[] = [
  { value: 'cramps', label: 'Cramps', icon: 'flash-outline' },
  { value: 'bloating', label: 'Bloating', icon: 'water-outline' },
  { value: 'headache', label: 'Headache', icon: 'alert-circle-outline' },
  { value: 'fatigue', label: 'Fatigue', icon: 'bed-outline' },
  { value: 'mood_changes', label: 'Mood Changes', icon: 'happy-outline' },
];

const PHASE_INFO: Record<CyclePhase, { label: string; color: string; description: string }> = {
  menstrual: { label: 'Menstrual', color: '#D04040', description: 'Days 1-5 typical' },
  follicular: { label: 'Follicular', color: '#4CAF50', description: 'Post-menstruation, energy rising' },
  ovulation: { label: 'Ovulation', color: '#FF9800', description: 'Peak energy window' },
  luteal: { label: 'Luteal', color: '#7E57C2', description: 'Pre-menstrual phase' },
};

function computeCyclePhase(cycleDay: number, menstrualLength: number = 5): CyclePhase {
  // Sequential display per spec: Menstrual -> Follicular -> Ovulation -> Luteal
  if (cycleDay <= menstrualLength) return 'menstrual';
  if (cycleDay <= 13) return 'follicular';
  if (cycleDay <= 15) return 'ovulation';
  return 'luteal';
}

export function CycleLogger() {
  const [entry, setEntry] = useState<CycleEntry>({
    period_start: null,
    flow_level: null,
    symptoms: [],
    computed_phase: null,
    cycle_day: null,
    notes: null,
  });
  const [notes, setNotes] = useState('');
  const [isPeriodDay, setIsPeriodDay] = useState(false);
  const [lastPeriodStart, setLastPeriodStart] = useState<string | null>(null);

  const { lastEntry, loading: lastEntryLoading, saveAsLast } = useLastEntry<CycleEntry>('womens.health');

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_CYCLE, today);
    const stored = await storageGet<CycleEntry>(key);
    if (stored) {
      setEntry(stored);
      setNotes(stored.notes ?? '');
      setIsPeriodDay(stored.period_start !== null || stored.flow_level !== null);
    }

    // Find last period start from recent logs
    const cycleKeys = await storageList(STORAGE_KEYS.LOG_CYCLE);
    const sortedKeys = cycleKeys.sort().reverse();
    for (const k of sortedKeys) {
      const data = await storageGet<CycleEntry>(k);
      if (data?.period_start) {
        setLastPeriodStart(data.period_start);
        // Compute cycle day
        const start = new Date(data.period_start);
        const now = new Date(today);
        const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 0 && diffDays <= 35) {
          const phase = computeCyclePhase(diffDays);
          if (!stored) {
            setEntry((prev) => ({ ...prev, computed_phase: phase, cycle_day: diffDays }));
          }
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveEntry = useCallback(async (updated: CycleEntry) => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_CYCLE, today);
    await storageSet(key, updated);
    setEntry(updated);
    await saveAsLast(updated);
  }, [saveAsLast]);

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    const updated = {
      ...entry,
      flow_level: lastEntry.flow_level,
      symptoms: lastEntry.symptoms ?? [],
    };
    if (lastEntry.flow_level) setIsPeriodDay(true);
    saveEntry(updated);
  }, [lastEntry, entry, saveEntry]);

  const togglePeriodDay = () => {
    const newVal = !isPeriodDay;
    setIsPeriodDay(newVal);
    if (newVal) {
      const today = todayDateString();
      const updated = {
        ...entry,
        period_start: lastPeriodStart ?? today,
        cycle_day: 1,
        computed_phase: 'menstrual' as CyclePhase,
      };
      // If no prior period start, this is day 1
      if (!lastPeriodStart) {
        updated.period_start = today;
      }
      saveEntry(updated);
    } else {
      saveEntry({ ...entry, period_start: null, flow_level: null });
    }
  };

  const markPeriodStart = () => {
    const today = todayDateString();
    const updated = {
      ...entry,
      period_start: today,
      cycle_day: 1,
      computed_phase: 'menstrual' as CyclePhase,
    };
    setLastPeriodStart(today);
    setIsPeriodDay(true);
    saveEntry(updated);
  };

  const setFlow = (flow: FlowLevel) => {
    saveEntry({ ...entry, flow_level: flow });
  };

  const toggleSymptom = (symptom: PeriodSymptom) => {
    const symptoms = entry.symptoms.includes(symptom)
      ? entry.symptoms.filter((s) => s !== symptom)
      : [...entry.symptoms, symptom];
    saveEntry({ ...entry, symptoms });
  };

  const saveNotes = () => {
    saveEntry({ ...entry, notes: notes.trim() || null });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <RepeatLastEntry
        tagLabel="cycle"
        subtitle={lastEntry?.flow_level ?? lastEntry?.computed_phase ?? undefined}
        visible={!lastEntryLoading && lastEntry !== null}
        onRepeat={handleRepeatLast}
      />

      {/* Current phase display */}
      {entry.computed_phase && (
        <View style={[styles.phaseCard, { borderColor: PHASE_INFO[entry.computed_phase].color }]}>
          <Text style={[styles.phaseLabel, { color: PHASE_INFO[entry.computed_phase].color }]}>
            {PHASE_INFO[entry.computed_phase].label} Phase
          </Text>
          {entry.cycle_day && (
            <Text style={styles.cycleDay}>Cycle Day {entry.cycle_day}</Text>
          )}
          <Text style={styles.phaseDesc}>{PHASE_INFO[entry.computed_phase].description}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.secondaryText} />
            <Text style={styles.infoText}>
              The follicular phase technically begins at the start of your period, but we display
              it after menstruation for clarity.
            </Text>
          </View>
        </View>
      )}

      {/* Period start button */}
      <TouchableOpacity style={styles.periodBtn} onPress={markPeriodStart} activeOpacity={0.7}>
        <Ionicons name="calendar" size={20} color={Colors.primaryBackground} />
        <Text style={styles.periodBtnText}>Mark Period Start (Day 1)</Text>
      </TouchableOpacity>

      {/* Period day toggle */}
      <TouchableOpacity style={styles.checkRow} onPress={togglePeriodDay} activeOpacity={0.7}>
        <Ionicons
          name={isPeriodDay ? 'checkbox' : 'square-outline'}
          size={22}
          color={isPeriodDay ? Colors.accent : Colors.secondaryText}
        />
        <Text style={styles.checkLabel}>Period day</Text>
      </TouchableOpacity>

      {/* Flow level */}
      {isPeriodDay && (
        <>
          <Text style={styles.sectionTitle}>Flow Level</Text>
          <View style={styles.flowRow}>
            {FLOW_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.flowBtn,
                  entry.flow_level === opt.value && { backgroundColor: opt.color, borderColor: opt.color },
                ]}
                onPress={() => setFlow(opt.value)}
              >
                <Text
                  style={[
                    styles.flowText,
                    entry.flow_level === opt.value && { color: '#FFF' },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Symptoms */}
      <Text style={styles.sectionTitle}>Symptoms</Text>
      <View style={styles.symptomGrid}>
        {SYMPTOM_OPTIONS.map((opt) => {
          const selected = entry.symptoms.includes(opt.value);
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.symptomBtn, selected && styles.symptomBtnActive]}
              onPress={() => toggleSymptom(opt.value)}
            >
              <Ionicons
                name={opt.icon as any}
                size={18}
                color={selected ? Colors.primaryBackground : Colors.secondaryText}
              />
              <Text style={[styles.symptomText, selected && styles.symptomTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        onBlur={saveNotes}
        placeholder="Any additional notes..."
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={3}
      />

      {/* Fertility disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.secondaryText} />
        <Text style={styles.disclaimerText}>
          This is an estimate based on your cycle data. It is not a medical fertility assessment.
          This should not be used as a method of contraception. Consult your healthcare provider
          for family planning guidance.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  phaseCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  phaseLabel: { fontSize: 20, fontWeight: 'bold' },
  cycleDay: { color: Colors.text, fontSize: 16, marginTop: 4, fontVariant: ['tabular-nums'] },
  phaseDesc: { color: Colors.secondaryText, fontSize: 13, marginTop: 4 },
  infoRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 8,
  },
  infoText: { color: Colors.secondaryText, fontSize: 11, flex: 1, lineHeight: 16 },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 12,
  },
  periodBtnText: { color: Colors.primaryBackground, fontSize: 16, fontWeight: '700' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  checkLabel: { color: Colors.text, fontSize: 14 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  flowRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  flowBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  flowText: { color: Colors.secondaryText, fontSize: 12, fontWeight: '600' },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  symptomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  symptomBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  symptomText: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500' },
  symptomTextActive: { color: Colors.primaryBackground },
  notesInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
  },
  disclaimerText: { color: Colors.secondaryText, fontSize: 11, flex: 1, lineHeight: 16 },
});
