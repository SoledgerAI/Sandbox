// Settings > Data Export
// Phase 17: Settings and Profile Management
// JSON export of all user data

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
import { Colors } from '../../src/constants/colors';
import { logAuditEvent } from '../../src/utils/audit';

export default function ExportScreen() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const dubKeys = allKeys.filter(
        (k) => k.startsWith('dub.') && !k.startsWith('dub.audit.'),
      );
      const pairs = await AsyncStorage.multiGet(dubKeys);

      const exportData: Record<string, unknown> = {};
      const sections: string[] = [];

      for (const [key, value] of pairs) {
        if (value != null) {
          // Exclude therapy notes from export per Section 17 #6
          try {
            const parsed = JSON.parse(value);
            if (key.includes('log.therapy')) {
              // Export therapy entries without the notes field
              if (Array.isArray(parsed)) {
                exportData[key] = parsed.map((entry: Record<string, unknown>) => {
                  const { notes, ...rest } = entry;
                  return rest;
                });
              } else if (typeof parsed === 'object' && parsed !== null) {
                const { notes, ...rest } = parsed as Record<string, unknown>;
                exportData[key] = rest;
              } else {
                exportData[key] = parsed;
              }
            } else {
              exportData[key] = parsed;
            }
          } catch {
            exportData[key] = value;
          }

          const section = key.split('.').slice(0, 2).join('.');
          if (!sections.includes(section)) sections.push(section);
        }
      }

      const exportPayload = {
        app: 'DUB_AI Tracker',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        note: 'Therapy notes are excluded from exports for privacy. Audit logs are retained separately.',
        data: exportData,
      };

      const json = JSON.stringify(exportPayload, null, 2);

      await logAuditEvent('DATA_EXPORT', {
        sections_included: sections,
        key_count: dubKeys.length,
      });

      await Share.share({
        message: json,
        title: 'DUB_AI Data Export',
      });
    } catch (error) {
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
          Export all your DUB_AI data as a JSON file. This includes your profile,
          settings, logs, and all tracked data. You can use this for backup or to
          transfer your data.
        </Text>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>What's included:</Text>
        <DetailItem label="Profile and settings" />
        <DetailItem label="All daily logs (food, water, workouts, etc.)" />
        <DetailItem label="Body measurements and health markers" />
        <DetailItem label="Coach conversation history" />
        <DetailItem label="Streak and recovery data" />
        <DetailItem label="Device sync states" />
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
            <Text style={styles.exportButtonText}>Export All Data (JSON)</Text>
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
