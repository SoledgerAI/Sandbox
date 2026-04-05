// Settings > Data Export
// Phase 17: Settings and Profile Management
// JSON and CSV export of all user data

import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { shareAsync } from 'expo-sharing';
import { Colors } from '../../src/constants/colors';
import { logAuditEvent } from '../../src/utils/audit';

type ExportFormat = 'json' | 'csv';

// Strip therapy notes from export data
function stripTherapyNotes(key: string, parsed: unknown): unknown {
  if (!key.includes('log.therapy')) return parsed;
  if (Array.isArray(parsed)) {
    return parsed.map((entry: Record<string, unknown>) => {
      const { notes, ...rest } = entry;
      return rest;
    });
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const { notes, ...rest } = parsed as Record<string, unknown>;
    return rest;
  }
  return parsed;
}

// Convert a flat array of objects to CSV string
function arrayToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h];
      if (v == null) return '';
      const str = String(v);
      // Escape CSV: wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

// Flatten a nested object for CSV with a category prefix
function flattenEntries(
  key: string,
  data: unknown,
  category: string,
): Record<string, unknown>[] {
  const dateMatch = key.match(/\.(\d{4}-\d{2}-\d{2})$/);
  const date = dateMatch ? dateMatch[1] : '';

  if (Array.isArray(data)) {
    return data.map((entry) => {
      const flat: Record<string, unknown> = { category, date };
      if (typeof entry === 'object' && entry !== null) {
        for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            // Flatten one level of nesting (e.g., computed_nutrition, food_item)
            for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
              if (typeof nv !== 'object') {
                flat[`${k}_${nk}`] = nv;
              }
            }
          } else if (Array.isArray(v)) {
            flat[k] = v.join('; ');
          } else {
            flat[k] = v;
          }
        }
      } else {
        flat.value = entry;
      }
      return flat;
    });
  }

  if (typeof data === 'object' && data !== null) {
    const flat: Record<string, unknown> = { category, date };
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v !== 'object' || v === null) {
        flat[k] = v;
      } else if (Array.isArray(v)) {
        flat[k] = v.join('; ');
      }
    }
    return [flat];
  }

  return [{ category, date, value: data }];
}

export default function ExportScreen() {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('json');

  async function gatherExportData() {
    const allKeys = await AsyncStorage.getAllKeys();
    const dubKeys = allKeys.filter(
      (k) => k.startsWith('dub.') && !k.startsWith('dub.audit.'),
    );
    const pairs = await AsyncStorage.multiGet(dubKeys);

    const exportData: Record<string, unknown> = {};
    const sections: string[] = [];

    for (const [key, value] of pairs) {
      if (value != null) {
        try {
          const parsed = JSON.parse(value);
          exportData[key] = stripTherapyNotes(key, parsed);
        } catch {
          exportData[key] = value;
        }
        const section = key.split('.').slice(0, 2).join('.');
        if (!sections.includes(section)) sections.push(section);
      }
    }

    return { exportData, sections, dubKeys };
  }

  async function handleExportJSON() {
    const { exportData, sections, dubKeys } = await gatherExportData();

    const exportPayload = {
      app: 'DUB_AI Tracker',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      note: 'Therapy notes are excluded from exports for privacy. Audit logs are retained separately.',
      data: exportData,
    };

    const json = JSON.stringify(exportPayload, null, 2);

    await logAuditEvent('DATA_EXPORT', {
      format: 'json',
      sections_included: sections,
      key_count: dubKeys.length,
    });

    await Share.share({
      message: json,
      title: 'DUB_AI Data Export',
    });
  }

  async function handleExportCSV() {
    const { exportData, sections, dubKeys } = await gatherExportData();

    // Flatten all log entries into rows grouped by category
    const allRows: Record<string, unknown>[] = [];

    for (const [key, data] of Object.entries(exportData)) {
      if (!key.startsWith('dub.log.')) continue;
      const category = key
        .replace(/^dub\.log\./, '')
        .replace(/\.\d{4}-\d{2}-\d{2}$/, '');
      const rows = flattenEntries(key, data, category);
      allRows.push(...rows);
    }

    // Sort by date then category
    allRows.sort((a, b) => {
      const da = String(a.date ?? '');
      const db = String(b.date ?? '');
      if (da !== db) return da.localeCompare(db);
      return String(a.category ?? '').localeCompare(String(b.category ?? ''));
    });

    // Collect all unique column headers
    const headerSet = new Set<string>();
    for (const row of allRows) {
      for (const k of Object.keys(row)) headerSet.add(k);
    }
    const headers = ['category', 'date', ...Array.from(headerSet).filter((h) => h !== 'category' && h !== 'date').sort()];

    // Build CSV with unified headers
    const csvLines = [headers.join(',')];
    for (const row of allRows) {
      const values = headers.map((h) => {
        const v = row[h];
        if (v == null) return '';
        const str = String(v);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvLines.push(values.join(','));
    }

    const csvContent = csvLines.join('\n');
    const fileName = `dub_ai_export_${new Date().toISOString().slice(0, 10)}.csv`;
    const filePath = `${cacheDirectory}${fileName}`;

    await writeAsStringAsync(filePath, csvContent, {
      encoding: EncodingType.UTF8,
    });

    await logAuditEvent('DATA_EXPORT', {
      format: 'csv',
      sections_included: sections,
      key_count: dubKeys.length,
      row_count: allRows.length,
    });

    await shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: 'DUB_AI CSV Export',
      UTI: 'public.comma-separated-values-text',
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      if (format === 'csv') {
        await handleExportCSV();
      } else {
        await handleExportJSON();
      }
    } catch {
      Alert.alert('Export Failed', 'Unable to export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Data Export</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
        <Text style={styles.infoText}>
          Export all your DUB_AI data for backup or transfer. Choose JSON for a
          complete archive or CSV for spreadsheet analysis.
        </Text>
      </View>

      {/* Format selector */}
      <View style={styles.formatRow}>
        <TouchableOpacity
          style={[styles.formatBtn, format === 'json' && styles.formatBtnActive]}
          onPress={() => setFormat('json')}
          activeOpacity={0.7}
        >
          <Ionicons name="code-slash-outline" size={16} color={format === 'json' ? Colors.primaryBackground : Colors.text} />
          <Text style={[styles.formatBtnText, format === 'json' && styles.formatBtnTextActive]}>JSON</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.formatBtn, format === 'csv' && styles.formatBtnActive]}
          onPress={() => setFormat('csv')}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={16} color={format === 'csv' ? Colors.primaryBackground : Colors.text} />
          <Text style={[styles.formatBtnText, format === 'csv' && styles.formatBtnTextActive]}>CSV</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>What's included:</Text>
        <DetailItem label="Profile and settings" />
        <DetailItem label="All daily logs (food, water, workouts, etc.)" />
        <DetailItem label="Body measurements and health markers" />
        <DetailItem label="Coach conversation history" />
        <DetailItem label="Streak and recovery data" />
        <DetailItem label="Device sync states" />
        {format === 'csv' && (
          <DetailItem label="Flattened log entries with date and category columns" />
        )}
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.detailTitleWarning}>What's excluded:</Text>
        <DetailItem label="Therapy notes (privacy protection)" warning />
        <DetailItem label="Audit logs (retained for compliance)" warning />
        <DetailItem label="API keys (stored in secure enclave)" warning />
      </View>

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
              Export All Data ({format === 'csv' ? 'CSV' : 'JSON'})
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Your exported data may contain sensitive health information. Store it securely
        and be cautious about sharing.
      </Text>
    </ScrollView>
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
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
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
  formatRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
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
  detailCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailTitle: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  detailTitleWarning: { color: Colors.warning, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  detailItemText: { color: Colors.secondaryText, fontSize: 13, flex: 1 },
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
