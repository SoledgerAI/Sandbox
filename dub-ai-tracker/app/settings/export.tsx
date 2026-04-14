// Settings > Data Export
// Sprint 26: CSV (per data type) + PDF Wellness Summary
// Accessible from Profile > Export My Data

import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { DateRangePicker } from '../../src/components/common/DateRangePicker';
import {
  runExport,
  type ExportFormat,
  type DatePreset,
  type ExportOptions,
} from '../../src/services/exportService';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

export default function ExportScreen() {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [includeJournal, setIncludeJournal] = useState(false);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 30 * 86400000),
    end: new Date(),
  });

  function handleJournalToggle(value: boolean) {
    if (value) {
      Alert.alert(
        'Include Private Journal Entries',
        'Journal entries may contain sensitive personal content. They will be included in the exported file.\n\nOnly share this export with people you trust.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Include', onPress: () => setIncludeJournal(true) },
        ],
      );
    } else {
      setIncludeJournal(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const options: ExportOptions = {
        format,
        datePreset,
        customRange: datePreset === 'custom' ? customRange : undefined,
        includeJournal,
      };
      await runExport(options);
    } catch {
      Alert.alert('Export Failed', 'Unable to export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Export My Data</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.infoText}>
            Export your health data for doctor visits, personal records, or backup.
            Choose CSV for raw data or PDF for a wellness summary.
          </Text>
        </View>

        {/* Format Selector */}
        <Text style={styles.sectionLabel}>Format</Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[styles.formatBtn, format === 'csv' && styles.formatBtnActive]}
            onPress={() => setFormat('csv')}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={16} color={format === 'csv' ? Colors.primaryBackground : Colors.text} />
            <Text style={[styles.formatBtnText, format === 'csv' && styles.formatBtnTextActive]}>CSV Data</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formatBtn, format === 'pdf' && styles.formatBtnActive]}
            onPress={() => setFormat('pdf')}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={16} color={format === 'pdf' ? Colors.primaryBackground : Colors.text} />
            <Text style={[styles.formatBtnText, format === 'pdf' && styles.formatBtnTextActive]}>PDF Summary</Text>
          </TouchableOpacity>
        </View>

        {/* Format description */}
        <View style={styles.detailCard}>
          {format === 'csv' ? (
            <>
              <Text style={styles.detailTitle}>CSV Export</Text>
              <Text style={styles.detailDesc}>
                All your logged data organized by type (sleep, mood, food, exercise, medications, etc.)
                in a single CSV file. Ideal for spreadsheets or personal archives.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.detailTitle}>PDF Wellness Summary</Text>
              <Text style={styles.detailDesc}>
                A one-page wellness report with compliance averages, sleep stats, mood trends,
                stress triggers, medication adherence, weight changes, and exercise totals.
                Designed for sharing with your doctor.
              </Text>
            </>
          )}
        </View>

        {/* Date Range */}
        <Text style={styles.sectionLabel}>Date Range</Text>
        <View style={styles.presetRow}>
          {DATE_PRESETS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.presetBtn, datePreset === p.key && styles.presetBtnActive]}
              onPress={() => setDatePreset(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetBtnText, datePreset === p.key && styles.presetBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {datePreset === 'custom' && (
          <DateRangePicker
            currentRange={customRange}
            onRangeChange={setCustomRange}
          />
        )}

        {/* Privacy Controls (CSV only) */}
        {format === 'csv' && (
          <View style={styles.privacyCard}>
            <Text style={styles.detailTitle}>Privacy</Text>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleLabel}>Include private journal entries</Text>
                <Text style={styles.toggleDesc}>
                  Journal entries are excluded by default for privacy
                </Text>
              </View>
              <Switch
                value={includeJournal}
                onValueChange={handleJournalToggle}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>

            <View style={styles.privacyNote}>
              <DetailItem label="Therapy notes are always stripped" warning />
              <DetailItem label="Intimacy data is never exported" warning />
              <DetailItem label="API keys are never included" warning />
              <DetailItem label="Coach conversations are not included" warning />
            </View>
          </View>
        )}

        {/* What's Included */}
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>What's included:</Text>
          <DetailItem label="All daily logs (sleep, food, workouts, mood, etc.)" />
          <DetailItem label="Body measurements and health markers" />
          <DetailItem label="Medications, supplements, bloodwork" />
          <DetailItem label="Migraines, stress, meditation, habits" />
          <DetailItem label="Cycle tracking, digestive, injuries" />
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitleWarning}>What's excluded:</Text>
          <DetailItem label="Therapy notes (privacy protection)" warning />
          <DetailItem label="Intimacy / sexual health data" warning />
          <DetailItem label="Journal entries (unless toggled on)" warning />
          <DetailItem label="API keys (secure enclave)" warning />
          <DetailItem label="Coach DUB conversations" warning />
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.7}
        >
          {exporting ? (
            <ActivityIndicator color={Colors.primaryBackground} />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color={Colors.primaryBackground} />
              <Text style={styles.exportButtonText}>
                Export {format === 'csv' ? 'CSV Data' : 'PDF Summary'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Your exported data may contain sensitive health information. Store it securely
          and be cautious about sharing.
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

function DetailItem({ label, warning }: { label: string; warning?: boolean }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons
        name={warning ? 'close-circle-outline' : 'checkmark-circle-outline'}
        size={16}
        color={warning ? Colors.warning : Colors.success}
      />
      <Text style={styles.detailItemText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: { color: Colors.secondaryText, fontSize: 13, lineHeight: 18, flex: 1 },
  sectionLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  formatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.cardBackground,
  },
  formatBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  formatBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  formatBtnTextActive: {
    color: Colors.primaryBackground,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.cardBackground,
  },
  presetBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  presetBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  presetBtnTextActive: {
    color: Colors.primaryBackground,
  },
  detailCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailTitle: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  detailTitleWarning: { color: Colors.warning, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  detailDesc: { color: Colors.secondaryText, fontSize: 13, lineHeight: 18 },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  detailItemText: { color: Colors.secondaryText, fontSize: 13, flex: 1 },
  privacyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  toggleDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  privacyNote: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 10,
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  exportButtonDisabled: { opacity: 0.5 },
  exportButtonText: { color: Colors.primaryBackground, fontSize: 16, fontWeight: '600' },
  disclaimer: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
