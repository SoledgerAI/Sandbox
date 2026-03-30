// Health Report PDF Generator Screen
// Phase 21: Reporting, Health Report PDF, and Celebrations
//
// CRITICAL: Therapy notes are NEVER included -- not even as an option.
// CRITICAL: Mood/gratitude raw entries are NEVER included -- summary statistics only.
// Coach chat history is NEVER included.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Colors } from '../../src/constants/colors';
import {
  generateAndShareHealthReport,
  type HealthReportSection,
  type HealthReportConfig,
  SECTION_LABELS,
} from '../../src/services/pdf';

// ============================================================
// Available Sections
// CRITICAL: therapy_notes is NOT in this list. Not an option. Never.
// CRITICAL: mood_raw and gratitude_raw are NOT options. Summary stats only.
// CRITICAL: coach_history is NOT an option.
// ============================================================

const AVAILABLE_SECTIONS: HealthReportSection[] = [
  'weight_body_composition',
  'nutrition',
  'exercise',
  'sleep',
  'vital_signs',
  'bloodwork',
  'supplements',
  'medications',
  'injury_pain',
  'womens_health',
  'substance_use',
];

// ============================================================
// Date Range Presets
// ============================================================

type DateRangePreset = '30d' | '90d' | '6m' | '1y' | 'custom';

const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  '6m': 'Last 6 Months',
  '1y': 'Last Year',
  'custom': 'Custom',
};

function getDateRange(preset: DateRangePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '6m':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'custom':
      start.setDate(start.getDate() - 30); // Default to 30d for custom
      break;
  }

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return { start: fmt(start), end: fmt(end) };
}

// ============================================================
// Component
// ============================================================

export default function HealthReportScreen() {
  const [selectedSections, setSelectedSections] = useState<Set<HealthReportSection>>(
    new Set(['weight_body_composition', 'nutrition', 'exercise', 'sleep', 'vital_signs']),
  );
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30d');
  const [generating, setGenerating] = useState(false);

  const toggleSection = (section: HealthReportSection) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSections(new Set(AVAILABLE_SECTIONS));
  };

  const deselectAll = () => {
    setSelectedSections(new Set());
  };

  const handleGenerate = async () => {
    if (selectedSections.size === 0) {
      Alert.alert('No Sections Selected', 'Please select at least one section to include in the report.');
      return;
    }

    setGenerating(true);

    try {
      const { start, end } = getDateRange(dateRangePreset);
      const config: HealthReportConfig = {
        sections: Array.from(selectedSections),
        dateRange: { start, end },
        includeCharts: true,
      };

      await generateAndShareHealthReport(config);
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to generate the health report. Please try again.',
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Health Report</Text>
          <Text style={styles.subtitle}>
            Generate a PDF summary to share with your healthcare provider.
          </Text>
        </View>

        {/* Date Range */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Date Range</Text>
        </View>
        <View style={styles.dateRangeRow}>
          {(Object.keys(DATE_RANGE_LABELS) as DateRangePreset[])
            .filter((k) => k !== 'custom')
            .map((preset) => (
              <Pressable
                key={preset}
                style={[
                  styles.dateChip,
                  dateRangePreset === preset && styles.dateChipActive,
                ]}
                onPress={() => setDateRangePreset(preset)}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    dateRangePreset === preset && styles.dateChipTextActive,
                  ]}
                >
                  {DATE_RANGE_LABELS[preset]}
                </Text>
              </Pressable>
            ))}
        </View>

        {/* Section Selector */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sections to Include</Text>
          <View style={styles.selectActions}>
            <Pressable onPress={selectAll}>
              <Text style={styles.selectActionText}>Select All</Text>
            </Pressable>
            <Text style={styles.selectDivider}>|</Text>
            <Pressable onPress={deselectAll}>
              <Text style={styles.selectActionText}>Deselect All</Text>
            </Pressable>
          </View>
        </View>

        {AVAILABLE_SECTIONS.map((section) => (
          <Pressable
            key={section}
            style={styles.sectionRow}
            onPress={() => toggleSection(section)}
          >
            <View
              style={[
                styles.checkbox,
                selectedSections.has(section) && styles.checkboxActive,
              ]}
            >
              {selectedSections.has(section) && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.sectionLabel}>{SECTION_LABELS[section]}</Text>
          </Pressable>
        ))}

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Text style={styles.privacyTitle}>Privacy Protections</Text>
          <Text style={styles.privacyText}>
            The following are never included in Health Reports:
          </Text>
          <Text style={styles.privacyItem}>- Therapy notes (excluded entirely)</Text>
          <Text style={styles.privacyItem}>- Raw mood/gratitude entries (summary stats only)</Text>
          <Text style={styles.privacyItem}>- Coach chat history</Text>
          <Text style={styles.privacyItem}>- Progress photos (unless explicitly selected)</Text>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This report is generated from self-reported data and has not been verified
            by a healthcare professional. Share with your provider for context, not as
            a substitute for clinical evaluation.
          </Text>
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color={Colors.primaryBackground} size="small" />
          ) : (
            <Text style={styles.generateButtonText}>Generate PDF</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.secondaryText,
    marginTop: 4,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accent,
  },
  selectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectActionText: {
    fontSize: 13,
    color: Colors.accent,
  },
  selectDivider: {
    color: Colors.divider,
  },
  dateRangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  dateChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dateChipText: {
    fontSize: 13,
    color: Colors.secondaryText,
  },
  dateChipTextActive: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.divider,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  privacyNotice: {
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 13,
    color: Colors.secondaryText,
    marginBottom: 4,
  },
  privacyItem: {
    fontSize: 13,
    color: Colors.secondaryText,
    paddingLeft: 8,
    lineHeight: 20,
  },
  disclaimer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.inputBackground,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.secondaryText,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.primaryBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  generateButton: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryBackground,
  },
});
