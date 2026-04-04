// Blood pressure logging component
// Systolic/diastolic (mmHg), optional pulse, position, arm, timing, notes
// Reference bands per AHA/ACC 2017 guidelines

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
import type { BloodPressureEntry, BPPosition, BPArm, BPTiming } from '../../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const TIMING_OPTIONS: { value: BPTiming; label: string }[] = [
  { value: 'morning_before_meds', label: 'Morning (before meds)' },
  { value: 'morning_after_meds', label: 'Morning (after meds)' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'before_exercise', label: 'Before exercise' },
  { value: 'after_exercise', label: 'After exercise' },
];

const POSITION_OPTIONS: { value: BPPosition; label: string }[] = [
  { value: 'sitting', label: 'Sitting' },
  { value: 'standing', label: 'Standing' },
  { value: 'lying_down', label: 'Lying down' },
];

const ARM_OPTIONS: { value: BPArm; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

type BPStage = 'normal' | 'elevated' | 'stage_1' | 'stage_2' | 'crisis';

interface StageResult {
  stage: BPStage;
  label: string;
  color: string;
  bold: boolean;
  crisisMessage: string | null;
}

function getBPStage(systolic: number, diastolic: number): StageResult {
  // Crisis check first — takes precedence
  if (systolic >= 180 || diastolic >= 120) {
    return {
      stage: 'crisis',
      label: 'Hypertensive Crisis',
      color: '#EF5350',
      bold: true,
      crisisMessage: 'Contact your doctor immediately or call 911 if you have symptoms.',
    };
  }

  // Use HIGHER stage of systolic vs diastolic classification
  const systolicStage = getSystolicStage(systolic);
  const diastolicStage = getDiastolicStage(diastolic);
  const stageOrder: BPStage[] = ['normal', 'elevated', 'stage_1', 'stage_2'];
  const sIdx = stageOrder.indexOf(systolicStage);
  const dIdx = stageOrder.indexOf(diastolicStage);
  const finalStage = sIdx >= dIdx ? systolicStage : diastolicStage;

  const stageMap: Record<BPStage, Omit<StageResult, 'stage'>> = {
    normal: { label: 'Normal', color: '#4CAF50', bold: false, crisisMessage: null },
    elevated: { label: 'Elevated', color: '#FFC107', bold: false, crisisMessage: null },
    stage_1: { label: 'Stage 1 Hypertension', color: '#FF9800', bold: false, crisisMessage: null },
    stage_2: { label: 'Stage 2 Hypertension', color: '#EF5350', bold: false, crisisMessage: null },
    crisis: { label: 'Hypertensive Crisis', color: '#EF5350', bold: true, crisisMessage: null },
  };

  return { stage: finalStage, ...stageMap[finalStage] };
}

function getSystolicStage(sys: number): BPStage {
  if (sys < 120) return 'normal';
  if (sys < 130) return 'elevated';
  if (sys < 140) return 'stage_1';
  return 'stage_2';
}

function getDiastolicStage(dia: number): BPStage {
  if (dia < 80) return 'normal';
  if (dia < 90) return 'stage_1';
  return 'stage_2';
}

interface BloodPressureLoggerProps {
  onEntryLogged?: () => void;
}

export function BloodPressureLogger({ onEntryLogged }: BloodPressureLoggerProps) {
  const [entries, setEntries] = useState<BloodPressureEntry[]>([]);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [position, setPosition] = useState<BPPosition | null>(null);
  const [arm, setArm] = useState<BPArm | null>(null);
  const [timing, setTiming] = useState<BPTiming | null>(null);
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const stored = await storageGet<BloodPressureEntry[]>(dateKey(STORAGE_KEYS.LOG_BP, today));
    setEntries(stored ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sysNum = parseFloat(systolic);
  const diaNum = parseFloat(diastolic);
  const pulseNum = pulse ? parseFloat(pulse) : null;
  const isValidSys = !isNaN(sysNum) && sysNum > 0;
  const isValidDia = !isNaN(diaNum) && diaNum > 0;
  const isValidReading = isValidSys && isValidDia;

  const sysOutOfRange = isValidSys && (sysNum < 60 || sysNum > 250);
  const diaOutOfRange = isValidDia && (diaNum < 30 || diaNum > 150);
  const pulseOutOfRange = pulseNum != null && !isNaN(pulseNum) && (pulseNum < 30 || pulseNum > 220);
  const anyOutOfRange = sysOutOfRange || diaOutOfRange || pulseOutOfRange;

  const stageResult = isValidReading ? getBPStage(sysNum, diaNum) : null;

  const logBP = useCallback(async () => {
    if (!isValidReading) return;

    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BP, today);

    const entry: BloodPressureEntry = {
      id: `bp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      systolic: sysNum,
      diastolic: diaNum,
      pulse_bpm: pulseNum != null && !isNaN(pulseNum) && pulseNum > 0 ? pulseNum : null,
      position,
      arm,
      timing,
      notes: notes.trim() || null,
    };

    const updated = [...entries, entry];
    await storageSet(key, updated);
    setEntries(updated);
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setNotes('');
    onEntryLogged?.();
  }, [entries, sysNum, diaNum, pulseNum, position, arm, timing, notes, isValidReading, onEntryLogged]);

  const deleteEntry = useCallback(
    async (id: string) => {
      const today = todayDateString();
      const key = dateKey(STORAGE_KEYS.LOG_BP, today);
      const updated = entries.filter((e) => e.id !== id);
      await storageSet(key, updated);
      setEntries(updated);
    },
    [entries],
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Systolic / Diastolic inputs */}
      <Text style={styles.sectionTitle}>Blood Pressure (mmHg)</Text>
      <View style={styles.bpRow}>
        <View style={styles.bpInputWrap}>
          <Text style={styles.bpLabel}>Systolic</Text>
          <TextInput
            style={styles.bpInput}
            value={systolic}
            onChangeText={setSystolic}
            placeholder="120"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="numeric"
            accessibilityLabel="Systolic blood pressure in millimeters of mercury"
          />
        </View>
        <Text style={styles.bpSlash}>/</Text>
        <View style={styles.bpInputWrap}>
          <Text style={styles.bpLabel}>Diastolic</Text>
          <TextInput
            style={styles.bpInput}
            value={diastolic}
            onChangeText={setDiastolic}
            placeholder="80"
            placeholderTextColor={Colors.secondaryText}
            keyboardType="numeric"
            accessibilityLabel="Diastolic blood pressure in millimeters of mercury"
          />
        </View>
      </View>

      {/* Pulse (optional) */}
      <Text style={styles.sectionTitle}>Pulse (optional, bpm)</Text>
      <TextInput
        style={styles.pulseInput}
        value={pulse}
        onChangeText={setPulse}
        placeholder="72"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="numeric"
        accessibilityLabel="Pulse rate in beats per minute"
      />

      {/* Out-of-range warning */}
      {anyOutOfRange && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={16} color="#FFC107" />
          <Text style={styles.warningText}>
            {sysOutOfRange && 'Systolic outside typical range (60-250). '}
            {diaOutOfRange && 'Diastolic outside typical range (30-150). '}
            {pulseOutOfRange && 'Pulse outside typical range (30-220). '}
            Entry will still save.
          </Text>
        </View>
      )}

      {/* Stage indicator */}
      {stageResult && (
        <View style={[styles.rangeBand, { borderLeftColor: stageResult.color }]}>
          <View style={[styles.rangeDot, { backgroundColor: stageResult.color }]} />
          <View style={styles.rangeLabelWrap}>
            <Text
              style={[
                styles.rangeLabel,
                { color: stageResult.color },
                stageResult.bold && styles.rangeLabelBold,
              ]}
              accessibilityRole="text"
            >
              {stageResult.label}
            </Text>
            {stageResult.crisisMessage && (
              <Text style={styles.crisisMessage} accessibilityRole="alert">
                {stageResult.crisisMessage}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Timing selector */}
      <Text style={styles.sectionTitle}>Timing (optional)</Text>
      <View style={styles.chipGrid}>
        {TIMING_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, timing === opt.value && styles.chipActive]}
            onPress={() => setTiming(timing === opt.value ? null : opt.value)}
            accessibilityLabel={opt.label}
            accessibilityRole="radio"
          >
            <Text style={[styles.chipLabel, timing === opt.value && styles.chipLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Position selector */}
      <Text style={styles.sectionTitle}>Position (optional)</Text>
      <View style={styles.chipGrid}>
        {POSITION_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, position === opt.value && styles.chipActive]}
            onPress={() => setPosition(position === opt.value ? null : opt.value)}
            accessibilityLabel={opt.label}
            accessibilityRole="radio"
          >
            <Text style={[styles.chipLabel, position === opt.value && styles.chipLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Arm selector */}
      <Text style={styles.sectionTitle}>Arm (optional)</Text>
      <View style={styles.chipGrid}>
        {ARM_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, arm === opt.value && styles.chipActive]}
            onPress={() => setArm(arm === opt.value ? null : opt.value)}
            accessibilityLabel={opt.label}
            accessibilityRole="radio"
          >
            <Text style={[styles.chipLabel, arm === opt.value && styles.chipLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
        onPress={logBP}
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
              const entryStage = getBPStage(entry.systolic, entry.diastolic);
              const timingLabel = entry.timing
                ? TIMING_OPTIONS.find((t) => t.value === entry.timing)?.label ?? entry.timing
                : null;
              return (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={[styles.entryDot, { backgroundColor: entryStage.color }]} />
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryReading}>
                      {entry.systolic}/{entry.diastolic} mmHg
                      {entry.pulse_bpm != null ? ` (${entry.pulse_bpm} bpm)` : ''}
                    </Text>
                    <Text style={styles.entryStage}>
                      {entryStage.label}
                      {timingLabel ? ` — ${timingLabel}` : ''}
                    </Text>
                    {entryStage.crisisMessage && (
                      <Text style={styles.entryCrisis}>{entryStage.crisisMessage}</Text>
                    )}
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
  bpRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 16,
  },
  bpInputWrap: {
    flex: 1,
  },
  bpLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 4,
  },
  bpInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Colors.divider,
    textAlign: 'center',
  },
  bpSlash: {
    color: Colors.secondaryText,
    fontSize: 28,
    fontWeight: '300',
    paddingBottom: 10,
  },
  pulseInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: Colors.divider,
    textAlign: 'center',
    marginBottom: 12,
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
    alignItems: 'flex-start',
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
    marginTop: 3,
  },
  rangeLabelWrap: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rangeLabelBold: {
    fontSize: 16,
    fontWeight: '800',
  },
  crisisMessage: {
    color: '#EF5350',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  chipLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  chipLabelActive: {
    color: Colors.accentText,
    fontWeight: '600',
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
  entryStage: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  entryCrisis: {
    color: '#EF5350',
    fontSize: 12,
    fontWeight: '600',
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
