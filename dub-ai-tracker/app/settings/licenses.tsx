// Settings > Open Source Licenses
// Displays third-party library licenses (Finding 71-2)

import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { LICENSES, groupByLicense } from '../../src/constants/licenses';
import type { LicenseEntry } from '../../src/constants/licenses';

interface SectionItem {
  type: 'header' | 'license';
  key: string;
  title?: string;
  count?: number;
  entry?: LicenseEntry;
}

export default function LicensesScreen() {
  const sections = useMemo<SectionItem[]>(() => {
    const grouped = groupByLicense(LICENSES);
    const items: SectionItem[] = [];
    for (const [licenseType, entries] of Object.entries(grouped).sort()) {
      items.push({
        type: 'header',
        key: `header_${licenseType}`,
        title: licenseType,
        count: entries.length,
      });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        items.push({
          type: 'license',
          key: entry.name,
          entry,
        });
      }
    }
    return items;
  }, []);

  const renderItem = ({ item }: { item: SectionItem }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
          <Text style={styles.sectionCount}>{item.count} packages</Text>
        </View>
      );
    }

    return (
      <View style={styles.licenseRow}>
        <Text style={styles.packageName}>{item.entry!.name}</Text>
        <Text style={styles.packageVersion}>v{item.entry!.version}</Text>
      </View>
    );
  };

  return (
    <ScreenWrapper>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Open Source Licenses</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.subtitle}>
        DUB_AI Tracker uses the following open source libraries.
        We are grateful to their authors and contributors.
      </Text>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionCount: {
    color: Colors.secondaryText,
    fontSize: 12,
  },
  licenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  packageName: {
    color: Colors.text,
    fontSize: 14,
    flex: 1,
  },
  packageVersion: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginLeft: 8,
  },
});
