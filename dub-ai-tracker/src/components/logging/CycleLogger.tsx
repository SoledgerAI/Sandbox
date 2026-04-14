// Sprint 24: Enhanced Cycle Logger
// Calendar view, quick/full log, symptoms with severity, predictions, privacy-aware

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, HealthColors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type {
  CycleEntryV2,
  PeriodStatus,
  FlowScale,
  CycleSymptom,
  CycleSymptomEntry,
  CervicalMucusType,
  OvulationTestResult,
  CrampSeverity,
  CyclePrediction,
} from '../../types';
import {
  CYCLE_SYMPTOM_OPTIONS,
  CERVICAL_MUCUS_OPTIONS,
} from '../../types';
import type { UserProfile } from '../../types/profile';
import { PremiumCard } from '../common/PremiumCard';
import { hapticSelection, hapticSuccess } from '../../utils/haptics';
import { getActiveDate } from '../../services/dateContextService';
import {
  getCyclePredictions,
  getPeriodStartDates,
  getCurrentCycleDay,
  buildMiniCalendar,
} from '../../utils/cyclePredictions';

try {
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
} catch {
  // Platform may not be available in test environment
}

const PERIOD_STATUS_OPTIONS: { value: PeriodStatus; label: string; color: string }[] = [
  { value: 'started', label: 'Started', color: '#D04040' },
  { value: 'ongoing', label: 'Ongoing', color: '#E07070' },
  { value: 'ended', label: 'Ended', color: '#4CAF50' },
  { value: 'spotting', label: 'Spotting', color: '#E8A0A0' },
  { value: 'none', label: 'None', color: Colors.secondaryText },
];

const FLOW_LABELS: Record<FlowScale, string> = {
  1: 'Light',
  2: 'Medium',
  3: 'Heavy',
  4: 'Very Heavy',
  5: 'Flooding',
};

const FLOW_COLORS: Record<FlowScale, string> = {
  1: '#E8A0A0',
  2: '#E07070',
  3: '#D04040',
  4: '#B02020',
  5: '#8B0000',
};

const OVULATION_OPTIONS: { value: OvulationTestResult; label: string }[] = [
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'not_taken', label: 'Not Taken' },
];

const CRAMP_SEVERITY_OPTIONS: { value: CrampSeverity; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

function makeDefaultEntry(date: string): CycleEntryV2 {
  return {
    date,
    period_status: 'none',
    flow_level: null,
    symptoms: [],
    cervical_mucus: null,
    basal_body_temp: null,
    basal_body_temp_unit: null,
    intimacy: null,
    ovulation_test: null,
    notes: null,
  };
}

export function CycleLogger() {
  const [entry, setEntry] = useState<CycleEntryV2 | null>(null);
  const [notes, setNotes] = useState('');
  const [showFullLog, setShowFullLog] = useState(false);
  const [bbtText, setBbtText] = useState('');
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [calendarDays, setCalendarDays] = useState<Array<{
    date: string;
    isPeriodDay: boolean;
    isPredictedPeriod: boolean;
    isFertileWindow: boolean;
    isToday: boolean;
  }>>([]);
  const [userSex, setUserSex] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [crampSeverity, setCrampSeverity] = useState<CrampSeverity | null>(null);
  const [otherSymptomText, setOtherSymptomText] = useState('');

  const loadData = useCallback(async () => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_CYCLE, today);
    const stored = await storageGet<CycleEntryV2>(key);

    if (stored) {
      // Migrate legacy entries
      const migrated: CycleEntryV2 = {
        date: today,
        period_status: stored.period_status ?? 'none',
        flow_level: stored.flow_level ?? null,
        symptoms: stored.symptoms ?? [],
        cervical_mucus: stored.cervical_mucus ?? null,
        basal_body_temp: stored.basal_body_temp ?? null,
        basal_body_temp_unit: stored.basal_body_temp_unit ?? null,
        intimacy: stored.intimacy ?? null,
        ovulation_test: stored.ovulation_test ?? null,
        notes: stored.notes ?? null,
      };
      setEntry(migrated);
      setNotes(migrated.notes ?? '');
      if (migrated.basal_body_temp != null) {
        setBbtText(String(migrated.basal_body_temp));
      }
      // Load cramp severity from symptoms
      const crampEntry = migrated.symptoms.find((s) => s.symptom === 'cramps');
      if (crampEntry?.severity) setCrampSeverity(crampEntry.severity);
      const otherEntry = migrated.symptoms.find((s) => s.symptom === 'other');
      if (otherEntry?.other_text) setOtherSymptomText(otherEntry.other_text);
      setSaved(true);
    } else {
      setEntry(makeDefaultEntry(today));
    }

    // Load predictions
    const pred = await getCyclePredictions();
    setPrediction(pred);

    // Load cycle day
    const starts = await getPeriodStartDates();
    const day = getCurrentCycleDay(starts, today);
    setCycleDay(day);

    // Load mini calendar
    const cal = await buildMiniCalendar(today);
    setCalendarDays(cal);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load user sex
  useEffect(() => {
    storageGet<UserProfile>(STORAGE_KEYS.PROFILE).then((p) => {
      setUserSex(p?.sex ?? null);
    });
  }, []);

  const saveEntry = useCallback(async (updated: CycleEntryV2) => {
    const today = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_CYCLE, today);
    await storageSet(key, updated);
    setEntry(updated);
    setSaved(true);
  }, []);

  // Male info card
  if (userSex === 'male') {
    return (
      <View style={styles.maleInfoCard}>
        <Ionicons name="information-circle-outline" size={24} color={Colors.accent} />
        <Text style={styles.maleInfoText}>
          This category tracks menstrual cycles. You can disable it in Settings {'>'} Categories.
        </Text>
        <TouchableOpacity
          style={styles.maleInfoBtn}
          onPress={() => router.push('/settings/categories' as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.maleInfoBtnText}>Go to Categories</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!entry) return null;

  const setPeriodStatus = (status: PeriodStatus) => {
    hapticSelection();
    const updated = {
      ...entry,
      period_status: status,
      flow_level: (status === 'started' || status === 'ongoing') ? entry.flow_level : null,
    };
    saveEntry(updated);
  };

  const setFlowLevel = (level: FlowScale) => {
    hapticSelection();
    saveEntry({ ...entry, flow_level: level });
  };

  const toggleSymptom = (symptom: CycleSymptom) => {
    hapticSelection();
    const existing = entry.symptoms.find((s) => s.symptom === symptom);
    let newSymptoms: CycleSymptomEntry[];
    if (existing) {
      newSymptoms = entry.symptoms.filter((s) => s.symptom !== symptom);
    } else {
      newSymptoms = [
        ...entry.symptoms,
        {
          symptom,
          severity: symptom === 'cramps' ? crampSeverity : null,
          other_text: symptom === 'other' ? otherSymptomText || null : null,
        },
      ];
    }
    saveEntry({ ...entry, symptoms: newSymptoms });
  };

  const updateCrampSeverity = (severity: CrampSeverity) => {
    hapticSelection();
    setCrampSeverity(severity);
    const newSymptoms = entry.symptoms.map((s) =>
      s.symptom === 'cramps' ? { ...s, severity } : s,
    );
    saveEntry({ ...entry, symptoms: newSymptoms });
  };

  const setCervicalMucus = (mucus: CervicalMucusType) => {
    hapticSelection();
    saveEntry({ ...entry, cervical_mucus: mucus });
  };

  const saveBBT = () => {
    const val = parseFloat(bbtText);
    if (!isNaN(val) && val > 90 && val < 110) {
      saveEntry({ ...entry, basal_body_temp: val, basal_body_temp_unit: 'F' });
    } else if (!isNaN(val) && val > 35 && val < 42) {
      saveEntry({ ...entry, basal_body_temp: val, basal_body_temp_unit: 'C' });
    }
  };

  const setOvulation = (result: OvulationTestResult) => {
    hapticSelection();
    saveEntry({ ...entry, ovulation_test: result });
  };

  const toggleIntimacy = () => {
    hapticSelection();
    saveEntry({ ...entry, intimacy: entry.intimacy ? null : true });
  };

  const saveNotes = () => {
    const trimmed = notes.trim().slice(0, 500) || null;
    saveEntry({ ...entry, notes: trimmed });
  };

  const toggleFullLog = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowFullLog(!showFullLog);
  };

  const hasSymptom = (symptom: CycleSymptom) => entry.symptoms.some((s) => s.symptom === symptom);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mini Calendar */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Cycle Calendar</Text>
        {cycleDay != null && (
          <Text style={styles.cycleDayText}>Cycle Day {cycleDay}</Text>
        )}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day) => (
            <View
              key={day.date}
              style={[
                styles.calendarDay,
                day.isPeriodDay && styles.calendarPeriodDay,
                day.isPredictedPeriod && !day.isPeriodDay && styles.calendarPredictedDay,
                day.isFertileWindow && !day.isPeriodDay && styles.calendarFertileDay,
                day.isToday && styles.calendarToday,
              ]}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  day.isPeriodDay && styles.calendarPeriodDayText,
                  day.isToday && styles.calendarTodayText,
                ]}
              >
                {parseInt(day.date.split('-')[2], 10)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D04040' }]} />
            <Text style={styles.legendText}>Period</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D04040', opacity: 0.4 }]} />
            <Text style={styles.legendText}>Predicted</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Fertile</Text>
          </View>
        </View>
      </PremiumCard>

      {/* Prediction Info */}
      {prediction && (
        <PremiumCard>
          <Text style={styles.sectionTitle}>Predictions</Text>
          <View style={styles.predictionRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.accentText} />
            <Text style={styles.predictionText}>
              Next period: ~{prediction.next_period_start}
            </Text>
          </View>
          <View style={styles.predictionRow}>
            <Ionicons name="leaf-outline" size={16} color={Colors.successText} />
            <Text style={styles.predictionText}>
              Fertile window: {prediction.fertile_window_start} to {prediction.fertile_window_end}
            </Text>
          </View>
          <Text style={styles.predictionMeta}>
            Based on {prediction.cycles_analyzed} cycle{prediction.cycles_analyzed !== 1 ? 's' : ''} | Avg length: {prediction.average_cycle_length} days
          </Text>
        </PremiumCard>
      )}

      {/* Quick Log: Period Status + Flow */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Period Status</Text>
        <View style={styles.statusRow}>
          {PERIOD_STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.statusBtn,
                entry.period_status === opt.value && {
                  backgroundColor: opt.color,
                  borderColor: opt.color,
                },
              ]}
              onPress={() => setPeriodStatus(opt.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.statusBtnText,
                  entry.period_status === opt.value && styles.statusBtnTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Flow level — only when started/ongoing */}
        {(entry.period_status === 'started' || entry.period_status === 'ongoing') && (
          <>
            <Text style={styles.subLabel}>Flow Level</Text>
            <View style={styles.flowRow}>
              {([1, 2, 3, 4, 5] as FlowScale[]).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.flowBtn,
                    entry.flow_level === level && {
                      backgroundColor: FLOW_COLORS[level],
                      borderColor: FLOW_COLORS[level],
                    },
                  ]}
                  onPress={() => setFlowLevel(level)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.flowBtnText,
                      entry.flow_level === level && styles.flowBtnTextActive,
                    ]}
                  >
                    {FLOW_LABELS[level]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </PremiumCard>

      {/* Symptoms */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Symptoms</Text>
        <View style={styles.symptomGrid}>
          {CYCLE_SYMPTOM_OPTIONS.map((opt) => {
            const selected = hasSymptom(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.symptomBtn, selected && styles.symptomBtnActive]}
                onPress={() => toggleSymptom(opt.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={16}
                  color={selected ? Colors.primaryBackground : Colors.secondaryText}
                />
                <Text style={[styles.symptomText, selected && styles.symptomTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cramp severity — only when cramps selected */}
        {hasSymptom('cramps') && (
          <View style={styles.severityRow}>
            <Text style={styles.subLabel}>Cramp Severity</Text>
            <View style={styles.severityBtns}>
              {CRAMP_SEVERITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.severityBtn,
                    crampSeverity === opt.value && styles.severityBtnActive,
                  ]}
                  onPress={() => updateCrampSeverity(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.severityBtnText,
                      crampSeverity === opt.value && styles.severityBtnTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Other symptom text */}
        {hasSymptom('other') && (
          <TextInput
            style={styles.otherInput}
            value={otherSymptomText}
            onChangeText={setOtherSymptomText}
            onBlur={() => {
              const newSymptoms = entry.symptoms.map((s) =>
                s.symptom === 'other' ? { ...s, other_text: otherSymptomText.trim() || null } : s,
              );
              saveEntry({ ...entry, symptoms: newSymptoms });
            }}
            placeholder="Describe other symptom..."
            placeholderTextColor={Colors.secondaryText}
            maxLength={200}
          />
        )}
      </PremiumCard>

      {/* Expand for full log */}
      <TouchableOpacity style={styles.expandBtn} onPress={toggleFullLog} activeOpacity={0.7}>
        <Ionicons
          name={showFullLog ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.accentText}
        />
        <Text style={styles.expandText}>
          {showFullLog ? 'Hide advanced tracking' : 'Show advanced tracking'}
        </Text>
      </TouchableOpacity>

      {showFullLog && (
        <>
          {/* Cervical Mucus */}
          <PremiumCard>
            <Text style={styles.sectionTitle}>Cervical Mucus</Text>
            <View style={styles.mucusRow}>
              {CERVICAL_MUCUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.mucusBtn,
                    entry.cervical_mucus === opt.value && styles.mucusBtnActive,
                  ]}
                  onPress={() => setCervicalMucus(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.mucusBtnText,
                      entry.cervical_mucus === opt.value && styles.mucusBtnTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </PremiumCard>

          {/* Basal Body Temperature */}
          <PremiumCard>
            <Text style={styles.sectionTitle}>Basal Body Temperature</Text>
            <View style={styles.bbtRow}>
              <TextInput
                style={styles.bbtInput}
                value={bbtText}
                onChangeText={setBbtText}
                onBlur={saveBBT}
                placeholder="e.g., 98.6"
                placeholderTextColor={Colors.secondaryText}
                keyboardType="decimal-pad"
                maxLength={5}
              />
              <Text style={styles.bbtUnit}>
                {entry.basal_body_temp_unit === 'C' ? 'C' : 'F'}
              </Text>
            </View>
          </PremiumCard>

          {/* Ovulation Test */}
          <PremiumCard>
            <Text style={styles.sectionTitle}>Ovulation Test</Text>
            <View style={styles.ovulationRow}>
              {OVULATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.ovulationBtn,
                    entry.ovulation_test === opt.value && styles.ovulationBtnActive,
                  ]}
                  onPress={() => setOvulation(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.ovulationBtnText,
                      entry.ovulation_test === opt.value && styles.ovulationBtnTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </PremiumCard>

          {/* Intimacy — private toggle */}
          <PremiumCard>
            <View style={styles.intimacyRow}>
              <View style={styles.intimacyInfo}>
                <Text style={styles.sectionTitle}>Intimacy</Text>
                <Text style={styles.privateLabel}>
                  <Ionicons name="lock-closed" size={11} color={Colors.secondaryText} /> Private — never shared with Coach
                </Text>
              </View>
              <Switch
                value={entry.intimacy === true}
                onValueChange={toggleIntimacy}
                trackColor={{ false: Colors.elevated, true: Colors.accent }}
                thumbColor={entry.intimacy ? '#FFFFFF' : Colors.secondaryText}
              />
            </View>
          </PremiumCard>
        </>
      )}

      {/* Notes */}
      <PremiumCard>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          onBlur={saveNotes}
          placeholder="Any additional notes (max 500 characters)..."
          placeholderTextColor={Colors.secondaryText}
          multiline
          numberOfLines={3}
          maxLength={500}
        />
      </PremiumCard>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="warning-outline" size={16} color={Colors.warning} />
        <Text style={styles.disclaimerText}>
          Predictions are estimates based on your history. Not a substitute for medical advice
          or contraception. Consult your healthcare provider for family planning guidance.
        </Text>
      </View>

      {saved && (
        <View style={styles.savedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.successText} />
          <Text style={styles.savedText}>Auto-saved</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  // Male info card
  maleInfoCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 24,
    margin: 16,
    alignItems: 'center',
    gap: 12,
  },
  maleInfoText: { color: Colors.secondaryText, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  maleInfoBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  maleInfoBtnText: { color: Colors.primaryBackground, fontSize: 14, fontWeight: '600' },

  // Section
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  subLabel: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500', marginTop: 12, marginBottom: 6 },

  // Cycle day
  cycleDayText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },

  // Calendar grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  calendarDay: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: Colors.elevated,
  },
  calendarPeriodDay: { backgroundColor: '#D04040' },
  calendarPredictedDay: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D04040',
    borderStyle: 'dashed',
  },
  calendarFertileDay: { backgroundColor: 'rgba(76, 175, 80, 0.25)' },
  calendarToday: { borderWidth: 2, borderColor: Colors.accent },
  calendarDayText: { color: Colors.secondaryText, fontSize: 12, fontVariant: ['tabular-nums'] },
  calendarPeriodDayText: { color: '#FFF', fontWeight: '600' },
  calendarTodayText: { color: Colors.accentText, fontWeight: '700' },

  // Legend
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.secondaryText, fontSize: 11 },

  // Predictions
  predictionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  predictionText: { color: Colors.text, fontSize: 14 },
  predictionMeta: { color: Colors.secondaryText, fontSize: 11, marginTop: 4 },

  // Period status
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  statusBtnText: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500' },
  statusBtnTextActive: { color: '#FFF' },

  // Flow level
  flowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  flowBtnText: { color: Colors.secondaryText, fontSize: 12, fontWeight: '500' },
  flowBtnTextActive: { color: '#FFF' },

  // Symptoms
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.elevated,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  symptomBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  symptomText: { color: Colors.secondaryText, fontSize: 12, fontWeight: '500' },
  symptomTextActive: { color: Colors.primaryBackground },

  // Severity
  severityRow: { marginTop: 8 },
  severityBtns: { flexDirection: 'row', gap: 8 },
  severityBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  severityBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  severityBtnText: { color: Colors.secondaryText, fontSize: 12, fontWeight: '500' },
  severityBtnTextActive: { color: Colors.primaryBackground },

  // Other symptom input
  otherInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginTop: 8,
  },

  // Expand button
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
  },
  expandText: { color: Colors.accentText, fontSize: 13, fontWeight: '500' },

  // Cervical mucus
  mucusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mucusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  mucusBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  mucusBtnText: { color: Colors.secondaryText, fontSize: 12, fontWeight: '500' },
  mucusBtnTextActive: { color: Colors.primaryBackground },

  // BBT
  bbtRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bbtInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    fontVariant: ['tabular-nums'],
  },
  bbtUnit: { color: Colors.secondaryText, fontSize: 16, fontWeight: '600' },

  // Ovulation test
  ovulationRow: { flexDirection: 'row', gap: 8 },
  ovulationBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  ovulationBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  ovulationBtnText: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500' },
  ovulationBtnTextActive: { color: Colors.primaryBackground },

  // Intimacy
  intimacyRow: { flexDirection: 'row', alignItems: 'center' },
  intimacyInfo: { flex: 1 },
  privateLabel: { color: Colors.secondaryText, fontSize: 11, marginTop: -4 },

  // Notes
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
  },

  // Disclaimer
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    marginTop: 8,
  },
  disclaimerText: { color: Colors.secondaryText, fontSize: 11, flex: 1, lineHeight: 16 },

  // Saved badge
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  savedText: { color: Colors.successText, fontSize: 12 },
});
