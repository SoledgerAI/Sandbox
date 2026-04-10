// Social Connection logging — Sprint 19
// Type picker, who field, duration, quality 1-5, weekly summary

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
import type { SocialConnectionEntry, SocialConnectionType } from '../../types';
import { SOCIAL_CONNECTION_TYPES } from '../../types';
import { TimestampPicker } from '../common/TimestampPicker';
import { getActiveDate } from '../../services/dateContextService';

const QUALITY_LABELS = ['', 'Drained', 'Low', 'Neutral', 'Good', 'Energized'];

function generateId(): string {
  return `soc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface SocialConnectionLoggerProps {
  onEntryLogged?: () => void;
}

export function SocialConnectionLogger({ onEntryLogged }: SocialConnectionLoggerProps) {
  const [entries, setEntries] = useState<SocialConnectionEntry[]>([]);
  const [selectedType, setSelectedType] = useState<SocialConnectionType>('in_person');
  const [who, setWho] = useState('');
  const [duration, setDuration] = useState('');
  const [quality, setQuality] = useState(3);
  const [timestamp, setTimestamp] = useState(new Date());
  const [weeklyCount, setWeeklyCount] = useState(0);

  const loadData = useCallback(async () => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SOCIAL, activeDate);
    const stored = await storageGet<SocialConnectionEntry[]>(key);
    setEntries(stored ?? []);

    // Weekly count
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayKey = dateKey(STORAGE_KEYS.LOG_SOCIAL, dateStr);
      const dayData = dateStr === activeDate ? stored : await storageGet<SocialConnectionEntry[]>(dayKey);
      count += (dayData ?? []).length;
    }
    setWeeklyCount(count);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logConnection = useCallback(async () => {
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur < 5 || dur > 480) {
      Alert.alert('Invalid Duration', 'Please enter 5-480 minutes.');
      return;
    }

    const newEntry: SocialConnectionEntry = {
      id: generateId(),
      timestamp: timestamp.toISOString(),
      type: selectedType,
      who: who.trim() || null,
      duration_minutes: dur,
      quality,
      notes: null,
    };

    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SOCIAL, activeDate);
    const updated = [...entries, newEntry];
    await storageSet(key, updated);
    setEntries(updated);
    setDuration('');
    setWho('');
    setQuality(3);
    onEntryLogged?.();
  }, [duration, selectedType, who, quality, entries, onEntryLogged, timestamp]);

  const deleteEntry = useCallback(async (id: string) => {
    const activeDate = getActiveDate();
    const key = dateKey(STORAGE_KEYS.LOG_SOCIAL, activeDate);
    const updated = entries.filter((e) => e.id !== id);
    await storageSet(key, updated);
    setEntries(updated);
  }, [entries]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Weekly summary */}
      {weeklyCount > 0 && (
        <View style={styles.weeklyBar}>
          <Ionicons name="people-outline" size={20} color={Colors.accent} />
          <Text style={styles.weeklyText}>{weeklyCount} meaningful connection{weeklyCount !== 1 ? 's' : ''} this week</Text>
        </View>
      )}

      <TimestampPicker value={timestamp} onChange={setTimestamp} />

      {/* Type selector */}
      <Text style={styles.sectionTitle}>Connection Type</Text>
      <View style={styles.typeGrid}>
        {SOCIAL_CONNECTION_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeBtn, selectedType === t.value && styles.typeBtnActive]}
            onPress={() => setSelectedType(t.value)}
          >
            <Ionicons
              name={t.icon as any}
              size={22}
              color={selectedType === t.value ? Colors.primaryBackground : Colors.secondaryText}
            />
            <Text style={[styles.typeLabel, selectedType === t.value && styles.typeLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Who */}
      <Text style={styles.sectionTitle}>Who (optional, first name only)</Text>
      <TextInput
        style={styles.input}
        value={who}
        onChangeText={setWho}
        placeholder="e.g. Sarah"
        placeholderTextColor={Colors.secondaryText}
        maxLength={30}
      />

      {/* Duration */}
      <Text style={styles.sectionTitle}>Duration (minutes)</Text>
      <View style={styles.durationRow}>
        {[15, 30, 60, 120].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.durationBtn, duration === String(d) && styles.durationBtnActive]}
            onPress={() => setDuration(String(d))}
          >
            <Text style={[styles.durationText, duration === String(d) && styles.durationTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={duration}
        onChangeText={setDuration}
        placeholder="Or enter custom (5-480)"
        placeholderTextColor={Colors.secondaryText}
        keyboardType="number-pad"
      />

      {/* Quality */}
      <Text style={styles.sectionTitle}>Quality</Text>
      <View style={styles.qualityRow}>
        {[1, 2, 3, 4, 5].map((q) => (
          <TouchableOpacity
            key={q}
            style={[styles.qualityBtn, quality === q && (q >= 4 ? styles.qualityBtnHigh : styles.qualityBtnActive)]}
            onPress={() => setQuality(q)}
          >
            <Text style={[styles.qualityNum, quality === q && styles.qualityNumActive]}>{q}</Text>
            <Text style={[styles.qualityLabel, quality === q && styles.qualityLabelActive]}>{QUALITY_LABELS[q]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Log button */}
      <TouchableOpacity
        style={[styles.logBtn, !duration && styles.logBtnDisabled]}
        onPress={logConnection}
        disabled={!duration}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.logBtnText}>Log Connection</Text>
      </TouchableOpacity>

      {/* Today's entries */}
      {entries.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Today's Connections</Text>
          {entries.map((e) => {
            const typeLabel = SOCIAL_CONNECTION_TYPES.find((t) => t.value === e.type)?.label ?? e.type;
            const isHighQuality = e.quality >= 4;
            return (
              <View key={e.id} style={[styles.entryCard, isHighQuality && styles.entryCardHighlight]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryType}>
                    {typeLabel}{e.who ? ` with ${e.who}` : ''} — {e.duration_minutes} min
                  </Text>
                  <Text style={styles.entryDetail}>
                    Quality: {QUALITY_LABELS[e.quality]} ({e.quality}/5)
                    {isHighQuality ? ' \u2B50' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteEntry(e.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  weeklyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  weeklyText: { color: Colors.accentText, fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typeLabel: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500' },
  typeLabelActive: { color: Colors.primaryBackground },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 20,
  },
  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  durationBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  durationBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  durationText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  durationTextActive: { color: Colors.primaryBackground },
  qualityRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  qualityBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  qualityBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  qualityBtnHigh: { backgroundColor: '#D4A843', borderColor: '#D4A843' },
  qualityNum: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  qualityNumActive: { color: Colors.primaryBackground },
  qualityLabel: { color: Colors.secondaryText, fontSize: 9, marginTop: 2 },
  qualityLabelActive: { color: Colors.primaryBackground },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText: { color: Colors.primaryBackground, fontSize: 17, fontWeight: '700' },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  entryCardHighlight: { borderLeftWidth: 3, borderLeftColor: '#D4A843' },
  entryType: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  entryDetail: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
});
