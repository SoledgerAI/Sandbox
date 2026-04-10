// Sprint 21: Breastfeeding Logger
// Track nursing, pumping, and bottle sessions with running timer

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { hapticSuccess, hapticSelection, hapticLight } from '../../utils/haptics';
import { useToast } from '../../contexts/ToastContext';
import type { BreastfeedingEntry, BreastfeedingType, NursingSide, VolumeUnit } from '../../types';

const TYPE_OPTIONS: { value: BreastfeedingType; label: string; icon: string }[] = [
  { value: 'nursing', label: 'Nursing', icon: 'heart-outline' },
  { value: 'pumping', label: 'Pumping', icon: 'water-outline' },
  { value: 'bottle', label: 'Bottle', icon: 'flask-outline' },
];

const SIDE_OPTIONS: { value: NursingSide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
];

export function BreastfeedingLogger() {
  const { showToast } = useToast();
  const today = getActiveDate();

  const [type, setType] = useState<BreastfeedingType>('nursing');
  const [side, setSide] = useState<NursingSide>('left');
  const [durationMinutes, setDurationMinutes] = useState('15');
  const [outputAmount, setOutputAmount] = useState('');
  const [outputUnit, setOutputUnit] = useState<VolumeUnit>('oz');
  const [bottleAmount, setBottleAmount] = useState('');
  const [bottleUnit, setBottleUnit] = useState<VolumeUnit>('oz');
  const [notes, setNotes] = useState('');

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0); // seconds
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Today's sessions
  const [sessions, setSessions] = useState<BreastfeedingEntry[]>([]);

  // Load existing sessions
  useEffect(() => {
    (async () => {
      const key = dateKey(STORAGE_KEYS.LOG_BREASTFEEDING, today);
      const existing = await storageGet<BreastfeedingEntry[]>(key);
      setSessions(existing ?? []);
    })();
  }, [today]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && timerStart) {
      timerRef.current = setInterval(() => {
        setTimerElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerStart]);

  const startTimer = useCallback(() => {
    hapticLight();
    const now = new Date();
    setTimerStart(now);
    setTimerRunning(true);
    setTimerElapsed(0);
  }, []);

  const stopTimer = useCallback(() => {
    hapticLight();
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    // Auto-fill duration
    const minutes = Math.max(1, Math.round(timerElapsed / 60));
    setDurationMinutes(String(minutes));
  }, [timerElapsed]);

  const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSave = useCallback(async () => {
    const duration = parseInt(durationMinutes, 10);
    if (!duration || duration < 1) {
      showToast('Duration must be at least 1 minute', 'error');
      return;
    }

    const key = dateKey(STORAGE_KEYS.LOG_BREASTFEEDING, today);
    const entry: BreastfeedingEntry = {
      id: `bf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      type,
      side: type === 'nursing' ? side : null,
      duration_minutes: duration,
      output_amount: type === 'pumping' && outputAmount ? parseFloat(outputAmount) : null,
      output_unit: type === 'pumping' && outputAmount ? outputUnit : null,
      bottle_amount: type === 'bottle' && bottleAmount ? parseFloat(bottleAmount) : null,
      bottle_unit: type === 'bottle' && bottleAmount ? bottleUnit : null,
      timer_start: timerStart?.toISOString() ?? null,
      timer_end: timerRunning ? null : (timerStart ? new Date().toISOString() : null),
      notes: notes.trim() || null,
    };

    const existing = await storageGet<BreastfeedingEntry[]>(key) ?? [];
    await storageSet(key, [...existing, entry]);
    setSessions([...existing, entry]);

    hapticSuccess();
    showToast('Session logged', 'success');

    // Reset form
    setDurationMinutes('15');
    setOutputAmount('');
    setBottleAmount('');
    setNotes('');
    setTimerStart(null);
    setTimerElapsed(0);
    setTimerRunning(false);
  }, [today, type, side, durationMinutes, outputAmount, outputUnit, bottleAmount, bottleUnit, notes, timerStart, timerRunning, showToast]);

  // Daily summary
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((s, e) => s + e.duration_minutes, 0);
  const totalOutput = sessions
    .filter((e) => e.output_amount != null)
    .reduce((s, e) => s + (e.output_amount ?? 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Quick Log Buttons */}
      <PremiumCard>
        <Text style={styles.cardTitle}>New Session</Text>
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.typeBtn, type === opt.value && styles.typeBtnActive]}
              onPress={() => { hapticSelection(); setType(opt.value); }}
            >
              <Ionicons name={opt.icon as any} size={20} color={type === opt.value ? Colors.accent : Colors.secondaryText} />
              <Text style={[styles.typeLabel, type === opt.value && styles.typeLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Side (nursing only) */}
        {type === 'nursing' && (
          <View style={styles.sideRow}>
            {SIDE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sideBtn, side === opt.value && styles.sideBtnActive]}
                onPress={() => { hapticSelection(); setSide(opt.value); }}
              >
                <Text style={[styles.sideLabel, side === opt.value && styles.sideLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Timer */}
        <View style={styles.timerSection}>
          <Text style={styles.timerLabel}>Timer</Text>
          <Text style={styles.timerDisplay}>{formatTimer(timerElapsed)}</Text>
          <View style={styles.timerBtnRow}>
            {!timerRunning ? (
              <PremiumButton label="Start" onPress={startTimer} variant="primary" size="medium" />
            ) : (
              <PremiumButton label="Stop" onPress={stopTimer} variant="danger" size="medium" />
            )}
          </View>
        </View>

        {/* Duration */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Duration (min)</Text>
          <TextInput
            style={styles.fieldInput}
            value={durationMinutes}
            onChangeText={(t) => setDurationMinutes(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        {/* Output (pumping) */}
        {type === 'pumping' && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Output ({outputUnit})</Text>
            <TextInput
              style={styles.fieldInput}
              value={outputAmount}
              onChangeText={(t) => setOutputAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.divider}
            />
            <TouchableOpacity
              style={styles.unitToggle}
              onPress={() => { hapticSelection(); setOutputUnit(outputUnit === 'oz' ? 'ml' : 'oz'); }}
            >
              <Text style={styles.unitText}>{outputUnit}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottle amount */}
        {type === 'bottle' && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Amount ({bottleUnit})</Text>
            <TextInput
              style={styles.fieldInput}
              value={bottleAmount}
              onChangeText={(t) => setBottleAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.divider}
            />
            <TouchableOpacity
              style={styles.unitToggle}
              onPress={() => { hapticSelection(); setBottleUnit(bottleUnit === 'oz' ? 'ml' : 'oz'); }}
            >
              <Text style={styles.unitText}>{bottleUnit}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notes */}
        <TextInput
          style={[styles.notesInput]}
          value={notes}
          onChangeText={(t) => setNotes(t.slice(0, 300))}
          placeholder="Notes (optional)"
          placeholderTextColor={Colors.divider}
          multiline
          maxLength={300}
        />

        <View style={styles.saveRow}>
          <PremiumButton label="Log Session" onPress={handleSave} variant="primary" size="large" />
        </View>
      </PremiumCard>

      {/* Daily Summary */}
      {totalSessions > 0 && (
        <PremiumCard style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Today's Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalSessions}</Text>
              <Text style={styles.summaryLabel}>Sessions</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalDuration}</Text>
              <Text style={styles.summaryLabel}>Total min</Text>
            </View>
            {totalOutput > 0 && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalOutput.toFixed(1)}</Text>
                <Text style={styles.summaryLabel}>oz pumped</Text>
              </View>
            )}
          </View>

          {/* Session Timeline */}
          <View style={styles.timeline}>
            {sessions.map((session, i) => (
              <View key={session.id} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: session.type === 'nursing' ? '#4CAF50' : session.type === 'pumping' ? '#42A5F5' : '#FF9800' }]} />
                <Text style={styles.timelineText}>
                  {new Date(session.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {' — '}
                  {session.type}{session.side ? ` (${session.side})` : ''}, {session.duration_minutes}min
                  {session.output_amount ? `, ${session.output_amount}${session.output_unit}` : ''}
                  {session.bottle_amount ? `, ${session.bottle_amount}${session.bottle_unit}` : ''}
                </Text>
              </View>
            ))}
          </View>
        </PremiumCard>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Type selector
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  typeBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
  },
  typeLabel: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  typeLabelActive: {
    color: Colors.accentText,
  },

  // Side selector
  sideRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  sideBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
  },
  sideLabel: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  sideLabelActive: {
    color: Colors.accentText,
  },

  // Timer
  timerSection: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  timerLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  timerDisplay: {
    color: Colors.text,
    fontSize: 40,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginBottom: 12,
  },
  timerBtnRow: {
    width: 140,
  },

  // Fields
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  fieldLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    width: 110,
  },
  fieldInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unitToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  unitText: {
    color: Colors.accentText,
    fontSize: 14,
    fontWeight: '600',
  },

  // Notes
  notesInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },

  saveRow: { marginTop: 4 },

  // Summary
  summaryCard: { marginTop: 16 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: Colors.accentText,
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },

  // Timeline
  timeline: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.divider,
    marginLeft: 8,
    paddingLeft: 16,
    gap: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    left: -21,
  },
  timelineText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
});
