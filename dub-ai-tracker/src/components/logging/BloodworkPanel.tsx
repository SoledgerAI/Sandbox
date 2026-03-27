// Bloodwork panel entry -- full panel with reference range flagging
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  storageGet,
  storageSet,
  STORAGE_KEYS,
  dateKey,
} from '../../utils/storage';
import type { BloodworkEntry, BloodworkMarker } from '../../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface MarkerTemplate {
  name: string;
  unit: string;
  defaultLow: number | null;
  defaultHigh: number | null;
}

interface PanelCategory {
  name: string;
  markers: MarkerTemplate[];
}

const PANEL_CATEGORIES: PanelCategory[] = [
  {
    name: 'CBC',
    markers: [
      { name: 'WBC', unit: 'K/uL', defaultLow: 4.5, defaultHigh: 11.0 },
      { name: 'RBC', unit: 'M/uL', defaultLow: 4.5, defaultHigh: 5.5 },
      { name: 'Hemoglobin', unit: 'g/dL', defaultLow: 12.0, defaultHigh: 17.5 },
      { name: 'Hematocrit', unit: '%', defaultLow: 36, defaultHigh: 51 },
      { name: 'Platelets', unit: 'K/uL', defaultLow: 150, defaultHigh: 400 },
    ],
  },
  {
    name: 'Metabolic',
    markers: [
      { name: 'Glucose (fasting)', unit: 'mg/dL', defaultLow: 70, defaultHigh: 100 },
      { name: 'A1C', unit: '%', defaultLow: null, defaultHigh: 5.7 },
      { name: 'BUN', unit: 'mg/dL', defaultLow: 7, defaultHigh: 20 },
      { name: 'Creatinine', unit: 'mg/dL', defaultLow: 0.6, defaultHigh: 1.2 },
      { name: 'eGFR', unit: 'mL/min', defaultLow: 60, defaultHigh: null },
      { name: 'Sodium', unit: 'mEq/L', defaultLow: 136, defaultHigh: 145 },
      { name: 'Potassium', unit: 'mEq/L', defaultLow: 3.5, defaultHigh: 5.0 },
      { name: 'Chloride', unit: 'mEq/L', defaultLow: 96, defaultHigh: 106 },
      { name: 'CO2', unit: 'mEq/L', defaultLow: 23, defaultHigh: 29 },
      { name: 'Calcium', unit: 'mg/dL', defaultLow: 8.5, defaultHigh: 10.5 },
      { name: 'Total Protein', unit: 'g/dL', defaultLow: 6.0, defaultHigh: 8.3 },
      { name: 'Albumin', unit: 'g/dL', defaultLow: 3.5, defaultHigh: 5.5 },
      { name: 'Bilirubin', unit: 'mg/dL', defaultLow: 0.1, defaultHigh: 1.2 },
      { name: 'ALT', unit: 'U/L', defaultLow: 7, defaultHigh: 56 },
      { name: 'AST', unit: 'U/L', defaultLow: 10, defaultHigh: 40 },
      { name: 'ALP', unit: 'U/L', defaultLow: 44, defaultHigh: 147 },
    ],
  },
  {
    name: 'Lipids',
    markers: [
      { name: 'Total Cholesterol', unit: 'mg/dL', defaultLow: null, defaultHigh: 200 },
      { name: 'LDL', unit: 'mg/dL', defaultLow: null, defaultHigh: 100 },
      { name: 'HDL', unit: 'mg/dL', defaultLow: 40, defaultHigh: null },
      { name: 'Triglycerides', unit: 'mg/dL', defaultLow: null, defaultHigh: 150 },
      { name: 'VLDL', unit: 'mg/dL', defaultLow: 2, defaultHigh: 30 },
    ],
  },
  {
    name: 'Thyroid',
    markers: [
      { name: 'TSH', unit: 'mIU/L', defaultLow: 0.4, defaultHigh: 4.0 },
      { name: 'Free T3', unit: 'pg/mL', defaultLow: 2.0, defaultHigh: 4.4 },
      { name: 'Free T4', unit: 'ng/dL', defaultLow: 0.8, defaultHigh: 1.8 },
    ],
  },
  {
    name: 'Hormones',
    markers: [
      { name: 'Testosterone (Total)', unit: 'ng/dL', defaultLow: 264, defaultHigh: 916 },
      { name: 'Testosterone (Free)', unit: 'pg/mL', defaultLow: 8.7, defaultHigh: 25.1 },
      { name: 'Estradiol', unit: 'pg/mL', defaultLow: null, defaultHigh: null },
      { name: 'DHEA-S', unit: 'mcg/dL', defaultLow: null, defaultHigh: null },
      { name: 'Cortisol', unit: 'mcg/dL', defaultLow: 6, defaultHigh: 23 },
    ],
  },
  {
    name: 'Vitamins & Minerals',
    markers: [
      { name: 'Vitamin D (25-OH)', unit: 'ng/mL', defaultLow: 30, defaultHigh: 100 },
      { name: 'Vitamin B12', unit: 'pg/mL', defaultLow: 200, defaultHigh: 900 },
      { name: 'Folate', unit: 'ng/mL', defaultLow: 2.7, defaultHigh: 17.0 },
      { name: 'Iron', unit: 'mcg/dL', defaultLow: 60, defaultHigh: 170 },
      { name: 'Ferritin', unit: 'ng/mL', defaultLow: 12, defaultHigh: 300 },
      { name: 'TIBC', unit: 'mcg/dL', defaultLow: 250, defaultHigh: 400 },
    ],
  },
  {
    name: 'Inflammation',
    markers: [
      { name: 'CRP', unit: 'mg/L', defaultLow: null, defaultHigh: 3.0 },
      { name: 'ESR', unit: 'mm/hr', defaultLow: null, defaultHigh: 20 },
      { name: 'Homocysteine', unit: 'umol/L', defaultLow: null, defaultHigh: 15 },
    ],
  },
];

export function BloodworkPanel() {
  const [labName, setLabName] = useState('');
  const [notes, setNotes] = useState('');
  const [markerValues, setMarkerValues] = useState<Record<string, string>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>('CBC');
  const [savedEntry, setSavedEntry] = useState<BloodworkEntry | null>(null);

  const loadData = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BLOODWORK, today);
    const stored = await storageGet<BloodworkEntry>(key);
    if (stored) {
      setSavedEntry(stored);
      setLabName(stored.lab_name ?? '');
      setNotes(stored.notes ?? '');
      const vals: Record<string, string> = {};
      stored.markers.forEach((m) => {
        vals[m.name] = String(m.value);
      });
      setMarkerValues(vals);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const savePanel = useCallback(async () => {
    const today = todayDateString();
    const key = dateKey(STORAGE_KEYS.LOG_BLOODWORK, today);

    const markers: BloodworkMarker[] = [];

    for (const cat of PANEL_CATEGORIES) {
      for (const template of cat.markers) {
        const valStr = markerValues[template.name];
        if (!valStr || valStr.trim() === '') continue;
        const val = parseFloat(valStr);
        if (isNaN(val)) continue;

        const low = template.defaultLow;
        const high = template.defaultHigh;
        const flagged =
          (low !== null && val < low) || (high !== null && val > high);

        markers.push({
          name: template.name,
          value: val,
          unit: template.unit,
          reference_range_low: low,
          reference_range_high: high,
          flagged,
        });
      }
    }

    if (markers.length === 0) {
      Alert.alert('No Data', 'Please enter at least one marker value.');
      return;
    }

    const entry: BloodworkEntry = {
      date: today,
      lab_name: labName.trim() || null,
      markers,
      notes: notes.trim() || null,
    };

    await storageSet(key, entry);
    setSavedEntry(entry);
    Alert.alert('Saved', `${markers.length} marker(s) saved.`);
  }, [markerValues, labName, notes]);

  const setMarkerValue = (name: string, value: string) => {
    setMarkerValues((prev) => ({ ...prev, [name]: value }));
  };

  const flaggedCount = savedEntry?.markers.filter((m) => m.flagged).length ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Summary */}
      {savedEntry && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{savedEntry.markers.length}</Text>
          <Text style={styles.summaryLabel}>markers entered</Text>
          {flaggedCount > 0 && (
            <View style={styles.flagRow}>
              <Ionicons name="warning" size={16} color={Colors.warning} />
              <Text style={styles.flagText}>{flaggedCount} outside reference range</Text>
            </View>
          )}
        </View>
      )}

      {/* Lab name */}
      <Text style={styles.sectionTitle}>Lab Information</Text>
      <TextInput
        style={styles.input}
        value={labName}
        onChangeText={setLabName}
        placeholder="Lab name (optional)"
        placeholderTextColor={Colors.secondaryText}
      />

      {/* Panel categories */}
      {PANEL_CATEGORIES.map((cat) => (
        <View key={cat.name}>
          <TouchableOpacity
            style={styles.categoryHeader}
            onPress={() =>
              setExpandedCategory(expandedCategory === cat.name ? null : cat.name)
            }
          >
            <Text style={styles.categoryTitle}>{cat.name}</Text>
            <View style={styles.categoryMeta}>
              {cat.markers.some((m) => markerValues[m.name]) && (
                <View style={styles.filledBadge}>
                  <Text style={styles.filledBadgeText}>
                    {cat.markers.filter((m) => markerValues[m.name]).length}/{cat.markers.length}
                  </Text>
                </View>
              )}
              <Ionicons
                name={expandedCategory === cat.name ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.secondaryText}
              />
            </View>
          </TouchableOpacity>

          {expandedCategory === cat.name &&
            cat.markers.map((template) => {
              const val = markerValues[template.name] ?? '';
              const numVal = parseFloat(val);
              const isFlagged =
                !isNaN(numVal) &&
                ((template.defaultLow !== null && numVal < template.defaultLow) ||
                  (template.defaultHigh !== null && numVal > template.defaultHigh));

              return (
                <View key={template.name} style={styles.markerRow}>
                  <View style={styles.markerInfo}>
                    <Text style={styles.markerName}>{template.name}</Text>
                    <Text style={styles.markerRange}>
                      {template.defaultLow !== null ? template.defaultLow : ''}-
                      {template.defaultHigh !== null ? template.defaultHigh : ''} {template.unit}
                    </Text>
                  </View>
                  <View style={styles.markerInput}>
                    <TextInput
                      style={[
                        styles.valueInput,
                        isFlagged && styles.valueInputFlagged,
                      ]}
                      value={val}
                      onChangeText={(v) => setMarkerValue(template.name, v)}
                      placeholder="--"
                      placeholderTextColor={Colors.secondaryText}
                      keyboardType="numeric"
                    />
                    {isFlagged && (
                      <Ionicons name="warning" size={16} color={Colors.warning} />
                    )}
                  </View>
                </View>
              );
            })}
        </View>
      ))}

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional notes..."
        placeholderTextColor={Colors.secondaryText}
        multiline
        numberOfLines={3}
      />

      {/* Save button */}
      <TouchableOpacity style={styles.saveBtn} onPress={savePanel} activeOpacity={0.7}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.primaryBackground} />
        <Text style={styles.saveBtnText}>Save Bloodwork</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryValue: {
    color: Colors.accent,
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: { color: Colors.secondaryText, fontSize: 13, marginTop: 4 },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  flagText: { color: Colors.warning, fontSize: 13, fontWeight: '600' },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
    marginTop: 4,
  },
  categoryTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  categoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filledBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  filledBadgeText: { color: Colors.primaryBackground, fontSize: 11, fontWeight: '700' },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  markerInfo: { flex: 1 },
  markerName: { color: Colors.text, fontSize: 13, fontWeight: '500' },
  markerRange: { color: Colors.secondaryText, fontSize: 11, marginTop: 2 },
  markerInput: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    width: 80,
    textAlign: 'center',
  },
  valueInputFlagged: { borderColor: Colors.warning },
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 24,
  },
  saveBtnText: { color: Colors.primaryBackground, fontSize: 17, fontWeight: '700' },
});
