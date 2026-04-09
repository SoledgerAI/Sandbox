// Settings > Feedback Log — Sprint 12 Feature 6
// Shows all feedback logged via @dub in Coach chat.
// Supports CSV export via share sheet.

import { useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { shareAsync } from 'expo-sharing';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { getFeedbackLog, exportFeedbackLog } from '../../src/utils/feedbackLog';
import type { FeedbackEntry } from '../../src/types/coach';

const TYPE_BADGES: Record<FeedbackEntry['type'], { icon: string; label: string; color: string }> = {
  bug: { icon: '🐛', label: 'Bug', color: Colors.danger },
  feature_request: { icon: '💡', label: 'Feature', color: Colors.accent },
  question: { icon: '❓', label: 'Question', color: Colors.secondaryText },
};

export default function FeedbackLogScreen() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getFeedbackLog().then(setEntries);
    }, []),
  );

  const handleExport = useCallback(async () => {
    if (entries.length === 0) {
      Alert.alert('No Feedback', 'No feedback entries to export yet.');
      return;
    }

    setExporting(true);
    try {
      const csv = await exportFeedbackLog();
      const path = `${cacheDirectory}dub_feedback_${new Date().toISOString().slice(0, 10)}.csv`;
      await writeAsStringAsync(path, csv);
      await shareAsync(path, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch {
      Alert.alert('Export Error', 'Failed to export feedback log.');
    } finally {
      setExporting(false);
    }
  }, [entries]);

  const renderItem = useCallback(({ item }: { item: FeedbackEntry }) => {
    const badge = TYPE_BADGES[item.type];
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return (
      <View style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <View style={[styles.typeBadge, { borderColor: badge.color }]}>
            <Text style={styles.typeBadgeIcon}>{badge.icon}</Text>
            <Text style={[styles.typeBadgeLabel, { color: badge.color }]}>{badge.label}</Text>
          </View>
          <Text style={styles.entryDate}>{dateStr} {timeStr}</Text>
        </View>
        <Text style={styles.entryDescription}>{item.description}</Text>
        {item.screen ? (
          <Text style={styles.entryScreen}>Screen: {item.screen}</Text>
        ) : null}
      </View>
    );
  }, []);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Feedback Log</Text>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={18} color={Colors.primaryBackground} />
            <Text style={styles.exportText}>Export CSV</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Feedback logged by @dub in Coach chat. Bug reports, feature requests, and questions.
        </Text>

        {entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbox-outline" size={48} color={Colors.divider} />
            <Text style={styles.emptyText}>No feedback yet</Text>
            <Text style={styles.emptySubtext}>
              Tell @dub about a bug or feature request in Coach chat — it'll appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  exportText: {
    color: Colors.primaryBackground,
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  list: {
    paddingBottom: 32,
  },
  entryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  typeBadgeIcon: {
    fontSize: 13,
  },
  typeBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  entryDate: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  entryDescription: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  entryScreen: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 60,
  },
  emptyText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
});
